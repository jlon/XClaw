import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('update release config', () => {
  it('keeps the updater feed on beta and preserves Windows beta packaging on x64 only', () => {
    const builder = readFileSync(resolve(process.cwd(), 'config/build/electron-builder.config.cjs'), 'utf8');
    const updateFeeds = readFileSync(resolve(process.cwd(), 'config/build/update-feeds.json'), 'utf8');
    const betaWorkflow = readFileSync(resolve(process.cwd(), '.github/workflows/package-beta.yml'), 'utf8');

    expect(builder).toContain('provider: \'generic\'');
    expect(builder).toContain('updateFeeds.channels.beta');
    expect(builder).toContain('generateUpdatesFilesForAllChannels');
    expect(updateFeeds).toContain('"baseUrl": "https://www.xclaw.live/downloads/updates"');
    expect(updateFeeds).toContain('"beta": "beta"');
    expect(betaWorkflow).toContain('run: pnpm run package:win:x64');
    expect(betaWorkflow).toContain('release/*.blockmap');
    expect(betaWorkflow).toContain('release/*.yml');
    expect(betaWorkflow).toContain('release-artifacts/**/*.blockmap');
    expect(betaWorkflow).toContain('release-artifacts/**/*.zip');
  });

  it('removes legacy upstream website and issue links from packaged update surfaces', () => {
    const menu = readFileSync(resolve(process.cwd(), 'electron/main/menu.ts'), 'utf8');
    const cliScripts = [
      'resources/cli/posix/openclaw',
      'resources/cli/win32/openclaw.cmd',
    ]
      .map((relativePath) => readFileSync(resolve(process.cwd(), relativePath), 'utf8'))
      .join('\n');

    expect(menu).not.toContain('https://claw-x.com');
    expect(menu).not.toContain('https://github.com/jlon/XClaw/issues');
    expect(cliScripts).not.toContain('https://claw-x.com');
    expect(cliScripts).not.toContain('Check for Updates');
  });
});
