import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ChatToolbar } from '@/pages/Chat/ChatToolbar';
import { useChatStore } from '@/stores/chat';
import { useGatewayStore } from '@/stores/gateway';
import { useAgentsStore } from '@/stores/agents';
import { useSettingsStore } from '@/stores/settings';

const { refreshMock } = vi.hoisted(() => ({
  refreshMock: vi.fn(),
}));

vi.mock('@/stores/chat', async () => {
  const { create } = await import('zustand');

  type ChatToolbarStore = {
    refresh: () => void;
    loading: boolean;
    showThinking: boolean;
    toggleThinking: () => void;
    currentAgentId: string;
  };

  const useChatStore = create<ChatToolbarStore>((set) => ({
    refresh: refreshMock,
    loading: false,
    showThinking: false,
    toggleThinking: () => set((state) => ({ showThinking: !state.showThinking })),
    currentAgentId: 'main',
  }));

  return { useChatStore };
});

vi.mock('@/stores/agents', async () => {
  const { create } = await import('zustand');

  type AgentsToolbarStore = {
    agents: Array<{ id: string; name: string }>;
    fetchAgents: () => void;
  };

  const useAgentsStore = create<AgentsToolbarStore>(() => ({
    agents: [
      { id: 'main', name: 'Main' },
      { id: 'writer', name: 'Writer' },
    ],
    fetchAgents: vi.fn(),
  }));

  return { useAgentsStore };
});

vi.mock('@/stores/settings', async () => {
  const { create } = await import('zustand');

  type SettingsToolbarStore = {
    chatFocusMode: boolean;
    setChatFocusMode: (value: boolean) => void;
  };

  const useSettingsStore = create<SettingsToolbarStore>((set) => ({
    chatFocusMode: false,
    setChatFocusMode: (value) => set({ chatFocusMode: value }),
  }));

  return { useSettingsStore };
});

vi.mock('@/stores/gateway', async () => {
  const { create } = await import('zustand');

  type GatewayToolbarStore = {
    status: {
      state: 'running' | 'starting' | 'reconnecting' | 'stopped' | 'error';
      port: number | null;
    };
  };

  const useGatewayStore = create<GatewayToolbarStore>(() => ({
    status: { state: 'running', port: 18789 },
  }));

  return { useGatewayStore };
});

vi.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      switch (key) {
        case 'toolbar.refresh':
          return 'Refresh';
        case 'toolbar.showThinking':
          return 'Show thinking';
        case 'toolbar.hideThinking':
          return 'Hide thinking';
        case 'toolbar.hideSessionPane':
          return 'Hide sessions';
        case 'toolbar.showSessionPane':
          return 'Show sessions';
        case 'sidebar.newChat':
        case 'common:sidebar.newChat':
          return 'New Chat';
        case 'sessionPane.newAgentTitle':
        case 'chat:sessionPane.newAgentTitle':
          return 'Start with agent';
        case 'sessionPane.currentAgent':
        case 'chat:sessionPane.currentAgent':
          return 'Current';
        case 'composer.gatewayConnectedHint':
          return 'Gateway connected';
        case 'composer.gatewayConnectingHint':
          return 'Gateway connecting';
        case 'composer.gatewayReconnectingHint':
          return 'Gateway reconnecting';
        case 'composer.gatewayDisconnectedHint':
          return 'Gateway disconnected';
        case 'composer.gatewayErrorHint':
          return 'Gateway error';
        default:
          return key;
      }
    },
  }),
}));

describe('ChatToolbar', () => {
  beforeEach(() => {
    refreshMock.mockReset();
    vi.restoreAllMocks();
    useChatStore.setState({
      refresh: refreshMock,
      loading: false,
      showThinking: false,
      toggleThinking: () => useChatStore.setState((state) => ({ showThinking: !state.showThinking })),
      currentAgentId: 'main',
    });
    useGatewayStore.setState({
      status: { state: 'running', port: 18789 },
    });
    useAgentsStore.setState({
      agents: [
        { id: 'main', name: 'Main' },
        { id: 'writer', name: 'Writer' },
      ],
      fetchAgents: vi.fn(),
    });
    useSettingsStore.setState({
      chatFocusMode: false,
      setChatFocusMode: (value) => useSettingsStore.setState({ chatFocusMode: value }),
    });
  });

  it('toggles the thinking button pressed state and active class on click', () => {
    render(
      <MemoryRouter>
        <ChatToolbar compact />
      </MemoryRouter>,
    );

    const toggle = screen.getByTestId('chat-toolbar-thinking-toggle');

    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    expect(toggle).not.toHaveClass('app-chat-toolbar-button--active');

    fireEvent.click(toggle);

    expect(useChatStore.getState().showThinking).toBe(true);
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
    expect(toggle).toHaveClass('app-chat-toolbar-button--active');
    expect(toggle).toHaveAttribute('aria-label', 'Hide thinking');
  });

  it('does not render session controls inside ChatToolbar', () => {
    render(
      <MemoryRouter>
        <ChatToolbar compact />
      </MemoryRouter>,
    );

    expect(screen.queryByTestId('chat-session-pane-toggle-toolbar')).not.toBeInTheDocument();
    expect(screen.queryByTestId('chat-new-chat-toolbar')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('toolbar.office')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('toolbar.backToChat')).not.toBeInTheDocument();
  });
});
