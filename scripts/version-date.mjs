import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const VALID_CHANNELS = new Set(['stable', 'beta', 'dev']);

export const formatDateVersion = ({ date = new Date(), channel = 'stable' } = {}) => {
  if (!VALID_CHANNELS.has(channel)) {
    throw new Error(`Unsupported release channel: ${channel}`);
  }
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const base = `${year}.${month}.${day}`;
  return channel === 'stable' ? base : `${base}-${channel}.0`;
};

export const parseVersionDateArgs = (argv = process.argv.slice(2)) => {
  let channel = 'stable';
  let date = new Date();

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--') {
      continue;
    }
    if (arg === '--channel') {
      channel = argv[index + 1] ?? channel;
      index += 1;
      continue;
    }
    if (arg === '--date') {
      const raw = argv[index + 1];
      if (!raw) {
        throw new Error('Missing value for --date');
      }
      date = new Date(`${raw}T12:00:00`);
      index += 1;
    }
  }

  return { channel, date };
};

export const updatePackageVersion = ({ packageJsonPath = path.resolve(process.cwd(), 'package.json'), version }) => {
  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
  packageJson.version = version;
  writeFileSync(packageJsonPath, `${JSON.stringify(packageJson, null, 4)}\n`);
  return version;
};

const main = () => {
  const { channel, date } = parseVersionDateArgs();
  const version = formatDateVersion({ date, channel });
  updatePackageVersion({ version });
  process.stdout.write(`${version}\n`);
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
