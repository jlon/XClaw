import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { Chat } from '@/pages/Chat';

const {
  chatState,
  gatewayState,
  agentsState,
  settingsState,
  scrollRefs,
  hostApiFetchMock,
} = vi.hoisted(() => ({
  chatState: {
    messages: [
      {
        id: 'm1',
        role: 'assistant',
        content: 'Ready to export',
        timestamp: 1710000000,
      },
    ] as Array<Record<string, unknown>>,
    currentSessionKey: 'agent:main:main',
    currentAgentId: 'main',
    sessions: [{ key: 'agent:main:main', label: 'Main thread' }] as Array<Record<string, unknown>>,
    sessionLabels: { 'agent:main:main': 'Main thread' } as Record<string, string>,
    loading: false,
    sending: false,
    error: null as string | null,
    showThinking: false,
    streamingMessage: null as unknown,
    streamingTools: [] as Array<Record<string, unknown>>,
    pendingFinal: false,
    pendingSlashAction: null as null | { kind: 'toggle-focus' | 'export'; token: string },
    sendMessage: vi.fn(),
    abortRun: vi.fn(),
    clearError: vi.fn(),
    cleanupEmptySession: vi.fn(),
  },
  gatewayState: {
    status: { state: 'running', port: 18789 },
  },
  agentsState: {
    agents: [{ id: 'main', name: 'Main Agent' }] as Array<Record<string, unknown>>,
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
  hostApiFetchMock: vi.fn(),
}));

vi.mock('@/stores/chat', () => ({
  useChatStore: Object.assign(
    (selector: (state: typeof chatState) => unknown) => selector(chatState),
    {
      getState: () => chatState,
      setState: (patch: Record<string, unknown>) => Object.assign(chatState, patch),
    },
  ),
}));

vi.mock('@/stores/gateway', () => ({
  useGatewayStore: (selector: (state: typeof gatewayState) => unknown) => selector(gatewayState),
}));

vi.mock('@/stores/agents', () => ({
  useAgentsStore: (selector: (state: typeof agentsState) => unknown) => selector(agentsState),
}));

vi.mock('@/stores/settings', () => ({
  useSettingsStore: (selector: (state: typeof settingsState) => unknown) => selector(settingsState),
}));

vi.mock('@/lib/host-api', () => ({
  hostApiFetch: (...args: unknown[]) => hostApiFetchMock(...args),
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
  ChatMessage: React.memo(() => <div data-testid="chat-message-row" />),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

describe('chat slash actions', () => {
  beforeEach(() => {
    chatState.pendingSlashAction = null;
    settingsState.chatFocusMode = false;
    settingsState.setChatFocusMode = vi.fn();
    hostApiFetchMock.mockReset();
    hostApiFetchMock.mockResolvedValue({ success: true, savedPath: '/tmp/Main thread.md' });
  });

  it('exports markdown through the host api for the local /export action', async () => {
    chatState.pendingSlashAction = { kind: 'export', token: 'export-1' };

    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<Chat />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(hostApiFetchMock).toHaveBeenCalledWith(
        '/api/files/save-text',
        expect.objectContaining({
          method: 'POST',
          body: expect.any(String),
        }),
      );
    });
  });

  it('toggles focus mode for the local /focus action', async () => {
    chatState.pendingSlashAction = { kind: 'toggle-focus', token: 'focus-1' };

    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<Chat />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(settingsState.setChatFocusMode).toHaveBeenCalledWith(true);
    });
  });
});
