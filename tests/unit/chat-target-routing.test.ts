import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { gatewayRpcMock, hostApiFetchMock, agentsState, gatewayStoreState } = vi.hoisted(() => ({
  gatewayRpcMock: vi.fn(),
  hostApiFetchMock: vi.fn(),
  agentsState: {
    agents: [] as Array<Record<string, unknown>>,
  },
  gatewayStoreState: {
    execApprovalQueue: [] as Array<Record<string, unknown>>,
  },
}));

vi.mock('@/stores/gateway', () => ({
  useGatewayStore: {
    getState: () => ({
      rpc: gatewayRpcMock,
      execApprovalQueue: gatewayStoreState.execApprovalQueue,
    }),
    setState: (updater: unknown) => {
      const current = { execApprovalQueue: gatewayStoreState.execApprovalQueue };
      const next = typeof updater === 'function'
        ? (updater as (state: typeof current) => Partial<typeof current>)(current)
        : (updater as Partial<typeof current>);
      gatewayStoreState.execApprovalQueue = next.execApprovalQueue ?? gatewayStoreState.execApprovalQueue;
    },
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

async function loadChatStoreWithBaseState() {
  const { useChatStore } = await import('@/stores/chat');

  useChatStore.setState({
    currentSessionKey: 'agent:main:main',
    currentAgentId: 'main',
    sessions: [{ key: 'agent:main:main', displayName: 'XClaw', model: 'moonshot/kimi-k2.5' }],
    messages: [],
    sessionLabels: {},
    sessionLastActivity: {},
    sending: false,
    activeRunId: null,
    streamingText: '',
    streamingMessage: null,
    streamingTools: [],
    pendingFinal: false,
    lastUserMessageAt: null,
    pendingToolImages: [],
    error: null,
    loading: false,
    thinkingLevel: null,
    showThinking: true,
    pendingSlashAction: null,
  });

  return useChatStore;
}

describe('chat target routing', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-11T12:00:00Z'));
    window.localStorage.clear();

    agentsState.agents = [
      {
        id: 'main',
        name: 'Main',
        isDefault: true,
        modelDisplay: 'MiniMax',
        inheritedModel: true,
        workspace: '~/.openclaw/workspace',
        agentDir: '~/.openclaw/agents/main/agent',
        mainSessionKey: 'agent:main:main',
        channelTypes: [],
      },
      {
        id: 'research',
        name: 'Research',
        isDefault: false,
        modelDisplay: 'Claude',
        inheritedModel: false,
        workspace: '~/.openclaw/workspace-research',
        agentDir: '~/.openclaw/agents/research/agent',
        mainSessionKey: 'agent:research:desk',
        channelTypes: [],
      },
    ];

    gatewayRpcMock.mockReset();
    gatewayStoreState.execApprovalQueue = [];
    gatewayRpcMock.mockImplementation(async (method: string, params?: Record<string, unknown>) => {
      if (method === 'chat.history') {
        return { messages: [] };
      }
      if (method === 'chat.send') {
        return { runId: 'run-text' };
      }
      if (method === 'exec.approval.resolve') {
        return { ok: true };
      }
      if (method === 'chat.inject') {
        return { ok: true, messageId: 'inject-1' };
      }
      if (method === 'sessions.reset') {
        return { ok: true, key: String(params?.key ?? '') };
      }
      if (method === 'sessions.compact') {
        return { ok: true, compacted: true };
      }
      if (method === 'sessions.patch') {
        const rawModel = params?.model ? String(params.model) : 'moonshot/kimi-k2.5';
        const [modelProvider, ...modelRest] = rawModel.split('/');
        return {
          ok: true,
          key: String(params?.key ?? ''),
          resolved: {
            modelProvider,
            model: modelRest.length > 0 ? modelRest.join('/') : rawModel,
          },
        };
      }
      if (method === 'models.list') {
        return {
          models: [
            { provider: 'moonshot', id: 'kimi-k2.5', name: 'Kimi K2.5' },
            { provider: 'openai', id: 'gpt-5.2', name: 'GPT-5.2' },
          ],
        };
      }
      if (method === 'agents.list') {
        return {
          defaultId: 'main',
          agents: [
            { id: 'main', name: 'Main Agent' },
            { id: 'research', name: 'Research Agent' },
          ],
        };
      }
      if (method === 'chat.abort') {
        return { ok: true };
      }
      if (method === 'sessions.list') {
        return {
          sessions: [
            {
              key: 'agent:main:main',
              modelProvider: 'moonshot',
              model: 'kimi-k2.5',
              thinkingLevel: 'medium',
              verboseLevel: 'off',
              fastMode: false,
              inputTokens: 100,
              outputTokens: 20,
              totalTokens: 120,
            },
            {
              key: 'agent:main:main:subagent:worker-a',
              spawnedBy: 'agent:main:main',
            },
            {
              key: 'agent:main:main:subagent:worker-b',
              spawnedBy: 'agent:main:main',
            },
          ],
        };
      }
      throw new Error(`Unexpected gateway RPC: ${method}`);
    });

    hostApiFetchMock.mockReset();
    hostApiFetchMock.mockResolvedValue({ success: true, result: { runId: 'run-media' } });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('switches to the selected agent main session before sending text', async () => {
    const { useChatStore } = await import('@/stores/chat');

    useChatStore.setState({
      currentSessionKey: 'agent:main:main',
      currentAgentId: 'main',
      sessions: [{ key: 'agent:main:main' }],
      messages: [{ role: 'assistant', content: 'Existing main history' }],
      sessionLabels: {},
      sessionLastActivity: {},
      sending: false,
      activeRunId: null,
      streamingText: '',
      streamingMessage: null,
      streamingTools: [],
      pendingFinal: false,
      lastUserMessageAt: null,
      pendingToolImages: [],
      error: null,
      loading: false,
      thinkingLevel: null,
      showThinking: true,
    });

    await useChatStore.getState().sendMessage('Hello direct agent', undefined, 'research');

    const state = useChatStore.getState();
    expect(state.currentSessionKey).toBe('agent:research:desk');
    expect(state.currentAgentId).toBe('research');
    expect(state.sessions.some((session) => session.key === 'agent:research:desk')).toBe(true);
    expect(state.messages.at(-1)?.content).toBe('Hello direct agent');

    const historyCall = gatewayRpcMock.mock.calls.find(([method]) => method === 'chat.history');
    expect(historyCall?.[1]).toEqual({ sessionKey: 'agent:research:desk', limit: 200 });

    const sendCall = gatewayRpcMock.mock.calls.find(([method]) => method === 'chat.send');
    expect(sendCall?.[1]).toMatchObject({
      sessionKey: 'agent:research:desk',
      message: 'Hello direct agent',
      deliver: false,
    });
    expect(typeof (sendCall?.[1] as { idempotencyKey?: unknown })?.idempotencyKey).toBe('string');
  });

  it('uses the selected agent main session for attachment sends', async () => {
    const { useChatStore } = await import('@/stores/chat');

    useChatStore.setState({
      currentSessionKey: 'agent:main:main',
      currentAgentId: 'main',
      sessions: [{ key: 'agent:main:main' }],
      messages: [],
      sessionLabels: {},
      sessionLastActivity: {},
      sending: false,
      activeRunId: null,
      streamingText: '',
      streamingMessage: null,
      streamingTools: [],
      pendingFinal: false,
      lastUserMessageAt: null,
      pendingToolImages: [],
      error: null,
      loading: false,
      thinkingLevel: null,
      showThinking: true,
    });

    await useChatStore.getState().sendMessage(
      '',
      [
        {
          fileName: 'design.png',
          mimeType: 'image/png',
          fileSize: 128,
          stagedPath: '/tmp/design.png',
          preview: 'data:image/png;base64,abc',
        },
      ],
      'research',
    );

    expect(useChatStore.getState().currentSessionKey).toBe('agent:research:desk');

    expect(hostApiFetchMock).toHaveBeenCalledWith(
      '/api/chat/send-with-media',
      expect.objectContaining({
        method: 'POST',
        body: expect.any(String),
      }),
    );

    const payload = JSON.parse(
      (hostApiFetchMock.mock.calls[0]?.[1] as { body: string }).body,
    ) as {
      sessionKey: string;
      message: string;
      media: Array<{ filePath: string }>;
    };

    expect(payload.sessionKey).toBe('agent:research:desk');
    expect(payload.message).toBe('Process the attached file(s).');
    expect(payload.media[0]?.filePath).toBe('/tmp/design.png');
  });

  it('uses the first main-session user message as the session title immediately', async () => {
    const { useChatStore } = await import('@/stores/chat');

    useChatStore.setState({
      currentSessionKey: 'agent:main:main',
      currentAgentId: 'main',
      sessions: [{ key: 'agent:main:main', displayName: 'XClaw' }],
      messages: [],
      sessionLabels: {},
      sessionLastActivity: {},
      sending: false,
      activeRunId: null,
      streamingText: '',
      streamingMessage: null,
      streamingTools: [],
      pendingFinal: false,
      lastUserMessageAt: null,
      pendingToolImages: [],
      error: null,
      loading: false,
      thinkingLevel: null,
      showThinking: true,
    });

    await useChatStore.getState().sendMessage('你好', undefined, undefined);

    expect(useChatStore.getState().sessionLabels['agent:main:main']).toBe('你好');
  });

  it('sanitizes background-loaded session labels in the main store session list path', async () => {
    const useChatStore = await loadChatStoreWithBaseState();

    gatewayRpcMock.mockImplementation(async (method: string, params?: Record<string, unknown>) => {
      if (method === 'sessions.list') {
        return {
          sessions: [
            {
              key: 'agent:main:main',
              displayName: 'XClaw',
              updatedAt: 1763800000000,
            },
            {
              key: 'agent:main:session-older',
              label: '历史会话',
              updatedAt: 1763700000000,
            },
          ],
        };
      }
      if (method === 'chat.history') {
        if (params?.sessionKey === 'agent:main:session-older') {
          return {
            messages: [
              {
                role: 'user',
                content: '[WhatsApp 2026-03-22 10:00] 你好',
                timestamp: 1763700000,
                id: 'user-older-1',
              },
            ],
          };
        }
        return { messages: [] };
      }
      return { ok: true };
    });

    await useChatStore.getState().loadSessions();

    await vi.waitFor(() => {
      expect(useChatStore.getState().sessionLabels['agent:main:session-older']).toBe('你好');
    });
  });

  it('routes /approve through exec.approval.resolve instead of chat.send', async () => {
    const useChatStore = await loadChatStoreWithBaseState();
    gatewayStoreState.execApprovalQueue = [
      {
        id: '08d6b8cd-1111-2222-3333-444444444444',
        slug: '08d6b8cd',
        createdAtMs: 10,
        expiresAtMs: Date.now() + 60_000,
        request: {
          command: 'find ~/Downloads -type f',
          sessionKey: 'agent:main:main',
        },
      },
    ];

    await useChatStore.getState().sendMessage('/approve 08d6b8cd allow-once');

    expect(gatewayRpcMock).toHaveBeenCalledWith('exec.approval.resolve', {
      id: '08d6b8cd-1111-2222-3333-444444444444',
      decision: 'allow-once',
    });
    expect(gatewayRpcMock).toHaveBeenCalledWith('chat.inject', {
      sessionKey: 'agent:main:main',
      message: 'Exec approval allow-once submitted for 08d6b8cd.\n\nThe pending command is now authorized and may continue asynchronously. Do not request approval again for this approval id unless a new id is generated.',
    });
    expect(
      gatewayRpcMock.mock.calls.find(([method]) => method === 'chat.send'),
    ).toBeUndefined();
    expect(useChatStore.getState().messages).toEqual([
      {
        role: 'assistant',
        content: 'Exec approval allow-once submitted for 08d6b8cd.',
        timestamp: expect.any(Number),
        id: expect.any(String),
      },
    ]);
  });

  it('returns a local usage hint for malformed approval commands instead of sending them to the model', async () => {
    const useChatStore = await loadChatStoreWithBaseState();

    await useChatStore.getState().sendMessage('/aprove 08d6b8cd');

    expect(
      gatewayRpcMock.mock.calls.find(([method]) => method === 'chat.send'),
    ).toBeUndefined();
    expect(useChatStore.getState().messages).toEqual([
      {
        role: 'assistant',
        content: 'Usage: /approve <id> allow-once|allow-always|deny',
        timestamp: expect.any(Number),
        id: expect.any(String),
      },
    ]);
  });

  it('shows the gateway approval error inline when approval submission fails', async () => {
    const useChatStore = await loadChatStoreWithBaseState();

    gatewayRpcMock.mockImplementationOnce(async (method: string) => {
      if (method === 'exec.approval.resolve') {
        throw new Error('unknown or expired approval id');
      }
      return { ok: true };
    });

    await useChatStore.getState().sendMessage('/approve 08d6b8cd allow-once');

    expect(useChatStore.getState().messages).toEqual([
      {
        role: 'assistant',
        content: 'Failed to submit approval: Error: unknown or expired approval id',
        timestamp: expect.any(Number),
        id: expect.any(String),
      },
    ]);
    expect(useChatStore.getState().sending).toBe(false);
  });

  it('falls back to the only pending approval in the current session when the typed slug is stale', async () => {
    const useChatStore = await loadChatStoreWithBaseState();
    gatewayStoreState.execApprovalQueue = [
      {
        id: '242f771b-1111-2222-3333-444444444444',
        slug: '242f771b',
        createdAtMs: 10,
        expiresAtMs: Date.now() + 60_000,
        request: {
          command: 'find ~/Downloads -type f',
          sessionKey: 'agent:main:main',
        },
      },
    ];

    await useChatStore.getState().sendMessage('/approve stale-slug allow-once');

    expect(gatewayRpcMock).toHaveBeenCalledWith('exec.approval.resolve', {
      id: '242f771b-1111-2222-3333-444444444444',
      decision: 'allow-once',
    });
    expect(gatewayRpcMock).toHaveBeenCalledWith('chat.inject', {
      sessionKey: 'agent:main:main',
      message: 'Exec approval allow-once submitted for 242f771b.\n\nThe pending command is now authorized and may continue asynchronously. Do not request approval again for this approval id unless a new id is generated.',
    });
    expect(useChatStore.getState().messages.at(-1)?.content).toBe(
      'Exec approval allow-once submitted for 242f771b.',
    );
  });

  it('shows slash command help locally instead of sending it to chat.send', async () => {
    const useChatStore = await loadChatStoreWithBaseState();

    await useChatStore.getState().sendMessage('/help');

    expect(gatewayRpcMock.mock.calls.find(([method]) => method === 'chat.send')).toBeUndefined();
    expect(useChatStore.getState().messages.at(-1)?.content).toContain('**Available Commands**');
    expect(useChatStore.getState().messages.at(-1)?.content).toContain('/model <name>');
    expect(useChatStore.getState().messages.at(-1)?.content).toContain('/steer <id> <msg>');
  });

  it('routes /model locally through sessions.patch instead of chat.send', async () => {
    const useChatStore = await loadChatStoreWithBaseState();

    await useChatStore.getState().sendMessage('/model openai/gpt-5.2');

    expect(gatewayRpcMock).toHaveBeenCalledWith('sessions.patch', {
      key: 'agent:main:main',
      model: 'openai/gpt-5.2',
    });
    expect(gatewayRpcMock.mock.calls.find(([method]) => method === 'chat.send')).toBeUndefined();
    expect(useChatStore.getState().sessions[0]?.model).toBe('openai/gpt-5.2');
  });

  it('routes /think, /verbose, and /fast locally through sessions.patch', async () => {
    const useChatStore = await loadChatStoreWithBaseState();

    await useChatStore.getState().sendMessage('/think high');
    await useChatStore.getState().sendMessage('/verbose full');
    await useChatStore.getState().sendMessage('/fast on');

    expect(gatewayRpcMock).toHaveBeenCalledWith('sessions.patch', {
      key: 'agent:main:main',
      thinkingLevel: 'high',
    });
    expect(gatewayRpcMock).toHaveBeenCalledWith('sessions.patch', {
      key: 'agent:main:main',
      verboseLevel: 'full',
    });
    expect(gatewayRpcMock).toHaveBeenCalledWith('sessions.patch', {
      key: 'agent:main:main',
      fastMode: true,
    });
    expect(gatewayRpcMock.mock.calls.find(([method]) => method === 'chat.send')).toBeUndefined();
  });

  it('routes /compact locally through sessions.compact', async () => {
    const useChatStore = await loadChatStoreWithBaseState();

    await useChatStore.getState().sendMessage('/compact');

    expect(gatewayRpcMock).toHaveBeenCalledWith('sessions.compact', {
      key: 'agent:main:main',
    });
    expect(gatewayRpcMock.mock.calls.find(([method]) => method === 'chat.send')).toBeUndefined();
    expect(useChatStore.getState().messages.at(-1)?.content).toBe('Context compacted successfully.');
  });

  it('lists agents locally through agents.list', async () => {
    const useChatStore = await loadChatStoreWithBaseState();

    await useChatStore.getState().sendMessage('/agents');

    expect(gatewayRpcMock).toHaveBeenCalledWith('agents.list', {});
    expect(gatewayRpcMock.mock.calls.find(([method]) => method === 'chat.send')).toBeUndefined();
    expect(useChatStore.getState().messages.at(-1)?.content).toContain('**Agents**');
    expect(useChatStore.getState().messages.at(-1)?.content).toContain('`research`');
  });

  it('aborts subagents locally for /kill all', async () => {
    const useChatStore = await loadChatStoreWithBaseState();

    await useChatStore.getState().sendMessage('/kill all');

    expect(gatewayRpcMock).toHaveBeenCalledWith('sessions.list', {});
    expect(gatewayRpcMock).toHaveBeenCalledWith('chat.abort', {
      sessionKey: 'agent:main:main:subagent:worker-a',
    });
    expect(gatewayRpcMock).toHaveBeenCalledWith('chat.abort', {
      sessionKey: 'agent:main:main:subagent:worker-b',
    });
    expect(gatewayRpcMock.mock.calls.find(([method]) => method === 'chat.send')).toBeUndefined();
    expect(useChatStore.getState().messages.at(-1)?.content).toBe('Aborted 2 sub-agent sessions.');
  });

  it('routes /new through chat.send with the literal slash command payload', async () => {
    const useChatStore = await loadChatStoreWithBaseState();

    await useChatStore.getState().sendMessage('/new');

    expect(gatewayRpcMock).toHaveBeenCalledWith(
      'chat.send',
      expect.objectContaining({
        sessionKey: 'agent:main:main',
        message: '/new',
        deliver: false,
      }),
      120000,
    );
    expect(gatewayRpcMock.mock.calls.find(([method]) => method === 'sessions.reset')).toBeUndefined();
    expect(useChatStore.getState().messages.at(-1)?.content).toBe('/new');
  });

  it('routes /reset through chat.send and keeps /clear local', async () => {
    const useChatStore = await loadChatStoreWithBaseState();

    useChatStore.setState({
      messages: [{ role: 'assistant', content: 'Old answer', timestamp: Date.now() / 1000 }],
    });

    await useChatStore.getState().sendMessage('/reset');
    await useChatStore.getState().sendMessage('/clear');

    expect(gatewayRpcMock).toHaveBeenCalledWith(
      'chat.send',
      expect.objectContaining({
        sessionKey: 'agent:main:main',
        message: '/reset',
        deliver: false,
      }),
      120000,
    );

    useChatStore.setState({
      sending: false,
      activeRunId: null,
    });

    await useChatStore.getState().sendMessage('/clear');

    expect(gatewayRpcMock).toHaveBeenCalledWith('sessions.reset', { key: 'agent:main:main' });
    expect(gatewayRpcMock.mock.calls.filter(([method]) => method === 'sessions.reset')).toHaveLength(1);
  });

  it('queues queueable local slash commands while busy and flushes them after the run completes', async () => {
    const useChatStore = await loadChatStoreWithBaseState();

    useChatStore.setState({
      sending: true,
      activeRunId: 'run-busy',
      messages: [
        { role: 'user', content: 'Process this', timestamp: Date.now() / 1000, id: 'user-1' },
      ],
    });

    await useChatStore.getState().sendMessage('/compact');

    expect(gatewayRpcMock.mock.calls.find(([method]) => method === 'sessions.compact')).toBeUndefined();
    expect(gatewayRpcMock.mock.calls.find(([method]) => method === 'chat.send')).toBeUndefined();

    useChatStore.getState().handleChatEvent({
      runId: 'run-busy',
      state: 'final',
      message: {
        role: 'assistant',
        content: 'Done',
        timestamp: Date.now() / 1000,
        id: 'assistant-final-1',
      },
    });

    await Promise.resolve();
    await Promise.resolve();

    expect(gatewayRpcMock).toHaveBeenCalledWith('sessions.compact', {
      key: 'agent:main:main',
    });
  });

  it('executes /focus immediately while busy instead of queueing it', async () => {
    const useChatStore = await loadChatStoreWithBaseState();

    useChatStore.setState({
      sending: true,
      activeRunId: 'run-busy',
    });

    await useChatStore.getState().sendMessage('/focus');

    expect(useChatStore.getState().pendingSlashAction?.kind).toBe('toggle-focus');
    expect(gatewayRpcMock.mock.calls.find(([method]) => method === 'chat.send')).toBeUndefined();
    expect(gatewayRpcMock.mock.calls.find(([method]) => method === 'sessions.compact')).toBeUndefined();
  });

  it('routes /stop and stop aliases through chat.abort instead of chat.send', async () => {
    const useChatStore = await loadChatStoreWithBaseState();

    await useChatStore.getState().sendMessage('/stop');
    await useChatStore.getState().sendMessage('stop');

    expect(gatewayRpcMock).toHaveBeenCalledWith('chat.abort', { sessionKey: 'agent:main:main' });
    expect(gatewayRpcMock.mock.calls.filter(([method]) => method === 'chat.abort')).toHaveLength(2);
    expect(gatewayRpcMock.mock.calls.find(([method]) => method === 'chat.send')).toBeUndefined();
  });

  it('keeps agent slash commands routed through chat.send', async () => {
    const useChatStore = await loadChatStoreWithBaseState();

    await useChatStore.getState().sendMessage('/status');

    expect(gatewayRpcMock).toHaveBeenCalledWith(
      'chat.send',
      expect.objectContaining({
        sessionKey: 'agent:main:main',
        message: '/status',
      }),
      120000,
    );
  });

  it('records pending UI slash actions for /focus and /export only', async () => {
    const useChatStore = await loadChatStoreWithBaseState();

    await useChatStore.getState().sendMessage('/focus');
    expect(useChatStore.getState().pendingSlashAction?.kind).toBe('toggle-focus');

    useChatStore.setState({ pendingSlashAction: null });

    await useChatStore.getState().sendMessage('/export');
    expect(useChatStore.getState().pendingSlashAction?.kind).toBe('export');

    expect(gatewayRpcMock.mock.calls.find(([method]) => method === 'chat.send')).toBeUndefined();
  });

  it('renders /usage locally instead of bouncing through a page navigation action', async () => {
    const useChatStore = await loadChatStoreWithBaseState();

    await useChatStore.getState().sendMessage('/usage');

    expect(useChatStore.getState().pendingSlashAction).toBeNull();
    expect(gatewayRpcMock).toHaveBeenCalledWith('sessions.list', {});
    expect(useChatStore.getState().messages.at(-1)?.content).toContain('**Session Usage**');
    expect(useChatStore.getState().messages.at(-1)?.content).toContain('Input: **100** tokens');
    expect(useChatStore.getState().messages.at(-1)?.content).toContain('Output: **20** tokens');
    expect(useChatStore.getState().messages.at(-1)?.content).toContain('Total: **120** tokens');
    expect(gatewayRpcMock.mock.calls.find(([method]) => method === 'chat.send')).toBeUndefined();
  });

  it('patches the current session model through sessions.patch', async () => {
    const { useChatStore } = await import('@/stores/chat');

    useChatStore.setState({
      currentSessionKey: 'agent:main:main',
      currentAgentId: 'main',
      sessions: [{ key: 'agent:main:main', model: 'moonshot/kimi-k2.5' }],
      messages: [],
      sessionLabels: {},
      sessionLastActivity: {},
      sending: false,
      activeRunId: null,
      streamingText: '',
      streamingMessage: null,
      streamingTools: [],
      pendingFinal: false,
      lastUserMessageAt: null,
      pendingToolImages: [],
      error: null,
      loading: false,
      thinkingLevel: null,
      showThinking: true,
    });

    await useChatStore.getState().setSessionModel('openai/gpt-5.2');

    expect(gatewayRpcMock).toHaveBeenCalledWith(
      'sessions.patch',
      {
        key: 'agent:main:main',
        model: 'openai/gpt-5.2',
      },
    );
    expect(useChatStore.getState().sessions[0]?.model).toBe('openai/gpt-5.2');
  });

  it('normalizes split provider/model fields returned by sessions.list', async () => {
    const { useChatStore } = await import('@/stores/chat');

    gatewayRpcMock.mockImplementationOnce(async (method: string) => {
      if (method === 'sessions.list') {
        return {
          sessions: [
            {
              key: 'agent:main:main',
              modelProvider: 'openai',
              model: 'gpt-5.4',
            },
          ],
        };
      }
      throw new Error(`Unexpected gateway RPC: ${method}`);
    });

    useChatStore.setState({
      currentSessionKey: 'agent:main:main',
      currentAgentId: 'main',
      sessions: [],
      messages: [],
      sessionLabels: {},
      sessionLastActivity: {},
      sending: false,
      activeRunId: null,
      streamingText: '',
      streamingMessage: null,
      streamingTools: [],
      pendingFinal: false,
      lastUserMessageAt: null,
      pendingToolImages: [],
      error: null,
      loading: false,
      thinkingLevel: null,
      showThinking: true,
    });

    await useChatStore.getState().loadSessions();

    expect(useChatStore.getState().sessions[0]?.model).toBe('openai/gpt-5.4');
  });

  it('filters internal cron and subagent sessions before selecting the active chat session', async () => {
    const { useChatStore } = await import('@/stores/chat');

    gatewayRpcMock.mockImplementationOnce(async (method: string) => {
      if (method === 'sessions.list') {
        return {
          sessions: [
            {
              key: 'agent:main:cron:job-1:run:abc',
              updatedAt: Date.parse('2026-03-11T11:59:00Z'),
            },
            {
              key: 'agent:main:subagent:worker-1',
              updatedAt: Date.parse('2026-03-11T11:58:00Z'),
            },
            {
              key: 'agent:main:telegram:direct:12345',
              label: '客户跟进',
              updatedAt: Date.parse('2026-03-11T11:57:00Z'),
            },
          ],
        };
      }
      throw new Error(`Unexpected gateway RPC: ${method}`);
    });

    useChatStore.setState({
      currentSessionKey: 'agent:main:main',
      currentAgentId: 'main',
      sessions: [],
      messages: [],
      sessionLabels: {},
      sessionLastActivity: {},
      sending: false,
      activeRunId: null,
      streamingText: '',
      streamingMessage: null,
      streamingTools: [],
      pendingFinal: false,
      lastUserMessageAt: null,
      pendingToolImages: [],
      error: null,
      loading: false,
      thinkingLevel: null,
      showThinking: true,
    });

    await useChatStore.getState().loadSessions();

    const state = useChatStore.getState();
    expect(state.sessions.map((session) => session.key)).toEqual(['agent:main:telegram:direct:12345']);
    expect(state.currentSessionKey).toBe('agent:main:telegram:direct:12345');
    expect(state.sessionLastActivity['agent:main:telegram:direct:12345']).toBe(Date.parse('2026-03-11T11:57:00Z'));
  });

  it('creates a newest session for the requested agent in the real chat store', async () => {
    const { useChatStore } = await import('@/stores/chat');
    const nowMs = Date.now();

    useChatStore.setState({
      currentSessionKey: 'agent:main:main',
      currentAgentId: 'main',
      sessions: [{ key: 'agent:main:main' }],
      messages: [],
      sessionLabels: {},
      sessionLastActivity: {},
      sending: false,
      activeRunId: null,
      streamingText: '',
      streamingMessage: null,
      streamingTools: [],
      pendingFinal: false,
      lastUserMessageAt: null,
      pendingToolImages: [],
      error: null,
      loading: false,
      thinkingLevel: null,
      showThinking: true,
    });

    useChatStore.getState().newSession('research');

    expect(useChatStore.getState().currentSessionKey).toBe(`agent:research:session-${nowMs}`);
    expect(useChatStore.getState().currentAgentId).toBe('research');
    expect(useChatStore.getState().sessionLastActivity[`agent:research:session-${nowMs}`]).toBe(nowMs);
  });

  it('keeps the current session agent when creating a new chat without an explicit agent', async () => {
    const { useChatStore } = await import('@/stores/chat');
    const nowMs = Date.now();

    useChatStore.setState({
      currentSessionKey: 'agent:research:desk',
      currentAgentId: 'research',
      sessions: [{ key: 'agent:research:desk' }],
      messages: [],
      sessionLabels: {},
      sessionLastActivity: {},
      sending: false,
      activeRunId: null,
      streamingText: '',
      streamingMessage: null,
      streamingTools: [],
      pendingFinal: false,
      lastUserMessageAt: null,
      pendingToolImages: [],
      error: null,
      loading: false,
      thinkingLevel: null,
      showThinking: true,
    });

    useChatStore.getState().newSession();

    expect(useChatStore.getState().currentSessionKey).toBe(`agent:research:session-${nowMs}`);
    expect(useChatStore.getState().currentAgentId).toBe('research');
    expect(useChatStore.getState().sessionLastActivity[`agent:research:session-${nowMs}`]).toBe(nowMs);
  });
});
