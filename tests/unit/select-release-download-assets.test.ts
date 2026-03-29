import { describe, expect, it } from 'vitest';
import { selectReleaseDownloadAssets } from '../../scripts/select-release-download-assets.mjs';

describe('select release download assets', () => {
  it('prefers the newest matching asset when the same tag contains stale package files', () => {
    const result = selectReleaseDownloadAssets([
      {
        tag_name: 'v2026.3.29-beta.0',
        assets: [
          {
            name: 'XClaw-2026.3.28-mac-arm64.dmg',
            size: 101,
            updated_at: '2026-03-28T16:16:58Z',
            browser_download_url: 'https://example.com/old-mac-arm64',
          },
          {
            name: 'XClaw-2026.3.29-mac-arm64.dmg',
            size: 202,
            updated_at: '2026-03-29T12:36:53Z',
            browser_download_url: 'https://example.com/new-mac-arm64',
          },
          {
            name: 'XClaw-2026.3.28-mac-x64.dmg',
            size: 303,
            updated_at: '2026-03-28T16:16:57Z',
            browser_download_url: 'https://example.com/old-mac-x64',
          },
          {
            name: 'XClaw-2026.3.29-mac-x64.dmg',
            size: 404,
            updated_at: '2026-03-29T12:36:53Z',
            browser_download_url: 'https://example.com/new-mac-x64',
          },
          {
            name: 'XClaw-2026.3.28-win-x64.exe',
            size: 505,
            updated_at: '2026-03-28T16:16:57Z',
            browser_download_url: 'https://example.com/old-win',
          },
          {
            name: 'XClaw-2026.3.29-win-x64.exe',
            size: 606,
            updated_at: '2026-03-29T12:36:52Z',
            browser_download_url: 'https://example.com/new-win',
          },
        ],
      },
    ]);

    expect(result.tag).toBe('v2026.3.29-beta.0');
    expect(result.downloads.macArm64.name).toBe('XClaw-2026.3.29-mac-arm64.dmg');
    expect(result.downloads.macX64.name).toBe('XClaw-2026.3.29-mac-x64.dmg');
    expect(result.downloads.win.name).toBe('XClaw-2026.3.29-win-x64.exe');
  });

  it('fails when a required download asset is missing', () => {
    expect(() =>
      selectReleaseDownloadAssets([
        {
          tag_name: 'v2026.3.29-beta.0',
          assets: [
            {
              name: 'XClaw-2026.3.29-mac-arm64.dmg',
              size: 202,
              updated_at: '2026-03-29T12:36:53Z',
              browser_download_url: 'https://example.com/new-mac-arm64',
            },
          ],
        },
      ]),
    ).toThrow('Required asset was not found for macX64.');
  });
});
