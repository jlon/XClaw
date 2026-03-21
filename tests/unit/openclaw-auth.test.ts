import { mkdir, readFile, rm, writeFile } from 'fs/promises';
import { join } from 'path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { testHome, testUserData } = vi.hoisted(() => {
  const suffix = Math.random().toString(36).slice(2);
  return {
    testHome: `/tmp/XClaw-openclaw-auth-${suffix}`,
    testUserData: `/tmp/XClaw-openclaw-auth-user-data-${suffix}`,
  };
});

vi.mock('os', async () => {
  const actual = await vi.importActual<typeof import('os')>('os');
  const mocked = {
    ...actual,
    homedir: () => testHome,
  };
  return {
    ...mocked,
    default: mocked,
  };
});

vi.mock('electron', () => ({
  app: {
    isPackaged: false,
    getPath: () => testUserData,
    getVersion: () => '0.0.0-test',
  },
}));

async function writeOpenClawJson(config: unknown): Promise<void> {
  const openclawDir = join(testHome, '.openclaw');
  await mkdir(openclawDir, { recursive: true });
  await writeFile(join(openclawDir, 'openclaw.json'), JSON.stringify(config, null, 2), 'utf8');
}

async function readAuthProfiles(agentId: string): Promise<Record<string, unknown>> {
  const content = await readFile(join(testHome, '.openclaw', 'agents', agentId, 'agent', 'auth-profiles.json'), 'utf8');
  return JSON.parse(content) as Record<string, unknown>;
}

async function readOpenClawJson(): Promise<Record<string, unknown>> {
  const content = await readFile(join(testHome, '.openclaw', 'openclaw.json'), 'utf8');
  return JSON.parse(content) as Record<string, unknown>;
}

describe('saveProviderKeyToOpenClaw', () => {
  beforeEach(async () => {
    vi.resetModules();
    vi.restoreAllMocks();
    await rm(testHome, { recursive: true, force: true });
    await rm(testUserData, { recursive: true, force: true });
  });

  it('only syncs auth profiles for configured agents', async () => {
    await writeOpenClawJson({
      agents: {
        list: [
          {
            id: 'main',
            name: 'Main',
            default: true,
            workspace: '~/.openclaw/workspace',
            agentDir: '~/.openclaw/agents/main/agent',
          },
          {
            id: 'test3',
            name: 'test3',
            workspace: '~/.openclaw/workspace-test3',
            agentDir: '~/.openclaw/agents/test3/agent',
          },
        ],
      },
    });

    await mkdir(join(testHome, '.openclaw', 'agents', 'test2', 'agent'), { recursive: true });
    await writeFile(
      join(testHome, '.openclaw', 'agents', 'test2', 'agent', 'auth-profiles.json'),
      JSON.stringify({
        version: 1,
        profiles: {
          'legacy:default': {
            type: 'api_key',
            provider: 'legacy',
            key: 'legacy-key',
          },
        },
      }, null, 2),
      'utf8',
    );

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const { saveProviderKeyToOpenClaw } = await import('@electron/utils/openclaw-auth');

    await saveProviderKeyToOpenClaw('openrouter', 'sk-test');

    const mainProfiles = await readAuthProfiles('main');
    const test3Profiles = await readAuthProfiles('test3');
    const staleProfiles = await readAuthProfiles('test2');

    expect((mainProfiles.profiles as Record<string, { key: string }>)['openrouter:default'].key).toBe('sk-test');
    expect((test3Profiles.profiles as Record<string, { key: string }>)['openrouter:default'].key).toBe('sk-test');
    expect(staleProfiles.profiles).toEqual({
      'legacy:default': {
        type: 'api_key',
        provider: 'legacy',
        key: 'legacy-key',
      },
    });
    expect(logSpy).toHaveBeenCalledWith(
      'Saved API key for provider "openrouter" to OpenClaw auth-profiles (agents: main, test3)',
    );

    logSpy.mockRestore();
  });
});

describe('sanitizeOpenClawConfig', () => {
  beforeEach(async () => {
    vi.resetModules();
    vi.restoreAllMocks();
    await rm(testHome, { recursive: true, force: true });
    await rm(testUserData, { recursive: true, force: true });
  });

  it('removes stale plugin allow entries while preserving built-in runtime plugins', async () => {
    await writeOpenClawJson({
      plugins: {
        allow: ['qwen-portal-auth', 'skillhub'],
        entries: {
          'qwen-portal-auth': { enabled: true },
          skillhub: { enabled: true, config: { primaryCli: 'skillhub' } },
        },
      },
    });

    const { sanitizeOpenClawConfig } = await import('@electron/utils/openclaw-auth');

    await sanitizeOpenClawConfig();

    const result = await readOpenClawJson();
    const plugins = result.plugins as Record<string, unknown>;
    const allow = plugins.allow as string[];
    const entries = plugins.entries as Record<string, unknown>;

    expect(allow).toContain('qwen-portal-auth');
    expect(allow).not.toContain('skillhub');
    expect(entries).toHaveProperty('qwen-portal-auth');
    expect(entries).not.toHaveProperty('skillhub');
  });

  it('preserves custom plugins declared through plugins.load.paths', async () => {
    const customPluginDir = join(testHome, '.openclaw', 'extensions', 'custom-skillhub');
    await mkdir(customPluginDir, { recursive: true });
    await writeFile(
      join(customPluginDir, 'openclaw.plugin.json'),
      JSON.stringify({ id: 'skillhub', name: 'SkillHub' }, null, 2),
      'utf8',
    );

    await writeOpenClawJson({
      plugins: {
        allow: ['skillhub'],
        load: {
          paths: [customPluginDir],
        },
        entries: {
          skillhub: { enabled: true },
        },
      },
    });

    const { sanitizeOpenClawConfig } = await import('@electron/utils/openclaw-auth');

    await sanitizeOpenClawConfig();

    const result = await readOpenClawJson();
    const plugins = result.plugins as Record<string, unknown>;
    const allow = plugins.allow as string[];
    const entries = plugins.entries as Record<string, unknown>;

    expect(allow).toContain('skillhub');
    expect(entries).toHaveProperty('skillhub');
  });

  it('migrates legacy feishu plugin entries to openclaw-lark', async () => {
    const legacyPluginDir = join(testHome, '.openclaw', 'extensions', 'feishu-openclaw-plugin');
    await mkdir(legacyPluginDir, { recursive: true });
    await writeFile(
      join(legacyPluginDir, 'openclaw.plugin.json'),
      JSON.stringify({ id: 'openclaw-lark', name: 'Feishu' }, null, 2),
      'utf8',
    );

    await writeOpenClawJson({
      plugins: {
        allow: ['feishu-openclaw-plugin', 'feishu'],
        entries: {
          'feishu-openclaw-plugin': { enabled: true, appId: 'legacy-app' },
          feishu: { enabled: true },
        },
      },
    });

    const { sanitizeOpenClawConfig } = await import('@electron/utils/openclaw-auth');

    await sanitizeOpenClawConfig();

    const result = await readOpenClawJson();
    const plugins = result.plugins as Record<string, unknown>;
    const allow = plugins.allow as string[];
    const entries = plugins.entries as Record<string, Record<string, unknown>>;

    expect(allow).toContain('openclaw-lark');
    expect(allow).not.toContain('feishu-openclaw-plugin');
    expect(allow).not.toContain('feishu');
    expect(entries['openclaw-lark']).toEqual(expect.objectContaining({ enabled: true, appId: 'legacy-app' }));
    expect(entries).not.toHaveProperty('feishu-openclaw-plugin');
    expect(entries.feishu).toEqual({ enabled: false });
  });
});

describe('syncProviderConfigToOpenClaw', () => {
  beforeEach(async () => {
    vi.resetModules();
    vi.restoreAllMocks();
    await rm(testHome, { recursive: true, force: true });
    await rm(testUserData, { recursive: true, force: true });
  });

  it('adds saved provider models to the allowlist without changing the current default model', async () => {
    await writeOpenClawJson({
      agents: {
        defaults: {
          model: {
            primary: 'bailian/qwen3.5-plus',
          },
          models: {
            'bailian/qwen3.5-plus': {
              alias: 'bailian-chat',
            },
          },
        },
      },
    });

    const { syncProviderConfigToOpenClaw } = await import('@electron/utils/openclaw-auth');

    await syncProviderConfigToOpenClaw('custom-custom01', 'gpt-5.4', {
      baseUrl: 'https://9985678.xyz/v1',
      api: 'openai-completions',
    });

    const result = await readOpenClawJson();
    const defaults = ((result.agents as Record<string, unknown>).defaults ?? {}) as Record<string, unknown>;
    const currentModel = (defaults.model ?? {}) as Record<string, unknown>;
    const allowedModels = (defaults.models ?? {}) as Record<string, unknown>;

    expect(currentModel.primary).toBe('bailian/qwen3.5-plus');
    expect(allowedModels).toHaveProperty('bailian/qwen3.5-plus');
    expect(allowedModels).toHaveProperty('custom-custom01/gpt-5.4');
  });
});

describe('migrateProviderModelRefsInOpenClaw', () => {
  beforeEach(async () => {
    vi.resetModules();
    vi.restoreAllMocks();
    await rm(testHome, { recursive: true, force: true });
    await rm(testUserData, { recursive: true, force: true });
  });

  it('moves custom provider model refs and provider entries from custom-custom01 to 998', async () => {
    await writeOpenClawJson({
      agents: {
        defaults: {
          model: {
            primary: 'custom-custom01/gpt-5.4',
            fallbacks: ['custom-custom01/gpt-5.3', 'moonshot/kimi-k2.5'],
          },
          models: {
            'custom-custom01/gpt-5.4': { alias: 'main' },
            'custom-custom01/gpt-5.3': { alias: 'fallback' },
            'moonshot/kimi-k2.5': { alias: 'shared' },
            'bailian/qwen3.5-plus': { alias: 'untouched' },
          },
        },
      },
      models: {
        providers: {
          'custom-custom01': {
            api: 'openai-completions',
            baseUrl: 'https://9985678.xyz/v1',
            models: [{ id: 'gpt-5.4', name: 'gpt-5.4' }],
          },
          moonshot: {
            api: 'openai-completions',
            baseUrl: 'https://api.moonshot.cn/v1',
            models: [{ id: 'kimi-k2.5', name: 'kimi-k2.5' }],
          },
        },
      },
    });

    const { migrateProviderModelRefsInOpenClaw } = await import('@electron/utils/openclaw-auth');

    await migrateProviderModelRefsInOpenClaw('custom-custom01', '998');

    const result = await readOpenClawJson();
    const defaults = ((result.agents as Record<string, unknown>).defaults ?? {}) as Record<string, unknown>;
    const defaultModel = (defaults.model ?? {}) as Record<string, unknown>;
    const allowedModels = (defaults.models ?? {}) as Record<string, unknown>;
    const providers = ((result.models as Record<string, unknown>).providers ?? {}) as Record<string, unknown>;

    expect(defaultModel.primary).toBe('998/gpt-5.4');
    expect(defaultModel.fallbacks).toEqual(['998/gpt-5.3', 'moonshot/kimi-k2.5']);
    expect(allowedModels).toHaveProperty('998/gpt-5.4');
    expect(allowedModels).toHaveProperty('998/gpt-5.3');
    expect(allowedModels).toHaveProperty('bailian/qwen3.5-plus');
    expect(allowedModels).not.toHaveProperty('custom-custom01/gpt-5.4');
    expect(allowedModels).not.toHaveProperty('custom-custom01/gpt-5.3');
    expect(providers).toHaveProperty('998');
    expect(providers).not.toHaveProperty('custom-custom01');
    expect(providers).toHaveProperty('moonshot');
    expect(providers['998']).toEqual(expect.objectContaining({
      api: 'openai-completions',
      baseUrl: 'https://9985678.xyz/v1',
      models: [{ id: 'gpt-5.4', name: 'gpt-5.4' }],
    }));
    expect(providers['moonshot']).toEqual(expect.objectContaining({
      api: 'openai-completions',
      baseUrl: 'https://api.moonshot.cn/v1',
      models: [{ id: 'kimi-k2.5', name: 'kimi-k2.5' }],
    }));
  });
});

describe('removeProviderFromOpenClaw', () => {
  beforeEach(async () => {
    vi.resetModules();
    vi.restoreAllMocks();
    await rm(testHome, { recursive: true, force: true });
    await rm(testUserData, { recursive: true, force: true });
  });

  it('removes stale oauth plugin ids from plugins.allow when a provider is deleted', async () => {
    await writeOpenClawJson({
      agents: {
        list: [{ id: 'main', default: true }],
      },
      models: {
        providers: {
          'qwen-portal': {
            api: 'openai-completions',
          },
        },
      },
      plugins: {
        allow: ['qwen-portal-auth', 'telegram'],
        entries: {
          'qwen-portal-auth': { enabled: true },
          telegram: { enabled: true },
        },
      },
    });

    const { removeProviderFromOpenClaw } = await import('@electron/utils/openclaw-auth');

    await removeProviderFromOpenClaw('qwen-portal');

    const result = await readOpenClawJson();
    const plugins = result.plugins as Record<string, unknown>;
    const allow = plugins.allow as string[];
    const entries = plugins.entries as Record<string, Record<string, unknown>>;
    const providers = ((result.models as Record<string, unknown>).providers ?? {}) as Record<string, unknown>;

    expect(allow).not.toContain('qwen-portal-auth');
    expect(allow).toContain('telegram');
    expect(entries['qwen-portal-auth']).toEqual({ enabled: false });
    expect(providers).not.toHaveProperty('qwen-portal');
  });
});
