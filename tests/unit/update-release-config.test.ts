import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('update release config', () => {
  it('removes oss publish and oss upload workflow from release pipeline', () => {
    const builder = readFileSync(resolve(process.cwd(), 'config/build/electron-builder.config.cjs'), 'utf8');
    const releaseWorkflow = readFileSync(resolve(process.cwd(), '.github/workflows/release.yml'), 'utf8');

    expect(builder).not.toContain('oss.intelli-spectrum.com');
    expect(releaseWorkflow).not.toContain('upload-oss:');
    expect(releaseWorkflow).not.toContain('ossutil');
    expect(releaseWorkflow).not.toContain('valuecell-XClaw');
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
