import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { IncomingMessage, ServerResponse } from 'http';

const applyProxySettingsMock = vi.fn();
const syncLaunchAtStartupSettingFromStoreMock = vi.fn();
const getAllSettingsMock = vi.fn();
const getSettingMock = vi.fn();
const resetSettingsMock = vi.fn();
const setSettingMock = vi.fn();
const parseJsonBodyMock = vi.fn();
const sendJsonMock = vi.fn();

vi.mock('@electron/main/proxy', () => ({
  applyProxySettings: (...args: unknown[]) => applyProxySettingsMock(...args),
}));

vi.mock('@electron/main/launch-at-startup', () => ({
  syncLaunchAtStartupSettingFromStore: (...args: unknown[]) => syncLaunchAtStartupSettingFromStoreMock(...args),
}));

vi.mock('@electron/utils/store', () => ({
  getAllSettings: (...args: unknown[]) => getAllSettingsMock(...args),
  getSetting: (...args: unknown[]) => getSettingMock(...args),
  resetSettings: (...args: unknown[]) => resetSettingsMock(...args),
  setSetting: (...args: unknown[]) => setSettingMock(...args),
}));

vi.mock('@electron/api/route-utils', () => ({
  parseJsonBody: (...args: unknown[]) => parseJsonBodyMock(...args),
  sendJson: (...args: unknown[]) => sendJsonMock(...args),
}));

describe('handleSettingsRoutes', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    getAllSettingsMock.mockResolvedValue({
      gatewayPort: 19001,
      proxyEnabled: false,
    });
    setSettingMock.mockResolvedValue(undefined);
    parseJsonBodyMock.mockResolvedValue({ value: 19001 });
  });

  it('passes gateway setting updates through the runtime controller', async () => {
    const applySettingsRuntimeEffectsMock = vi.fn().mockResolvedValue(undefined);
    const { handleSettingsRoutes } = await import('@electron/api/routes/settings');

    const handled = await handleSettingsRoutes(
      { method: 'PUT' } as IncomingMessage,
      {} as ServerResponse,
      new URL('http://127.0.0.1:3210/api/settings/gatewayPort'),
      {
        gatewayRuntimeController: {
          applySettingsRuntimeEffects: applySettingsRuntimeEffectsMock,
        },
      } as never,
    );

    expect(handled).toBe(true);
    expect(setSettingMock).toHaveBeenCalledWith('gatewayPort', 19001);
    expect(applySettingsRuntimeEffectsMock).toHaveBeenCalledWith({
      gatewayPort: 19001,
      applyProxySettings: null,
      applyLaunchAtStartup: null,
    });
    expect(sendJsonMock).toHaveBeenCalledWith(expect.anything(), 200, { success: true });
  });

  it('passes reset settings side effects through the runtime controller', async () => {
    const applySettingsRuntimeEffectsMock = vi.fn().mockResolvedValue(undefined);
    resetSettingsMock.mockResolvedValue(undefined);
    getAllSettingsMock.mockResolvedValue({
      gatewayPort: 19001,
      proxyEnabled: true,
    });
    const { handleSettingsRoutes } = await import('@electron/api/routes/settings');

    const handled = await handleSettingsRoutes(
      { method: 'POST' } as IncomingMessage,
      {} as ServerResponse,
      new URL('http://127.0.0.1:3210/api/settings/reset'),
      {
        gatewayRuntimeController: {
          applySettingsRuntimeEffects: applySettingsRuntimeEffectsMock,
        },
      } as never,
    );

    expect(handled).toBe(true);
    expect(resetSettingsMock).toHaveBeenCalledTimes(1);
    expect(applySettingsRuntimeEffectsMock).toHaveBeenCalledWith({
      gatewayPort: 19001,
      applyProxySettings: expect.any(Function),
      applyLaunchAtStartup: expect.any(Function),
    });
    expect(sendJsonMock).toHaveBeenCalledWith(expect.anything(), 200, {
      success: true,
      settings: {
        gatewayPort: 19001,
        proxyEnabled: true,
      },
    });
  });
});
