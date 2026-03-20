import { beforeEach, describe, expect, it, vi } from 'vitest';

const handleMock = vi.fn();
const getAllSettingsMock = vi.fn();
const getSettingMock = vi.fn();
const resetSettingsMock = vi.fn();
const setSettingMock = vi.fn();

vi.mock('electron', () => ({
  ipcMain: {
    handle: (...args: unknown[]) => handleMock(...args),
  },
  BrowserWindow: vi.fn(),
  shell: {
    openExternal: vi.fn(),
    showItemInFolder: vi.fn(),
    openPath: vi.fn(),
  },
  dialog: {
    showOpenDialog: vi.fn(),
    showSaveDialog: vi.fn(),
    showMessageBox: vi.fn(),
  },
  app: {
    getPath: vi.fn(),
    quit: vi.fn(),
    relaunch: vi.fn(),
    getVersion: vi.fn(),
    getName: vi.fn(),
  },
  nativeImage: {
    createFromPath: vi.fn(),
  },
}));

vi.mock('@electron/main/updater', () => ({
  appUpdater: {
    checkForUpdates: vi.fn(),
    quitAndInstall: vi.fn(),
    on: vi.fn(),
  },
}));

vi.mock('@electron/utils/store', () => ({
  getAllSettings: (...args: unknown[]) => getAllSettingsMock(...args),
  getSetting: (...args: unknown[]) => getSettingMock(...args),
  resetSettings: (...args: unknown[]) => resetSettingsMock(...args),
  setSetting: (...args: unknown[]) => setSettingMock(...args),
}));

describe('registerIpcHandlers settings runtime effects', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    getAllSettingsMock.mockResolvedValue({
      gatewayPort: 19001,
      proxyEnabled: true,
    });
    getSettingMock.mockResolvedValue(undefined);
    resetSettingsMock.mockResolvedValue(undefined);
    setSettingMock.mockResolvedValue(undefined);
  });

  it('routes settings mutations through the runtime controller for both legacy IPC and app:request', async () => {
    const { registerIpcHandlers } = await import('@electron/main/ipc-handlers');
    const gatewayManager = {
      on: vi.fn(),
      getStatus: vi.fn().mockReturnValue({ state: 'stopped', port: 18789 }),
      isConnected: vi.fn().mockReturnValue(false),
      start: vi.fn(),
      stop: vi.fn(),
      restart: vi.fn(),
    };
    const applySettingsRuntimeEffects = vi.fn().mockResolvedValue(undefined);
    const gatewayRuntimeController = {
      requestStart: vi.fn().mockResolvedValue(undefined),
      requestStop: vi.fn().mockResolvedValue(undefined),
      requestRestart: vi.fn().mockResolvedValue(undefined),
      applySettingsRuntimeEffects,
    };

    registerIpcHandlers(
      gatewayManager as never,
      gatewayRuntimeController as never,
      {} as never,
      {
        isDestroyed: vi.fn().mockReturnValue(false),
        webContents: {
          send: vi.fn(),
        },
      } as never,
    );

    const handlers = new Map(
      handleMock.mock.calls.map(([channel, handler]) => [channel as string, handler as (...args: unknown[]) => Promise<unknown>]),
    );

    await handlers.get('settings:set')?.(undefined, 'gatewayPort', 19001);
    await handlers.get('settings:setMany')?.(undefined, { proxyEnabled: true });
    await handlers.get('settings:reset')?.(undefined);
    await handlers.get('app:request')?.(undefined, {
      id: 'req-1',
      module: 'settings',
      action: 'set',
      payload: { key: 'launchAtStartup', value: true },
    });

    expect(applySettingsRuntimeEffects).toHaveBeenNthCalledWith(1, {
      gatewayPort: 19001,
      applyProxySettings: null,
      applyLaunchAtStartup: null,
    });
    expect(applySettingsRuntimeEffects).toHaveBeenNthCalledWith(2, {
      gatewayPort: undefined,
      applyProxySettings: expect.any(Function),
      applyLaunchAtStartup: null,
    });
    expect(applySettingsRuntimeEffects).toHaveBeenNthCalledWith(3, {
      gatewayPort: 19001,
      applyProxySettings: expect.any(Function),
      applyLaunchAtStartup: expect.any(Function),
    });
    expect(applySettingsRuntimeEffects).toHaveBeenNthCalledWith(4, {
      gatewayPort: undefined,
      applyProxySettings: null,
      applyLaunchAtStartup: expect.any(Function),
    });
  });
});
