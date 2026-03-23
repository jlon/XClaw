import { beforeEach, describe, expect, it, vi } from 'vitest';

const hostApiFetchMock = vi.fn();
const subscribeHostEventMock = vi.fn();

vi.mock('@/lib/host-api', () => ({
  hostApiFetch: (...args: unknown[]) => hostApiFetchMock(...args),
}));

vi.mock('@/lib/host-events', () => ({
  subscribeHostEvent: (...args: unknown[]) => subscribeHostEventMock(...args),
}));

describe('gateway store event wiring', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('subscribes to host events through subscribeHostEvent on init', async () => {
    hostApiFetchMock.mockResolvedValueOnce({ state: 'running', port: 18789 });

    const handlers = new Map<string, (payload: unknown) => void>();
    subscribeHostEventMock.mockImplementation((eventName: string, handler: (payload: unknown) => void) => {
      handlers.set(eventName, handler);
      return () => {};
    });

    const { useGatewayStore } = await import('@/stores/gateway');
    await useGatewayStore.getState().init();

    expect(subscribeHostEventMock).toHaveBeenCalledWith('gateway:status', expect.any(Function));
    expect(subscribeHostEventMock).toHaveBeenCalledWith('gateway:error', expect.any(Function));
    expect(subscribeHostEventMock).toHaveBeenCalledWith('gateway:notification', expect.any(Function));
    expect(subscribeHostEventMock).toHaveBeenCalledWith('gateway:chat-message', expect.any(Function));
    expect(subscribeHostEventMock).toHaveBeenCalledWith('gateway:channel-status', expect.any(Function));

    handlers.get('gateway:status')?.({ state: 'stopped', port: 18789 });
    expect(useGatewayStore.getState().status.state).toBe('stopped');
  });

  it('tracks exec approval requests and resolutions from gateway notifications', async () => {
    hostApiFetchMock.mockResolvedValueOnce({ state: 'running', port: 18789 });

    const handlers = new Map<string, (payload: unknown) => void>();
    subscribeHostEventMock.mockImplementation((eventName: string, handler: (payload: unknown) => void) => {
      handlers.set(eventName, handler);
      return () => {};
    });

    const { useGatewayStore } = await import('@/stores/gateway');
    await useGatewayStore.getState().init();

    handlers.get('gateway:notification')?.({
      method: 'exec.approval.requested',
      params: {
        id: '242f771b-1111-2222-3333-444444444444',
        createdAtMs: 10,
        expiresAtMs: Date.now() + 60_000,
        request: {
          command: 'find ~/Downloads -type f',
          sessionKey: 'agent:main:main',
        },
      },
    });

    expect(useGatewayStore.getState().execApprovalQueue).toEqual([
      expect.objectContaining({
        id: '242f771b-1111-2222-3333-444444444444',
        slug: '242f771b',
      }),
    ]);

    handlers.get('gateway:notification')?.({
      method: 'exec.approval.resolved',
      params: {
        id: '242f771b-1111-2222-3333-444444444444',
        decision: 'allow-once',
      },
    });

    expect(useGatewayStore.getState().execApprovalQueue).toEqual([]);
  });
});
