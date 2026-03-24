import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const run = (command, args, env = process.env) => {
  const result = spawnSync(command, args, { stdio: 'inherit', env });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
};

const main = () => {
  run(
    'pnpm',
    ['run', 'package'],
    { ...process.env, SKIP_PREINSTALLED_SKILLS: process.env.SKIP_PREINSTALLED_SKILLS ?? '1' },
  );
  run(
    'pnpm',
    [
      'exec',
      'electron-builder',
      '-c',
      'config/build/electron-builder.config.cjs',
      '--mac',
      'dmg',
      '--x64',
      '--arm64',
      '--publish',
      'never',
      '-c.mac.notarize=false',
      '-c.mac.identity=-',
    ],
    { ...process.env, CSC_IDENTITY_AUTO_DISCOVERY: 'false' },
  );
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
