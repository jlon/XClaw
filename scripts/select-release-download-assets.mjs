import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const rules = {
  macArm64: [/-mac-arm64\.dmg$/],
  macX64: [/-mac-x64\.dmg$/],
  win: [/-win-x64\.exe$/, /-win\.exe$/, /-win-arm64\.exe$/],
};

const sortByNewestAsset = (left, right) => {
  const leftUpdated = Date.parse(left.updated_at ?? left.updatedAt ?? '') || 0;
  const rightUpdated = Date.parse(right.updated_at ?? right.updatedAt ?? '') || 0;
  if (leftUpdated !== rightUpdated) {
    return rightUpdated - leftUpdated;
  }
  const leftCreated = Date.parse(left.created_at ?? left.createdAt ?? '') || 0;
  const rightCreated = Date.parse(right.created_at ?? right.createdAt ?? '') || 0;
  if (leftCreated !== rightCreated) {
    return rightCreated - leftCreated;
  }
  return String(right.name ?? '').localeCompare(String(left.name ?? ''));
};

const selectNewestMatch = (assets, pattern) =>
  [...assets]
    .filter((asset) => pattern.test(String(asset.name ?? '')))
    .sort(sortByNewestAsset)[0] ?? null;

export const selectReleaseDownloadAssets = (payload) => {
  if (!Array.isArray(payload) || payload.length === 0) {
    throw new Error('No releases were returned by GitHub.');
  }

  const release = payload[0];
  const assets = Array.isArray(release.assets) ? release.assets : [];
  const downloads = {};

  for (const [stableName, patterns] of Object.entries(rules)) {
    let match = null;
    for (const pattern of patterns) {
      match = selectNewestMatch(assets, pattern);
      if (match) {
        break;
      }
    }
    if (!match) {
      throw new Error(`Required asset was not found for ${stableName}.`);
    }
    downloads[stableName] = {
      name: String(match.name),
      size: Number(match.size),
      updatedAt: String(match.updated_at ?? match.updatedAt ?? ''),
      url: String(match.browser_download_url ?? match.browserDownloadUrl ?? ''),
    };
  }

  return {
    tag: String(release.tag_name ?? release.tagName ?? ''),
    downloads,
  };
};

const isDirectRun = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);

if (isDirectRun) {
  const payload = JSON.parse(process.argv[2] ?? '[]');
  const result = selectReleaseDownloadAssets(payload);
  console.log(result.tag);
  for (const key of ['macArm64', 'macX64', 'win']) {
    const asset = result.downloads[key];
    console.log([key, asset.name, String(asset.size), asset.updatedAt, asset.url].join('\t'));
  }
}
