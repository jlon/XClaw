import { describe, expect, it } from 'vitest';
import { computeReleaseAssetsToDelete } from '../../scripts/prune-release-assets.mjs';

describe('prune release assets', () => {
  it('drops stale package files from a rerun on the same release tag', () => {
    const assetsToDelete = computeReleaseAssetsToDelete({
      desiredAssetNames: [
        'XClaw-2026.3.29-mac-arm64.dmg',
        'XClaw-2026.3.29-mac-x64.dmg',
        'XClaw-2026.3.29-win-x64.exe',
        'latest-mac.yml',
        'latest.yml',
      ],
      existingAssets: [
        { id: 1, name: 'XClaw-2026.3.28-mac-arm64.dmg' },
        { id: 2, name: 'XClaw-2026.3.28-mac-x64.dmg' },
        { id: 3, name: 'XClaw-2026.3.28-win-x64.exe' },
        { id: 4, name: 'XClaw-2026.3.29-mac-arm64.dmg' },
        { id: 5, name: 'XClaw-2026.3.29-mac-x64.dmg' },
        { id: 6, name: 'XClaw-2026.3.29-win-x64.exe' },
        { id: 7, name: 'latest-mac.yml' },
        { id: 8, name: 'latest.yml' },
      ],
    });

    expect(assetsToDelete).toEqual([
      { id: 1, name: 'XClaw-2026.3.28-mac-arm64.dmg' },
      { id: 2, name: 'XClaw-2026.3.28-mac-x64.dmg' },
      { id: 3, name: 'XClaw-2026.3.28-win-x64.exe' },
    ]);
  });

  it('keeps all assets when the release already matches the desired file set', () => {
    const assetsToDelete = computeReleaseAssetsToDelete({
      desiredAssetNames: [
        'XClaw-2026.3.29-mac-arm64.dmg',
        'XClaw-2026.3.29-mac-x64.dmg',
        'XClaw-2026.3.29-win-x64.exe',
      ],
      existingAssets: [
        { id: 4, name: 'XClaw-2026.3.29-mac-arm64.dmg' },
        { id: 5, name: 'XClaw-2026.3.29-mac-x64.dmg' },
        { id: 6, name: 'XClaw-2026.3.29-win-x64.exe' },
      ],
    });

    expect(assetsToDelete).toEqual([]);
  });
});
