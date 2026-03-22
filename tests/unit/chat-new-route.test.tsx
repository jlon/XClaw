import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { NewChatRoute } from '@/pages/Chat/NewChatRoute';

const { chatState } = vi.hoisted(() => ({
  chatState: {
    currentAgentId: 'main',
    newSession: vi.fn(),
  },
}));

vi.mock('@/stores/chat', () => ({
  useChatStore: (selector: (state: typeof chatState) => unknown) => selector(chatState),
}));

vi.mock('@/pages/Chat/index', () => ({
  Chat: () => <div data-testid="chat-screen" />,
}));

describe('new chat route', () => {
  beforeEach(() => {
    chatState.currentAgentId = 'main';
    chatState.newSession = vi.fn();
  });

  it('creates a new session for the requested agent and then returns to the chat route', async () => {
    render(
      <MemoryRouter initialEntries={['/new/research']}>
        <Routes>
          <Route path="/" element={<div data-testid="home-screen">Home</div>} />
          <Route path="/new/:agentId" element={<NewChatRoute />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(chatState.newSession).toHaveBeenCalledWith('research');
      expect(screen.getByTestId('home-screen')).toBeInTheDocument();
    });
  });

  it('falls back to the current agent when /new has no explicit agent segment', async () => {
    render(
      <MemoryRouter initialEntries={['/new']}>
        <Routes>
          <Route path="/" element={<div data-testid="home-screen">Home</div>} />
          <Route path="/new" element={<NewChatRoute />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(chatState.newSession).toHaveBeenCalledWith('main');
      expect(screen.getByTestId('home-screen')).toBeInTheDocument();
    });
  });
});
