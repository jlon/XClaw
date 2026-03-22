import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ChatToolbar } from '@/pages/Chat/ChatToolbar';
import { useChatStore } from '@/stores/chat';
import { useGatewayStore } from '@/stores/gateway';

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
  };

  const useChatStore = create<ChatToolbarStore>((set) => ({
    refresh: refreshMock,
    loading: false,
    showThinking: false,
    toggleThinking: () => set((state) => ({ showThinking: !state.showThinking })),
  }));

  return { useChatStore };
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
    useChatStore.setState({
      refresh: refreshMock,
      loading: false,
      showThinking: false,
      toggleThinking: () => useChatStore.setState((state) => ({ showThinking: !state.showThinking })),
    });
    useGatewayStore.setState({
      status: { state: 'running', port: 18789 },
    });
  });

  it('toggles the thinking button pressed state and active class on click', () => {
    render(<ChatToolbar compact />);

    const toggle = screen.getByTestId('chat-toolbar-thinking-toggle');

    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    expect(toggle).not.toHaveClass('app-chat-toolbar-button--active');

    fireEvent.click(toggle);

    expect(useChatStore.getState().showThinking).toBe(true);
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
    expect(toggle).toHaveClass('app-chat-toolbar-button--active');
    expect(toggle).toHaveAttribute('aria-label', 'Hide thinking');
  });
});
