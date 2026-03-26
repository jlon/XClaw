import { beforeEach, describe, expect, it, vi } from 'vitest';

const handleMock = vi.fn();
const checkUvInstalledMock = vi.fn();
const installUvMock = vi.fn();
const isPythonReadyMock = vi.fn();
const setupManagedPythonMock = vi.fn();
const inspectStudioPythonEnvMock = vi.fn();
const ensureStudioPythonEnvMock = vi.fn();
const createAbortError = () => Object.assign(new Error('Environment preparation cancelled'), { name: 'AbortError' });

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
    expect(isPythonReadyMock).not.toHaveBeenCalled();
  });

  it('registers a setup environment prepare channel that reports running progress and final success', async () => {
    checkUvInstalledMock.mockResolvedValueOnce(false).mockResolvedValue(true);

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

    await expect(handlers.get('setup:prepare-environment')?.(undefined)).resolves.toMatchObject({
      state: 'running',
      step: 'uv',
      canCancel: true,
      error: null,
    });

    await vi.waitFor(async () => {
      await expect(handlers.get('setup:prepare-environment-status')?.(undefined)).resolves.toMatchObject({
        state: 'succeeded',
        step: 'verify',
        canCancel: false,
        error: null,
      });
    });

    const finalStatus = await handlers.get('setup:prepare-environment-status')?.(undefined) as {
      logs: Array<{ message: string }>;
    };

    expect(finalStatus.logs.map((entry) => entry.message)).toEqual(expect.arrayContaining([
      expect.stringContaining('uv'),
      expect.stringContaining('Python'),
      expect.stringContaining('Studio'),
    ]));
    expect(installUvMock).toHaveBeenCalledTimes(1);
    expect(setupManagedPythonMock).toHaveBeenCalledTimes(1);
    expect(ensureStudioPythonEnvMock).toHaveBeenCalledTimes(1);
  });

  it('cancels an in-flight setup environment preparation task', async () => {
    inspectStudioPythonEnvMock.mockResolvedValue({
      uvInstalled: true,
      interpreterReady: false,
      dependenciesReady: false,
      pythonPath: null,
      venvPythonPath: null,
      error: 'Managed Python 3.12 is not ready',
    });
    setupManagedPythonMock.mockImplementation(async ({ signal, onLog }: {
      signal?: AbortSignal;
      onLog?: (entry: { level: string; message: string }) => void;
    } = {}) => {
      onLog?.({ level: 'info', message: 'Installing managed Python 3.12' });
      return await new Promise((_resolve, reject) => {
        signal?.addEventListener('abort', () => reject(createAbortError()), { once: true });
      });
    });

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

    await expect(handlers.get('setup:prepare-environment')?.(undefined)).resolves.toMatchObject({
      state: 'running',
      canCancel: true,
    });

    await expect(handlers.get('setup:prepare-environment-cancel')?.(undefined)).resolves.toMatchObject({
      success: true,
    });

    await vi.waitFor(async () => {
      await expect(handlers.get('setup:prepare-environment-status')?.(undefined)).resolves.toMatchObject({
        state: 'cancelled',
        canCancel: false,
        error: null,
      });
    });

    const cancelledStatus = await handlers.get('setup:prepare-environment-status')?.(undefined) as {
      logs: Array<{ message: string }>;
    };

    expect(cancelledStatus.logs.at(-1)?.message).toContain('cancel');
    expect(ensureStudioPythonEnvMock).not.toHaveBeenCalled();
  });
});
