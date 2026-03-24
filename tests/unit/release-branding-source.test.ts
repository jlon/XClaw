import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('release branding source', () => {
  it('drives builder metadata from a single release branding config source', async () => {
    const branding = JSON.parse(
      readFileSync(resolve(process.cwd(), 'config/release-branding.json'), 'utf8'),
    ) as {
      appId: string;
      productName: string;
      executableName: string;
      vendor: string;
      teamName: string;
      maintainerEmail: string;
      description: string;
    };
    const builderConfigModule = await import(resolve(process.cwd(), 'config/build/electron-builder.config.cjs'));
    const builderConfig = builderConfigModule.default ?? builderConfigModule;

    expect(builderConfig.appId).toBe(branding.appId);
    expect(builderConfig.productName).toBe(branding.productName);
    expect(builderConfig.win.target).toBeDefined();
    expect(builderConfig.nsis.shortcutName).toBe(branding.productName);
    expect(builderConfig.nsis.uninstallDisplayName).toBe(branding.productName);
    expect(builderConfig.linux.vendor).toBe(branding.vendor);
    expect(builderConfig.linux.maintainer).toBe(
      `${branding.teamName} <${branding.maintainerEmail}>`,
    );
    expect(builderConfig.linux.description).toBe(branding.description);
  });

  it('uses release branding config in workflow and runtime help entrypoints', () => {
    const workflow = readFileSync(resolve(process.cwd(), '.github/workflows/package-beta.yml'), 'utf8');
    const menu = readFileSync(resolve(process.cwd(), 'electron/main/menu.ts'), 'utf8');

    expect(workflow).toContain('scripts/read-release-branding.mjs');
    expect(workflow).toContain('steps.branding.outputs.github_repository');
    expect(workflow).not.toContain('XClaw - Graphical AI Assistant based on OpenClaw');
    expect(menu).toContain("from '../../config/release-branding.json'");
    expect(menu).not.toContain('https://docs.openclaw.ai');
  });
});
