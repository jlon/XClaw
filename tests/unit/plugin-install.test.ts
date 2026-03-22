import { mkdir, readFile, rm, writeFile } from 'fs/promises';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { tempRoot } = vi.hoisted(() => ({
  tempRoot: `/tmp/XClaw-plugin-install-${Math.random().toString(36).slice(2)}`,
}));

vi.mock('electron', () => ({
  app: {
    isPackaged: false,
    getAppPath: () => '/tmp',
  },
}));

vi.mock('@electron/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('patchWeixinPluginGatewayBridge', () => {
  const originalHome = process.env.HOME;

  beforeEach(async () => {
    vi.resetModules();
    process.env.HOME = tempRoot;
    await rm(tempRoot, { recursive: true, force: true });
    await mkdir(tempRoot, { recursive: true });
  });

  afterEach(() => {
    if (originalHome === undefined) {
      delete process.env.HOME;
      return;
    }
    process.env.HOME = originalHome;
  });

  it('injects dedicated xclaw weixin gateway handlers exactly once', async () => {
    const pluginDir = join(tempRoot, 'openclaw-weixin');
    await mkdir(pluginDir, { recursive: true });
    await writeFile(
      join(pluginDir, 'index.ts'),
      [
        'import type { OpenClawPluginApi } from "openclaw/plugin-sdk";',
        'import { buildChannelConfigSchema } from "openclaw/plugin-sdk";',
        'import { weixinPlugin } from "./src/channel.js";',
        'const plugin = {',
        '  register(api: OpenClawPluginApi) {',
        '    api.registerChannel({ plugin: weixinPlugin });',
        '  },',
        '};',
        'export default plugin;',
        '',
      ].join('\n'),
      'utf8',
    );

    const { patchWeixinPluginGatewayBridge } = await import('@electron/utils/plugin-install');

    patchWeixinPluginGatewayBridge(pluginDir);
    patchWeixinPluginGatewayBridge(pluginDir);

    const patched = await readFile(join(pluginDir, 'index.ts'), 'utf8');
    expect(patched.match(/xclaw\.weixin\.login\.start/g)).toHaveLength(1);
    expect(patched.match(/xclaw\.weixin\.login\.wait/g)).toHaveLength(1);
    expect(patched).toContain('api.registerGatewayMethod("xclaw.weixin.login.start"');
    expect(patched).toContain('api.registerGatewayMethod("xclaw.weixin.login.wait"');
    expect(patched).toContain('import { ErrorCodes, errorShape } from "openclaw/plugin-sdk";');
  });

  it('repairs an already-installed same-version weixin plugin that is missing the gateway bridge', async () => {
    const sourceDir = join(tempRoot, 'bundled-openclaw-weixin');
    const installedDir = join(tempRoot, '.openclaw', 'extensions', 'openclaw-weixin');
    const pluginEntry = [
      'import type { OpenClawPluginApi } from "openclaw/plugin-sdk";',
      'import { buildChannelConfigSchema } from "openclaw/plugin-sdk";',
      'import { weixinPlugin } from "./src/channel.js";',
      'const plugin = {',
      '  register(api: OpenClawPluginApi) {',
      '    api.registerChannel({ plugin: weixinPlugin });',
      '  },',
      '};',
      'export default plugin;',
      '',
    ].join('\n');

    await mkdir(sourceDir, { recursive: true });
    await mkdir(installedDir, { recursive: true });

    await writeFile(join(sourceDir, 'openclaw.plugin.json'), JSON.stringify({ id: 'openclaw-weixin' }, null, 2), 'utf8');
    await writeFile(join(sourceDir, 'package.json'), JSON.stringify({ name: '@tencent-weixin/openclaw-weixin', version: '1.0.2' }, null, 2), 'utf8');

    await writeFile(join(installedDir, 'openclaw.plugin.json'), JSON.stringify({ id: 'openclaw-weixin' }, null, 2), 'utf8');
    await writeFile(join(installedDir, 'package.json'), JSON.stringify({ name: '@tencent-weixin/openclaw-weixin', version: '1.0.2' }, null, 2), 'utf8');
    await writeFile(join(installedDir, 'index.ts'), pluginEntry, 'utf8');

    const { ensurePluginInstalled } = await import('@electron/utils/plugin-install');

    const result = ensurePluginInstalled('openclaw-weixin', [sourceDir], 'Weixin');

    expect(result).toEqual({ installed: true, changed: true });

    const repaired = await readFile(join(installedDir, 'index.ts'), 'utf8');
    expect(repaired).toContain('api.registerGatewayMethod("xclaw.weixin.login.start"');
    expect(repaired).toContain('api.registerGatewayMethod("xclaw.weixin.login.wait"');
  });

  it('repairs an already-installed same-version weixin plugin that imports the unexported gateway protocol path', async () => {
    const sourceDir = join(tempRoot, 'bundled-openclaw-weixin');
    const installedDir = join(tempRoot, '.openclaw', 'extensions', 'openclaw-weixin');
    const pluginEntry = [
      'import type { OpenClawPluginApi } from "openclaw/plugin-sdk";',
      'import { buildChannelConfigSchema } from "openclaw/plugin-sdk";',
      'import { ErrorCodes, errorShape } from "openclaw/plugin-sdk/gateway/protocol";',
      'import { weixinPlugin } from "./src/channel.js";',
      'const plugin = {',
      '  register(api: OpenClawPluginApi) {',
      '    api.registerChannel({ plugin: weixinPlugin });',
      '    api.registerGatewayMethod("xclaw.weixin.login.start", async ({ respond }) => {',
      '      respond(true, { ok: true, code: ErrorCodes.UNAVAILABLE, shape: errorShape(ErrorCodes.UNAVAILABLE, "x") });',
      '    });',
      '  },',
      '};',
      'export default plugin;',
      '',
    ].join('\n');

    await mkdir(sourceDir, { recursive: true });
    await mkdir(installedDir, { recursive: true });

    await writeFile(join(sourceDir, 'openclaw.plugin.json'), JSON.stringify({ id: 'openclaw-weixin' }, null, 2), 'utf8');
    await writeFile(join(sourceDir, 'package.json'), JSON.stringify({ name: '@tencent-weixin/openclaw-weixin', version: '1.0.2' }, null, 2), 'utf8');

    await writeFile(join(installedDir, 'openclaw.plugin.json'), JSON.stringify({ id: 'openclaw-weixin' }, null, 2), 'utf8');
    await writeFile(join(installedDir, 'package.json'), JSON.stringify({ name: '@tencent-weixin/openclaw-weixin', version: '1.0.2' }, null, 2), 'utf8');
    await writeFile(join(installedDir, 'index.ts'), pluginEntry, 'utf8');

    const { ensurePluginInstalled } = await import('@electron/utils/plugin-install');

    const result = ensurePluginInstalled('openclaw-weixin', [sourceDir], 'Weixin');

    expect(result).toEqual({ installed: true, changed: true });

    const repaired = await readFile(join(installedDir, 'index.ts'), 'utf8');
    expect(repaired).toContain('import { ErrorCodes, errorShape } from "openclaw/plugin-sdk";');
    expect(repaired).not.toContain('openclaw/plugin-sdk/gateway/protocol');
  });
});
