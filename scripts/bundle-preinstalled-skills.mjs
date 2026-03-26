#!/usr/bin/env zx

import 'zx/globals';
import { readFileSync, existsSync, mkdirSync, rmSync, cpSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const MANIFEST_PATH = join(ROOT, 'resources', 'skills', 'preinstalled-manifest.json');
const OUTPUT_ROOT = join(ROOT, 'build', 'preinstalled-skills');
const TMP_ROOT = join(ROOT, 'build', '.tmp-preinstalled-skills');
const LOCK_PATH = join(OUTPUT_ROOT, '.preinstalled-lock.json');
const CACHE_ENV = 'XCLAW_USE_PREINSTALLED_SKILLS_CACHE';

function loadManifest() {
  if (!existsSync(MANIFEST_PATH)) {
    throw new Error(`Missing manifest: ${MANIFEST_PATH}`);
  }
  const raw = readFileSync(MANIFEST_PATH, 'utf8');
  const parsed = JSON.parse(raw);
  if (!parsed || !Array.isArray(parsed.skills)) {
    throw new Error('Invalid preinstalled-skills manifest format');
  }
  for (const item of parsed.skills) {
    if (!item.slug || !item.repo || !item.repoPath) {
      throw new Error(`Invalid manifest entry: ${JSON.stringify(item)}`);
    }
  }
  return parsed.skills;
}

function groupByRepoRef(entries) {
  const grouped = new Map();
  for (const entry of entries) {
    const ref = entry.ref || 'main';
    const key = `${entry.repo}#${ref}`;
    if (!grouped.has(key)) grouped.set(key, { repo: entry.repo, ref, entries: [] });
    grouped.get(key).entries.push(entry);
  }
  return [...grouped.values()];
}

function loadExistingLock() {
  if (!existsSync(LOCK_PATH)) return null;
  const raw = readFileSync(LOCK_PATH, 'utf8');
  const parsed = JSON.parse(raw);
  return Array.isArray(parsed?.skills) ? parsed : null;
}

function hasValidCachedBundle(entries) {
  const lock = loadExistingLock();
  if (!lock) return false;
  if (lock.skills.length !== entries.length) return false;
  const expected = new Map(entries.map((entry) => [
    entry.slug,
    {
      repo: entry.repo,
      repoPath: normalizeRepoPath(entry.repoPath),
      ref: entry.ref || 'main',
    },
  ]));
  for (const item of lock.skills) {
    const current = expected.get(item.slug);
    if (!current) return false;
    if (item.repo !== current.repo) return false;
    if (normalizeRepoPath(item.repoPath) !== current.repoPath) return false;
    if ((item.ref || 'main') !== current.ref) return false;
    const skillDir = join(OUTPUT_ROOT, item.slug);
    if (!existsSync(skillDir)) return false;
    if (!existsSync(join(skillDir, 'SKILL.md'))) return false;
  }
  return true;
}

function createRepoDirName(repo, ref) {
  return `${repo.replace(/[\\/]/g, '__')}__${ref.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
}

function toGitPath(inputPath) {
  if (process.platform !== 'win32') return inputPath;
  // Git on Windows accepts forward slashes and avoids backslash escape quirks.
  return inputPath.replace(/\\/g, '/');
}

function normalizeRepoPath(repoPath) {
  return repoPath.replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+$/, '');
}

function shouldCopySkillFile(srcPath) {
  const base = basename(srcPath);
  if (base === '.git') return false;
  if (base === '.subset.tar') return false;
  return true;
}

async function extractArchive(archiveFileName, cwd) {
  const prevCwd = $.cwd;
  $.cwd = cwd;
  try {
    try {
      await $`tar -xf ${archiveFileName}`;
      return;
    } catch (tarError) {
      if (process.platform === 'win32') {
        // Some Windows images expose bsdtar instead of tar.
        await $`bsdtar -xf ${archiveFileName}`;
        return;
      }
      throw tarError;
    }
  } finally {
    $.cwd = prevCwd;
  }
}

async function extractCompressedArchive(archiveFileName, cwd) {
  const prevCwd = $.cwd;
  $.cwd = cwd;
  try {
    try {
      await $`tar -xzf ${archiveFileName}`;
      return;
    } catch (tarError) {
      if (process.platform === 'win32') {
        await $`bsdtar -xzf ${archiveFileName}`;
        return;
      }
      throw tarError;
    }
  } finally {
    $.cwd = prevCwd;
  }
}

async function downloadFile(url, targetPath) {
  const response = await fetch(url, {
    headers: {
      'user-agent': 'XClaw build script',
      accept: 'application/octet-stream',
    },
    redirect: 'follow',
  });
  if (!response.ok) {
    throw new Error(`Download failed: ${response.status} ${response.statusText}`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  writeFileSync(targetPath, buffer);
}

async function resolveGithubCommit(repo, ref) {
  try {
    const response = await fetch(`https://api.github.com/repos/${repo}/commits/${encodeURIComponent(ref)}`, {
      headers: {
        'user-agent': 'XClaw build script',
        accept: 'application/vnd.github+json',
      },
      redirect: 'follow',
    });
    if (!response.ok) return ref;
    const payload = await response.json();
    return typeof payload?.sha === 'string' && payload.sha.trim() ? payload.sha.trim() : ref;
  } catch {
    return ref;
  }
}

async function fetchGithubArchive(repo, ref, checkoutDir) {
  const archivePath = join(checkoutDir, '.repo.tar.gz');
  const extractedDir = join(checkoutDir, '.archive-extract');
  const archiveUrls = [
    `https://codeload.github.com/${repo}/tar.gz/refs/heads/${encodeURIComponent(ref)}`,
    `https://codeload.github.com/${repo}/tar.gz/refs/tags/${encodeURIComponent(ref)}`,
    `https://api.github.com/repos/${repo}/tarball/${encodeURIComponent(ref)}`,
  ];
  let lastError = null;
  for (const url of archiveUrls) {
    try {
      await downloadFile(url, archivePath);
      rmSync(extractedDir, { recursive: true, force: true });
      mkdirSync(extractedDir, { recursive: true });
      await extractCompressedArchive(basename(archivePath), extractedDir);
      const rootDir = readdirSync(extractedDir, { withFileTypes: true }).find((entry) => entry.isDirectory());
      if (!rootDir) {
        throw new Error(`Archive root missing for ${repo}@${ref}`);
      }
      const sourceRoot = join(extractedDir, rootDir.name);
      for (const entry of readdirSync(sourceRoot)) {
        cpSync(join(sourceRoot, entry), join(checkoutDir, entry), { recursive: true, dereference: true });
      }
      rmSync(archivePath, { force: true });
      rmSync(extractedDir, { recursive: true, force: true });
      return await resolveGithubCommit(repo, ref);
    } catch (error) {
      lastError = error;
      rmSync(archivePath, { force: true });
      rmSync(extractedDir, { recursive: true, force: true });
    }
  }
  throw lastError instanceof Error ? lastError : new Error(`Failed to download GitHub archive for ${repo}@${ref}`);
}

async function fetchSparseRepo(repo, ref, paths, checkoutDir) {
  const remote = `https://github.com/${repo}.git`;
  mkdirSync(checkoutDir, { recursive: true });
  const gitCheckoutDir = toGitPath(checkoutDir);
  const archiveFileName = '.subset.tar';
  const archivePath = join(checkoutDir, archiveFileName);
  const archivePaths = [...new Set(paths.map(normalizeRepoPath))];

  await $`git init ${gitCheckoutDir}`;
  await $`git -C ${gitCheckoutDir} remote add origin ${remote}`;
  try {
    await $`git -C ${gitCheckoutDir} fetch --depth 1 origin ${ref}`;
  } catch (error) {
    if (!repo.includes('/')) {
      throw error;
    }
    echo`   git fetch failed for ${repo} @ ${ref}, falling back to GitHub archive`;
    rmSync(join(checkoutDir, '.git'), { recursive: true, force: true });
    return await fetchGithubArchive(repo, ref, checkoutDir);
  }
  // Do not checkout working tree on Windows: upstream repos may contain
  // Windows-invalid paths. Export only requested directories via git archive.
  await $`git -C ${gitCheckoutDir} archive --format=tar --output ${archiveFileName} FETCH_HEAD ${archivePaths}`;
  await extractArchive(archiveFileName, checkoutDir);
  rmSync(archivePath, { force: true });

  const commit = (await $`git -C ${gitCheckoutDir} rev-parse FETCH_HEAD`).stdout.trim();
  return commit;
}

echo`Bundling preinstalled skills...`;

if (process.env.SKIP_PREINSTALLED_SKILLS === '1') {
  echo`⏭  SKIP_PREINSTALLED_SKILLS=1 set, skipping skills fetch.`;
  process.exit(0);
}

const manifestSkills = loadManifest();

if (process.env[CACHE_ENV] === '1' && hasValidCachedBundle(manifestSkills)) {
  echo`♻️  Using cached preinstalled skills bundle from ${OUTPUT_ROOT}`;
  process.exit(0);
}

rmSync(OUTPUT_ROOT, { recursive: true, force: true });
mkdirSync(OUTPUT_ROOT, { recursive: true });
rmSync(TMP_ROOT, { recursive: true, force: true });
mkdirSync(TMP_ROOT, { recursive: true });

const lock = {
  generatedAt: new Date().toISOString(),
  skills: [],
};

const groups = groupByRepoRef(manifestSkills);
for (const group of groups) {
  const repoDir = join(TMP_ROOT, createRepoDirName(group.repo, group.ref));
  const sparsePaths = [...new Set(group.entries.map((entry) => entry.repoPath))];

  echo`Fetching ${group.repo} @ ${group.ref}`;
  const commit = await fetchSparseRepo(group.repo, group.ref, sparsePaths, repoDir);
  echo`   commit ${commit}`;

  for (const entry of group.entries) {
    const sourceDir = join(repoDir, entry.repoPath);
    const targetDir = join(OUTPUT_ROOT, entry.slug);

    if (!existsSync(sourceDir)) {
      throw new Error(`Missing source path in repo checkout: ${entry.repoPath}`);
    }

    rmSync(targetDir, { recursive: true, force: true });
    cpSync(sourceDir, targetDir, { recursive: true, dereference: true, filter: shouldCopySkillFile });

    const skillManifest = join(targetDir, 'SKILL.md');
    if (!existsSync(skillManifest)) {
      throw new Error(`Skill ${entry.slug} is missing SKILL.md after copy`);
    }

    const requestedVersion = (entry.version || '').trim();
    const resolvedVersion = !requestedVersion || requestedVersion === 'main'
      ? commit
      : requestedVersion;
    lock.skills.push({
      slug: entry.slug,
      version: resolvedVersion,
      repo: entry.repo,
      repoPath: entry.repoPath,
      ref: group.ref,
      commit,
    });

    echo`   OK ${entry.slug}`;
  }
}

writeFileSync(LOCK_PATH, `${JSON.stringify(lock, null, 2)}\n`, 'utf8');
rmSync(TMP_ROOT, { recursive: true, force: true });
echo`Preinstalled skills ready: ${OUTPUT_ROOT}`;
