import { spawnSync } from 'node:child_process';
import os from 'node:os';
import { pathToFileURL } from 'node:url';

export const MIN_DARWIN_MAJOR_FOR_DMG = 22;
export const MAC_ARCH_ARGS = ['--x64', '--arm64'];
export const LOCAL_COMPRESSION_ARGS = ['-c.compression=store'];

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
  return parseDarwinMajor(release) >= MIN_DARWIN_MAJOR_FOR_DMG ? ['dmg', 'zip'] : ['zip'];
};

export const buildMacLocalBuilderArgs = ({ platform = process.platform, release = os.release() } = {}) => [
  '--mac',
  ...resolveMacLocalTargets({ platform, release }),
  ...MAC_ARCH_ARGS,
  ...LOCAL_COMPRESSION_ARGS,
  '--publish',
  'never',
];

const run = (command, args, env = process.env) => {
  const result = spawnSync(command, args, { stdio: 'inherit', env });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
};

const main = () => {
  const release = os.release();
  const targets = resolveMacLocalTargets({ release });
  if (targets.length === 1) {
    console.log(
      `package:mac:local detected Darwin ${release}. local DMG packaging is skipped because electron-builder's dmg toolchain requires macOS 13+ on this host.`,
    );
  } else {
    console.log(`package:mac:local detected Darwin ${release}. building macOS targets: ${targets.join(', ')}`);
  }
  run('pnpm', ['run', 'package'], { ...process.env, SKIP_PREINSTALLED_SKILLS: process.env.SKIP_PREINSTALLED_SKILLS ?? '1' });
  run('pnpm', ['exec', 'electron-builder', ...buildMacLocalBuilderArgs({ release })]);
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
