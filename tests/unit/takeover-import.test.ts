import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn().mockReturnValue('/tmp'),
    getPreferredSystemLanguages: vi.fn().mockReturnValue(['zh-CN']),
    getLocale: vi.fn().mockReturnValue('zh-CN'),
  },
}));

describe('runTakeoverImport', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('backs up local state, imports provider state and commits setup completion', async () => {
    const writeBackupMock = vi.fn().mockResolvedValue('/tmp/XClaw-takeover-backup.json');
    const applyImportedProviderStateMock = vi.fn().mockResolvedValue(undefined);
    const applyImportedRuntimeSettingsMock = vi.fn().mockResolvedValue(undefined);
    const captureFingerprintMock = vi.fn().mockResolvedValue('fingerprint-v1');
    const setTakeoverFingerprintMock = vi.fn().mockResolvedValue(undefined);
    const restoreSettingsSnapshotMock = vi.fn().mockResolvedValue(undefined);
    const restoreProviderStoreSnapshotMock = vi.fn().mockResolvedValue(undefined);
    const { runTakeoverImport, getTakeoverImportStatus } = await import('@electron/main/takeover-import');

    const result = await runTakeoverImport(undefined, {
      now: () => '2026-03-19T03:30:00.000Z',
      inspectSetup: async () => ({
        hasExistingOpenClaw: true,
        suggestedMode: 'takeover',
        gatewayPort: 18789,
        runtime: {
          externalGatewayDetected: false,
          configChanging: false,
        },
      }),
      buildPlan: () => ({
        mode: 'takeover',
        canApply: true,
        blockingIssues: [],
        warnings: ['provider 需要复核'],
      }),
      loadRuntimeState: async () => ({
        config: {
          gateway: {
            auth: {
              token: 'XClaw-secret',
            },
          },
          models: {
            providers: {
              moonshot: {
                apiKey: 'provider-secret',
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
      }),
      getSettingsSnapshot: async () => ({
        theme: 'system',
        language: 'zh-CN',
        startMinimized: false,
        launchAtStartup: false,
        telemetryEnabled: true,
        machineId: 'machine-id',
        hasReportedInstall: false,
        setupComplete: false,
        gatewayAutoStart: true,
        gatewayPort: 18789,
        gatewayToken: 'token',
        proxyEnabled: false,
        proxyServer: '',
        proxyHttpServer: '',
        proxyHttpsServer: '',
        proxyAllServer: '',
        proxyBypassRules: '',
        updateChannel: 'stable',
        autoCheckUpdate: true,
        autoDownloadUpdate: false,
        skippedVersions: [],
        sidebarCollapsed: false,
        devModeUnlocked: false,
        selectedBundles: [],
        enabledSkills: [],
        disabledSkills: [],
      }),
      getProviderStoreSnapshot: async () => ({
        providerAccounts: {},
        providerSecrets: {
          moonshot: {
            apiKey: 'sk-stored',
          },
        },
      }),
      writeBackup: writeBackupMock,
      applyImportedProviderState: applyImportedProviderStateMock,
      applyImportedRuntimeSettings: applyImportedRuntimeSettingsMock,
      captureFingerprint: captureFingerprintMock,
      setTakeoverFingerprint: setTakeoverFingerprintMock,
      restoreSettingsSnapshot: restoreSettingsSnapshotMock,
      restoreProviderStoreSnapshot: restoreProviderStoreSnapshotMock,
    });

    expect(writeBackupMock).toHaveBeenCalledWith(expect.objectContaining({
      generatedAt: '2026-03-19T03:30:00.000Z',
      inspection: expect.objectContaining({
        hasExistingOpenClaw: true,
      }),
      settings: expect.objectContaining({
        setupComplete: false,
        gatewayToken: '[redacted]',
      }),
      providerStore: expect.objectContaining({
        providerSecrets: expect.objectContaining({
          moonshot: expect.objectContaining({
            apiKey: '[redacted]',
          }),
        }),
      }),
      runtimeState: expect.objectContaining({
        config: expect.objectContaining({
          gateway: expect.objectContaining({
            auth: expect.objectContaining({
              token: '[redacted]',
            }),
          }),
          models: expect.objectContaining({
            providers: expect.objectContaining({
              moonshot: expect.objectContaining({
                apiKey: '[redacted]',
              }),
            }),
          }),
        }),
        authProfilesByAgent: expect.objectContaining({
          main: expect.objectContaining({
            profiles: expect.objectContaining({
              'moonshot:default': expect.objectContaining({
                key: '[redacted]',
              }),
            }),
          }),
        }),
      }),
    }));
    expect(applyImportedProviderStateMock).toHaveBeenCalledWith(expect.objectContaining({
      defaultAccountId: 'moonshot',
      accounts: [
        expect.objectContaining({
          id: 'moonshot',
        }),
      ],
    }));
    expect(applyImportedRuntimeSettingsMock).toHaveBeenCalledWith({
      gatewayPort: 18789,
      gatewayToken: 'XClaw-secret',
    });
    expect(captureFingerprintMock).toHaveBeenCalledWith(expect.objectContaining({
      inspection: expect.objectContaining({
        hasExistingOpenClaw: true,
      }),
      imported: expect.objectContaining({
        defaultAccountId: 'moonshot',
      }),
    }));
    expect(setTakeoverFingerprintMock).toHaveBeenCalledWith('fingerprint-v1');
    expect(restoreSettingsSnapshotMock).not.toHaveBeenCalled();
    expect(restoreProviderStoreSnapshotMock).not.toHaveBeenCalled();
    expect(result).toEqual(expect.objectContaining({
      state: 'complete',
      step: 'complete',
      backupPath: '/tmp/XClaw-takeover-backup.json',
      defaultAccountId: 'moonshot',
      importedAccountCount: 1,
      warnings: ['provider 需要复核'],
    }));
    expect(getTakeoverImportStatus()).toEqual(result);
  });

  it('restores local snapshots when provider import fails', async () => {
    const restoreSettingsSnapshotMock = vi.fn().mockResolvedValue(undefined);
    const restoreProviderStoreSnapshotMock = vi.fn().mockResolvedValue(undefined);
    const { runTakeoverImport, getTakeoverImportStatus } = await import('@electron/main/takeover-import');

    const result = await runTakeoverImport(undefined, {
      now: () => '2026-03-19T03:30:00.000Z',
      inspectSetup: async () => ({
        hasExistingOpenClaw: true,
        suggestedMode: 'takeover',
        runtime: {
          externalGatewayDetected: false,
          configChanging: false,
        },
      }),
      buildPlan: () => ({
        mode: 'takeover',
        canApply: true,
        blockingIssues: [],
        warnings: [],
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
                key: 'sk-main',
              },
            },
          },
        },
      }),
      getSettingsSnapshot: async () => ({
        theme: 'system',
        language: 'zh-CN',
        startMinimized: false,
        launchAtStartup: false,
        telemetryEnabled: true,
        machineId: 'machine-id',
        hasReportedInstall: false,
        setupComplete: false,
        gatewayAutoStart: true,
        gatewayPort: 18789,
        gatewayToken: 'token',
        proxyEnabled: false,
        proxyServer: '',
        proxyHttpServer: '',
        proxyHttpsServer: '',
        proxyAllServer: '',
        proxyBypassRules: '',
        updateChannel: 'stable',
        autoCheckUpdate: true,
        autoDownloadUpdate: false,
        skippedVersions: [],
        sidebarCollapsed: false,
        devModeUnlocked: false,
        selectedBundles: [],
        enabledSkills: [],
        disabledSkills: [],
      }),
      getProviderStoreSnapshot: async () => ({
        providerAccounts: {
          existing: {
            id: 'existing',
          },
        },
      }),
      writeBackup: vi.fn().mockResolvedValue('/tmp/XClaw-takeover-backup.json'),
      applyImportedProviderState: vi.fn().mockRejectedValue(new Error('import failed')),
      restoreSettingsSnapshot: restoreSettingsSnapshotMock,
      restoreProviderStoreSnapshot: restoreProviderStoreSnapshotMock,
    });

    expect(result).toEqual(expect.objectContaining({
      state: 'failed',
      step: 'rollback',
      error: 'import failed',
    }));
    expect(restoreSettingsSnapshotMock).toHaveBeenCalledWith(expect.objectContaining({
      setupComplete: false,
    }));
    expect(restoreProviderStoreSnapshotMock).toHaveBeenCalledWith(expect.objectContaining({
      providerAccounts: {
        existing: {
          id: 'existing',
        },
      },
    }));
    expect(getTakeoverImportStatus()).toEqual(expect.objectContaining({
      state: 'failed',
      step: 'rollback',
    }));
  });

  it('blocks takeover when the latest setup plan cannot apply', async () => {
    const writeBackupMock = vi.fn();
    const applyImportedProviderStateMock = vi.fn();
    const { runTakeoverImport, getTakeoverImportStatus } = await import('@electron/main/takeover-import');

    const result = await runTakeoverImport(undefined, {
      inspectSetup: async () => ({
        hasExistingOpenClaw: true,
        suggestedMode: 'takeover',
        runtime: {
          externalGatewayDetected: true,
          configChanging: false,
        },
      }),
      buildPlan: () => ({
        mode: 'takeover',
        canApply: false,
        blockingIssues: ['检测到外部 Gateway 仍在运行，请先停止后再继续接管'],
        warnings: [],
      }),
      loadRuntimeState: async () => ({
        config: {},
        authProfilesByAgent: {},
      }),
      getSettingsSnapshot: async () => ({
        setupComplete: false,
      }),
      getProviderStoreSnapshot: async () => ({}),
      writeBackup: writeBackupMock,
      applyImportedProviderState: applyImportedProviderStateMock,
      restoreSettingsSnapshot: vi.fn(),
      restoreProviderStoreSnapshot: vi.fn(),
    });

    expect(result).toEqual(expect.objectContaining({
      state: 'blocked',
      step: 'blocked',
      blockingIssues: ['检测到外部 Gateway 仍在运行，请先停止后再继续接管'],
    }));
    expect(writeBackupMock).not.toHaveBeenCalled();
    expect(applyImportedProviderStateMock).not.toHaveBeenCalled();
    expect(getTakeoverImportStatus()).toEqual(result);
  });

  it('reuses the in-flight takeover import instead of running a second import concurrently', async () => {
    let releaseImport: (() => void) | null = null;
    const applyImportedProviderStateMock = vi.fn().mockImplementation(
      () => new Promise<void>((resolve) => {
        releaseImport = resolve;
      }),
    );
    const { runTakeoverImport } = await import('@electron/main/takeover-import');

    const dependencies = {
      now: () => '2026-03-19T03:30:00.000Z',
      inspectSetup: async () => ({
        hasExistingOpenClaw: true,
        suggestedMode: 'takeover',
        runtime: {
          externalGatewayDetected: false,
          configChanging: false,
        },
      }),
      buildPlan: () => ({
        mode: 'takeover',
        canApply: true,
        blockingIssues: [],
        warnings: [],
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
                key: 'sk-main',
              },
            },
          },
        },
      }),
      getSettingsSnapshot: async () => ({
        theme: 'system',
        language: 'zh-CN',
        startMinimized: false,
        launchAtStartup: false,
        telemetryEnabled: true,
        machineId: 'machine-id',
        hasReportedInstall: false,
        setupComplete: false,
        gatewayAutoStart: true,
        gatewayPort: 18789,
        gatewayToken: 'token',
        proxyEnabled: false,
        proxyServer: '',
        proxyHttpServer: '',
        proxyHttpsServer: '',
        proxyAllServer: '',
        proxyBypassRules: '',
        updateChannel: 'stable',
        autoCheckUpdate: true,
        autoDownloadUpdate: false,
        skippedVersions: [],
        sidebarCollapsed: false,
        devModeUnlocked: false,
        selectedBundles: [],
        enabledSkills: [],
        disabledSkills: [],
      }),
      getProviderStoreSnapshot: async () => ({
        providerAccounts: {},
      }),
      writeBackup: vi.fn().mockResolvedValue('/tmp/XClaw-takeover-backup.json'),
      applyImportedProviderState: applyImportedProviderStateMock,
      captureFingerprint: vi.fn().mockResolvedValue('fingerprint-v1'),
      setTakeoverFingerprint: vi.fn().mockResolvedValue(undefined),
      restoreSettingsSnapshot: vi.fn().mockResolvedValue(undefined),
      restoreProviderStoreSnapshot: vi.fn().mockResolvedValue(undefined),
    };

    const first = runTakeoverImport(undefined, dependencies);
    const second = runTakeoverImport(undefined, dependencies);

    await vi.waitFor(() => {
      expect(applyImportedProviderStateMock).toHaveBeenCalledTimes(1);
    });

    releaseImport?.();

    const [firstResult, secondResult] = await Promise.all([first, second]);

    expect(firstResult).toEqual(secondResult);
    expect(applyImportedProviderStateMock).toHaveBeenCalledTimes(1);
  });
});
