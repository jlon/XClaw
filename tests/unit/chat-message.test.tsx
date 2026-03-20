import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ChatMessage } from '@/pages/Chat/ChatMessage';
import type { RawMessage } from '@/stores/chat';

vi.mock('@/lib/api-client', () => ({
  invokeIpc: vi.fn(),
}));

describe('ChatMessage', () => {
  it('renders user messages with the neutral bubble treatment', () => {
    const message: RawMessage = {
      role: 'user',
      content: 'Need a calmer bubble',
      timestamp: 1710000000,
    };

    render(
      <ChatMessage
        message={message}
        showThinking={false}
      />,
    );

    const bubble = screen.getByTestId('chat-user-bubble');
    expect(bubble).not.toHaveClass('bg-[#0a84ff]');
    expect(bubble).toHaveClass('border');
  });
});
