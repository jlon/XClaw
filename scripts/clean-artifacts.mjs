import { rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(scriptDir, '..');
const args = new Set(process.argv.slice(2));
const baseTargets = ['.DS_Store', 'dist', 'dist-electron', 'release', 'test-results'];
const deepTargets = ['build'];
const targets = [...baseTargets, ...(args.has('--include-build') ? deepTargets : [])];

const removeTarget = async (target) => {
  const location = resolve(rootDir, target);
  try {
    await rm(location, { recursive: true, force: true });
    console.log(`removed ${target}`);
  } catch (error) {
    console.error(`failed ${target}: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
};

await Promise.all(targets.map(removeTarget));
