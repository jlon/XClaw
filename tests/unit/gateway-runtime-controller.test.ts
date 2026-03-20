import { beforeEach, describe, expect, it, vi } from 'vitest';

const getSettingMock = vi.fn();
const setSettingMock = vi.fn().mockResolvedValue(undefined);

vi.mock('@electron/utils/store', () => ({
  getSetting: (...args: unknown[]) => getSettingMock(...args),
  setSetting: (...args: unknown[]) => setSettingMock(...args),
}));

describe('GatewayRuntimeController', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    getSettingMock.mockImplementation(async (key: string) => {
      if (key === 'gatewayManagedMode') {
        return 'managed';
      }
      if (key === 'gatewayDesiredState') {
        return 'running';
      }
      return undefined;
    });
  });

  it('bootstraps into managed running mode and starts the gateway', async () => {
    const gatewayManager = {
      start: vi.fn().mockResolvedValue(undefined),
      ownsCurrentProcess: vi.fn().mockReturnValue(true),
      stop: vi.fn().mockResolvedValue(undefined),
      restart: vi.fn().mockResolvedValue(undefined),
      getStatus: vi.fn().mockReturnValue({ state: 'stopped', port: 18789 }),
    };
    const { GatewayRuntimeController } = await import('@electron/gateway/runtime-controller');
    const controller = new GatewayRuntimeController({ gatewayManager } as never);

    await controller.bootstrap();

    expect(gatewayManager.start).toHaveBeenCalledTimes(1);
    expect(controller.getRuntimeState()).toMatchObject({
      ownership: 'managed',
      desiredState: 'running',
      managedMode: 'managed',
    });
    expect(controller.shouldAutoRecover()).toBe(true);
  });

  it('marks ownership as adopted when bootstrap reuses an external runtime', async () => {
    const gatewayManager = {
      start: vi.fn().mockResolvedValue(undefined),
      ownsCurrentProcess: vi.fn().mockReturnValue(false),
      stop: vi.fn().mockResolvedValue(undefined),
      restart: vi.fn().mockResolvedValue(undefined),
      getStatus: vi.fn().mockReturnValue({ state: 'stopped', port: 18789 }),
    };
    const { GatewayRuntimeController } = await import('@electron/gateway/runtime-controller');
    const controller = new GatewayRuntimeController({ gatewayManager } as never);

    await controller.bootstrap();

    expect(controller.getRuntimeState()).toMatchObject({
      ownership: 'adopted',
      desiredState: 'running',
      managedMode: 'managed',
    });
  });

  it('does not auto-start when desired state is stopped', async () => {
    getSettingMock.mockImplementation(async (key: string) => {
      if (key === 'gatewayManagedMode') {
        return 'managed';
      }
      if (key === 'gatewayDesiredState') {
        return 'stopped';
      }
      return undefined;
    });
    const gatewayManager = {
      start: vi.fn().mockResolvedValue(undefined),
      stop: vi.fn().mockResolvedValue(undefined),
      restart: vi.fn().mockResolvedValue(undefined),
      getStatus: vi.fn().mockReturnValue({ state: 'stopped', port: 18789 }),
    };
    const { GatewayRuntimeController } = await import('@electron/gateway/runtime-controller');
    const controller = new GatewayRuntimeController({ gatewayManager } as never);

    await controller.bootstrap();

    expect(gatewayManager.start).not.toHaveBeenCalled();
    expect(controller.shouldAutoRecover()).toBe(false);
  });

  it('persists running intent when requestStart is called', async () => {
    const gatewayManager = {
      start: vi.fn().mockResolvedValue(undefined),
      stop: vi.fn().mockResolvedValue(undefined),
      restart: vi.fn().mockResolvedValue(undefined),
      getStatus: vi.fn().mockReturnValue({ state: 'stopped', port: 18789 }),
    };
    const { GatewayRuntimeController } = await import('@electron/gateway/runtime-controller');
    const controller = new GatewayRuntimeController({ gatewayManager } as never);

    await controller.requestStart();

    expect(setSettingMock).toHaveBeenNthCalledWith(1, 'gatewayManagedMode', 'managed');
    expect(setSettingMock).toHaveBeenNthCalledWith(2, 'gatewayDesiredState', 'running');
    expect(gatewayManager.start).toHaveBeenCalledTimes(1);
    expect(controller.shouldAutoRecover()).toBe(true);
  });

  it('persists stopped intent when requestStop is called', async () => {
    const gatewayManager = {
      start: vi.fn().mockResolvedValue(undefined),
      stop: vi.fn().mockResolvedValue(undefined),
      restart: vi.fn().mockResolvedValue(undefined),
      getStatus: vi.fn().mockReturnValue({ state: 'running', port: 18789 }),
    };
    const { GatewayRuntimeController } = await import('@electron/gateway/runtime-controller');
    const controller = new GatewayRuntimeController({ gatewayManager } as never);

    await controller.requestStop();

    expect(setSettingMock).toHaveBeenCalledWith('gatewayDesiredState', 'stopped');
    expect(gatewayManager.stop).toHaveBeenCalledTimes(1);
    expect(controller.shouldAutoRecover()).toBe(false);
  });

  it('activates managed mode without starting when desired state is stopped', async () => {
    const gatewayManager = {
      start: vi.fn().mockResolvedValue(undefined),
      stop: vi.fn().mockResolvedValue(undefined),
      restart: vi.fn().mockResolvedValue(undefined),
      getStatus: vi.fn().mockReturnValue({ state: 'stopped', port: 18789 }),
    };
    const { GatewayRuntimeController } = await import('@electron/gateway/runtime-controller');
    const controller = new GatewayRuntimeController({ gatewayManager } as never);

    await controller.activateManagedMode('stopped');

    expect(setSettingMock).toHaveBeenNthCalledWith(1, 'gatewayManagedMode', 'managed');
    expect(setSettingMock).toHaveBeenNthCalledWith(2, 'gatewayDesiredState', 'stopped');
    expect(gatewayManager.start).not.toHaveBeenCalled();
    expect(controller.getRuntimeState()).toMatchObject({
      managedMode: 'managed',
      desiredState: 'stopped',
    });
  });

  it('restarts under managed running intent when requestRestart is called', async () => {
    const gatewayManager = {
      start: vi.fn().mockResolvedValue(undefined),
      stop: vi.fn().mockResolvedValue(undefined),
      restart: vi.fn().mockResolvedValue(undefined),
      getStatus: vi.fn().mockReturnValue({ state: 'running', port: 18789 }),
    };
    const { GatewayRuntimeController } = await import('@electron/gateway/runtime-controller');
    const controller = new GatewayRuntimeController({ gatewayManager } as never);

    await controller.requestRestart();

    expect(setSettingMock).toHaveBeenNthCalledWith(1, 'gatewayManagedMode', 'managed');
    expect(setSettingMock).toHaveBeenNthCalledWith(2, 'gatewayDesiredState', 'running');
    expect(gatewayManager.restart).toHaveBeenCalledTimes(1);
    expect(controller.shouldAutoRecover()).toBe(true);
  });

  it('treats restart from stopped as an explicit start intent', async () => {
    getSettingMock.mockImplementation(async (key: string) => {
      if (key === 'gatewayManagedMode') {
        return 'managed';
      }
      if (key === 'gatewayDesiredState') {
        return 'stopped';
      }
      return undefined;
    });
    const gatewayManager = {
      start: vi.fn().mockResolvedValue(undefined),
      ownsCurrentProcess: vi.fn().mockReturnValue(true),
      stop: vi.fn().mockResolvedValue(undefined),
      restart: vi.fn().mockResolvedValue(undefined),
      getStatus: vi.fn().mockReturnValue({ state: 'stopped', port: 18789 }),
    };
    const { GatewayRuntimeController } = await import('@electron/gateway/runtime-controller');
    const controller = new GatewayRuntimeController({ gatewayManager } as never);

    await controller.requestRestart();

    expect(setSettingMock).toHaveBeenNthCalledWith(1, 'gatewayManagedMode', 'managed');
    expect(setSettingMock).toHaveBeenNthCalledWith(2, 'gatewayDesiredState', 'running');
    expect(gatewayManager.start).toHaveBeenCalledTimes(1);
    expect(gatewayManager.restart).not.toHaveBeenCalled();
    expect(controller.getRuntimeState()).toMatchObject({
      desiredState: 'running',
      ownership: 'managed',
    });
  });

  it('applies runtime settings effects and restarts when a running gateway needs a port refresh', async () => {
    const setPort = vi.fn();
    const restart = vi.fn().mockResolvedValue(undefined);
    const applyProxySettings = vi.fn().mockResolvedValue(undefined);
    const applyLaunchAtStartup = vi.fn().mockResolvedValue(undefined);
    const gatewayManager = {
      start: vi.fn().mockResolvedValue(undefined),
      stop: vi.fn().mockResolvedValue(undefined),
      restart,
      setPort,
      getStatus: vi.fn().mockReturnValue({ state: 'running', port: 18789 }),
    };
    const { GatewayRuntimeController } = await import('@electron/gateway/runtime-controller');
    const controller = new GatewayRuntimeController({ gatewayManager } as never);

    await controller.applySettingsRuntimeEffects({
      gatewayPort: 19001,
      applyProxySettings,
      applyLaunchAtStartup,
    });

    expect(setPort).toHaveBeenCalledWith(19001);
    expect(applyProxySettings).toHaveBeenCalledTimes(1);
    expect(applyLaunchAtStartup).toHaveBeenCalledTimes(1);
    expect(restart).toHaveBeenCalledTimes(1);
  });

  it('applies runtime settings effects without restart when desired state is stopped', async () => {
    getSettingMock.mockImplementation(async (key: string) => {
      if (key === 'gatewayManagedMode') {
        return 'managed';
      }
      if (key === 'gatewayDesiredState') {
        return 'stopped';
      }
      return undefined;
    });
    const setPort = vi.fn();
    const restart = vi.fn().mockResolvedValue(undefined);
    const gatewayManager = {
      start: vi.fn().mockResolvedValue(undefined),
      stop: vi.fn().mockResolvedValue(undefined),
      restart,
      setPort,
      getStatus: vi.fn().mockReturnValue({ state: 'running', port: 18789 }),
    };
    const { GatewayRuntimeController } = await import('@electron/gateway/runtime-controller');
    const controller = new GatewayRuntimeController({ gatewayManager } as never);

    await controller.applySettingsRuntimeEffects({
      gatewayPort: 19001,
      applyProxySettings: vi.fn().mockResolvedValue(undefined),
    });

    expect(setPort).toHaveBeenCalledWith(19001);
    expect(restart).not.toHaveBeenCalled();
  });

  it('requests a debounced reload when runtime refresh is allowed', async () => {
    const debouncedReload = vi.fn();
    const debouncedRestart = vi.fn();
    const gatewayManager = {
      start: vi.fn().mockResolvedValue(undefined),
      stop: vi.fn().mockResolvedValue(undefined),
      restart: vi.fn().mockResolvedValue(undefined),
      setPort: vi.fn(),
      debouncedReload,
      debouncedRestart,
      getStatus: vi.fn().mockReturnValue({ state: 'running', port: 18789 }),
    };
    const { GatewayRuntimeController } = await import('@electron/gateway/runtime-controller');
    const controller = new GatewayRuntimeController({ gatewayManager } as never);

    await controller.requestRuntimeRefresh({ mode: 'reload', delayMs: 2500 });

    expect(debouncedReload).toHaveBeenCalledWith(2500);
    expect(debouncedRestart).not.toHaveBeenCalled();
  });

  it('keeps runtime refresh eligible while the gateway is recovering', async () => {
    const debouncedReload = vi.fn();
    const gatewayManager = {
      start: vi.fn().mockResolvedValue(undefined),
      stop: vi.fn().mockResolvedValue(undefined),
      restart: vi.fn().mockResolvedValue(undefined),
      replaceRuntime: vi.fn().mockResolvedValue(undefined),
      setPort: vi.fn(),
      debouncedReload,
      debouncedRestart: vi.fn(),
      getStatus: vi.fn().mockReturnValue({ state: 'error', port: 18789 }),
    };
    const { GatewayRuntimeController } = await import('@electron/gateway/runtime-controller');
    const controller = new GatewayRuntimeController({ gatewayManager } as never);

    await controller.requestRuntimeRefresh({ mode: 'reload', delayMs: 1200 });

    expect(debouncedReload).toHaveBeenCalledWith(1200);
  });

  it('replaces the current runtime when desired state is still running', async () => {
    const replaceRuntime = vi.fn().mockResolvedValue(undefined);
    const gatewayManager = {
      start: vi.fn().mockResolvedValue(undefined),
      stop: vi.fn().mockResolvedValue(undefined),
      restart: vi.fn().mockResolvedValue(undefined),
      replaceRuntime,
      setPort: vi.fn(),
      debouncedReload: vi.fn(),
      debouncedRestart: vi.fn(),
      getStatus: vi.fn().mockReturnValue({ state: 'error', port: 18789 }),
    };
    const { GatewayRuntimeController } = await import('@electron/gateway/runtime-controller');
    const controller = new GatewayRuntimeController({ gatewayManager } as never);

    await controller.replaceRuntime();

    expect(replaceRuntime).toHaveBeenCalledTimes(1);
    expect(controller.getRuntimeState()).toMatchObject({
      ownership: 'managed',
    });
  });

  it('suppresses runtime refresh when desired state is stopped', async () => {
    getSettingMock.mockImplementation(async (key: string) => {
      if (key === 'gatewayManagedMode') {
        return 'managed';
      }
      if (key === 'gatewayDesiredState') {
        return 'stopped';
      }
      return undefined;
    });
    const gatewayManager = {
      start: vi.fn().mockResolvedValue(undefined),
      stop: vi.fn().mockResolvedValue(undefined),
      restart: vi.fn().mockResolvedValue(undefined),
      setPort: vi.fn(),
      debouncedReload: vi.fn(),
      debouncedRestart: vi.fn(),
      getStatus: vi.fn().mockReturnValue({ state: 'running', port: 18789 }),
    };
    const { GatewayRuntimeController } = await import('@electron/gateway/runtime-controller');
    const controller = new GatewayRuntimeController({ gatewayManager } as never);

    await controller.requestRuntimeRefresh({ mode: 'restart', delayMs: 1000 });

    expect(gatewayManager.debouncedReload).not.toHaveBeenCalled();
    expect(gatewayManager.debouncedRestart).not.toHaveBeenCalled();
  });
});
