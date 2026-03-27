import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { collectReleaseAssets } from '../../scripts/collect-release-assets.mjs';

describe('collect release assets', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    tempDirs.splice(0).forEach((directory) => rmSync(directory, { recursive: true, force: true }));
  });

  it('collects only releasable asset files from downloaded workflow artifacts', () => {
    const tempRoot = mkdtempSync(join(tmpdir(), 'xclaw-release-assets-'));
    tempDirs.push(tempRoot);
    const artifactsRoot = join(tempRoot, 'release-artifacts');

    mkdirSync(join(artifactsRoot, 'beta-mac'), { recursive: true });
    mkdirSync(join(artifactsRoot, 'beta-win'), { recursive: true });
    mkdirSync(join(artifactsRoot, 'beta-linux'), { recursive: true });

    writeFileSync(join(artifactsRoot, 'beta-mac', 'XClaw-mac-arm64.dmg'), '');
    writeFileSync(join(artifactsRoot, 'beta-mac', 'XClaw-mac-arm64.dmg.blockmap'), '');
    writeFileSync(join(artifactsRoot, 'beta-mac', 'latest-mac.yml'), '');
    writeFileSync(join(artifactsRoot, 'beta-win', 'XClaw-win-x64.exe'), '');
    writeFileSync(join(artifactsRoot, 'beta-win', 'latest.yml'), '');
    writeFileSync(join(artifactsRoot, 'beta-linux', 'XClaw-linux.AppImage'), '');
    writeFileSync(join(artifactsRoot, 'beta-linux', 'builder-debug.yml'), '');
    writeFileSync(join(artifactsRoot, 'beta-linux', 'notes.txt'), '');

    expect(collectReleaseAssets(artifactsRoot, tempRoot)).toEqual([
      'release-artifacts/beta-linux/XClaw-linux.AppImage',
      'release-artifacts/beta-mac/XClaw-mac-arm64.dmg',
      'release-artifacts/beta-mac/XClaw-mac-arm64.dmg.blockmap',
      'release-artifacts/beta-mac/latest-mac.yml',
      'release-artifacts/beta-win/XClaw-win-x64.exe',
      'release-artifacts/beta-win/latest.yml',
    ]);
  });

  it('fails when no releasable assets exist', () => {
    const tempRoot = mkdtempSync(join(tmpdir(), 'xclaw-release-assets-empty-'));
    tempDirs.push(tempRoot);
    const artifactsRoot = join(tempRoot, 'release-artifacts');

    mkdirSync(artifactsRoot, { recursive: true });
    writeFileSync(join(artifactsRoot, 'builder-debug.yml'), '');

    expect(() => collectReleaseAssets(artifactsRoot, tempRoot)).toThrow(
      'No releasable assets were found under',
    );
  });
});
