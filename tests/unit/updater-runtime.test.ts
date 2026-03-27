import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  autoUpdaterMock,
  checkForUpdatesMock,
  downloadUpdateMock,
  getSettingMock,
  quitAndInstallMock,
  sendMock,
  setFeedUrlMock,
} = vi.hoisted(() => {
  const listeners = new Map<string, Array<(...args: unknown[]) => void>>();
  const emitter: {
    autoDownload: boolean;
    checkForUpdates: typeof checkForUpdatesMock;
    downloadUpdate: typeof downloadUpdateMock;
    quitAndInstall: typeof quitAndInstallMock;
    setFeedURL: typeof setFeedUrlMock;
    emit: (event: string, ...args: unknown[]) => boolean;
    on: (event: string, handler: (...args: unknown[]) => void) => typeof emitter;
    removeAllListeners: () => typeof emitter;
  } = {
    autoDownload: false,
    checkForUpdates: vi.fn().mockResolvedValue(null),
    downloadUpdate: vi.fn().mockResolvedValue(['/tmp/XClaw.exe']),
    quitAndInstall: vi.fn(),
    setFeedURL: vi.fn(),
    emit: (event: string, ...args: unknown[]) => {
      const handlers = listeners.get(event) ?? [];
      handlers.forEach((handler) => handler(...args));
      return handlers.length > 0;
    },
    on: (event: string, handler: (...args: unknown[]) => void) => {
      const handlers = listeners.get(event) ?? [];
      handlers.push(handler);
      listeners.set(event, handlers);
      return emitter;
    },
    removeAllListeners: () => {
      listeners.clear();
      return emitter;
    },
  };

  return {
    autoUpdaterMock: emitter,
    checkForUpdatesMock: emitter.checkForUpdates,
    downloadUpdateMock: emitter.downloadUpdate,
    getSettingMock: vi.fn(),
    quitAndInstallMock: emitter.quitAndInstall,
    sendMock: vi.fn(),
    setFeedUrlMock: emitter.setFeedURL,
  };
});

const originalPlatform = process.platform;
const fetchMock = vi.fn();

vi.mock('electron', () => ({
  app: {
    getVersion: vi.fn(() => '2026.3.23'),
    isPackaged: true,
  },
  ipcMain: {
    handle: vi.fn(),
  },
  BrowserWindow: vi.fn(),
}));

vi.mock('electron-updater', () => ({
  autoUpdater: autoUpdaterMock,
}));

vi.mock('@electron/utils/store', () => ({
  getSetting: (...args: unknown[]) => getSettingMock(...args),
}));

vi.mock('@electron/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('AppUpdater runtime', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    autoUpdaterMock.removeAllListeners();
    Object.defineProperty(process, 'platform', { value: 'win32' });
    vi.stubGlobal('fetch', fetchMock);
    getSettingMock.mockImplementation(async (key: string) => {
      if (key === 'updateChannel') {
        return 'beta';
      }
      if (key === 'autoDownloadUpdate') {
        return false;
      }
      return undefined;
    });
  });

  afterAll(() => {
    Object.defineProperty(process, 'platform', { value: originalPlatform });
  });

  it('configures the beta feed and delegates update checks to electron-updater', async () => {
    const { AppUpdater } = await import('@electron/main/updater');
    const updater = new AppUpdater();

    updater.setMainWindow({
      isDestroyed: () => false,
      webContents: {
        send: sendMock,
      },
    } as never);

    updater.setChannel('beta');
    await updater.checkForUpdates();
    autoUpdaterMock.emit('checking-for-update');

    expect(setFeedUrlMock).toHaveBeenCalledWith(expect.objectContaining({
      provider: 'generic',
      url: expect.stringContaining('/downloads/updates/beta'),
    }));
    expect(checkForUpdatesMock).toHaveBeenCalledTimes(1);
    expect(updater.getStatus().status).toBe('checking');
  });

  it('delegates downloading and install handoff to electron-updater', async () => {
    const { AppUpdater } = await import('@electron/main/updater');
    const updater = new AppUpdater();

    await updater.downloadUpdate();
    updater.quitAndInstall();

    expect(downloadUpdateMock).toHaveBeenCalledTimes(1);
    expect(quitAndInstallMock).toHaveBeenCalledTimes(1);
  });

  it('uses manual beta metadata on macOS and does not delegate installer download/install to electron-updater', async () => {
    Object.defineProperty(process, 'platform', { value: 'darwin' });
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        version: '2026.3.26-beta.0',
        releaseDate: '2026-03-26T08:00:00.000Z',
        downloads: {
          macArm64: {
            name: 'XClaw-2026.3.26-beta.0-mac-arm64.dmg',
          },
        },
      }),
    });

    const { AppUpdater } = await import('@electron/main/updater');
    const updater = new AppUpdater();

    await updater.checkForUpdates();

    expect(checkForUpdatesMock).not.toHaveBeenCalled();
    expect(updater.getStatus()).toEqual(expect.objectContaining({
      status: 'available',
      info: expect.objectContaining({
        version: '2026.3.26-beta.0',
        downloadUrl: expect.stringContaining('XClaw-2026.3.26-beta.0-mac-arm64.dmg'),
      }),
    }));

    await expect(updater.downloadUpdate()).rejects.toThrow('Manual update is required on macOS');
    updater.quitAndInstall();

    expect(downloadUpdateMock).not.toHaveBeenCalled();
    expect(quitAndInstallMock).not.toHaveBeenCalled();
  });
});
