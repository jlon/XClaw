import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildImportedProviderState } from '@electron/services/providers/provider-import';
import { buildTakeoverFingerprint, runTakeoverReconciler } from '@electron/main/takeover-reconciler';

const buildImportedState = (apiKey = 'sk-main') => buildImportedProviderState({
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
          key: apiKey,
        },
      },
    },
  },
});

const buildInspection = (overrides: Record<string, unknown> = {}) => ({
  hasExistingOpenClaw: true,
  defaultWorkspacePath: '/Users/test/.openclaw/workspace',
  configuredWorkspacePaths: ['/Users/test/.openclaw/workspace'],
  ...overrides,
});

describe('buildTakeoverFingerprint', () => {
  it('normalizes windows workspace paths and directory ordering before hashing', () => {
    const imported = buildImportedState();

    const left = buildTakeoverFingerprint({
      imported,
      defaultWorkspacePath: 'C:\\Users\\Alice\\.openclaw\\workspace\\',
      configuredWorkspacePaths: ['C:\\Users\\Alice\\.openclaw\\workspace\\'],
      skillEntries: ['beta', 'alpha'],
      extensionEntries: ['ext-b', 'ext-a'],
    });

    const right = buildTakeoverFingerprint({
      imported,
      defaultWorkspacePath: 'c:/Users/Alice/.openclaw/workspace',
      configuredWorkspacePaths: ['c:/Users/Alice/.openclaw/workspace/'],
      skillEntries: ['alpha', 'beta'],
      extensionEntries: ['ext-a', 'ext-b'],
    });

    expect(left).toBe(right);
  });
});

describe('runTakeoverReconciler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('skips when setup is incomplete', async () => {
    const applyImportedProviderStateMock = vi.fn();
    const persistFingerprintMock = vi.fn();

    const result = await runTakeoverReconciler({
      getSettings: async () => ({
        setupComplete: false,
        takeoverFingerprint: null,
      }),
      inspectSetup: async () => buildInspection(),
      loadRuntimeState: async () => ({
        config: {},
        authProfilesByAgent: {},
      }),
      readDirectoryEntries: async () => [],
      applyImportedProviderState: applyImportedProviderStateMock,
      persistFingerprint: persistFingerprintMock,
    });

    expect(result).toEqual({
      status: 'skipped',
      reason: 'setup-incomplete',
      fingerprint: null,
      providerProjectionUpdated: false,
    });
    expect(applyImportedProviderStateMock).not.toHaveBeenCalled();
    expect(persistFingerprintMock).not.toHaveBeenCalled();
  });

  it('refreshes provider projection and persists the next fingerprint when provider drift is detected', async () => {
    const previousFingerprint = buildTakeoverFingerprint({
      imported: buildImportedState('sk-old'),
      defaultWorkspacePath: '/Users/test/.openclaw/workspace',
      configuredWorkspacePaths: ['/Users/test/.openclaw/workspace'],
      skillEntries: ['alpha'],
      extensionEntries: ['ext-a'],
    });
    const applyImportedProviderStateMock = vi.fn().mockResolvedValue(undefined);
    const persistFingerprintMock = vi.fn().mockResolvedValue(undefined);

    const result = await runTakeoverReconciler({
      now: () => '2026-03-19T03:30:00.000Z',
      getSettings: async () => ({
        setupComplete: true,
        takeoverFingerprint: previousFingerprint,
      }),
      inspectSetup: async () => buildInspection(),
      loadRuntimeState: async () => ({
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
                key: 'sk-new',
              },
            },
          },
        },
      }),
      readDirectoryEntries: async (path) => path.endsWith('/skills') ? ['alpha'] : ['ext-a'],
      applyImportedProviderState: applyImportedProviderStateMock,
      persistFingerprint: persistFingerprintMock,
    });

    expect(applyImportedProviderStateMock).toHaveBeenCalledWith(expect.objectContaining({
      defaultAccountId: 'moonshot',
      secrets: [
        expect.objectContaining({
          accountId: 'moonshot',
          apiKey: 'sk-new',
        }),
      ],
    }));
    expect(persistFingerprintMock).toHaveBeenCalledWith(expect.any(String));
    expect(result).toEqual({
      status: 'updated',
      reason: 'provider-drift',
      fingerprint: expect.any(String),
      providerProjectionUpdated: true,
    });
  });

  it('only persists the next fingerprint when non-provider drift is detected', async () => {
    const imported = buildImportedState('sk-stable');
    const previousFingerprint = buildTakeoverFingerprint({
      imported,
      defaultWorkspacePath: '/Users/test/.openclaw/workspace',
      configuredWorkspacePaths: ['/Users/test/.openclaw/workspace'],
      skillEntries: ['alpha'],
      extensionEntries: ['ext-a'],
    });
    const applyImportedProviderStateMock = vi.fn().mockResolvedValue(undefined);
    const persistFingerprintMock = vi.fn().mockResolvedValue(undefined);

    const result = await runTakeoverReconciler({
      now: () => '2026-03-19T03:30:00.000Z',
      getSettings: async () => ({
        setupComplete: true,
        takeoverFingerprint: previousFingerprint,
      }),
      inspectSetup: async () => buildInspection({
        configuredWorkspacePaths: [
          '/Users/test/.openclaw/workspace',
          '/Users/test/projects/demo',
        ],
      }),
      loadRuntimeState: async () => ({
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
                key: 'sk-stable',
              },
            },
          },
        },
      }),
      readDirectoryEntries: async (path) => path.endsWith('/skills') ? ['alpha', 'beta'] : ['ext-a'],
      applyImportedProviderState: applyImportedProviderStateMock,
      persistFingerprint: persistFingerprintMock,
    });

    expect(applyImportedProviderStateMock).not.toHaveBeenCalled();
    expect(persistFingerprintMock).toHaveBeenCalledWith(expect.any(String));
    expect(result).toEqual({
      status: 'updated',
      reason: 'environment-drift',
      fingerprint: expect.any(String),
      providerProjectionUpdated: false,
    });
  });
});
