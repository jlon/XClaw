import { mkdir, readFile, rm, writeFile } from 'fs/promises';
import { join } from 'path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { testHome, testUserData } = vi.hoisted(() => {
  const suffix = Math.random().toString(36).slice(2);
  return {
    testHome: `/tmp/clawx-openclaw-auth-${suffix}`,
    testUserData: `/tmp/clawx-openclaw-auth-user-data-${suffix}`,
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
