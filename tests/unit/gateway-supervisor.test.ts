import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WebSocketServer } from 'ws';
import { createServer } from 'node:net';
import { existsSync, mkdirSync, rmSync } from 'node:fs';

const execMock = vi.fn();
const getSettingMock = vi.fn();
const isPythonReadyMock = vi.fn();
const setupManagedPythonMock = vi.fn();
const userDataDir = `/tmp/xclaw-vitest-gateway-supervisor-${process.pid}`;

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn().mockReturnValue(userDataDir),
    isPackaged: false,
  },
  utilityProcess: {
    fork: vi.fn(),
  },
}));

vi.mock('child_process', async () => {
  const actual = await vi.importActual<typeof import('child_process')>('child_process');
  return {
    ...actual,
    default: {
      ...actual,
      exec: (...args: unknown[]) => execMock(...args),
    },
    exec: (...args: unknown[]) => execMock(...args),
  };
});

vi.mock('@electron/utils/store', () => ({
  getSetting: (...args: unknown[]) => getSettingMock(...args),
}));

vi.mock('@electron/utils/uv-setup', () => ({
  isPythonReady: (...args: unknown[]) => isPythonReadyMock(...args),
  setupManagedPython: (...args: unknown[]) => setupManagedPythonMock(...args),
}));

describe('findExistingGatewayProcess', () => {
  let wss: WebSocketServer | null = null;
  let port = 0;

  beforeEach(() => {
    execMock.mockReset();
    mkdirSync(userDataDir, { recursive: true });
  });

  afterEach(async () => {
    if (!wss) {
      rmSync(userDataDir, { recursive: true, force: true });
      return;
    }

    await new Promise<void>((resolve, reject) => {
      wss?.close((error) => error ? reject(error) : resolve());
    });
    wss = null;
    rmSync(userDataDir, { recursive: true, force: true });
  });

  it('reuses an existing gateway only after receiving the protocol challenge', async () => {
    wss = await new Promise<WebSocketServer>((resolve) => {
      const server = new WebSocketServer({ host: '127.0.0.1', port: 0 });
      server.on('listening', () => resolve(server));
    });
    wss.on('connection', (socket) => {
      socket.send(JSON.stringify({
        type: 'event',
        event: 'connect.challenge',
        params: { nonce: 'test-nonce' },
      }));
    });

    const address = wss.address();
    port = typeof address === 'object' && address ? address.port : 0;

    const { findExistingGatewayProcess } = await import('@electron/gateway/supervisor');
    const existing = await findExistingGatewayProcess({ port });

    expect(existing).toEqual({ port });
    expect(execMock).not.toHaveBeenCalled();
  }, 15000);

  it('does not mistake an arbitrary websocket listener for an existing gateway', async () => {
    execMock.mockImplementation((_cmd, _options, callback) => {
      callback?.(new Error('not found'), '', '');
    });

    wss = await new Promise<WebSocketServer>((resolve) => {
      const server = new WebSocketServer({ host: '127.0.0.1', port: 0 });
      server.on('listening', () => resolve(server));
    });

    const address = wss.address();
    port = typeof address === 'object' && address ? address.port : 0;

    const { findExistingGatewayProcess } = await import('@electron/gateway/supervisor');
    const existing = await findExistingGatewayProcess({ port });

    expect(existing).toBeNull();
    expect(execMock).toHaveBeenCalled();
  });

  it('preserves ownership metadata when the listening gateway is the managed child process', async () => {
    execMock.mockImplementation((_cmd, _options, callback) => {
      callback?.(null, '12345\n', '');
    });

    wss = await new Promise<WebSocketServer>((resolve) => {
      const server = new WebSocketServer({ host: '127.0.0.1', port: 0 });
      server.on('listening', () => resolve(server));
    });
    wss.on('connection', (socket) => {
      socket.send(JSON.stringify({
        type: 'event',
        event: 'connect.challenge',
        params: { nonce: 'test-nonce' },
      }));
    });

    const address = wss.address();
    port = typeof address === 'object' && address ? address.port : 0;

    const { findExistingGatewayProcess } = await import('@electron/gateway/supervisor');
    const existing = await findExistingGatewayProcess({ port, ownedPid: 12345 });

    expect(existing).toEqual({ port, pid: 12345, owned: true });
  }, 15000);

  it('waits for a pending quit handoff before declaring that no existing gateway is available', async () => {
    execMock.mockImplementation((_cmd, _options, callback) => {
      callback?.(new Error('not found'), '', '');
    });

    const claimedPort = await new Promise<number>((resolve, reject) => {
      const server = createServer();
      server.once('error', reject);
      server.listen(0, '127.0.0.1', () => {
        const address = server.address();
        const nextPort = typeof address === 'object' && address ? address.port : 0;
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve(nextPort);
        });
      });
    });

    port = claimedPort;
    const { writeGatewayHandoffMarker } = await import('@electron/gateway/handoff-marker');
    await writeGatewayHandoffMarker({
      port,
      waitForPid: 12345,
      createdAt: Date.now(),
      expiresAt: Date.now() + 5000,
    });

    setTimeout(() => {
      void new Promise<WebSocketServer>((resolve) => {
        const server = new WebSocketServer({ host: '127.0.0.1', port });
        server.on('listening', () => resolve(server));
      }).then((server) => {
        wss = server;
        wss.on('connection', (socket) => {
          socket.send(JSON.stringify({
            type: 'event',
            event: 'connect.challenge',
            params: { nonce: 'test-nonce' },
          }));
        });
      });
    }, 250);

    const { findExistingGatewayProcess } = await import('@electron/gateway/supervisor');
    const existing = await findExistingGatewayProcess({ port });

    expect(existing).toEqual({ port });
    expect(existsSync(`${userDataDir}/gateway-handoff.json`)).toBe(false);
  }, 15000);

  it('keeps a minimum attach window for late restarts during a pending handoff', async () => {
    execMock.mockImplementation((_cmd, _options, callback) => {
      callback?.(null, '12345\n', '');
    });

    const claimedPort = await new Promise<number>((resolve, reject) => {
      const server = createServer();
      server.once('error', reject);
      server.listen(0, '127.0.0.1', () => {
        const address = server.address();
        const nextPort = typeof address === 'object' && address ? address.port : 0;
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve(nextPort);
        });
      });
    });

    port = claimedPort;
    const { writeGatewayHandoffMarker } = await import('@electron/gateway/handoff-marker');
    await writeGatewayHandoffMarker({
      port,
      waitForPid: 12345,
      createdAt: Date.now() - 5000,
      expiresAt: Date.now() + 50,
    });

    setTimeout(() => {
      void new Promise<WebSocketServer>((resolve) => {
        const server = new WebSocketServer({ host: '127.0.0.1', port });
        server.on('listening', () => resolve(server));
      }).then((server) => {
        wss = server;
      });
    }, 200);

    const { findExistingGatewayProcess } = await import('@electron/gateway/supervisor');
    const existing = await findExistingGatewayProcess({ port });

    expect(existing).toEqual({ port });
    expect(existsSync(`${userDataDir}/gateway-handoff.json`)).toBe(false);
  }, 15000);
});

describe('warmupManagedPythonReadiness', () => {
  beforeEach(() => {
    vi.resetModules();
    getSettingMock.mockReset();
    isPythonReadyMock.mockReset();
    setupManagedPythonMock.mockReset();
    getSettingMock.mockResolvedValue(true);
    isPythonReadyMock.mockResolvedValue(true);
    setupManagedPythonMock.mockResolvedValue(undefined);
  });

  it('skips background Python repair while setup is incomplete', async () => {
    getSettingMock.mockResolvedValue(false);

    const { warmupManagedPythonReadiness } = await import('@electron/gateway/supervisor');
    warmupManagedPythonReadiness();

    await vi.waitFor(() => {
      expect(getSettingMock).toHaveBeenCalledWith('setupComplete');
    });

    expect(isPythonReadyMock).not.toHaveBeenCalled();
    expect(setupManagedPythonMock).not.toHaveBeenCalled();
  });

  it('repairs Python in the background after setup is complete', async () => {
    getSettingMock.mockResolvedValue(true);
    isPythonReadyMock.mockResolvedValue(false);

    const { warmupManagedPythonReadiness } = await import('@electron/gateway/supervisor');
    warmupManagedPythonReadiness();

    await vi.waitFor(() => {
      expect(setupManagedPythonMock).toHaveBeenCalledTimes(1);
    });
  });
});
