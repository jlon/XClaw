import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { IncomingMessage, ServerResponse } from 'http';

const sendJsonMock = vi.fn();
const getSettingMock = vi.fn();

vi.mock('@electron/api/route-utils', () => ({
  parseJsonBody: vi.fn().mockResolvedValue({}),
  sendJson: (...args: unknown[]) => sendJsonMock(...args),
}));

vi.mock('@electron/utils/store', () => ({
  getSetting: (...args: unknown[]) => getSettingMock(...args),
}));

describe('handleGatewayRoutes', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    getSettingMock.mockResolvedValue('token');
  });

  it('routes gateway start to the runtime controller', async () => {
    const { handleGatewayRoutes } = await import('@electron/api/routes/gateway');
    const requestStart = vi.fn().mockResolvedValue(undefined);

    const handled = await handleGatewayRoutes(
      { method: 'POST' } as IncomingMessage,
      {} as ServerResponse,
      new URL('http://127.0.0.1:3210/api/gateway/start'),
      {
        gatewayManager: {
          getStatus: vi.fn().mockReturnValue({ state: 'stopped', port: 18789 }),
        },
        gatewayRuntimeController: {
          requestStart,
        },
      } as never,
    );

    expect(handled).toBe(true);
    expect(requestStart).toHaveBeenCalledTimes(1);
    expect(sendJsonMock).toHaveBeenCalledWith(expect.anything(), 200, { success: true });
  });

  it('routes gateway stop to the runtime controller', async () => {
    const { handleGatewayRoutes } = await import('@electron/api/routes/gateway');
    const requestStop = vi.fn().mockResolvedValue(undefined);

    const handled = await handleGatewayRoutes(
      { method: 'POST' } as IncomingMessage,
      {} as ServerResponse,
      new URL('http://127.0.0.1:3210/api/gateway/stop'),
      {
        gatewayManager: {
          getStatus: vi.fn().mockReturnValue({ state: 'running', port: 18789 }),
        },
        gatewayRuntimeController: {
          requestStop,
        },
      } as never,
    );

    expect(handled).toBe(true);
    expect(requestStop).toHaveBeenCalledTimes(1);
    expect(sendJsonMock).toHaveBeenCalledWith(expect.anything(), 200, { success: true });
  });

  it('routes gateway restart to the runtime controller', async () => {
    const { handleGatewayRoutes } = await import('@electron/api/routes/gateway');
    const requestRestart = vi.fn().mockResolvedValue(undefined);

    const handled = await handleGatewayRoutes(
      { method: 'POST' } as IncomingMessage,
      {} as ServerResponse,
      new URL('http://127.0.0.1:3210/api/gateway/restart'),
      {
        gatewayManager: {
          getStatus: vi.fn().mockReturnValue({ state: 'running', port: 18789 }),
        },
        gatewayRuntimeController: {
          requestRestart,
        },
      } as never,
    );

    expect(handled).toBe(true);
    expect(requestRestart).toHaveBeenCalledTimes(1);
    expect(sendJsonMock).toHaveBeenCalledWith(expect.anything(), 200, { success: true });
  });
});
