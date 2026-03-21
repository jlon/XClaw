import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { Chat } from '@/pages/Chat';

const {
  chatState,
  gatewayState,
  agentsState,
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
  chatMessageRenderSpy: vi.fn(),
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
    gatewayState.status = { state: 'running', port: 18789 };
    agentsState.agents = [
      {
        id: 'main',
        name: 'Main Agent',
      },
    ];
    scrollRefs.scrollRef.current = null;
    scrollRefs.contentRef.current = null;
  });

  it('keeps existing message rows memo-stable across parent rerenders with unchanged state', () => {
    const { rerender } = render(<Chat />);

    expect(chatMessageRenderSpy).toHaveBeenCalledTimes(1);

    rerender(<Chat />);

    expect(chatMessageRenderSpy).toHaveBeenCalledTimes(1);
  });
});
