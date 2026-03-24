import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EventEmitter } from 'events';
import { createServer, type Server } from 'net';

const spawnMock = vi.fn();
const getSettingMock = vi.fn();
const setSettingMock = vi.fn();
const inspectStudioPythonEnvMock = vi.fn();
const ensureStudioPythonEnvMock = vi.fn();
const listAgentsSnapshotMock = vi.fn();

vi.mock('child_process', () => ({
  spawn: (...args: unknown[]) => spawnMock(...args),
  default: {
    spawn: (...args: unknown[]) => spawnMock(...args),
  },
}));

vi.mock('@electron/utils/store', () => ({
  getSetting: (...args: unknown[]) => getSettingMock(...args),
  setSetting: (...args: unknown[]) => setSettingMock(...args),
}));

vi.mock('@electron/studio/python-env', () => ({
  inspectStudioPythonEnv: (...args: unknown[]) => inspectStudioPythonEnvMock(...args),
  ensureStudioPythonEnv: (...args: unknown[]) => ensureStudioPythonEnvMock(...args),
}));

vi.mock('@electron/utils/agent-config', () => ({
  listAgentsSnapshot: (...args: unknown[]) => listAgentsSnapshotMock(...args),
}));

vi.mock('@electron/studio/paths', () => ({
  getStudioBackendDir: () => '/tmp/studio-backend',
  getStudioBackendEntryPath: () => '/tmp/studio-backend/app.py',
  getStudioDataDir: () => '/tmp/studio-data',
  getStudioRuntimeDir: () => '/tmp/studio-runtime',
}));

vi.mock('@electron/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

class FakeChildProcess extends EventEmitter {
  stdout = new EventEmitter();
  stderr = new EventEmitter();
  kill = vi.fn(() => true);
}

describe('StudioRuntimeManager', () => {
  let occupiedServer: Server | null = null;
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    getSettingMock.mockResolvedValue(3211);
    setSettingMock.mockResolvedValue(undefined);
    listAgentsSnapshotMock.mockResolvedValue({
      agents: [{ id: 'main', workspace: 'C:\\Users\\tester\\workspace' }],
    });
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
    spawnMock.mockImplementation(() => new FakeChildProcess());
    originalFetch = global.fetch;
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true })));
  });

  afterEach(async () => {
    if (occupiedServer && occupiedServer.listening) {
      await new Promise<void>((resolve, reject) => {
        occupiedServer?.close((error) => {
          occupiedServer = null;
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      });
    }
    vi.unstubAllGlobals();
    global.fetch = originalFetch;
  });

  it('allocates a fallback port when the preferred studio port is already bound on all interfaces', async () => {
    const preferredPort = await new Promise<number>((resolve, reject) => {
      const probe = createServer();
      probe.once('error', reject);
      probe.listen(0, '0.0.0.0', () => {
        const address = probe.address();
        if (!address || typeof address === 'string') {
          probe.close(() => reject(new Error('Failed to allocate preferred test port')));
          return;
        }
        probe.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve(address.port);
        });
      });
    });
    getSettingMock.mockResolvedValue(preferredPort);
    occupiedServer = createServer();
    await new Promise<void>((resolve, reject) => {
      occupiedServer?.once('error', reject);
      occupiedServer?.listen(preferredPort, '0.0.0.0', () => resolve());
    });

    const { StudioRuntimeManager } = await import('@electron/studio/runtime-manager');
    const manager = new StudioRuntimeManager();

    const snapshot = await manager.start();

    expect(snapshot.status).toBe('ready');
    expect(snapshot.port).not.toBe(preferredPort);
    expect(typeof snapshot.port).toBe('number');
    expect(setSettingMock).toHaveBeenCalledWith('studioPort', snapshot.port);
    expect(spawnMock).toHaveBeenCalledTimes(1);
  });
});
