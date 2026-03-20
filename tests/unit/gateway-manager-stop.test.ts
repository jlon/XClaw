import { beforeEach, describe, expect, it, vi } from 'vitest';
import WebSocket from 'ws';

vi.mock('electron', () => ({
  app: {
    getPath: () => '/tmp',
    isPackaged: false,
  },
  utilityProcess: {
    fork: vi.fn(),
  },
}));

describe('GatewayManager stop', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('does not shut down an external gateway when explicitly asked to detach only', async () => {
    const { GatewayManager } = await import('@electron/gateway/manager');
    const manager = new GatewayManager();
    const rpcMock = vi.fn().mockResolvedValue(undefined);
    const closeMock = vi.fn();

    Object.assign(manager as unknown as {
      ownsProcess: boolean;
      externalShutdownSupported: boolean | null;
      ws: { readyState: number; close: (code?: number, reason?: string) => void } | null;
      rpc: typeof rpcMock;
    }, {
      ownsProcess: false,
      externalShutdownSupported: null,
      ws: {
        readyState: WebSocket.OPEN,
        close: closeMock,
      },
      rpc: rpcMock,
    });

    await (manager as unknown as {
      stop: (options?: { shutdownExternal?: boolean }) => Promise<void>;
    }).stop({ shutdownExternal: false });

    expect(rpcMock).not.toHaveBeenCalled();
    expect(closeMock).toHaveBeenCalledWith(1000, 'Gateway stopped by user');
  });

  it('keeps the default manual stop behavior for external gateways', async () => {
    const { GatewayManager } = await import('@electron/gateway/manager');
    const manager = new GatewayManager();
    const rpcMock = vi.fn().mockResolvedValue(undefined);
    const closeMock = vi.fn();

    Object.assign(manager as unknown as {
      ownsProcess: boolean;
      externalShutdownSupported: boolean | null;
      ws: { readyState: number; close: (code?: number, reason?: string) => void } | null;
      rpc: typeof rpcMock;
    }, {
      ownsProcess: false,
      externalShutdownSupported: null,
      ws: {
        readyState: WebSocket.OPEN,
        close: closeMock,
      },
      rpc: rpcMock,
    });

    await manager.stop();

    expect(rpcMock).toHaveBeenCalledWith('shutdown', undefined, 5000);
    expect(closeMock).toHaveBeenCalledWith(1000, 'Gateway stopped by user');
  });
});
