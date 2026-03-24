import { beforeEach, describe, expect, it, vi } from 'vitest';

const handleMock = vi.fn();
const checkUvInstalledMock = vi.fn();
const installUvMock = vi.fn();
const isPythonReadyMock = vi.fn();
const setupManagedPythonMock = vi.fn();
const inspectStudioPythonEnvMock = vi.fn();
const ensureStudioPythonEnvMock = vi.fn();

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

vi.mock('@electron/utils/uv-setup', () => ({
  checkUvInstalled: (...args: unknown[]) => checkUvInstalledMock(...args),
  installUv: (...args: unknown[]) => installUvMock(...args),
  isPythonReady: (...args: unknown[]) => isPythonReadyMock(...args),
  setupManagedPython: (...args: unknown[]) => setupManagedPythonMock(...args),
}));

vi.mock('@electron/studio/python-env', () => ({
  inspectStudioPythonEnv: (...args: unknown[]) => inspectStudioPythonEnvMock(...args),
  ensureStudioPythonEnv: (...args: unknown[]) => ensureStudioPythonEnvMock(...args),
}));

describe('registerIpcHandlers setup environment channels', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    checkUvInstalledMock.mockResolvedValue(true);
    isPythonReadyMock.mockResolvedValue(true);
    installUvMock.mockResolvedValue(undefined);
    setupManagedPythonMock.mockResolvedValue(undefined);
    inspectStudioPythonEnvMock.mockResolvedValue({
      uvInstalled: true,
      interpreterReady: true,
      dependenciesReady: true,
      pythonPath: 'C:\\Users\\tester\\AppData\\Local\\uv\\python.exe',
      venvPythonPath: 'C:\\Users\\tester\\AppData\\Roaming\\XClaw\\studio\\.venv\\Scripts\\python.exe',
      error: null,
    });
    ensureStudioPythonEnvMock.mockResolvedValue({
      uvInstalled: true,
      interpreterReady: true,
      dependenciesReady: true,
      pythonPath: 'C:\\Users\\tester\\AppData\\Local\\uv\\python.exe',
      venvPythonPath: 'C:\\Users\\tester\\AppData\\Roaming\\XClaw\\studio\\.venv\\Scripts\\python.exe',
      error: null,
    });
  });

  it('registers a setup environment status channel that includes studio dependency readiness', async () => {
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
        webContents: { send: vi.fn() },
      } as never,
    );

    const handlers = new Map(
      handleMock.mock.calls.map(([channel, handler]) => [channel as string, handler as (...args: unknown[]) => Promise<unknown>]),
    );

    await expect(handlers.get('setup:environment-status')?.(undefined)).resolves.toEqual({
      uvInstalled: true,
      pythonReady: true,
      studioDependenciesReady: true,
      studioInterpreterReady: true,
      studioError: null,
    });
  });

  it('registers a setup environment prepare channel that provisions uv, Python, and studio dependencies together', async () => {
    checkUvInstalledMock.mockResolvedValue(false);

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
        webContents: { send: vi.fn() },
      } as never,
    );

    const handlers = new Map(
      handleMock.mock.calls.map(([channel, handler]) => [channel as string, handler as (...args: unknown[]) => Promise<unknown>]),
    );

    await expect(handlers.get('setup:prepare-environment')?.(undefined)).resolves.toEqual({ success: true });
    expect(installUvMock).toHaveBeenCalledTimes(1);
    expect(setupManagedPythonMock).toHaveBeenCalledTimes(1);
    expect(ensureStudioPythonEnvMock).toHaveBeenCalledTimes(1);
  });
});
