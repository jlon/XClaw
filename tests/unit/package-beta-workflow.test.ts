import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('beta package workflow', () => {
  it('publishes the mainstream Windows beta build through the x64 packaging script', () => {
    const workflow = readFileSync(resolve(process.cwd(), '.github/workflows/package-beta.yml'), 'utf8');
    const packageJson = JSON.parse(
      readFileSync(resolve(process.cwd(), 'package.json'), 'utf8'),
    ) as {
      scripts: Record<string, string>;
    };

    expect(packageJson.scripts['package:win:x64']).toBe(
      'pnpm run package && electron-builder -c config/build/electron-builder.win-x64.config.cjs --win --publish never',
    );
    expect(workflow).toContain('run: pnpm run package:win:x64');
  });

  it('locks the beta Windows builder config to the x64 NSIS target only', async () => {
    const builderConfigModule = await import(
      resolve(process.cwd(), 'config/build/electron-builder.win-x64.config.cjs')
    );
    const builderConfig = builderConfigModule.default ?? builderConfigModule;

    expect(builderConfig.win.target).toEqual([{ target: 'nsis', arch: ['x64'] }]);
  });
});
