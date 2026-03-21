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
  ChatInput: () => <div data-testid="chat-input-dock" />,
}));

vi.mock('@/pages/Chat/ChatMessage', () => ({
  ChatMessage: ({ message }: { message: { content?: string } }) => (
    <div data-testid="chat-message-row">{String(message.content ?? '')}</div>
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
        case 'welcome.subtitle':
          return 'What can I do for you?';
        case 'welcome.description':
          return 'Welcome';
        case 'welcome.askQuestions':
          return 'Handle tasks';
        case 'welcome.askQuestionsDesc':
          return 'Handle tasks desc';
        case 'welcome.creativeTasks':
          return 'Continuous execution';
        case 'welcome.creativeTasksDesc':
          return 'Continuous execution desc';
        case 'welcome.brainstorming':
          return 'Parallel agents';
        case 'welcome.brainstormingDesc':
          return 'Parallel agents desc';
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
  });

  it('renders a compact composer-adjacent error bubble for request timeouts', async () => {
    chatState.error = 'LLM request timed out.';

    render(<Chat />);

    expect(screen.getByText('This request timed out')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Dismiss' })).toBeInTheDocument();
  });
});
