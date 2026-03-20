import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WebSocketServer } from 'ws';

const execMock = vi.fn();

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn().mockReturnValue('/tmp'),
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

describe('findExistingGatewayProcess', () => {
  let wss: WebSocketServer | null = null;
  let port = 0;

  beforeEach(() => {
    execMock.mockReset();
  });

  afterEach(async () => {
    if (!wss) {
      return;
    }

    await new Promise<void>((resolve, reject) => {
      wss?.close((error) => error ? reject(error) : resolve());
    });
    wss = null;
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
});
