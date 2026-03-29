import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Chat } from '@/pages/Chat';

const {
  chatState,
  gatewayState,
  agentsState,
  settingsState,
  scrollRefs,
  chatMessageRenderSpy,
} = vi.hoisted(() => ({
  chatState: {
    messages: [] as Array<Record<string, unknown>>,
    currentSessionKey: 'agent:main:thread-1',
    currentAgentId: 'main',
    sessions: [] as Array<Record<string, unknown>>,
    sessionLabels: {} as Record<string, string>,
    loading: false,
    sending: false,
    error: null as string | null,
    showThinking: false,
    streamingMessage: null as unknown,
    streamingTools: [] as Array<Record<string, unknown>>,
    pendingFinal: false,
    lastUserMessageAt: null as number | null,
    sendMessage: vi.fn(),
    abortRun: vi.fn(),
    clearError: vi.fn(),
    cleanupEmptySession: vi.fn(),
  },
  gatewayState: {
    status: { state: 'running', port: 18789 },
    execApprovalQueue: [] as Array<Record<string, unknown>>,
  },
  agentsState: {
    agents: [] as Array<Record<string, unknown>>,
    fetchAgents: vi.fn(),
  },
  settingsState: {
    chatFocusMode: false,
    setChatFocusMode: vi.fn(),
  },
  scrollRefs: {
    scrollRef: { current: null as HTMLDivElement | null },
    contentRef: { current: null as HTMLDivElement | null },
  },
  chatMessageRenderSpy: vi.fn(),
}));

vi.mock('@/stores/chat', () => ({
  useChatStore: Object.assign(
    (selector: (state: typeof chatState) => unknown) => selector(chatState),
    {
      getState: () => chatState,
      setState: vi.fn(),
    },
  ),
}));

vi.mock('@/stores/gateway', () => ({
  useGatewayStore: (selector: (state: typeof gatewayState) => unknown) => selector(gatewayState),
}));

vi.mock('@/stores/agents', () => ({
  useAgentsStore: Object.assign(
    (selector: (state: typeof agentsState) => unknown) => selector(agentsState),
    {
      getState: () => agentsState,
    },
  ),
}));

vi.mock('@/stores/settings', () => ({
  useSettingsStore: Object.assign(
    (selector: (state: typeof settingsState) => unknown) => selector(settingsState),
    {
      getState: () => settingsState,
    },
  ),
}));

vi.mock('@/hooks/use-stick-to-bottom-instant', () => ({
  useStickToBottomInstant: () => scrollRefs,
}));

vi.mock('@/hooks/use-min-loading', () => ({
  useMinLoading: () => false,
}));

vi.mock('@/components/common/LoadingSpinner', () => ({
  LoadingSpinner: () => <div data-testid="loading-spinner" />,
}));

vi.mock('@/lib/chat-avatar', () => ({
  getSessionAvatar: () => ({ label: 'A', style: 'from-primary to-primary' }),
}));

vi.mock('@/pages/Chat/ChatInput', () => ({
  ChatInput: () => <div data-testid="chat-input-dock" />,
}));

vi.mock('@/pages/Chat/ChatMessage', () => {
  const MockChatMessage = React.memo(() => {
    chatMessageRenderSpy();
    return <div data-testid="chat-message-row" />;
  });

  return {
    ChatMessage: MockChatMessage,
  };
});

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, vars?: Record<string, unknown>) => {
      switch (key) {
        case 'toolbar.scrollToLatest':
          return 'Scroll to latest';
        case 'errors.requestTimeout':
          return 'This request timed out';
        case 'common:actions.dismiss':
          return 'Dismiss';
        case 'welcome.title':
          return 'XClaw';
        case 'welcome.subtitle':
          return 'Your sidekick is ready. You ask, I start. Endless possibilities await.';
        case 'welcome.description':
          return '';
        case 'welcome.executionKicker':
          return 'Current desk';
        case 'welcome.execution':
          return 'Start the work';
        case 'welcome.executionDesc':
          return 'Drop in the goal, files, and constraints. I will take it from this desk and start moving.';
        case 'welcome.continuationKicker':
          return 'Same thread';
        case 'welcome.continuation':
          return 'Keep it going';
        case 'welcome.continuationDesc':
          return 'Pick up right where we left off, with the same context, model, and trail intact.';
        case 'welcome.orchestrationKicker':
          return 'Agent relay';
        case 'welcome.orchestration':
          return 'Split the job';
        case 'welcome.orchestrationDesc':
          return 'When the task gets bigger, break it across agents so each part can keep moving.';
        case 'welcome.integrationKicker':
          return 'Skills & access';
        case 'welcome.integration':
          return 'Plug in more';
        case 'welcome.integrationDesc':
          return 'Wire in skills, tools, and external access so this desk can take on more than one kind of job.';
        case 'message.toolProcessing':
          return 'Processing tools';
        case 'execApproval.title':
          return 'Local exec approval needed';
        case 'execApproval.subtitle':
          return `This command expires in ${String(vars?.remaining ?? '')}`;
        case 'execApproval.queueCount':
          return `${String(vars?.count ?? '')} pending`;
        case 'execApproval.commandLabel':
          return 'Pending command';
        case 'execApproval.cwdLabel':
          return 'Working directory';
        case 'execApproval.hostLabel':
          return 'Host';
        case 'execApproval.policyLabel':
          return 'Approval policy';
        case 'execApproval.deny':
          return 'Deny';
        case 'execApproval.allowAlways':
          return 'Allow always';
        case 'execApproval.allowOnce':
          return 'Allow once';
        default:
          return typeof vars?.state === 'string' ? `${key}:${vars.state}` : key;
      }
    },
  }),
}));

describe('chat render stability', () => {
  beforeEach(() => {
    chatMessageRenderSpy.mockReset();
    chatState.messages = [
      {
        id: 'm1',
        role: 'assistant',
        content: 'Earlier content',
        timestamp: 1710000000,
      },
    ];
    chatState.currentSessionKey = 'agent:main:thread-1';
    chatState.currentAgentId = 'main';
    chatState.sessions = [
      {
        key: 'agent:main:thread-1',
        label: 'Main thread',
      },
    ];
    chatState.sessionLabels = {};
    chatState.loading = false;
    chatState.sending = false;
    chatState.error = null;
    chatState.showThinking = false;
    chatState.streamingMessage = null;
    chatState.streamingTools = [];
    chatState.pendingFinal = false;
    chatState.lastUserMessageAt = null;
    gatewayState.status = { state: 'running', port: 18789 };
    gatewayState.execApprovalQueue = [];
    agentsState.agents = [
      {
        id: 'main',
        name: 'Main Agent',
      },
    ];
    scrollRefs.scrollRef.current = null;
    scrollRefs.contentRef.current = null;
  });

  const renderChat = () => render(
    <MemoryRouter>
      <Chat />
    </MemoryRouter>,
  );

  it('keeps existing message rows memo-stable across parent rerenders with unchanged state', () => {
    const { rerender } = renderChat();

    expect(chatMessageRenderSpy).toHaveBeenCalledTimes(1);

    rerender(
      <MemoryRouter>
        <Chat />
      </MemoryRouter>,
    );

    expect(chatMessageRenderSpy).toHaveBeenCalledTimes(1);
  });

  it('renders the welcome shell without the legacy main agent heading when the chat is empty', () => {
    chatState.messages = [];

    const { container, queryByText, getByText } = renderChat();
    const scrollShell = container.querySelector('.app-chat-workspace-shell');

    expect(queryByText('Main Agent')).not.toBeInTheDocument();
    expect(getByText('XClaw')).toBeInTheDocument();
    expect(getByText('Your sidekick is ready. You ask, I start. Endless possibilities await.')).toBeInTheDocument();
    expect(queryByText('Tasks, files, to-dos, and stray ideas can all land here. I do more than answer questions. I take the work, break it down, and keep it moving.')).not.toBeInTheDocument();
    expect(getByText('Start the work')).toBeInTheDocument();
    expect(getByText('Keep it going')).toBeInTheDocument();
    expect(getByText('Split the job')).toBeInTheDocument();
    expect(getByText('Plug in more')).toBeInTheDocument();
    expect(scrollShell).toHaveClass('subtle-scrollbar');
  });

  it('keeps the welcome hero stable regardless of runtime state so the hero layout does not jump', () => {
    chatState.messages = [];
    gatewayState.status = { state: 'running', port: 18789 };

    const { rerender } = renderChat();

    expect(screen.getByTestId('chat-welcome-hero')).toBeInTheDocument();
    expect(screen.getByTestId('chat-welcome-wordmark')).toBeInTheDocument();
    expect(screen.queryByTestId('chat-welcome-status-slot')).not.toBeInTheDocument();

    gatewayState.status = { state: 'starting', port: 18789 };

    rerender(
      <MemoryRouter>
        <Chat />
      </MemoryRouter>,
    );

    expect(screen.getByTestId('chat-welcome-hero')).toBeInTheDocument();
    expect(screen.getByTestId('chat-welcome-wordmark')).toBeInTheDocument();
    expect(screen.queryByTestId('chat-welcome-status-slot')).not.toBeInTheDocument();
  });

  it('does not fall back to the welcome shell while an existing session history is loading', () => {
    chatState.messages = [];
    chatState.loading = true;

    const { queryByTestId, queryByText } = renderChat();

    expect(queryByTestId('chat-welcome-hero')).not.toBeInTheDocument();
    expect(queryByText('Start the work')).not.toBeInTheDocument();
  });

  it('filters system/runtime messages out of the visible chat transcript', () => {
    chatState.messages = [
      {
        id: 'sys-1',
        role: 'system',
        content: 'Exec approval allow-once submitted for 08d6b8cd.',
        timestamp: 1710000000,
      },
      {
        id: 'runtime-approval-1',
        role: 'assistant',
        content: 'Exec approval allow-always submitted for 55fc94cf.\n\nThe pending command is now authorized and may continue asynchronously. Do not request approval again for this approval id unless a new id is generated.',
        timestamp: 1710000001,
      },
      {
        id: 'm1',
        role: 'assistant',
        content: '正常助手回复',
        timestamp: 1710000100,
      },
    ];

    renderChat();

    expect(chatMessageRenderSpy).toHaveBeenCalledTimes(1);
  });

  it('does not render a duplicate streaming row after the final assistant reply is already in history', () => {
    chatState.messages = [
      {
        id: 'm1',
        role: 'assistant',
        content: 'Final answer',
        timestamp: 1710000100,
      },
    ];
    chatState.sending = true;
    chatState.streamingMessage = {
      role: 'assistant',
      content: 'Final answer',
      timestamp: 1710000101,
    };

    renderChat();

    expect(chatMessageRenderSpy).toHaveBeenCalledTimes(1);
  });

  it('uses desktop scrollbars for populated chat threads and subtle scrollbars only for the welcome shell', () => {
    const { container, rerender } = renderChat();
    const populatedScrollShell = container.querySelector('.app-chat-workspace-shell');

    expect(populatedScrollShell).toHaveClass('workspace-page-scroll-default');
    expect(populatedScrollShell).not.toHaveClass('subtle-scrollbar');

    chatState.messages = [];
    rerender(
      <MemoryRouter>
        <Chat />
      </MemoryRouter>,
    );

    const emptyScrollShell = container.querySelector('.app-chat-workspace-shell');
    expect(emptyScrollShell).toHaveClass('subtle-scrollbar');
  });

  it('marks the chat surface as a wallpaper-aware page stage', () => {
    const { container } = renderChat();

    expect(container.querySelector('.app-chat-shell')).toHaveClass('app-page-stage');
  });

  it('renders a desktop exec approval overlay for pending approvals in the current session', () => {
    gatewayState.execApprovalQueue = [
      {
        id: '3991c078-e218-45b9-bc33-c9218184520c',
        slug: '3991c078',
        createdAtMs: 10,
        expiresAtMs: Date.now() + 60_000,
        request: {
          command: `uv run python - <<'PY'
print("hello")
PY`,
          cwd: '/Users/jianglong/.openclaw/workspace',
          host: 'gateway',
          security: 'default',
          ask: 'on-fail',
          sessionKey: 'agent:main:thread-1',
        },
      },
    ];

    const { getByText } = renderChat();

    expect(getByText('Local exec approval needed')).toBeInTheDocument();
    expect(getByText('Pending command')).toBeInTheDocument();
    expect(getByText('Allow once')).toBeInTheDocument();
    expect(getByText('Allow always')).toBeInTheDocument();
    expect(getByText('Deny')).toBeInTheDocument();
  });
});
