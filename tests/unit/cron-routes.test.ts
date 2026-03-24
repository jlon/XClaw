import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { IncomingMessage, ServerResponse } from 'http';

const parseJsonBodyMock = vi.fn();
const sendJsonMock = vi.fn();

vi.mock('@electron/api/route-utils', () => ({
  parseJsonBody: (...args: unknown[]) => parseJsonBodyMock(...args),
  sendJson: (...args: unknown[]) => sendJsonMock(...args),
}));

describe('handleCronRoutes', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('forwards agentId when creating UI cron jobs', async () => {
    parseJsonBodyMock.mockResolvedValueOnce({
      name: 'daily-ops',
      message: 'run ops brief',
      schedule: '0 9 * * *',
      enabled: true,
      agentId: 'ops',
      target: {
        channelType: 'feishu',
        accountId: 'bot2',
        recipientId: 'ou_123',
      },
    });

    const rpc = vi.fn().mockResolvedValueOnce({
      id: 'job-1',
      agentId: 'ops',
      name: 'daily-ops',
      enabled: true,
      createdAtMs: Date.now(),
      updatedAtMs: Date.now(),
      schedule: { kind: 'cron', expr: '0 9 * * *' },
      payload: { kind: 'agentTurn', message: 'run ops brief' },
      sessionTarget: 'isolated',
      delivery: { mode: 'none' },
      state: {},
    });

    const { handleCronRoutes } = await import('@electron/api/routes/cron');

    const handled = await handleCronRoutes(
      { method: 'POST' } as IncomingMessage,
      {} as ServerResponse,
      new URL('http://127.0.0.1:3210/api/cron/jobs'),
      {
        gatewayManager: { rpc },
      } as never,
    );

    expect(handled).toBe(true);
    expect(rpc).toHaveBeenCalledWith(
      'cron.add',
      expect.objectContaining({
        name: 'daily-ops',
        agentId: 'ops',
        sessionTarget: 'isolated',
        payload: { kind: 'agentTurn', message: 'run ops brief' },
        delivery: {
          mode: 'announce',
          channel: 'feishu',
          accountId: 'bot2',
          to: 'ou_123',
        },
      }),
    );
    expect(sendJsonMock).toHaveBeenCalledWith(
      expect.anything(),
      200,
      expect.objectContaining({
        id: 'job-1',
        agentId: 'ops',
      }),
    );
  });
});
