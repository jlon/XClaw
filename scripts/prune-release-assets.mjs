import { readFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const computeReleaseAssetsToDelete = ({ existingAssets, desiredAssetNames }) => {
  const desired = new Set(desiredAssetNames);
  return existingAssets
    .filter((asset) => typeof asset?.name === 'string' && !desired.has(asset.name))
    .map((asset) => ({ id: asset.id, name: asset.name }));
};

const githubApiRequest = async ({ token, path, method = 'GET' }) => {
  const response = await fetch(`https://api.github.com${path}`, {
    method,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`GitHub API request failed: ${method} ${path} -> ${response.status}`);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
};

export const pruneReleaseAssets = async ({ repo, tag, desiredAssetNames, token }) => {
  const release = await githubApiRequest({
    token,
    path: `/repos/${repo}/releases/tags/${encodeURIComponent(tag)}`,
  });

  if (!release) {
    return [];
  }

  const staleAssets = computeReleaseAssetsToDelete({
    existingAssets: Array.isArray(release.assets) ? release.assets : [],
    desiredAssetNames,
  });

  for (const asset of staleAssets) {
    await githubApiRequest({
      token,
      method: 'DELETE',
      path: `/repos/${repo}/releases/assets/${asset.id}`,
    });
  }

  return staleAssets;
};

const parseArgs = (argv) => {
  const result = { repo: '', tag: '', files: '' };
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    const value = argv[index + 1] ?? '';
    if (key === '--repo') {
      result.repo = value;
      index += 1;
    } else if (key === '--tag') {
      result.tag = value;
      index += 1;
    } else if (key === '--files') {
      result.files = value;
      index += 1;
    }
  }
  return result;
};

const isDirectRun = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);

if (isDirectRun) {
  const { repo, tag, files } = parseArgs(process.argv.slice(2));
  const token = process.env.GITHUB_TOKEN ?? '';

  if (!repo || !tag || !files || !token) {
    throw new Error('Usage: node scripts/prune-release-assets.mjs --repo <owner/repo> --tag <tag> --files <path> with GITHUB_TOKEN set');
  }

  const desiredAssetNames = readFileSync(files, 'utf8')
    .split(/\r?\n/)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => basename(entry));

  const deletedAssets = await pruneReleaseAssets({ repo, tag, desiredAssetNames, token });
  deletedAssets.forEach((asset) => console.log(`Deleted stale asset: ${asset.name}`));
}
