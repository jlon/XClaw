import { beforeEach, describe, expect, it, vi } from 'vitest';

const replaceImportedProviderAccountsMock = vi.fn();
const replaceImportedProviderSecretsMock = vi.fn();
const listProviderAccountsMock = vi.fn();

vi.mock('@electron/services/providers/provider-store', () => ({
  replaceImportedProviderAccounts: (...args: unknown[]) => replaceImportedProviderAccountsMock(...args),
  listProviderAccounts: (...args: unknown[]) => listProviderAccountsMock(...args),
}));

vi.mock('@electron/services/secrets/secret-store', () => ({
  replaceImportedProviderSecrets: (...args: unknown[]) => replaceImportedProviderSecretsMock(...args),
}));

import {
  applyImportedProviderState,
  buildImportedProviderState,
} from '@electron/services/providers/provider-import';

describe('buildImportedProviderState', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('imports api key, oauth browser and local providers while restoring the default account', () => {
    const result = buildImportedProviderState({
      now: () => '2026-03-19T03:20:00.000Z',
      config: {
        models: {
          providers: {
            moonshot: {
              baseUrl: 'https://api.moonshot.cn/v1',
              api: 'openai-completions',
            },
            ollama: {
              baseUrl: 'http://localhost:11434/v1',
              api: 'openai-completions',
            },
          },
        },
        agents: {
          defaults: {
            model: {
              primary: 'openai-codex/gpt-5.3-codex',
            },
          },
        },
      },
      authProfilesByAgent: {
        main: {
          profiles: {
            'openai-codex:default': {
              type: 'oauth',
              provider: 'openai-codex',
              access: 'access-token',
              refresh: 'refresh-token',
              expires: 1742354400000,
              email: 'user@example.com',
            },
            'moonshot:default': {
              type: 'api_key',
              provider: 'moonshot',
              key: 'sk-moonshot',
            },
          },
        },
      },
    });

    expect(result.defaultAccountId).toBe('openai-codex');
    expect(result.conflicts).toEqual([]);
    expect(result.accounts).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'openai-codex',
        vendorId: 'openai',
        authMode: 'oauth_browser',
        isDefault: true,
      }),
      expect.objectContaining({
        id: 'moonshot',
        vendorId: 'moonshot',
        authMode: 'api_key',
        isDefault: false,
      }),
      expect.objectContaining({
        id: 'ollama',
        vendorId: 'ollama',
        authMode: 'local',
      }),
    ]));
    expect(result.secrets).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: 'oauth',
        accountId: 'openai-codex',
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      }),
      expect.objectContaining({
        type: 'api_key',
        accountId: 'moonshot',
        apiKey: 'sk-moonshot',
      }),
      expect.objectContaining({
        type: 'local',
        accountId: 'ollama',
      }),
    ]));
  });

  it('keeps takeover going but marks conflicts and prefers main agent credentials', () => {
    const result = buildImportedProviderState({
      now: () => '2026-03-19T03:20:00.000Z',
      config: {
        models: {
          providers: {
            moonshot: {
              baseUrl: 'https://api.moonshot.cn/v1',
              api: 'openai-completions',
            },
          },
        },
      },
      authProfilesByAgent: {
        reviewer: {
          profiles: {
            'moonshot:default': {
              type: 'api_key',
              provider: 'moonshot',
              key: 'sk-reviewer',
            },
          },
        },
        main: {
          profiles: {
            'moonshot:default': {
              type: 'api_key',
              provider: 'moonshot',
              key: 'sk-main',
            },
          },
        },
      },
    });

    expect(result.conflicts).toEqual(['moonshot']);
    expect(result.warnings).toEqual(expect.arrayContaining([
      expect.stringContaining('moonshot'),
    ]));
    expect(result.entries).toEqual(expect.arrayContaining([
      expect.objectContaining({
        runtimeProviderKey: 'moonshot',
        conflict: true,
      }),
    ]));
    expect(result.secrets).toEqual([
      expect.objectContaining({
        type: 'api_key',
        accountId: 'moonshot',
        apiKey: 'sk-main',
      }),
    ]);
  });

  it('imports compatible unknown providers as custom accounts with api key auth', () => {
    const result = buildImportedProviderState({
      now: () => '2026-03-19T03:20:00.000Z',
      config: {
        models: {
          providers: {
            'external-compatible': {
              baseUrl: 'https://example.com/v1',
              api: 'openai-completions',
            },
          },
        },
      },
      authProfilesByAgent: {
        main: {
          profiles: {
            'external-compatible:default': {
              type: 'api_key',
              provider: 'external-compatible',
              key: 'sk-custom',
            },
          },
        },
      },
    });

    expect(result.accounts).toEqual([
      expect.objectContaining({
        id: 'external-compatible',
        vendorId: 'custom',
        label: 'external-compatible',
        runtimeKey: 'external-compatible',
        authMode: 'api_key',
        baseUrl: 'https://example.com/v1',
        apiProtocol: 'openai-completions',
      }),
    ]);
    expect(result.secrets).toEqual([
      expect.objectContaining({
        type: 'api_key',
        accountId: 'external-compatible',
        apiKey: 'sk-custom',
      }),
    ]);
  });

  it('falls back to the only credentialed account when no default runtime provider is configured', () => {
    const result = buildImportedProviderState({
      now: () => '2026-03-19T03:20:00.000Z',
      config: {
        models: {
          providers: {
            moonshot: {
              baseUrl: 'https://api.moonshot.cn/v1',
              api: 'openai-completions',
            },
          },
        },
      },
      authProfilesByAgent: {
        main: {
          profiles: {
            'moonshot:default': {
              type: 'api_key',
              provider: 'moonshot',
              key: 'sk-only',
            },
          },
        },
      },
    });

    expect(result.defaultAccountId).toBe('moonshot');
    expect(result.accounts[0]).toEqual(expect.objectContaining({
      id: 'moonshot',
      isDefault: true,
    }));
  });
});

describe('applyImportedProviderState', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listProviderAccountsMock.mockResolvedValue([]);
  });

  it('writes imported accounts, default account and secrets into XClaw stores', async () => {
    const imported = buildImportedProviderState({
      now: () => '2026-03-19T03:20:00.000Z',
      config: {
        models: {
          providers: {
            moonshot: {
              baseUrl: 'https://api.moonshot.cn/v1',
              api: 'openai-completions',
            },
          },
        },
      },
      authProfilesByAgent: {
        main: {
          profiles: {
            'moonshot:default': {
              type: 'api_key',
              provider: 'moonshot',
              key: 'sk-main',
            },
          },
        },
      },
    });

    await applyImportedProviderState(imported);

    expect(replaceImportedProviderAccountsMock).toHaveBeenCalledWith(
      imported.accounts,
      imported.defaultAccountId,
    );
    expect(replaceImportedProviderSecretsMock).toHaveBeenCalledWith(imported.secrets);
  });

  it('keeps an existing richer custom provider account instead of downgrading it during import merge', async () => {
    listProviderAccountsMock.mockResolvedValue([
      {
        id: 'custom-custom01',
        vendorId: 'custom',
        label: '998',
        runtimeKey: '998',
        authMode: 'api_key',
        baseUrl: 'https://9985678.xyz/v1',
        apiProtocol: 'openai-completions',
        model: 'gpt-5.4',
        enabled: true,
        isDefault: true,
        createdAt: '2026-03-21T05:34:20.141Z',
        updatedAt: '2026-03-21T05:34:20.141Z',
      },
    ]);
    const imported = buildImportedProviderState({
      now: () => '2026-03-21T06:17:37.707Z',
      config: {
        models: {
          providers: {
            '998': {
              baseUrl: 'https://9985678.xyz/v1',
              api: 'openai-completions',
            },
          },
        },
        agents: {
          defaults: {
            model: {
              primary: '998/gpt-5.4',
            },
          },
        },
      },
      authProfilesByAgent: {
        main: {
          profiles: {
            '998:default': {
              type: 'api_key',
              provider: '998',
              key: 'sk-998',
            },
          },
        },
      },
    });

    await applyImportedProviderState(imported);

    expect(replaceImportedProviderAccountsMock).toHaveBeenCalledWith([
      expect.objectContaining({
        id: 'custom-custom01',
        vendorId: 'custom',
        label: '998',
        runtimeKey: '998',
        model: 'gpt-5.4',
        isDefault: true,
      }),
    ], 'custom-custom01');
    expect(replaceImportedProviderSecretsMock).toHaveBeenCalledWith([
      expect.objectContaining({
        type: 'api_key',
        accountId: 'custom-custom01',
        apiKey: 'sk-998',
      }),
    ]);
  });
});
