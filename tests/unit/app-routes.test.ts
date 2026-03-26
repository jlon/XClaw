import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { IncomingMessage, ServerResponse } from 'http';

const runOpenClawDoctorMock = vi.fn();
const runOpenClawDoctorFixMock = vi.fn();
const inspectLocalOpenClawSetupMock = vi.fn();
const buildSetupPlanMock = vi.fn();
const runTakeoverImportMock = vi.fn();
const getTakeoverImportStatusMock = vi.fn();
const resetTakeoverImportStatusMock = vi.fn();
const runSetupActivationSideEffectsMock = vi.fn();
const getAllSettingsMock = vi.fn();
const replaceAllSettingsMock = vi.fn();
const getSettingMock = vi.fn();
const setSettingMock = vi.fn();
const sendJsonMock = vi.fn();
const sendNoContentMock = vi.fn();
const studioServiceStartMock = vi.fn();
const getOpenClawStatusMock = vi.fn();

vi.mock('@electron/utils/openclaw-doctor', () => ({
  runOpenClawDoctor: (...args: unknown[]) => runOpenClawDoctorMock(...args),
  runOpenClawDoctorFix: (...args: unknown[]) => runOpenClawDoctorFixMock(...args),
}));

vi.mock('@electron/main/setup-inspection', () => ({
  inspectLocalOpenClawSetup: (...args: unknown[]) => inspectLocalOpenClawSetupMock(...args),
  buildSetupPlan: (...args: unknown[]) => buildSetupPlanMock(...args),
}));

vi.mock('@electron/main/takeover-import', () => ({
  runTakeoverImport: (...args: unknown[]) => runTakeoverImportMock(...args),
  getTakeoverImportStatus: (...args: unknown[]) => getTakeoverImportStatusMock(...args),
  resetTakeoverImportStatus: (...args: unknown[]) => resetTakeoverImportStatusMock(...args),
}));

vi.mock('@electron/main/setup-activation', () => ({
  runSetupActivationSideEffects: (...args: unknown[]) => runSetupActivationSideEffectsMock(...args),
}));

vi.mock('@electron/utils/store', () => ({
  getAllSettings: (...args: unknown[]) => getAllSettingsMock(...args),
  getSetting: (...args: unknown[]) => getSettingMock(...args),
  replaceAllSettings: (...args: unknown[]) => replaceAllSettingsMock(...args),
  setSetting: (...args: unknown[]) => setSettingMock(...args),
}));

vi.mock('@electron/utils/paths', () => ({
  getOpenClawStatus: (...args: unknown[]) => getOpenClawStatusMock(...args),
}));

vi.mock('@electron/api/route-utils', () => ({
  setCorsHeaders: vi.fn(),
  parseJsonBody: vi.fn().mockResolvedValue({}),
  sendJson: (...args: unknown[]) => sendJsonMock(...args),
  sendNoContent: (...args: unknown[]) => sendNoContentMock(...args),
}));

describe('handleAppRoutes', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    buildSetupPlanMock.mockImplementation((_inspection: unknown, input: { mode?: 'fresh' | 'takeover' } = {}) => ({
      mode: input.mode === 'takeover' ? 'takeover' : 'fresh',
      canApply: true,
      blockingIssues: [],
    }));
    getAllSettingsMock.mockResolvedValue({});
    getSettingMock.mockResolvedValue(undefined);
    replaceAllSettingsMock.mockResolvedValue(undefined);
    setSettingMock.mockResolvedValue(undefined);
    studioServiceStartMock.mockResolvedValue(undefined);
    getOpenClawStatusMock.mockReturnValue({
      packageExists: true,
      isBuilt: true,
      dir: '/tmp/openclaw',
      version: '1.2.3',
    });
  });

  it('runs openclaw doctor through the host api', async () => {
    runOpenClawDoctorMock.mockResolvedValueOnce({ success: true, exitCode: 0 });
    const { handleAppRoutes } = await import('@electron/api/routes/app');

    const handled = await handleAppRoutes(
      { method: 'POST' } as IncomingMessage,
      {} as ServerResponse,
      new URL('http://127.0.0.1:3210/api/app/openclaw-doctor'),
      {} as never,
    );

    expect(handled).toBe(true);
    expect(runOpenClawDoctorMock).toHaveBeenCalledTimes(1);
    expect(sendJsonMock).toHaveBeenCalledWith(expect.anything(), 200, { success: true, exitCode: 0 });
  });

  it('returns openclaw package status through the host api', async () => {
    const { handleAppRoutes } = await import('@electron/api/routes/app');

    const handled = await handleAppRoutes(
      { method: 'GET' } as IncomingMessage,
      {} as ServerResponse,
      new URL('http://127.0.0.1:3210/api/app/openclaw-status'),
      {} as never,
    );

    expect(handled).toBe(true);
    expect(getOpenClawStatusMock).toHaveBeenCalledTimes(1);
    expect(sendJsonMock).toHaveBeenCalledWith(expect.anything(), 200, {
      packageExists: true,
      isBuilt: true,
      dir: '/tmp/openclaw',
      version: '1.2.3',
    });
  });

  it('runs openclaw doctor fix when requested', async () => {
    const { parseJsonBody } = await import('@electron/api/route-utils');
    vi.mocked(parseJsonBody).mockResolvedValueOnce({ mode: 'fix' });
    runOpenClawDoctorFixMock.mockResolvedValueOnce({ success: false, exitCode: 1 });
    const { handleAppRoutes } = await import('@electron/api/routes/app');

    const handled = await handleAppRoutes(
      { method: 'POST' } as IncomingMessage,
      {} as ServerResponse,
      new URL('http://127.0.0.1:3210/api/app/openclaw-doctor'),
      {} as never,
    );

    expect(handled).toBe(true);
    expect(runOpenClawDoctorFixMock).toHaveBeenCalledTimes(1);
    expect(sendJsonMock).toHaveBeenCalledWith(expect.anything(), 200, { success: false, exitCode: 1 });
  });

  it('returns setup inspection through the host api', async () => {
    inspectLocalOpenClawSetupMock.mockResolvedValueOnce({ hasExistingOpenClaw: true });
    const { handleAppRoutes } = await import('@electron/api/routes/app');

    const handled = await handleAppRoutes(
      { method: 'GET' } as IncomingMessage,
      {} as ServerResponse,
      new URL('http://127.0.0.1:3210/api/app/setup-inspection'),
      {} as never,
    );

    expect(handled).toBe(true);
    expect(inspectLocalOpenClawSetupMock).toHaveBeenCalledTimes(1);
    expect(sendJsonMock).toHaveBeenCalledWith(expect.anything(), 200, { hasExistingOpenClaw: true });
  });

  it('builds a setup plan from the latest inspection result', async () => {
    const { parseJsonBody } = await import('@electron/api/route-utils');
    vi.mocked(parseJsonBody).mockResolvedValueOnce({
      mode: 'fresh',
      gatewayPort: 19001,
      workspacePath: '/Users/test/custom-workspace',
    });
    inspectLocalOpenClawSetupMock.mockResolvedValueOnce({ hasExistingOpenClaw: true });
    buildSetupPlanMock.mockReturnValueOnce({ mode: 'fresh', canApply: true });
    const { handleAppRoutes } = await import('@electron/api/routes/app');

    const handled = await handleAppRoutes(
      { method: 'POST' } as IncomingMessage,
      {} as ServerResponse,
      new URL('http://127.0.0.1:3210/api/app/setup-plan'),
      {} as never,
    );

    expect(handled).toBe(true);
    expect(inspectLocalOpenClawSetupMock).toHaveBeenCalledWith({
      requestedGatewayPort: 19001,
      requestedWorkspacePath: '/Users/test/custom-workspace',
    });
    expect(buildSetupPlanMock).toHaveBeenCalledWith(
      { hasExistingOpenClaw: true },
      {
        mode: 'fresh',
        gatewayPort: 19001,
        workspacePath: '/Users/test/custom-workspace',
      },
    );
    expect(sendJsonMock).toHaveBeenCalledWith(expect.anything(), 200, { mode: 'fresh', canApply: true });
  });

  it('runs takeover import through the host api', async () => {
    runTakeoverImportMock.mockResolvedValueOnce({ state: 'complete', step: 'complete' });
    const { parseJsonBody } = await import('@electron/api/route-utils');
    vi.mocked(parseJsonBody).mockResolvedValueOnce({ mode: 'takeover' });
    const { handleAppRoutes } = await import('@electron/api/routes/app');

    const handled = await handleAppRoutes(
      { method: 'POST' } as IncomingMessage,
      {} as ServerResponse,
      new URL('http://127.0.0.1:3210/api/app/takeover-import'),
      {} as never,
    );

    expect(handled).toBe(true);
    expect(runTakeoverImportMock).toHaveBeenCalledWith({ mode: 'takeover' });
    expect(sendJsonMock).toHaveBeenCalledWith(expect.anything(), 200, { state: 'complete', step: 'complete' });
  });

  it('returns the latest takeover status through the host api', async () => {
    getTakeoverImportStatusMock.mockReturnValueOnce({ state: 'running', step: 'backup' });
    const { handleAppRoutes } = await import('@electron/api/routes/app');

    const handled = await handleAppRoutes(
      { method: 'GET' } as IncomingMessage,
      {} as ServerResponse,
      new URL('http://127.0.0.1:3210/api/app/takeover-status'),
      {} as never,
    );

    expect(handled).toBe(true);
    expect(getTakeoverImportStatusMock).toHaveBeenCalledTimes(1);
    expect(sendJsonMock).toHaveBeenCalledWith(expect.anything(), 200, { state: 'running', step: 'backup' });
  });

  it('runs setup activation side effects through the host api', async () => {
    runSetupActivationSideEffectsMock.mockResolvedValueOnce(undefined);
    const { parseJsonBody } = await import('@electron/api/route-utils');
    vi.mocked(parseJsonBody).mockResolvedValueOnce({
      mode: 'fresh',
      gatewayPort: 19001,
      workspacePath: '/Users/test/custom-workspace',
    });
    const { handleAppRoutes } = await import('@electron/api/routes/app');

    const handled = await handleAppRoutes(
      { method: 'POST' } as IncomingMessage,
      {} as ServerResponse,
      new URL('http://127.0.0.1:3210/api/app/setup-activation'),
      {
        gatewayManager: { id: 'gateway' },
        gatewayRuntimeController: { id: 'runtime' },
        mainWindow: { id: 'mainWindow' },
        studioService: { start: studioServiceStartMock },
      } as never,
    );

    expect(handled).toBe(true);
    expect(runSetupActivationSideEffectsMock).toHaveBeenCalledWith({
      gatewayManager: { id: 'gateway' },
      runtimeController: { id: 'runtime' },
      mainWindow: { id: 'mainWindow' },
      awaitCriticalTasks: true,
      setup: {
        mode: 'fresh',
        gatewayPort: 19001,
        workspacePath: '/Users/test/custom-workspace',
      },
    });
    expect(replaceAllSettingsMock).toHaveBeenCalledWith({});
    expect(resetTakeoverImportStatusMock).toHaveBeenCalledTimes(1);
    expect(studioServiceStartMock).toHaveBeenCalledTimes(1);
    expect(setSettingMock).toHaveBeenCalledWith('setupComplete', true);
    expect(sendJsonMock).toHaveBeenCalledWith(expect.anything(), 200, { success: true });
  });

  it('does not mark setup complete when setup activation fails', async () => {
    runSetupActivationSideEffectsMock.mockRejectedValueOnce(new Error('网关自动启动失败：plugin not found: skillhub'));
    getTakeoverImportStatusMock.mockReturnValueOnce({
      state: 'complete',
      step: 'complete',
      importedAccountCount: 1,
      defaultAccountId: 'bailian',
      conflicts: [],
      warnings: [],
      blockingIssues: [],
    });
    const { parseJsonBody } = await import('@electron/api/route-utils');
    vi.mocked(parseJsonBody).mockResolvedValueOnce({
      mode: 'takeover',
    });
    const { handleAppRoutes } = await import('@electron/api/routes/app');

    await expect(handleAppRoutes(
      { method: 'POST' } as IncomingMessage,
      {} as ServerResponse,
      new URL('http://127.0.0.1:3210/api/app/setup-activation'),
      {
        gatewayManager: { id: 'gateway' },
        gatewayRuntimeController: { id: 'runtime' },
        mainWindow: { id: 'mainWindow' },
        studioService: { start: studioServiceStartMock },
      } as never,
    )).rejects.toThrow('网关自动启动失败：plugin not found: skillhub');

    expect(setSettingMock).not.toHaveBeenCalled();
    expect(sendJsonMock).not.toHaveBeenCalled();
  });

  it('blocks takeover activation before takeover import reaches a committed state', async () => {
    getTakeoverImportStatusMock.mockReturnValueOnce({
      state: 'idle',
      step: 'idle',
      importedAccountCount: 0,
      defaultAccountId: null,
      conflicts: [],
      warnings: [],
      blockingIssues: [],
    });
    getSettingMock.mockResolvedValueOnce(undefined);
    const { parseJsonBody } = await import('@electron/api/route-utils');
    vi.mocked(parseJsonBody).mockResolvedValueOnce({
      mode: 'takeover',
    });
    const { handleAppRoutes } = await import('@electron/api/routes/app');

    await expect(handleAppRoutes(
      { method: 'POST' } as IncomingMessage,
      {} as ServerResponse,
      new URL('http://127.0.0.1:3210/api/app/setup-activation'),
      {
        gatewayManager: { id: 'gateway' },
        gatewayRuntimeController: { id: 'runtime' },
        mainWindow: { id: 'mainWindow' },
        studioService: { start: studioServiceStartMock },
      } as never,
    )).rejects.toThrow('接管导入尚未完成，不能提前完成安装');

    expect(runSetupActivationSideEffectsMock).not.toHaveBeenCalled();
    expect(setSettingMock).not.toHaveBeenCalled();
  });

  it('waits for studio runtime to become ready before marking setup complete', async () => {
    runSetupActivationSideEffectsMock.mockResolvedValueOnce(undefined);
    studioServiceStartMock.mockRejectedValueOnce(new Error('studio runtime failed to start'));
    const { parseJsonBody } = await import('@electron/api/route-utils');
    vi.mocked(parseJsonBody).mockResolvedValueOnce({
      mode: 'fresh',
      gatewayPort: 19001,
      workspacePath: '/Users/test/custom-workspace',
    });
    const { handleAppRoutes } = await import('@electron/api/routes/app');

    await expect(handleAppRoutes(
      { method: 'POST' } as IncomingMessage,
      {} as ServerResponse,
      new URL('http://127.0.0.1:3210/api/app/setup-activation'),
      {
        gatewayManager: { id: 'gateway' },
        gatewayRuntimeController: { id: 'runtime' },
        mainWindow: { id: 'mainWindow' },
        studioService: { start: studioServiceStartMock },
      } as never,
    )).rejects.toThrow('studio runtime failed to start');

    expect(setSettingMock).not.toHaveBeenCalled();
    expect(sendJsonMock).not.toHaveBeenCalled();
  });
});
