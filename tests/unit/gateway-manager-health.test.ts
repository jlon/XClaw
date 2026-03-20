import { beforeEach, describe, expect, it, vi } from 'vitest';
import WebSocket from 'ws';

const terminateOwnedGatewayProcessMock = vi.fn().mockResolvedValue(undefined);
const terminateGatewayProcessesListeningOnPortMock = vi.fn().mockResolvedValue(true);

vi.mock('electron', () => ({
  app: {
    getPath: () => '/tmp',
    isPackaged: false,
  },
  utilityProcess: {
    fork: vi.fn(),
  },
}));

vi.mock('@electron/gateway/supervisor', async () => {
  const actual = await vi.importActual<typeof import('@electron/gateway/supervisor')>('@electron/gateway/supervisor');
  return {
    ...actual,
    terminateGatewayProcessesListeningOnPort: (...args: unknown[]) => terminateGatewayProcessesListeningOnPortMock(...args),
    terminateOwnedGatewayProcess: (...args: unknown[]) => terminateOwnedGatewayProcessMock(...args),
  };
});

describe('GatewayManager health', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    terminateOwnedGatewayProcessMock.mockReset();
    terminateOwnedGatewayProcessMock.mockResolvedValue(undefined);
    terminateGatewayProcessesListeningOnPortMock.mockReset();
    terminateGatewayProcessesListeningOnPortMock.mockResolvedValue(true);
  });

  it('uses system.health rpc when supported', async () => {
    const { GatewayManager } = await import('@electron/gateway/manager');
    const manager = new GatewayManager();
    const rpcMock = vi.fn().mockResolvedValue({
      status: 'healthy',
      uptime: 42,
      version: '2026.3.13',
    });

    Object.assign(manager as unknown as {
      ws: { readyState: number } | null;
      rpc: typeof rpcMock;
      healthRpcSupported: boolean | null;
      status: { connectedAt: number; port: number; state: string };
    }, {
      ws: { readyState: WebSocket.OPEN },
      rpc: rpcMock,
      healthRpcSupported: null,
      status: {
        connectedAt: Date.now() - 42_000,
        port: 18789,
        state: 'running',
      },
    });

    const result = await manager.checkHealth();

    expect(rpcMock).toHaveBeenCalledWith('system.health', undefined, 5000);
    expect(result).toEqual({
      ok: true,
      uptime: 42,
      version: '2026.3.13',
    });
  });

  it('falls back to websocket liveness when system.health is unsupported', async () => {
    const { GatewayManager } = await import('@electron/gateway/manager');
    const manager = new GatewayManager();
    const rpcMock = vi.fn().mockRejectedValue(new Error('unknown method: system.health'));

    Object.assign(manager as unknown as {
      ws: { readyState: number } | null;
      rpc: typeof rpcMock;
      healthRpcSupported: boolean | null;
      status: { connectedAt: number; port: number; state: string };
    }, {
      ws: { readyState: WebSocket.OPEN },
      rpc: rpcMock,
      healthRpcSupported: null,
      status: {
        connectedAt: Date.now() - 15_000,
        port: 18789,
        state: 'running',
      },
    });

    const first = await manager.checkHealth();
    rpcMock.mockClear();
    const second = await manager.checkHealth();

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    expect((manager as unknown as { healthRpcSupported: boolean | null }).healthRpcSupported).toBe(false);
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it('reports unhealthy when system.health rpc fails for a real error', async () => {
    const { GatewayManager } = await import('@electron/gateway/manager');
    const manager = new GatewayManager();
    const rpcMock = vi.fn().mockRejectedValue(new Error('rpc timeout'));

    Object.assign(manager as unknown as {
      ws: { readyState: number } | null;
      rpc: typeof rpcMock;
      healthRpcSupported: boolean | null;
      status: { connectedAt: number; port: number; state: string };
    }, {
      ws: { readyState: WebSocket.OPEN },
      rpc: rpcMock,
      healthRpcSupported: null,
      status: {
        connectedAt: Date.now() - 15_000,
        port: 18789,
        state: 'running',
      },
    });

    const result = await manager.checkHealth();

    expect(result).toEqual({
      ok: false,
      error: 'rpc timeout',
    });
  });

  it('forces reconnect after three consecutive health failures', async () => {
    const { GatewayManager } = await import('@electron/gateway/manager');
    const manager = new GatewayManager();
    const terminateMock = vi.fn();
    const scheduleReconnectMock = vi.fn();
    const setStatusMock = vi.fn();
    let capturedOptions: {
      onUnhealthy: (errorMessage: string) => void;
      onError: (error: unknown) => void;
    } | null = null;

    manager.on('error', () => {});

    Object.assign(manager as unknown as {
      connectionMonitor: { startHealthCheck: (options: unknown) => void };
      ws: { terminate: () => void } | null;
      status: { state: string; port: number };
      scheduleReconnect: () => void;
      setStatus: (update: Record<string, unknown>) => void;
    }, {
      connectionMonitor: {
        startHealthCheck: (options: unknown) => {
          capturedOptions = options as typeof capturedOptions;
        },
      },
      ws: {
        terminate: terminateMock,
      },
      status: {
        state: 'running',
        port: 18789,
      },
      scheduleReconnect: scheduleReconnectMock,
      setStatus: setStatusMock,
    });

    (manager as unknown as { startHealthCheck: () => void }).startHealthCheck();

    expect(capturedOptions).not.toBeNull();

    capturedOptions?.onUnhealthy('rpc timeout');
    capturedOptions?.onUnhealthy('rpc timeout');

    expect(terminateMock).not.toHaveBeenCalled();
    expect(scheduleReconnectMock).not.toHaveBeenCalled();

    capturedOptions?.onUnhealthy('rpc timeout');

    await vi.waitFor(() => {
      expect(terminateMock).toHaveBeenCalledTimes(1);
      expect(setStatusMock).toHaveBeenCalledWith({
        state: 'error',
        error: 'Health check failed: rpc timeout',
      });
      expect(scheduleReconnectMock).toHaveBeenCalledTimes(1);
    });
  });

  it('terminates an owned gateway process before reconnecting after repeated health failures', async () => {
    const { GatewayManager } = await import('@electron/gateway/manager');
    const manager = new GatewayManager();
    const terminateMock = vi.fn();
    const scheduleReconnectMock = vi.fn();
    const setStatusMock = vi.fn();
    const child = { pid: 12345 };
    let capturedOptions: {
      onUnhealthy: (errorMessage: string) => void;
      onError: (error: unknown) => void;
    } | null = null;

    manager.on('error', () => {});

    Object.assign(manager as unknown as {
      connectionMonitor: { startHealthCheck: (options: unknown) => void };
      ws: { terminate: () => void } | null;
      process: typeof child | null;
      ownsProcess: boolean;
      status: { state: string; port: number };
      scheduleReconnect: () => void;
      setStatus: (update: Record<string, unknown>) => void;
    }, {
      connectionMonitor: {
        startHealthCheck: (options: unknown) => {
          capturedOptions = options as typeof capturedOptions;
        },
      },
      ws: {
        terminate: terminateMock,
      },
      process: child,
      ownsProcess: true,
      status: {
        state: 'running',
        port: 18789,
      },
      scheduleReconnect: scheduleReconnectMock,
      setStatus: setStatusMock,
    });

    (manager as unknown as { startHealthCheck: () => void }).startHealthCheck();

    capturedOptions?.onUnhealthy('rpc timeout');
    capturedOptions?.onUnhealthy('rpc timeout');
    capturedOptions?.onUnhealthy('rpc timeout');

    await vi.waitFor(() => {
      expect(terminateOwnedGatewayProcessMock).toHaveBeenCalledWith(child);
      expect(scheduleReconnectMock).toHaveBeenCalledTimes(1);
    });

    expect(terminateMock).toHaveBeenCalledTimes(1);
    expect(setStatusMock).toHaveBeenCalledWith({
      state: 'error',
      error: 'Health check failed: rpc timeout',
    });
  });

  it('does not reconnect when recovery arbitration denies automatic recovery', async () => {
    const { GatewayManager } = await import('@electron/gateway/manager');
    const manager = new GatewayManager();
    const terminateMock = vi.fn();
    const scheduleReconnectMock = vi.fn();
    const status = {
      state: 'running',
      port: 18789,
    };
    const setStatusMock = vi.fn((update: Record<string, unknown>) => {
      Object.assign(status, update);
    });
    const recoveryArbiterMock = vi.fn().mockResolvedValue(false);
    let capturedOptions: {
      onUnhealthy: (errorMessage: string) => void;
      onError: (error: unknown) => void;
    } | null = null;

    manager.on('error', () => {});

    Object.assign(manager as unknown as {
      connectionMonitor: { startHealthCheck: (options: unknown) => void };
      ws: { terminate: () => void } | null;
      status: { state: string; port: number };
      scheduleReconnect: () => void;
      setStatus: (update: Record<string, unknown>) => void;
    }, {
      connectionMonitor: {
        startHealthCheck: (options: unknown) => {
          capturedOptions = options as typeof capturedOptions;
        },
      },
      ws: {
        terminate: terminateMock,
      },
      status,
      scheduleReconnect: scheduleReconnectMock,
      setStatus: setStatusMock,
    });

    (manager as unknown as {
      setRecoveryArbiter: (arbiter: typeof recoveryArbiterMock) => void;
    }).setRecoveryArbiter(recoveryArbiterMock);

    (manager as unknown as { startHealthCheck: () => void }).startHealthCheck();

    capturedOptions?.onUnhealthy('rpc timeout');
    capturedOptions?.onUnhealthy('rpc timeout');
    capturedOptions?.onUnhealthy('rpc timeout');

    await vi.waitFor(() => {
      expect(recoveryArbiterMock).toHaveBeenCalledWith(expect.objectContaining({
        trigger: 'health-check',
        plannedAction: 'reconnect',
        currentState: 'error',
        ownsProcess: false,
        reconnectAttempts: 0,
        error: 'rpc timeout',
      }));
    });

    expect(terminateMock).toHaveBeenCalledTimes(1);
    expect(scheduleReconnectMock).not.toHaveBeenCalled();
  });

  it('force-replaces an externally attached gateway by port before starting again', async () => {
    const { GatewayManager } = await import('@electron/gateway/manager');
    const manager = new GatewayManager();
    const startMock = vi.fn().mockResolvedValue(undefined);
    const setStatusMock = vi.fn();
    const wsCloseMock = vi.fn();

    Object.assign(manager as unknown as {
      process: null;
      ownsProcess: boolean;
      start: () => Promise<void>;
      ws: { close: (code: number, reason: string) => void } | null;
      status: { state: string; port: number; pid?: number };
      setStatus: (update: Record<string, unknown>) => void;
      clearAllTimers: () => void;
    }, {
      process: null,
      ownsProcess: false,
      start: startMock,
      ws: {
        close: wsCloseMock,
      },
      status: {
        state: 'running',
        port: 18789,
      },
      setStatus: setStatusMock,
      clearAllTimers: vi.fn(),
    });

    await (manager as unknown as { replaceRuntime: () => Promise<void> }).replaceRuntime();

    expect(terminateGatewayProcessesListeningOnPortMock).toHaveBeenCalledWith(18789);
    expect(wsCloseMock).toHaveBeenCalledWith(1000, 'Gateway runtime replaced');
    expect(startMock).toHaveBeenCalledTimes(1);
    expect(setStatusMock).toHaveBeenCalledWith({
      state: 'stopped',
      error: undefined,
      pid: undefined,
      connectedAt: undefined,
      uptime: undefined,
    });
  });
});
