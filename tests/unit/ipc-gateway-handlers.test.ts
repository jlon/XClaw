import { beforeEach, describe, expect, it, vi } from 'vitest';

const handleMock = vi.fn();
const saveChannelConfigMock = vi.fn();
const setChannelEnabledMock = vi.fn();

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

vi.mock('@electron/utils/channel-config', () => ({
  saveChannelConfig: (...args: unknown[]) => saveChannelConfigMock(...args),
  getChannelConfig: vi.fn(),
  getChannelFormValues: vi.fn(),
  deleteChannelConfig: vi.fn(),
  listConfiguredChannels: vi.fn().mockResolvedValue([]),
  setChannelEnabled: (...args: unknown[]) => setChannelEnabledMock(...args),
  validateChannelConfig: vi.fn(),
  validateChannelCredentials: vi.fn(),
}));

vi.mock('@electron/utils/plugin-install', () => ({
  ensureDingTalkPluginInstalled: vi.fn().mockResolvedValue({ installed: true }),
  ensureFeishuPluginInstalled: vi.fn().mockResolvedValue({ installed: true }),
  ensureQQBotPluginInstalled: vi.fn().mockResolvedValue({ installed: true }),
  ensureWeComPluginInstalled: vi.fn().mockResolvedValue({ installed: true }),
}));

vi.mock('@electron/main/updater', () => ({
  appUpdater: {
    checkForUpdates: vi.fn(),
    quitAndInstall: vi.fn(),
    on: vi.fn(),
  },
}));

describe('registerIpcHandlers gateway lifecycle channels', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    saveChannelConfigMock.mockResolvedValue(undefined);
    setChannelEnabledMock.mockResolvedValue(undefined);
  });

  it('routes gateway start stop restart IPC through the runtime controller', async () => {
    const { registerIpcHandlers } = await import('@electron/main/ipc-handlers');
    const gatewayManager = {
      on: vi.fn(),
      getStatus: vi.fn().mockReturnValue({ state: 'stopped', port: 18789 }),
      isConnected: vi.fn().mockReturnValue(false),
      start: vi.fn(),
      stop: vi.fn(),
      restart: vi.fn(),
    };
    const gatewayRuntimeController = {
      requestStart: vi.fn().mockResolvedValue(undefined),
      requestStop: vi.fn().mockResolvedValue(undefined),
      requestRestart: vi.fn().mockResolvedValue(undefined),
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

    await handlers.get('gateway:start')?.(undefined);
    await handlers.get('gateway:stop')?.(undefined);
    await handlers.get('gateway:restart')?.(undefined);

    expect(gatewayRuntimeController.requestStart).toHaveBeenCalledTimes(1);
    expect(gatewayRuntimeController.requestStop).toHaveBeenCalledTimes(1);
    expect(gatewayRuntimeController.requestRestart).toHaveBeenCalledTimes(1);
    expect(gatewayManager.start).not.toHaveBeenCalled();
    expect(gatewayManager.stop).not.toHaveBeenCalled();
    expect(gatewayManager.restart).not.toHaveBeenCalled();
  });

  it('routes legacy channel IPC refreshes through the runtime controller', async () => {
    const { registerIpcHandlers } = await import('@electron/main/ipc-handlers');
    const gatewayManager = {
      on: vi.fn(),
      getStatus: vi.fn().mockReturnValue({ state: 'running', port: 18789 }),
      isConnected: vi.fn().mockReturnValue(true),
      start: vi.fn(),
      stop: vi.fn(),
      restart: vi.fn(),
      debouncedReload: vi.fn(),
      debouncedRestart: vi.fn(),
    };
    const gatewayRuntimeController = {
      requestStart: vi.fn().mockResolvedValue(undefined),
      requestStop: vi.fn().mockResolvedValue(undefined),
      requestRestart: vi.fn().mockResolvedValue(undefined),
      requestRuntimeRefresh: vi.fn().mockResolvedValue(undefined),
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

    await handlers.get('channel:saveConfig')?.(undefined, 'feishu', { appId: '123' });
    await handlers.get('channel:setEnabled')?.(undefined, 'telegram', true);

    expect(gatewayRuntimeController.requestRuntimeRefresh).toHaveBeenNthCalledWith(1, { mode: 'reload' });
    expect(gatewayRuntimeController.requestRuntimeRefresh).toHaveBeenNthCalledWith(2, { mode: 'restart' });
    expect(gatewayManager.debouncedReload).not.toHaveBeenCalled();
    expect(gatewayManager.debouncedRestart).not.toHaveBeenCalled();
  });
});
