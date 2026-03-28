import { describe, expect, it, vi } from 'vitest';

describe('runGatewayStartupSequence', () => {
  it('passes existing gateway metadata through when startup reuses a ready runtime', async () => {
    const { runGatewayStartupSequence } = await import('@electron/gateway/startup-orchestrator');
    const connect = vi.fn().mockResolvedValue(undefined);
    const onConnectedToExistingGateway = vi.fn();

    await runGatewayStartupSequence({
      port: 18789,
      shouldWaitForPortFree: false,
      resetStartupStderrLines: vi.fn(),
      getStartupStderrLines: vi.fn().mockReturnValue([]),
      assertLifecycle: vi.fn(),
      findExistingGateway: vi.fn().mockResolvedValue({ port: 18789, pid: 12345, owned: true }),
      isPortAvailable: vi.fn().mockResolvedValue(true),
      findSuggestedPort: vi.fn().mockResolvedValue(18790),
      onPortConflict: vi.fn().mockResolvedValue(undefined),
      connect,
      onExistingGatewayConnectFailure: vi.fn(),
      onConnectedToExistingGateway,
      waitForPortFree: vi.fn(),
      startProcess: vi.fn(),
      waitForReady: vi.fn(),
      onConnectedToManagedGateway: vi.fn(),
      runDoctorRepair: vi.fn().mockResolvedValue(false),
      onDoctorRepairSuccess: vi.fn(),
      delay: vi.fn().mockResolvedValue(undefined),
    });

    expect(connect).toHaveBeenCalledWith(18789, undefined);
    expect(onConnectedToExistingGateway).toHaveBeenCalledWith({ port: 18789, pid: 12345, owned: true });
  });

  it('replaces an existing gateway with a managed process when attaching to it fails', async () => {
    const { runGatewayStartupSequence } = await import('@electron/gateway/startup-orchestrator');
    const connect = vi.fn()
      .mockRejectedValueOnce(new Error('WebSocket closed before handshake: token mismatch'))
      .mockResolvedValueOnce(undefined);
    const onExistingGatewayConnectFailure = vi.fn().mockResolvedValue(true);
    const waitForPortFree = vi.fn().mockResolvedValue(undefined);
    const startProcess = vi.fn().mockResolvedValue(undefined);
    const waitForReady = vi.fn().mockResolvedValue(undefined);
    const onConnectedToExistingGateway = vi.fn();
    const onConnectedToManagedGateway = vi.fn();

    await runGatewayStartupSequence({
      port: 18789,
      shouldWaitForPortFree: false,
      resetStartupStderrLines: vi.fn(),
      getStartupStderrLines: vi.fn().mockReturnValue([]),
      assertLifecycle: vi.fn(),
      findExistingGateway: vi.fn().mockResolvedValue({ port: 18789 }),
      isPortAvailable: vi.fn().mockResolvedValue(true),
      findSuggestedPort: vi.fn().mockResolvedValue(18790),
      onPortConflict: vi.fn().mockResolvedValue(undefined),
      connect,
      onExistingGatewayConnectFailure: vi.fn().mockResolvedValue({ action: 'replace-existing' }),
      onConnectedToExistingGateway,
      waitForPortFree,
      startProcess,
      waitForReady,
      onConnectedToManagedGateway,
      runDoctorRepair: vi.fn().mockResolvedValue(false),
      onDoctorRepairSuccess: vi.fn(),
      delay: vi.fn().mockResolvedValue(undefined),
    });

    expect(waitForPortFree).toHaveBeenCalledWith(18789);
    expect(startProcess).toHaveBeenCalledTimes(1);
    expect(waitForReady).toHaveBeenCalledWith(18789);
    expect(connect).toHaveBeenNthCalledWith(1, 18789, undefined);
    expect(connect).toHaveBeenNthCalledWith(2, 18789);
    expect(onConnectedToExistingGateway).not.toHaveBeenCalled();
    expect(onConnectedToManagedGateway).toHaveBeenCalledTimes(1);
  });

  it('switches to a suggested port when attaching an external gateway fails', async () => {
    const { runGatewayStartupSequence } = await import('@electron/gateway/startup-orchestrator');
    const connect = vi.fn()
      .mockRejectedValueOnce(new Error('unauthorized: gateway token mismatch'))
      .mockResolvedValueOnce(undefined);
    const findExistingGateway = vi.fn()
      .mockResolvedValueOnce({ port: 18789 })
      .mockResolvedValueOnce(null);
    const onPortConflict = vi.fn().mockResolvedValue(undefined);
    const startProcess = vi.fn().mockResolvedValue(undefined);
    const waitForReady = vi.fn().mockResolvedValue(undefined);
    const onConnectedToManagedGateway = vi.fn();

    await runGatewayStartupSequence({
      port: 18789,
      shouldWaitForPortFree: false,
      resetStartupStderrLines: vi.fn(),
      getStartupStderrLines: vi.fn().mockReturnValue([]),
      assertLifecycle: vi.fn(),
      findExistingGateway,
      isPortAvailable: vi.fn().mockResolvedValue(true),
      findSuggestedPort: vi.fn().mockResolvedValue(18790),
      onPortConflict,
      connect,
      onExistingGatewayConnectFailure: vi.fn().mockResolvedValue({ action: 'switch-port', port: 18790 }),
      onConnectedToExistingGateway: vi.fn(),
      waitForPortFree: vi.fn(),
      startProcess,
      waitForReady,
      onConnectedToManagedGateway,
      runDoctorRepair: vi.fn().mockResolvedValue(false),
      onDoctorRepairSuccess: vi.fn(),
      delay: vi.fn().mockResolvedValue(undefined),
    });

    expect(onPortConflict).not.toHaveBeenCalled();
    expect(startProcess).toHaveBeenCalledTimes(1);
    expect(waitForReady).toHaveBeenCalledWith(18790);
    expect(connect).toHaveBeenNthCalledWith(1, 18789, undefined);
    expect(connect).toHaveBeenNthCalledWith(2, 18790);
    expect(onConnectedToManagedGateway).toHaveBeenCalledTimes(1);
  });
});
