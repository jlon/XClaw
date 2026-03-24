import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import releaseBranding from '../config/release-branding.json' with { type: 'json' };

const require = createRequire(import.meta.url);

export const resolveMacLocalTargets = ({ platform = process.platform } = {}) => {
  if (platform !== 'darwin') {
    throw new Error('package:mac:local can only run on macOS');
  }
  return ['dir', 'dmg'];
};

export const resolveMacLocalArchArg = ({ arch = process.arch } = {}) => {
  if (arch === 'x64') return '--x64';
  if (arch === 'arm64') return '--arm64';
  throw new Error(`Unsupported macOS architecture: ${arch}`);
};

export const resolveLocalElectronDist = ({ candidatePath } = {}) => {
  const distPath = candidatePath ?? path.join(path.dirname(require.resolve('electron/package.json')), 'dist');
  return existsSync(distPath) ? distPath : null;
};

export const buildMacLocalBuilderArgs = ({
  platform = process.platform,
  arch = process.arch,
  electronDist = resolveLocalElectronDist(),
  targets = resolveMacLocalTargets({ platform }),
} = {}) => {
  const args = [
    '-c',
    'config/build/electron-builder.config.cjs',
    '--mac',
    ...targets,
    resolveMacLocalArchArg({ arch }),
    '--publish',
    'never',
    '-c.mac.notarize=false',
  ];

  if (electronDist) {
    args.push(`-c.electronDist=${electronDist}`);
  }

  return args;
};

const run = (command, args, env = process.env) => spawnSync(command, args, { stdio: 'inherit', env });

const runOrExit = (command, args, env = process.env) => {
  const result = run(command, args, env);
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
  return result;
};

const readPackageVersion = () =>
  JSON.parse(readFileSync(path.resolve(process.cwd(), 'package.json'), 'utf8')).version;

const createLocalZipArtifact = ({ arch = process.arch } = {}) => {
  const appPath = path.resolve(process.cwd(), 'release', 'mac', `${releaseBranding.productName}.app`);
  if (!existsSync(appPath)) {
    throw new Error(`Packaged app not found: ${appPath}`);
  }

  const zipPath = path.resolve(
    process.cwd(),
    'release',
    `${releaseBranding.productName}-${readPackageVersion()}-mac-${arch}-local.zip`,
  );

  rmSync(zipPath, { force: true });
  run('ditto', ['-c', '-k', '--sequesterRsrc', '--keepParent', appPath, zipPath]);
  run('unzip', ['-t', zipPath]);
  console.log(`package:mac:local artifact ready: ${zipPath}`);
};

const main = () => {
  const release = os.release();
  const arch = process.arch;
  const targets = resolveMacLocalTargets();
  console.log(`package:mac:local detected Darwin ${release}. attempting macOS targets: ${targets.join(', ')} (${arch})`);
  const electronDist = resolveLocalElectronDist();
  if (electronDist) {
    console.log(`package:mac:local using local electron dist: ${electronDist}`);
  } else {
    console.log('package:mac:local did not find a local electron dist. falling back to electron-builder download flow.');
  }
  runOrExit(
    'pnpm',
    ['run', 'package'],
    { ...process.env, SKIP_PREINSTALLED_SKILLS: process.env.SKIP_PREINSTALLED_SKILLS ?? '1' },
  );
  const builderResult = run('pnpm', ['exec', 'electron-builder', ...buildMacLocalBuilderArgs({ arch, electronDist, targets })]);
  if (builderResult.error) {
    throw builderResult.error;
  }
  if (builderResult.status !== 0) {
    console.warn(`package:mac:local DMG packaging failed on Darwin ${release}. retrying with unpacked app only.`);
    runOrExit('pnpm', ['exec', 'electron-builder', ...buildMacLocalBuilderArgs({ arch, electronDist, targets: ['dir'] })]);
  }
  createLocalZipArtifact({ arch });
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
