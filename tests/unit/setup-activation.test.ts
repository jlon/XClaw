import { beforeEach, describe, expect, it, vi } from 'vitest';

const ensureBuiltinSkillsInstalledMock = vi.fn().mockResolvedValue(undefined);
const ensurePreinstalledSkillsInstalledMock = vi.fn().mockResolvedValue(undefined);
const ensureAllBundledPluginsInstalledMock = vi.fn().mockResolvedValue(undefined);
const ensureXClawContextMock = vi.fn().mockResolvedValue(undefined);
const repairXClawOnlyBootstrapFilesMock = vi.fn().mockResolvedValue(undefined);
const autoInstallCliIfNeededMock = vi.fn().mockResolvedValue(undefined);
const generateCompletionCacheMock = vi.fn();
const installCompletionToProfileMock = vi.fn();
const getSettingMock = vi.fn();
const setSettingMock = vi.fn().mockResolvedValue(undefined);
const syncAllProviderAuthToRuntimeMock = vi.fn().mockResolvedValue(undefined);
const runTakeoverReconcilerMock = vi.fn().mockResolvedValue(undefined);
const readOpenClawConfigMock = vi.fn();
const writeOpenClawConfigMock = vi.fn().mockResolvedValue(undefined);
const validateWorkspacePathInputMock = vi.fn();
const mkdirMock = vi.fn().mockResolvedValue(undefined);
const withConfigLockMock = vi.fn(async (callback: () => Promise<unknown>) => callback());

vi.mock('fs/promises', () => ({
  mkdir: (...args: unknown[]) => mkdirMock(...args),
  default: {
    mkdir: (...args: unknown[]) => mkdirMock(...args),
  },
}));

vi.mock('@electron/utils/skill-config', () => ({
  ensureBuiltinSkillsInstalled: (...args: unknown[]) => ensureBuiltinSkillsInstalledMock(...args),
  ensurePreinstalledSkillsInstalled: (...args: unknown[]) => ensurePreinstalledSkillsInstalledMock(...args),
}));

vi.mock('@electron/utils/plugin-install', () => ({
  ensureAllBundledPluginsInstalled: (...args: unknown[]) => ensureAllBundledPluginsInstalledMock(...args),
}));

vi.mock('@electron/utils/openclaw-workspace', () => ({
  ensureXClawContext: (...args: unknown[]) => ensureXClawContextMock(...args),
  repairXClawOnlyBootstrapFiles: (...args: unknown[]) => repairXClawOnlyBootstrapFilesMock(...args),
}));

vi.mock('@electron/utils/openclaw-cli', () => ({
  autoInstallCliIfNeeded: (...args: unknown[]) => autoInstallCliIfNeededMock(...args),
  generateCompletionCache: (...args: unknown[]) => generateCompletionCacheMock(...args),
  installCompletionToProfile: (...args: unknown[]) => installCompletionToProfileMock(...args),
}));

vi.mock('@electron/utils/store', () => ({
  getSetting: (...args: unknown[]) => getSettingMock(...args),
  setSetting: (...args: unknown[]) => setSettingMock(...args),
}));

vi.mock('@electron/utils/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('@electron/services/providers/provider-runtime-sync', () => ({
  syncAllProviderAuthToRuntime: (...args: unknown[]) => syncAllProviderAuthToRuntimeMock(...args),
}));

vi.mock('@electron/main/takeover-reconciler', () => ({
  runTakeoverReconciler: (...args: unknown[]) => runTakeoverReconcilerMock(...args),
}));

vi.mock('@electron/utils/channel-config', () => ({
  readOpenClawConfig: (...args: unknown[]) => readOpenClawConfigMock(...args),
  writeOpenClawConfig: (...args: unknown[]) => writeOpenClawConfigMock(...args),
}));

vi.mock('@electron/utils/config-mutex', () => ({
  withConfigLock: (...args: unknown[]) => withConfigLockMock(...args),
}));

vi.mock('@electron/utils/workspace-path', () => ({
  validateWorkspacePathInput: (...args: unknown[]) => validateWorkspacePathInputMock(...args),
}));

describe('runSetupActivationSideEffects', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    getSettingMock.mockResolvedValue(false);
    readOpenClawConfigMock.mockResolvedValue({});
    validateWorkspacePathInputMock.mockImplementation((value: string) => ({
      normalizedPath: value,
    }));
  });

  it('persists fresh setup gateway port and workspace only at activation time', async () => {
    const gatewayManager = {
      setPort: vi.fn(),
      start: vi.fn().mockResolvedValue(undefined),
    };
    const runtimeController = {
      activateManagedMode: vi.fn().mockResolvedValue(undefined),
    };
    const { runSetupActivationSideEffects } = await import('@electron/main/setup-activation');

    await runSetupActivationSideEffects({
      gatewayManager,
      runtimeController,
      mainWindow: null,
      awaitCriticalTasks: true,
      setup: {
        mode: 'fresh',
        gatewayPort: 19001,
        workspacePath: '/Users/test/.openclaw/workspace-alt',
      },
    } as never);

    expect(setSettingMock).toHaveBeenCalledWith('gatewayPort', 19001);
    expect(gatewayManager.setPort).toHaveBeenCalledWith(19001);
    expect(mkdirMock).toHaveBeenCalledWith('/Users/test/.openclaw/workspace-alt', { recursive: true });
    expect(withConfigLockMock).toHaveBeenCalledTimes(1);
    expect(writeOpenClawConfigMock).toHaveBeenCalledWith({
      agents: {
        defaults: {
          workspace: '/Users/test/.openclaw/workspace-alt',
        },
      },
      gateway: {
        port: 19001,
      },
    });
    expect(ensureBuiltinSkillsInstalledMock).toHaveBeenCalledTimes(1);
    expect(ensurePreinstalledSkillsInstalledMock).toHaveBeenCalledTimes(1);
    expect(ensureAllBundledPluginsInstalledMock).toHaveBeenCalledTimes(1);
    expect(ensureXClawContextMock).toHaveBeenCalledTimes(1);
    expect(syncAllProviderAuthToRuntimeMock).not.toHaveBeenCalled();
    expect(gatewayManager.start).not.toHaveBeenCalled();
    expect(runtimeController.activateManagedMode).toHaveBeenCalledWith('stopped');
  }, 15000);

  it('rejects invalid fresh gateway ports before any write occurs', async () => {
    const gatewayManager = {
      setPort: vi.fn(),
      start: vi.fn().mockResolvedValue(undefined),
    };
    const runtimeController = {
      activateManagedMode: vi.fn().mockResolvedValue(undefined),
    };
    const { runSetupActivationSideEffects } = await import('@electron/main/setup-activation');

    await expect(runSetupActivationSideEffects({
      gatewayManager,
      runtimeController,
      mainWindow: null,
      awaitCriticalTasks: true,
      setup: {
        mode: 'fresh',
        gatewayPort: 70000,
        workspacePath: '/Users/test/.openclaw/workspace-alt',
      },
    } as never)).rejects.toThrow('网关端口必须是 1-65535 的整数');

    expect(setSettingMock).not.toHaveBeenCalled();
    expect(mkdirMock).not.toHaveBeenCalled();
    expect(writeOpenClawConfigMock).not.toHaveBeenCalled();
    expect(gatewayManager.setPort).not.toHaveBeenCalled();
    expect(runtimeController.activateManagedMode).not.toHaveBeenCalled();
  }, 15000);

  it('does not rewrite fresh setup runtime selections during takeover activation', async () => {
    const gatewayManager = {
      setPort: vi.fn(),
      start: vi.fn().mockResolvedValue(undefined),
    };
    const runtimeController = {
      activateManagedMode: vi.fn().mockResolvedValue(undefined),
    };
    getSettingMock.mockImplementation(async (key: string) => {
      if (key === 'gatewayPort') {
        return 19009;
      }
      return false;
    });
    const { runSetupActivationSideEffects } = await import('@electron/main/setup-activation');

    await runSetupActivationSideEffects({
      gatewayManager,
      runtimeController,
      mainWindow: null,
      awaitCriticalTasks: true,
      setup: {
        mode: 'takeover',
      },
    } as never);

    expect(setSettingMock).not.toHaveBeenCalled();
    expect(mkdirMock).not.toHaveBeenCalled();
    expect(writeOpenClawConfigMock).not.toHaveBeenCalled();
    expect(gatewayManager.setPort).toHaveBeenCalledWith(19009);
    expect(runtimeController.activateManagedMode).toHaveBeenCalledWith('stopped');
  });

  it('fails setup activation when explicit gateway auto-start fails', async () => {
    const gatewayManager = {
      setPort: vi.fn(),
      start: vi.fn().mockRejectedValue(new Error('plugin not found: skillhub')),
    };
    const runtimeController = {
      activateManagedMode: vi.fn().mockRejectedValue(new Error('plugin not found: skillhub')),
    };
    const { runSetupActivationSideEffects } = await import('@electron/main/setup-activation');

    getSettingMock.mockImplementation(async (key: string) => {
      if (key === 'gatewayDesiredState') {
        return 'running';
      }
      return false;
    });

    await expect(runSetupActivationSideEffects({
      gatewayManager,
      runtimeController,
      mainWindow: null,
      awaitCriticalTasks: true,
      setup: {
        mode: 'takeover',
      },
    } as never)).rejects.toThrow('网关自动启动失败');

    expect(syncAllProviderAuthToRuntimeMock).toHaveBeenCalledTimes(1);
    expect(runtimeController.activateManagedMode).toHaveBeenCalledWith('running');
    expect(gatewayManager.start).not.toHaveBeenCalled();
  });

  it('keeps startup soft-failure behavior when auto-start fails outside explicit setup completion', async () => {
    const gatewayManager = {
      setPort: vi.fn(),
      start: vi.fn().mockRejectedValue(new Error('plugin not found: skillhub')),
    };
    const runtimeController = {
      activateManagedMode: vi.fn().mockRejectedValue(new Error('plugin not found: skillhub')),
    };
    const sendMock = vi.fn();
    const { runSetupActivationSideEffects } = await import('@electron/main/setup-activation');

    getSettingMock.mockImplementation(async (key: string) => {
      if (key === 'gatewayDesiredState') {
        return 'running';
      }
      return false;
    });

    await expect(runSetupActivationSideEffects({
      gatewayManager,
      runtimeController,
      mainWindow: {
        isDestroyed: () => false,
        webContents: {
          send: sendMock,
        },
      },
    } as never)).resolves.toBeUndefined();

    expect(syncAllProviderAuthToRuntimeMock).toHaveBeenCalledTimes(1);
    expect(runtimeController.activateManagedMode).toHaveBeenCalledWith('running');
    expect(gatewayManager.start).not.toHaveBeenCalled();
    expect(sendMock).toHaveBeenCalledWith('gateway:error', expect.stringContaining('plugin not found: skillhub'));
  });
});
