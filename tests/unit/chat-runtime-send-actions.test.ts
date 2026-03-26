import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createRuntimeSendActions } from '@/stores/chat/runtime-send-actions';
import type { ChatState } from '@/stores/chat/types';

const { gatewayRpcMock, hostApiFetchMock, invokeIpcMock, agentsState } = vi.hoisted(() => ({
  gatewayRpcMock: vi.fn(),
  hostApiFetchMock: vi.fn(),
  invokeIpcMock: vi.fn(),
  agentsState: {
    agents: [] as Array<Record<string, unknown>>,
  },
}));

vi.mock('@/stores/gateway', () => ({
  useGatewayStore: {
    getState: () => ({
      rpc: gatewayRpcMock,
    }),
  },
}));

vi.mock('@/stores/agents', () => ({
  useAgentsStore: {
    getState: () => agentsState,
  },
}));

vi.mock('@/lib/host-api', () => ({
  hostApiFetch: (...args: unknown[]) => hostApiFetchMock(...args),
}));

vi.mock('@/lib/api-client', () => ({
  invokeIpc: (...args: unknown[]) => invokeIpcMock(...args),
}));

function createState(): ChatState {
  return {
    messages: [],
    loading: false,
    error: null,
    sending: false,
    activeRunId: null,
    streamingText: '',
    streamingMessage: null,
    streamingTools: [],
    pendingFinal: false,
    lastUserMessageAt: null,
    pendingToolImages: [],
    sessions: [{ key: 'agent:main:main', displayName: 'XClaw' }],
    currentSessionKey: 'agent:main:main',
    currentAgentId: 'main',
    sessionLabels: {},
    sessionLastActivity: {},
    pendingSlashAction: null,
    showThinking: true,
    thinkingLevel: null,
    loadSessions: vi.fn(async () => {}),
    switchSession: vi.fn(),
    newSession: vi.fn(),
    deleteSession: vi.fn(async () => {}),
    cleanupEmptySession: vi.fn(),
    loadHistory: vi.fn(async () => {}),
    sendMessage: vi.fn(async () => {}),
    abortRun: vi.fn(async () => {}),
    handleChatEvent: vi.fn(),
    toggleThinking: vi.fn(),
    setSessionModel: vi.fn(async () => undefined),
    refresh: vi.fn(async () => {}),
    clearError: vi.fn(),
  };
}

describe('chat runtime send actions', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    gatewayRpcMock.mockReset();
    hostApiFetchMock.mockReset();
    invokeIpcMock.mockReset();
    agentsState.agents = [
      {
        id: 'main',
        mainSessionKey: 'agent:main:main',
      },
    ];
    gatewayRpcMock.mockImplementation(async (method: string) => {
      if (method === 'chat.send') {
        return { runId: 'run-text' };
      }
      if (method === 'chat.abort') {
        return { ok: true };
      }
      if (method === 'chat.history') {
        return { messages: [] };
      }
      throw new Error(`Unexpected gateway RPC: ${method}`);
    });
    hostApiFetchMock.mockResolvedValue({ success: true, result: { runId: 'run-media' } });
  });

  it('handles /help locally in the modular runtime send path', async () => {
    let state = createState();
    const set = (patch: Partial<ChatState> | ((current: ChatState) => Partial<ChatState>)) => {
      const next = typeof patch === 'function' ? patch(state) : patch;
      state = { ...state, ...next };
    };
    const get = () => state;
    const actions = createRuntimeSendActions(set, get);

    await actions.sendMessage('/help');

    expect(gatewayRpcMock.mock.calls.find(([method]) => method === 'chat.send')).toBeUndefined();
    expect(state.messages).toHaveLength(1);
    expect(state.messages[0]?.content).toContain('**Available Commands**');
  });

  it('queues /compact while busy in the modular runtime path and flushes it after the run completes', async () => {
    let state = {
      ...createState(),
      sending: true,
      activeRunId: 'run-busy',
      messages: [{ role: 'user', content: 'busy', timestamp: Date.now() / 1000, id: 'u1' }],
    } satisfies ChatState;
    const set = (patch: Partial<ChatState> | ((current: ChatState) => Partial<ChatState>)) => {
      const next = typeof patch === 'function' ? patch(state) : patch;
      state = { ...state, ...next };
    };
    const get = () => state;
    const actions = createRuntimeSendActions(set, get);
    const { createRuntimeEventActions } = await import('@/stores/chat/runtime-event-actions');
    const eventActions = createRuntimeEventActions(set, get);

    await actions.sendMessage('/compact');

    expect(gatewayRpcMock.mock.calls.find(([method]) => method === 'sessions.compact')).toBeUndefined();

    eventActions.handleChatEvent({
      runId: 'run-busy',
      state: 'final',
      message: {
        role: 'assistant',
        content: 'done',
        timestamp: Date.now() / 1000,
        id: 'a1',
      },
    });

    await Promise.resolve();
    await Promise.resolve();

    expect(gatewayRpcMock).toHaveBeenCalledWith('sessions.compact', { key: 'agent:main:main' });
  });

  it('sends plain text through the gateway store instead of direct renderer IPC', async () => {
    let state = createState();
    const set = (patch: Partial<ChatState> | ((current: ChatState) => Partial<ChatState>)) => {
      const next = typeof patch === 'function' ? patch(state) : patch;
      state = { ...state, ...next };
    };
    const get = () => state;
    const actions = createRuntimeSendActions(set, get);

    await actions.sendMessage('Hello browser mode');

    expect(gatewayRpcMock).toHaveBeenCalledWith(
      'chat.send',
      expect.objectContaining({
        sessionKey: 'agent:main:main',
        message: 'Hello browser mode',
      }),
      120000,
    );
    expect(hostApiFetchMock).not.toHaveBeenCalled();
    expect(invokeIpcMock).not.toHaveBeenCalledWith(
      'gateway:rpc',
      expect.anything(),
      expect.anything(),
      expect.anything(),
    );
  });

  it('sends media through the host api instead of direct renderer IPC', async () => {
    let state = createState();
    const set = (patch: Partial<ChatState> | ((current: ChatState) => Partial<ChatState>)) => {
      const next = typeof patch === 'function' ? patch(state) : patch;
      state = { ...state, ...next };
    };
    const get = () => state;
    const actions = createRuntimeSendActions(set, get);

    await actions.sendMessage('Look at this', [
      {
        fileName: 'image.png',
        mimeType: 'image/png',
        fileSize: 123,
        stagedPath: '/tmp/image.png',
        preview: 'data:image/png;base64,abc',
      },
    ]);

    expect(hostApiFetchMock).toHaveBeenCalledWith(
      '/api/chat/send-with-media',
      expect.objectContaining({
        method: 'POST',
      }),
    );
    expect(gatewayRpcMock).not.toHaveBeenCalledWith('chat.send', expect.anything(), expect.anything());
    expect(invokeIpcMock).not.toHaveBeenCalledWith(
      'chat:sendWithMedia',
      expect.anything(),
    );
  });
});
