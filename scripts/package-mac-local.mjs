import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import releaseBranding from '../config/release-branding.json' with { type: 'json' };

export const MIN_DARWIN_MAJOR_FOR_DMG = 22;
const require = createRequire(import.meta.url);

export const parseDarwinMajor = (release) => {
  const major = Number.parseInt(String(release).split('.')[0] ?? '', 10);
  if (!Number.isFinite(major)) {
    throw new Error(`Invalid Darwin release: ${release}`);
  }
  return major;
};

export const resolveMacLocalTargets = ({ platform = process.platform, release = os.release() } = {}) => {
  if (platform !== 'darwin') {
    throw new Error('package:mac:local can only run on macOS');
  }
  return parseDarwinMajor(release) >= MIN_DARWIN_MAJOR_FOR_DMG ? ['dir', 'dmg'] : ['dir'];
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
  release = os.release(),
  arch = process.arch,
  electronDist = resolveLocalElectronDist(),
} = {}) => {
  const args = [
    '--mac',
    ...resolveMacLocalTargets({ platform, release }),
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

const run = (command, args, env = process.env) => {
  const result = spawnSync(command, args, { stdio: 'inherit', env });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
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
  const targets = resolveMacLocalTargets({ release });
  if (targets.includes('dmg')) {
    console.log(`package:mac:local detected Darwin ${release}. building macOS targets: ${targets.join(', ')} (${arch})`);
  } else {
    console.log(
      `package:mac:local detected Darwin ${release}. local DMG packaging is skipped because electron-builder's dmg toolchain requires macOS 13+ on this host. building unpacked app for ${arch}.`,
    );
  }
  const electronDist = resolveLocalElectronDist();
  if (electronDist) {
    console.log(`package:mac:local using local electron dist: ${electronDist}`);
  } else {
    console.log('package:mac:local did not find a local electron dist. falling back to electron-builder download flow.');
  }
  run(
    'pnpm',
    ['run', 'package'],
    { ...process.env, SKIP_PREINSTALLED_SKILLS: process.env.SKIP_PREINSTALLED_SKILLS ?? '1' },
  );
  run('pnpm', ['exec', 'electron-builder', ...buildMacLocalBuilderArgs({ release, arch, electronDist })]);
  createLocalZipArtifact({ arch });
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
