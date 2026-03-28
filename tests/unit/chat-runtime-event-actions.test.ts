import { beforeEach, describe, expect, it, vi } from 'vitest';

const clearHistoryPoll = vi.fn();
const setLastChatEventAt = vi.fn();
const handleRuntimeEventState = vi.fn();

vi.mock('@/stores/chat/helpers', () => ({
  clearHistoryPoll: (...args: unknown[]) => clearHistoryPoll(...args),
  setLastChatEventAt: (...args: unknown[]) => setLastChatEventAt(...args),
}));

vi.mock('@/stores/chat/runtime-event-handlers', () => ({
  handleRuntimeEventState: (...args: unknown[]) => handleRuntimeEventState(...args),
}));

describe('chat runtime event actions', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('keeps injected final completion events even when an older run is still active', async () => {
    const { createRuntimeEventActions } = await import('@/stores/chat/runtime-event-actions');
    let state = {
      activeRunId: 'run-old',
      currentSessionKey: 'agent:main:main',
      sending: false,
    };
    const set = vi.fn((patch: Record<string, unknown>) => {
      state = { ...state, ...patch };
    });
    const get = () => state;
    const actions = createRuntimeEventActions(set as never, get as never);

    actions.handleChatEvent({
      runId: 'inject-123',
      state: 'final',
      sessionKey: 'agent:main:main',
      message: {
        role: 'assistant',
        content: 'Command update:\n\nExec finished',
        stopReason: 'stop',
      },
    });

    expect(setLastChatEventAt).toHaveBeenCalledTimes(1);
    expect(clearHistoryPoll).toHaveBeenCalledTimes(1);
    expect(handleRuntimeEventState).toHaveBeenCalledWith(
      set,
      get,
      expect.objectContaining({
        runId: 'inject-123',
        sessionKey: 'agent:main:main',
      }),
      'final',
      'inject-123',
    );
  });
});
