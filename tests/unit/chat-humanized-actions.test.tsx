import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Chat } from '@/pages/Chat';

const {
  chatState,
  gatewayState,
  agentsState,
  scrollRefs,
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
    sendMessage: vi.fn(),
    abortRun: vi.fn(),
    clearError: vi.fn(),
    cleanupEmptySession: vi.fn(),
  },
  gatewayState: {
    status: { state: 'running', port: 18789 },
  },
  agentsState: {
    agents: [] as Array<Record<string, unknown>>,
    fetchAgents: vi.fn(),
  },
  scrollRefs: {
    scrollRef: { current: null as HTMLDivElement | null },
    contentRef: { current: null as HTMLDivElement | null },
  },
}));

vi.mock('@/stores/chat', () => ({
  useChatStore: (selector: (state: typeof chatState) => unknown) => selector(chatState),
}));

vi.mock('@/stores/gateway', () => ({
  useGatewayStore: (selector: (state: typeof gatewayState) => unknown) => selector(gatewayState),
}));

vi.mock('@/stores/agents', () => ({
  useAgentsStore: (selector: (state: typeof agentsState) => unknown) => selector(agentsState),
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
  ChatInput: ({
    draftSeed,
    showScrollToLatest,
    hasPendingLatest,
    onScrollToLatest,
  }: {
    draftSeed?: string;
    showScrollToLatest?: boolean;
    hasPendingLatest?: boolean;
    onScrollToLatest?: () => void;
  }) => (
    <div data-testid="chat-input-dock" data-draft-seed={draftSeed ?? ''}>
      {showScrollToLatest && (
        <button type="button" onClick={onScrollToLatest} aria-label="Scroll to latest">
          {hasPendingLatest ? 'pending latest' : 'scroll latest'}
        </button>
      )}
    </div>
  ),
}));

vi.mock('@/pages/Chat/ChatMessage', () => ({
  ChatMessage: ({ message, showAvatar }: { message: { content?: string }; showAvatar?: boolean }) => (
    <div data-testid="chat-message-row" data-show-avatar={showAvatar === false ? 'false' : 'true'}>
      {String(message.content ?? '')}
    </div>
  ),
}));

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
          return 'Your sidekick is ready. You ask, I start.';
        case 'welcome.description':
          return '';
        case 'welcome.executionKicker':
          return 'Current desk';
        case 'welcome.execution':
          return 'Start the work';
        case 'welcome.executionDesc':
          return 'Drop in the goal, files, and constraints. I will take it from this desk and start moving.';
        case 'welcome.executionPrompt':
          return "Start working on this in the current workspace. I will provide the goal, files, and constraints:";
        case 'welcome.continuationKicker':
          return 'Same thread';
        case 'welcome.continuation':
          return 'Keep it going';
        case 'welcome.continuationDesc':
          return 'Pick up right where we left off, with the same context, model, and trail intact.';
        case 'welcome.continuationPrompt':
          return 'Continue this work from the current session, model, and context:';
        case 'welcome.orchestrationKicker':
          return 'Agent relay';
        case 'welcome.orchestration':
          return 'Split the job';
        case 'welcome.orchestrationDesc':
          return 'When the task gets bigger, break it across agents so each part can keep moving.';
        case 'welcome.orchestrationPrompt':
          return 'Break this work into parts, assign the right agents, and keep the relay moving:';
        case 'welcome.integrationKicker':
          return 'Skills & access';
        case 'welcome.integration':
          return 'Plug in more';
        case 'welcome.integrationDesc':
          return 'Wire in skills, tools, and external access so this desk can take on more than one kind of job.';
        case 'welcome.integrationPrompt':
          return 'Help me identify and connect the skills, tools, or external access needed to handle this work better:';
        case 'message.toolProcessing':
          return 'Processing tools';
        default:
          return typeof vars?.state === 'string' ? `${key}:${vars.state}` : key;
      }
    },
  }),
}));

describe('chat humanized actions', () => {
  beforeEach(() => {
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
    chatState.sendMessage = vi.fn();
    chatState.abortRun = vi.fn();
    chatState.clearError = vi.fn();
    chatState.cleanupEmptySession = vi.fn();
    gatewayState.status = { state: 'running', port: 18789 };
    agentsState.agents = [
      {
        id: 'main',
        name: 'Main Agent',
      },
    ];
    agentsState.fetchAgents = vi.fn();
    scrollRefs.scrollRef.current = null;
    scrollRefs.contentRef.current = null;
  });

  it('shows a jump-to-latest affordance when the user scrolls away from the bottom', async () => {
    render(<Chat />);

    const scroller = scrollRefs.scrollRef.current;
    expect(scroller).toBeTruthy();

    Object.defineProperty(scroller!, 'scrollHeight', { configurable: true, value: 1400 });
    Object.defineProperty(scroller!, 'clientHeight', { configurable: true, value: 500 });
    Object.defineProperty(scroller!, 'scrollTop', { configurable: true, writable: true, value: 120 });
    Object.defineProperty(scroller!, 'scrollTo', { configurable: true, value: vi.fn() });

    fireEvent.scroll(scroller!);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Scroll to latest' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Scroll to latest' }));

    expect(scroller!.scrollTo).toHaveBeenCalled();
  }, 10000);

  it('renders a compact composer-adjacent error bubble for request timeouts', async () => {
    chatState.error = 'LLM request timed out.';

    render(<Chat />);

    expect(screen.getByText('This request timed out')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Dismiss' })).toBeInTheDocument();
  });

  it('hydrates the composer with a starter prompt when a welcome quick action is clicked', async () => {
    chatState.messages = [];

    render(<Chat />);

    fireEvent.click(screen.getByRole('button', { name: /Start the work/i }));

    await waitFor(() => {
      expect(screen.getByTestId('chat-input-dock')).toHaveAttribute('data-draft-seed', 'Start working on this in the current workspace. I will provide the goal, files, and constraints:');
    });
  });

  it('hydrates the composer with a capability prompt when the fourth welcome action is clicked', async () => {
    chatState.messages = [];

    render(<Chat />);

    fireEvent.click(screen.getByRole('button', { name: /Plug in more/i }));

    await waitFor(() => {
      expect(screen.getByTestId('chat-input-dock')).toHaveAttribute('data-draft-seed', 'Help me identify and connect the skills, tools, or external access needed to handle this work better:');
    });
  });

  it('renders the welcome screen as a centered desktop starter instead of a plain suggestion list', () => {
    chatState.messages = [];

    render(<Chat />);

    expect(screen.getByText('XClaw')).toBeInTheDocument();
    expect(screen.queryByText('Main Agent')).not.toBeInTheDocument();
    expect(screen.getByText('Your sidekick is ready. You ask, I start.')).toBeInTheDocument();
    expect(screen.queryByText('Tasks, files, to-dos, and stray ideas can all land here. I do more than answer questions. I take the work, break it down, and keep it moving.')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Start the work/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Keep it going/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Split the job/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Plug in more/i })).toBeInTheDocument();
  });

  it('suppresses repeated assistant avatar chrome for consecutive assistant outputs', () => {
    chatState.messages = [
      {
        id: 'm1',
        role: 'assistant',
        content: 'First assistant block',
        timestamp: 1710000000,
      },
      {
        id: 'm2',
        role: 'assistant',
        content: 'Second assistant block',
        timestamp: 1710000001,
      },
      {
        id: 'm3',
        role: 'user',
        content: 'User reply',
        timestamp: 1710000002,
      },
      {
        id: 'm4',
        role: 'assistant',
        content: 'Assistant after user',
        timestamp: 1710000003,
      },
    ];

    render(<Chat />);

    const rows = screen.getAllByTestId('chat-message-row');
    expect(rows).toHaveLength(4);
    expect(rows[0]).toHaveAttribute('data-show-avatar', 'true');
    expect(rows[1]).toHaveAttribute('data-show-avatar', 'false');
    expect(rows[3]).toHaveAttribute('data-show-avatar', 'true');
  });

  it('keeps consecutive assistant outputs tighter than a role change', () => {
    chatState.messages = [
      {
        id: 'm1',
        role: 'assistant',
        content: 'Assistant block one',
        timestamp: 1710000000,
      },
      {
        id: 'm2',
        role: 'assistant',
        content: 'Assistant block two',
        timestamp: 1710000001,
      },
      {
        id: 'm3',
        role: 'user',
        content: 'User reply',
        timestamp: 1710000002,
      },
    ];

    render(<Chat />);

    const rows = screen.getAllByTestId('chat-message-row');
    expect(rows[0].parentElement).toHaveClass('mt-0');
    expect(rows[1].parentElement).toHaveClass('mt-2');
    expect(rows[2].parentElement).toHaveClass('mt-4');
  });
});
