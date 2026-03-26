import { beforeEach, describe, expect, it, vi } from 'vitest';

const hostApiFetchMock = vi.fn();
const gatewayRpcMock = vi.fn();
const clearHistoryPoll = vi.fn();
const enrichWithCachedImages = vi.fn((messages) => messages);
const enrichWithToolResultFiles = vi.fn((messages) => messages);
const getMessageText = vi.fn((content: unknown) => typeof content === 'string' ? content : '');
const getSessionLabelText = vi.fn((content: unknown) => typeof content === 'string' ? content : '');
const hasNonToolAssistantContent = vi.fn((message: { content?: unknown } | undefined) => {
  if (!message) return false;
  return typeof message.content === 'string' ? message.content.trim().length > 0 : true;
});
const isToolResultRole = vi.fn((role: unknown) => role === 'toolresult' || role === 'tool_result');
const loadMissingPreviews = vi.fn(async () => false);
const toMs = vi.fn((ts: number) => ts < 1e12 ? ts * 1000 : ts);

vi.mock('@/stores/gateway', () => ({
  useGatewayStore: {
    getState: () => ({
      rpc: (...args: unknown[]) => gatewayRpcMock(...args),
    }),
  },
}));

vi.mock('@/lib/host-api', () => ({
  hostApiFetch: (...args: unknown[]) => hostApiFetchMock(...args),
}));

vi.mock('@/stores/chat/helpers', () => ({
  clearHistoryPoll: (...args: unknown[]) => clearHistoryPoll(...args),
  enrichWithCachedImages: (...args: unknown[]) => enrichWithCachedImages(...args),
  enrichWithToolResultFiles: (...args: unknown[]) => enrichWithToolResultFiles(...args),
  getMessageText: (...args: unknown[]) => getMessageText(...args),
  getSessionLabelText: (...args: unknown[]) => getSessionLabelText(...args),
  hasNonToolAssistantContent: (...args: unknown[]) => hasNonToolAssistantContent(...args),
  isToolResultRole: (...args: unknown[]) => isToolResultRole(...args),
  loadMissingPreviews: (...args: unknown[]) => loadMissingPreviews(...args),
  toMs: (...args: unknown[]) => toMs(...args as Parameters<typeof toMs>),
}));

type ChatLikeState = {
  currentSessionKey: string;
  messages: Array<{ role: string; timestamp?: number; content?: unknown; _attachedFiles?: unknown[] }>;
  loading: boolean;
  error: string | null;
  sending: boolean;
  lastUserMessageAt: number | null;
  pendingFinal: boolean;
  sessionLabels: Record<string, string>;
  sessionLastActivity: Record<string, number>;
  thinkingLevel: string | null;
  activeRunId: string | null;
};

function makeHarness(initial?: Partial<ChatLikeState>) {
  let state: ChatLikeState = {
    currentSessionKey: 'agent:main:main',
    messages: [],
    loading: false,
    error: null,
    sending: false,
    lastUserMessageAt: null,
    pendingFinal: false,
    sessionLabels: {},
    sessionLastActivity: {},
    thinkingLevel: null,
    activeRunId: null,
    ...initial,
  };

  const set = (partial: Partial<ChatLikeState> | ((s: ChatLikeState) => Partial<ChatLikeState>)) => {
    const patch = typeof partial === 'function' ? partial(state) : partial;
    state = { ...state, ...patch };
  };
  const get = () => state;
  return { set, get, read: () => state };
}

describe('chat history actions', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    gatewayRpcMock.mockResolvedValue({ messages: [] });
    hostApiFetchMock.mockResolvedValue({ messages: [] });
  });

  it('uses cron session fallback when gateway history is empty', async () => {
    const { createHistoryActions } = await import('@/stores/chat/history-actions');
    const h = makeHarness({
      currentSessionKey: 'agent:main:cron:job-1',
    });
    const actions = createHistoryActions(h.set as never, h.get as never);

    hostApiFetchMock.mockResolvedValueOnce({
      messages: [
        {
          id: 'cron-meta-job-1',
          role: 'system',
          content: 'Scheduled task: Drink water',
          timestamp: 1773281731495,
        },
        {
          id: 'cron-run-1',
          role: 'assistant',
          content: 'Drink water 💧',
          timestamp: 1773281732751,
        },
      ],
    });

    await actions.loadHistory();

    expect(hostApiFetchMock).toHaveBeenCalledWith(
      '/api/cron/session-history?sessionKey=agent%3Amain%3Acron%3Ajob-1&limit=200',
    );
    expect(h.read().messages.map((message) => message.content)).toEqual([
      'Scheduled task: Drink water',
      'Drink water 💧',
    ]);
    expect(h.read().sessionLastActivity['agent:main:cron:job-1']).toBe(1773281732751);
    expect(h.read().loading).toBe(false);
  });

  it('does not use cron fallback for normal sessions', async () => {
    const { createHistoryActions } = await import('@/stores/chat/history-actions');
    const h = makeHarness({
      currentSessionKey: 'agent:main:main',
    });
    const actions = createHistoryActions(h.set as never, h.get as never);

    await actions.loadHistory();

    expect(hostApiFetchMock).not.toHaveBeenCalled();
    expect(h.read().messages).toEqual([]);
    expect(h.read().loading).toBe(false);
  });

  it('uses the first user message as the label for main sessions too', async () => {
    const { createHistoryActions } = await import('@/stores/chat/history-actions');
    const h = makeHarness({
      currentSessionKey: 'agent:main:main',
    });
    const actions = createHistoryActions(h.set as never, h.get as never);

    gatewayRpcMock.mockResolvedValueOnce({
      messages: [
        {
          id: 'user-1',
          role: 'user',
          content: '帮我把桌面文件整理一下',
          timestamp: 1773281731495,
        },
        {
          id: 'assistant-1',
          role: 'assistant',
          content: '先从下载目录开始。',
          timestamp: 1773281732751,
        },
      ],
    });

    await actions.loadHistory();

    expect(h.read().sessionLabels['agent:main:main']).toBe('帮我把桌面文件整理一下');
    expect(h.read().sessionLastActivity['agent:main:main']).toBe(1773281732751);
  });

  it('sanitizes session labels when history hydrates from transport-prefixed user messages', async () => {
    const { createHistoryActions } = await import('@/stores/chat/history-actions');
    const h = makeHarness({
      currentSessionKey: 'agent:main:session-older',
    });
    const actions = createHistoryActions(h.set as never, h.get as never);

    getSessionLabelText.mockImplementationOnce((content: unknown) =>
      typeof content === 'string' ? content.replace(/^\[WhatsApp 2026-03-22 10:00\]\s*/, '') : '',
    );
    gatewayRpcMock.mockResolvedValueOnce({
      messages: [
        {
          id: 'user-1',
          role: 'user',
          content: '[WhatsApp 2026-03-22 10:00] 你好',
          timestamp: 1773281731495,
        },
        {
          id: 'assistant-1',
          role: 'assistant',
          content: '收到',
          timestamp: 1773281732751,
        },
      ],
    });

    await actions.loadHistory();

    expect(h.read().sessionLabels['agent:main:session-older']).toBe('你好');
  });

  it('loads normal session history through the gateway store rpc facade', async () => {
    const { createHistoryActions } = await import('@/stores/chat/history-actions');
    const h = makeHarness({
      currentSessionKey: 'agent:main:main',
    });
    const actions = createHistoryActions(h.set as never, h.get as never);

    gatewayRpcMock.mockResolvedValueOnce({
      messages: [
        {
          id: 'assistant-1',
          role: 'assistant',
          content: 'ok',
          timestamp: 1773281732751,
        },
      ],
    });

    await actions.loadHistory();

    expect(gatewayRpcMock).toHaveBeenCalledWith('chat.history', {
      sessionKey: 'agent:main:main',
      limit: 200,
    });
  });
});
