import { fileURLToPath } from 'node:url';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { basename, relative, resolve, sep } from 'node:path';

const releaseAssetSuffixes = [
  '.dmg',
  '.zip',
  '.blockmap',
  '.exe',
  '.AppImage',
  '.deb',
  '.rpm',
  '.yml',
];

const toPosix = (value) => value.split(sep).join('/');

const walkFiles = (rootDir) =>
  readdirSync(rootDir, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = resolve(rootDir, entry.name);
    if (entry.isDirectory()) {
      return walkFiles(entryPath);
    }
    if (entry.isFile()) {
      return [entryPath];
    }
    return [];
  });

const isReleaseAsset = (filePath) =>
  basename(filePath) !== 'builder-debug.yml'
  && releaseAssetSuffixes.some((suffix) => filePath.endsWith(suffix));

export const collectReleaseAssets = (rootDir, cwd = process.cwd()) => {
  const absoluteRootDir = resolve(rootDir);
  if (!existsSync(absoluteRootDir) || !statSync(absoluteRootDir).isDirectory()) {
    throw new Error(`Release artifact directory does not exist: ${rootDir}`);
  }

  const files = walkFiles(absoluteRootDir)
    .filter(isReleaseAsset)
    .map((filePath) => toPosix(relative(cwd, filePath)))
    .sort();

  if (files.length === 0) {
    throw new Error(`No releasable assets were found under ${rootDir}`);
  }

  return files;
};

const isDirectRun = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);

if (isDirectRun) {
  const rootDir = process.argv[2];
  if (!rootDir) {
    console.error('Usage: node scripts/collect-release-assets.mjs <artifact-dir>');
    process.exit(1);
  }

  try {
    process.stdout.write(`${collectReleaseAssets(rootDir).join('\n')}\n`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
