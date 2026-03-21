import { beforeEach, describe, expect, it, vi } from 'vitest';

const setProxyMock = vi.fn();
const closeAllConnectionsMock = vi.fn();
const getAllSettingsMock = vi.fn();
const loggerInfoMock = vi.fn();
const loggerWarnMock = vi.fn();
const loggerDebugMock = vi.fn();

vi.mock('electron', () => ({
  session: {
    defaultSession: {
      setProxy: (...args: unknown[]) => setProxyMock(...args),
      closeAllConnections: (...args: unknown[]) => closeAllConnectionsMock(...args),
    },
  },
}));

vi.mock('@electron/utils/store', () => ({
  getAllSettings: (...args: unknown[]) => getAllSettingsMock(...args),
}));

vi.mock('@electron/utils/logger', () => ({
  logger: {
    info: (...args: unknown[]) => loggerInfoMock(...args),
    warn: (...args: unknown[]) => loggerWarnMock(...args),
    debug: (...args: unknown[]) => loggerDebugMock(...args),
  },
}));

describe('main proxy startup', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers();
    getAllSettingsMock.mockResolvedValue({
      proxyEnabled: false,
      proxyServer: '',
      proxyHttpServer: '',
      proxyHttpsServer: '',
      proxyAllServer: '',
      proxyBypassRules: '',
    });
    closeAllConnectionsMock.mockResolvedValue(undefined);
  });

  it('does not block startup forever when Electron setProxy hangs', async () => {
    setProxyMock.mockImplementation(() => new Promise(() => {}));

    const { applyProxySettings } = await import('@electron/main/proxy');

    let settled = false;
    void applyProxySettings().then(() => {
      settled = true;
    });

    await vi.advanceTimersByTimeAsync(2500);

    expect(settled).toBe(true);
    expect(loggerWarnMock).toHaveBeenCalled();
    expect(closeAllConnectionsMock).not.toHaveBeenCalled();
  });
});
