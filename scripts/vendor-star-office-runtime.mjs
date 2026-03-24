#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { dirname, join, normalize, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, '..');
const MANIFEST_PATH = join(ROOT_DIR, 'scripts', 'star-office-runtime.manifest.json');
const OVERRIDES_ROOT = join(ROOT_DIR, 'scripts', 'star-office-runtime-overrides');

const parseArgs = () =>
  process.argv.slice(2).reduce((result, entry) => {
    const [rawKey, ...rawValue] = entry.split('=');
    const key = rawKey.replace(/^-+/, '');
    result[key] = rawValue.length > 0 ? rawValue.join('=') : '1';
    return result;
  }, {});

const ensureRelativePath = (value) => {
  const normalized = normalize(value).replace(/\\/g, '/');
  if (
    normalized.length === 0 ||
    normalized.startsWith('../') ||
    normalized.includes('/../') ||
    normalized === '..' ||
    normalized.startsWith('/')
  ) {
    throw new Error(`Invalid manifest path: ${value}`);
  }
  return normalized;
};

const formatBytes = (value) => {
  if (value < 1024) return `${value} B`;
  if (value < 1024 ** 2) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 ** 2).toFixed(1)} MB`;
};

const copyTree = (sourceDir, outputDir) => {
  for (const entry of readdirSync(sourceDir, { withFileTypes: true })) {
    const sourcePath = join(sourceDir, entry.name);
    const outputPath = join(outputDir, entry.name);
    if (entry.isDirectory()) {
      mkdirSync(outputPath, { recursive: true });
      copyTree(sourcePath, outputPath);
      continue;
    }
    mkdirSync(dirname(outputPath), { recursive: true });
    cpSync(sourcePath, outputPath, { recursive: false, dereference: true });
  }
};

const getGitWorktreeRoots = () => {
  try {
    return execFileSync('git', ['worktree', 'list', '--porcelain'], { cwd: ROOT_DIR, encoding: 'utf8' })
      .split('\n')
      .filter((line) => line.startsWith('worktree '))
      .map((line) => line.slice('worktree '.length).trim())
      .filter(Boolean);
  } catch {
    return [];
  }
};

const resolveSourceRoot = (sourceHint) => {
  const candidates = [
    sourceHint ? resolve(ROOT_DIR, sourceHint) : null,
    ...getGitWorktreeRoots().map((worktreeRoot) => resolve(worktreeRoot, sourceHint)),
  ].filter(Boolean);

  const uniqueCandidates = [...new Set(candidates)];
  const match = uniqueCandidates.find((candidate) => existsSync(candidate));
  if (match) return match;

  throw new Error(
    `Missing Star Office source directory. Tried: ${uniqueCandidates.join(', ') || '(none)'}`,
  );
};

const manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'));
const args = parseArgs();
const sourceRoot = resolveSourceRoot(args.source ?? process.env.STAR_OFFICE_SOURCE_DIR ?? manifest.sourceRoot);
const outputRoot = resolve(ROOT_DIR, manifest.outputRoot);
const files = Array.isArray(manifest.files) ? manifest.files.map(ensureRelativePath) : [];

if (files.length === 0) {
  throw new Error(`No vendored files declared in ${MANIFEST_PATH}`);
}

rmSync(outputRoot, { recursive: true, force: true });
mkdirSync(outputRoot, { recursive: true });

let totalBytes = 0;

for (const file of files) {
  const sourcePath = resolve(sourceRoot, file);
  const outputPath = resolve(outputRoot, file);
  const outputParent = dirname(outputPath);

  if (relative(sourceRoot, sourcePath).startsWith('..')) {
    throw new Error(`Resolved source escapes source root: ${file}`);
  }

  if (!existsSync(sourcePath)) {
    throw new Error(`Missing vendored source file: ${sourcePath}`);
  }

  mkdirSync(outputParent, { recursive: true });
  cpSync(sourcePath, outputPath, { recursive: false, dereference: true });
  totalBytes += statSync(sourcePath).size;
}

if (existsSync(OVERRIDES_ROOT)) {
  copyTree(OVERRIDES_ROOT, outputRoot);
}

console.log(`Vendored ${files.length} files into ${outputRoot}`);
console.log(`Source: ${sourceRoot}`);
console.log(`Size: ${formatBytes(totalBytes)}`);
