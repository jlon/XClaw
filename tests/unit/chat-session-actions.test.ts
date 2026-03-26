import { beforeEach, describe, expect, it, vi } from 'vitest';

const invokeIpcMock = vi.fn();
const gatewayRpcMock = vi.fn();

vi.mock('@/lib/api-client', () => ({
  invokeIpc: (...args: unknown[]) => invokeIpcMock(...args),
}));

vi.mock('@/stores/gateway', () => ({
  useGatewayStore: {
    getState: () => ({
      rpc: (...args: unknown[]) => gatewayRpcMock(...args),
    }),
  },
}));

type ChatLikeState = {
  currentSessionKey: string;
  currentAgentId: string;
  sessions: Array<{ key: string; displayName?: string; updatedAt?: number }>;
  messages: Array<{ role: string; timestamp?: number; content?: unknown }>;
  sessionLabels: Record<string, string>;
  sessionLastActivity: Record<string, number>;
  streamingText: string;
  streamingMessage: unknown | null;
  streamingTools: unknown[];
  activeRunId: string | null;
  error: string | null;
  pendingFinal: boolean;
  lastUserMessageAt: number | null;
  pendingToolImages: unknown[];
  loadHistory: ReturnType<typeof vi.fn>;
};

function makeHarness(initial?: Partial<ChatLikeState>) {
  let state: ChatLikeState = {
    currentSessionKey: 'agent:main:main',
    currentAgentId: 'main',
    sessions: [{ key: 'agent:main:main' }],
    messages: [],
    sessionLabels: {},
    sessionLastActivity: {},
    streamingText: '',
    streamingMessage: null,
    streamingTools: [],
    activeRunId: null,
    error: null,
    pendingFinal: false,
    lastUserMessageAt: null,
    pendingToolImages: [],
    loadHistory: vi.fn(),
    ...initial,
  };
  const set = (partial: Partial<ChatLikeState> | ((s: ChatLikeState) => Partial<ChatLikeState>)) => {
    const patch = typeof partial === 'function' ? partial(state) : partial;
    state = { ...state, ...patch };
  };
  const get = () => state;
  return { set, get, read: () => state };
}

describe('chat session actions', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    invokeIpcMock.mockResolvedValue({ success: true });
    gatewayRpcMock.mockResolvedValue({ sessions: [] });
  });

  it('switchSession preserves non-main session that has activity history', async () => {
    const { createSessionActions } = await import('@/stores/chat/session-actions');
    const h = makeHarness({
      currentSessionKey: 'agent:foo:session-a',
      sessions: [{ key: 'agent:foo:session-a' }, { key: 'agent:foo:main' }],
      messages: [],
      sessionLabels: { 'agent:foo:session-a': 'A' },
      sessionLastActivity: { 'agent:foo:session-a': 1 },
    });
    const actions = createSessionActions(h.set as never, h.get as never);

    actions.switchSession('agent:foo:main');
    const next = h.read();
    expect(next.currentSessionKey).toBe('agent:foo:main');
    // Session with labels and activity should NOT be removed even though messages is empty,
    // because messages get cleared eagerly during switchSession before loadHistory completes.
    expect(next.sessions.find((s) => s.key === 'agent:foo:session-a')).toBeDefined();
    expect(next.sessionLabels['agent:foo:session-a']).toBe('A');
    expect(next.sessionLastActivity['agent:foo:session-a']).toBe(1);
    expect(h.read().loadHistory).toHaveBeenCalledTimes(1);
  });

  it('switchSession is a no-op when selecting the current session again', async () => {
    const { createSessionActions } = await import('@/stores/chat/session-actions');
    const h = makeHarness({
      currentSessionKey: 'agent:foo:main',
      currentAgentId: 'foo',
      sessions: [{ key: 'agent:foo:main' }],
      messages: [{ role: 'assistant', content: 'Keep state' }],
      loadHistory: vi.fn(),
    });
    const actions = createSessionActions(h.set as never, h.get as never);

    actions.switchSession('agent:foo:main');

    expect(h.read().messages).toEqual([{ role: 'assistant', content: 'Keep state' }]);
    expect(h.read().loadHistory).not.toHaveBeenCalled();
  });

  it('switchSession removes truly empty non-main session (no activity, no labels)', async () => {
    const { createSessionActions } = await import('@/stores/chat/session-actions');
    const h = makeHarness({
      currentSessionKey: 'agent:foo:session-b',
      sessions: [{ key: 'agent:foo:session-b' }, { key: 'agent:foo:main' }],
      messages: [],
      sessionLabels: {},
      sessionLastActivity: {},
    });
    const actions = createSessionActions(h.set as never, h.get as never);

    actions.switchSession('agent:foo:main');
    const next = h.read();
    expect(next.currentSessionKey).toBe('agent:foo:main');
    // Truly empty session (no labels, no activity) should be cleaned up
    expect(next.sessions.find((s) => s.key === 'agent:foo:session-b')).toBeUndefined();
    expect(h.read().loadHistory).toHaveBeenCalledTimes(1);
  });

  it('deleteSession updates current session and keeps sidebar consistent', async () => {
    const { createSessionActions } = await import('@/stores/chat/session-actions');
    const h = makeHarness({
      currentSessionKey: 'agent:foo:session-a',
      sessions: [{ key: 'agent:foo:session-a' }, { key: 'agent:foo:main' }],
      sessionLabels: { 'agent:foo:session-a': 'A' },
      sessionLastActivity: { 'agent:foo:session-a': 1 },
      messages: [{ role: 'user' }],
    });
    const actions = createSessionActions(h.set as never, h.get as never);

    await actions.deleteSession('agent:foo:session-a');
    const next = h.read();
    expect(invokeIpcMock).toHaveBeenCalledWith('session:delete', 'agent:foo:session-a');
    expect(next.currentSessionKey).toBe('agent:foo:main');
    expect(next.sessions.map((s) => s.key)).toEqual(['agent:foo:main']);
    expect(next.sessionLabels['agent:foo:session-a']).toBeUndefined();
    expect(next.sessionLastActivity['agent:foo:session-a']).toBeUndefined();
    expect(h.read().loadHistory).toHaveBeenCalledTimes(1);
  });

  it('newSession creates a canonical session key and clears transient state', async () => {
    const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(1711111111111);
    const { createSessionActions } = await import('@/stores/chat/session-actions');
    const h = makeHarness({
      currentSessionKey: 'agent:foo:main',
      currentAgentId: 'foo',
      sessions: [{ key: 'agent:foo:main' }],
      messages: [{ role: 'assistant' }],
      streamingText: 'streaming',
      activeRunId: 'r1',
      pendingFinal: true,
    });
    const actions = createSessionActions(h.set as never, h.get as never);

    actions.newSession();
    const next = h.read();
    expect(next.currentSessionKey).toBe('agent:foo:session-1711111111111');
    expect(next.currentAgentId).toBe('foo');
    expect(next.sessions.some((s) => s.key === 'agent:foo:session-1711111111111')).toBe(true);
    expect(next.sessionLastActivity['agent:foo:session-1711111111111']).toBe(1711111111111);
    expect(next.messages).toEqual([]);
    expect(next.streamingText).toBe('');
    expect(next.activeRunId).toBeNull();
    expect(next.pendingFinal).toBe(false);
    nowSpy.mockRestore();
  });

  it('newSession can start directly under another agent', async () => {
    const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(1712222222222);
    const { createSessionActions } = await import('@/stores/chat/session-actions');
    const h = makeHarness({
      currentSessionKey: 'agent:main:main',
      currentAgentId: 'main',
      sessions: [{ key: 'agent:main:main' }],
    });
    const actions = createSessionActions(h.set as never, h.get as never);

    actions.newSession('research');
    const next = h.read();

    expect(next.currentSessionKey).toBe('agent:research:session-1712222222222');
    expect(next.currentAgentId).toBe('research');
    expect(next.sessions.some((s) => s.key === 'agent:research:session-1712222222222')).toBe(true);
    expect(next.sessionLastActivity['agent:research:session-1712222222222']).toBe(1712222222222);
    nowSpy.mockRestore();
  });

  it('seeds sessionLastActivity from visible backend sessions and excludes internal ones', async () => {
    const { createSessionActions } = await import('@/stores/chat/session-actions');
    const h = makeHarness({
      currentSessionKey: 'agent:main:main',
      sessions: [],
    });
    const actions = createSessionActions(h.set as never, h.get as never);

    gatewayRpcMock.mockResolvedValueOnce({
      sessions: [
        {
          key: 'agent:main:main',
          displayName: 'Main',
          updatedAt: 1773281700000,
        },
        {
          key: 'agent:main:telegram:direct:12345',
          label: 'Telegram direct',
          updatedAt: 1773281710000,
        },
        {
          key: 'agent:main:cron:job-1',
          label: 'Cron: Drink water',
          updatedAt: 1773281731621,
        },
      ],
    });

    await actions.loadSessions();

    expect(h.read().sessionLastActivity['agent:main:main']).toBe(1773281700000);
    expect(h.read().sessionLastActivity['agent:main:telegram:direct:12345']).toBe(1773281710000);
    expect(h.read().sessionLastActivity['agent:main:cron:job-1']).toBeUndefined();
    expect(h.read().sessions.find((session) => session.key === 'agent:main:cron:job-1')).toBeUndefined();
  });

  it('loadSessions preserves a local pending session that is not yet in the backend list', async () => {
    const { createSessionActions } = await import('@/stores/chat/session-actions');
    const h = makeHarness({
      currentSessionKey: 'agent:research:session-1773273600000',
      currentAgentId: 'research',
      sessions: [{ key: 'agent:research:session-1773273600000' }],
    });
    const actions = createSessionActions(h.set as never, h.get as never);

    gatewayRpcMock.mockResolvedValueOnce({
      sessions: [
        {
          key: 'agent:main:main',
          displayName: 'Main',
          updatedAt: 1773281700000,
        },
      ],
    });

    await actions.loadSessions();

    expect(h.read().currentSessionKey).toBe('agent:research:session-1773273600000');
    expect(h.read().sessions.some((session) => session.key === 'agent:research:session-1773273600000')).toBe(true);
  });

  it('hydrates main-session labels from the first user message during session refresh', async () => {
    const { createSessionActions } = await import('@/stores/chat/session-actions');
    const h = makeHarness({
      currentSessionKey: 'agent:main:main',
      sessions: [],
    });
    const actions = createSessionActions(h.set as never, h.get as never);

    gatewayRpcMock.mockImplementation(async (method: string, params?: Record<string, unknown>) => {
      if (method === 'sessions.list') {
        return {
          sessions: [
            {
              key: 'agent:main:main',
              displayName: 'XClaw',
              updatedAt: 1773281700000,
            },
          ],
        };
      }
      if (method === 'chat.history') {
        expect(params).toEqual({ sessionKey: 'agent:main:main', limit: 1000 });
        return {
          messages: [
            {
              role: 'user',
              content: '[WhatsApp 2026-03-22 10:00] 你好',
              timestamp: 1773281700000,
            },
            {
              role: 'assistant',
              content: '我在。',
              timestamp: 1773281710000,
            },
          ],
        };
      }
      return {};
    });

    await actions.loadSessions();
    await Promise.resolve();
    await Promise.resolve();

    expect(h.read().sessionLabels['agent:main:main']).toBe('你好');
    expect(h.read().sessionLastActivity['agent:main:main']).toBe(1773281710000);
  });

  it('loads sessions through the gateway store rpc facade', async () => {
    const { createSessionActions } = await import('@/stores/chat/session-actions');
    const h = makeHarness();
    const actions = createSessionActions(h.set as never, h.get as never);

    gatewayRpcMock.mockResolvedValueOnce({
      sessions: [
        {
          key: 'agent:main:main',
          displayName: 'Main',
          updatedAt: 1773281700000,
        },
      ],
    });

    await actions.loadSessions();

    expect(gatewayRpcMock).toHaveBeenCalledWith('sessions.list', {});
  });
});
