import { beforeEach, describe, expect, it, vi } from 'vitest';
import WebSocket from 'ws';

const prepareGatewayLaunchContextMock = vi.fn();
const launchGatewayHandoffProcessMock = vi.fn().mockResolvedValue(undefined);

vi.mock('electron', () => ({
  app: {
    getPath: () => '/tmp',
    isPackaged: false,
  },
  utilityProcess: {
    fork: vi.fn(),
  },
}));

vi.mock('@electron/gateway/config-sync', async () => {
  const actual = await vi.importActual<typeof import('@electron/gateway/config-sync')>('@electron/gateway/config-sync');
  return {
    ...actual,
    prepareGatewayLaunchContext: (...args: unknown[]) => prepareGatewayLaunchContextMock(...args),
  };
});

vi.mock('@electron/gateway/process-launcher', async () => {
  const actual = await vi.importActual<typeof import('@electron/gateway/process-launcher')>('@electron/gateway/process-launcher');
  return {
    ...actual,
    launchGatewayHandoffProcess: (...args: unknown[]) => launchGatewayHandoffProcessMock(...args),
  };
});

describe('GatewayManager stop', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    prepareGatewayLaunchContextMock.mockResolvedValue({
      openclawDir: '/tmp/openclaw',
      entryScript: '/tmp/openclaw/openclaw.mjs',
      gatewayArgs: ['gateway', '--port', '18789'],
      forkEnv: {},
    });
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

  it('detaches on quit without killing an owned gateway process', async () => {
    const { GatewayManager } = await import('@electron/gateway/manager');
    const manager = new GatewayManager();
    const closeMock = vi.fn();
    const childKillMock = vi.fn();
    const child = {
      pid: 12345,
      kill: childKillMock,
    };

    Object.assign(manager as unknown as {
      ownsProcess: boolean;
      process: typeof child | null;
      ws: { readyState: number; close: (code?: number, reason?: string) => void } | null;
      status: { state: string; port: number; pid?: number };
    }, {
      ownsProcess: true,
      process: child,
      ws: {
        readyState: WebSocket.OPEN,
        close: closeMock,
      },
      status: {
        state: 'running',
        port: 18789,
        pid: 12345,
      },
    });

    await (manager as unknown as {
      detach: (options?: { reason?: 'quit' | 'handoff' }) => Promise<void>;
    }).detach({ reason: 'quit' });

    expect(closeMock).toHaveBeenCalledWith(1000, 'Gateway detached for app quit');
    expect(childKillMock).not.toHaveBeenCalled();
    expect((manager as unknown as { ownsProcess: boolean }).ownsProcess).toBe(false);
    expect((manager as unknown as { process: typeof child | null }).process).toBeNull();
  });

  it('hands off a managed gateway process before quit', async () => {
    const { GatewayManager } = await import('@electron/gateway/manager');
    const manager = new GatewayManager();
    const closeMock = vi.fn();
    const child = {
      pid: 12345,
      kill: vi.fn(),
    };

    Object.assign(manager as unknown as {
      ownsProcess: boolean;
      process: typeof child | null;
      ws: { readyState: number; close: (code?: number, reason?: string) => void } | null;
      status: { state: string; port: number; pid?: number };
    }, {
      ownsProcess: true,
      process: child,
      ws: {
        readyState: WebSocket.OPEN,
        close: closeMock,
      },
      status: {
        state: 'running',
        port: 18789,
        pid: 12345,
      },
    });

    await (manager as unknown as {
      handoffForQuit: () => Promise<void>;
    }).handoffForQuit();

    expect(prepareGatewayLaunchContextMock).toHaveBeenCalledWith(18789);
    expect(launchGatewayHandoffProcessMock).toHaveBeenCalledWith(expect.objectContaining({
      waitForPid: 12345,
      port: 18789,
    }));
    expect(closeMock).toHaveBeenCalledWith(1000, 'Gateway detached for runtime handoff');
  });

  it('still schedules quit handoff when pid is known but ownership has drifted', async () => {
    const { GatewayManager } = await import('@electron/gateway/manager');
    const manager = new GatewayManager();
    const closeMock = vi.fn();

    Object.assign(manager as unknown as {
      ownsProcess: boolean;
      process: null;
      ws: { readyState: number; close: (code?: number, reason?: string) => void } | null;
      status: { state: string; port: number; pid?: number };
    }, {
      ownsProcess: false,
      process: null,
      ws: {
        readyState: WebSocket.OPEN,
        close: closeMock,
      },
      status: {
        state: 'running',
        port: 18789,
        pid: 67890,
      },
    });

    await (manager as unknown as {
      handoffForQuit: () => Promise<void>;
    }).handoffForQuit();

    expect(launchGatewayHandoffProcessMock).toHaveBeenCalledWith(expect.objectContaining({
      waitForPid: 67890,
      port: 18789,
    }));
    expect(closeMock).toHaveBeenCalledWith(1000, 'Gateway detached for runtime handoff');
  });

  it('drops a debounced restart when a stop lands before the timer executes', async () => {
    vi.useFakeTimers();
    const { GatewayManager } = await import('@electron/gateway/manager');
    const manager = new GatewayManager();
    const startMock = vi.spyOn(manager, 'start').mockResolvedValue(undefined);
    const stopMock = vi.spyOn(manager, 'stop').mockResolvedValue(undefined);

    Object.assign(manager as unknown as {
      status: { state: string; port: number };
      stopGeneration: number;
    }, {
      status: { state: 'running', port: 18789 },
      stopGeneration: 0,
    });

    manager.debouncedRestart(25);
    (manager as unknown as { stopGeneration: number }).stopGeneration += 1;
    await vi.advanceTimersByTimeAsync(25);

    expect(stopMock).not.toHaveBeenCalled();
    expect(startMock).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('aborts restart before start when a stop is observed during teardown', async () => {
    const { GatewayManager } = await import('@electron/gateway/manager');
    const manager = new GatewayManager();
    const startMock = vi.spyOn(manager, 'start').mockResolvedValue(undefined);
    const originalStop = manager.stop.bind(manager);

    vi.spyOn(manager, 'stop').mockImplementation(async (options) => {
      await originalStop(options);
      if (options?.reason === 'restart') {
        (manager as unknown as { stopGeneration: number }).stopGeneration += 1;
      }
    });

    Object.assign(manager as unknown as {
      status: { state: string; port: number };
      stopGeneration: number;
    }, {
      status: { state: 'running', port: 18789 },
      stopGeneration: 0,
    });

    await manager.restart();

    expect(startMock).not.toHaveBeenCalled();
  });
});
