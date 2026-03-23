import { pathToFileURL } from 'node:url';
import { formatDateVersion, updatePackageVersion } from './version-date.mjs';

export const parseReleaseVersionArgs = (argv = process.argv.slice(2)) => {
  let githubRef = '';
  let inputVersion = '';
  let channel = 'stable';
  let writePackage = false;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--github-ref') {
      githubRef = argv[index + 1] ?? githubRef;
      index += 1;
      continue;
    }
    if (arg === '--input-version') {
      inputVersion = argv[index + 1] ?? inputVersion;
      index += 1;
      continue;
    }
    if (arg === '--channel') {
      channel = argv[index + 1] ?? channel;
      index += 1;
      continue;
    }
    if (arg === '--write-package') {
      writePackage = true;
    }
  }

  return { githubRef, inputVersion, channel, writePackage };
};

export const resolveReleaseVersion = ({
  githubRef = '',
  inputVersion = '',
  channel = 'stable',
  date = new Date(),
} = {}) => {
  const trimmedInputVersion = String(inputVersion).trim();
  const tagMatch = /^refs\/tags\/v(.+)$/.exec(String(githubRef).trim());
  if (tagMatch?.[1]) {
    return tagMatch[1];
  }
  if (trimmedInputVersion) {
    return trimmedInputVersion;
  }
  return formatDateVersion({ date, channel });
};

const main = () => {
  const { githubRef, inputVersion, channel, writePackage } = parseReleaseVersionArgs();
  const version = resolveReleaseVersion({ githubRef, inputVersion, channel });
  if (writePackage) {
    updatePackageVersion({ version });
  }
  process.stdout.write(`${version}\n`);
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
