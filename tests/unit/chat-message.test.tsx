import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ChatMessage } from '@/pages/Chat/ChatMessage';
import type { RawMessage } from '@/stores/chat';

vi.mock('@/lib/api-client', () => ({
  invokeIpc: vi.fn(),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      switch (key) {
        case 'message.thinking':
          return 'Thinking';
        case 'message.showInFolder':
          return 'Show in folder';
        case 'message.openFile':
          return 'Open file';
        case 'message.file':
          return 'File';
        case 'message.image':
          return 'Image';
        case 'common:actions.copy':
          return 'Copy';
        default:
          return key;
      }
    },
  }),
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

  it('shows a lightweight copy action below both user and assistant messages', () => {
    const userMessage: RawMessage = {
      role: 'user',
      content: 'Copy me too',
      timestamp: 1710000000,
    };
    const assistantMessage: RawMessage = {
      role: 'assistant',
      content: 'And me',
      timestamp: 1710000100,
    };

    render(
      <div>
        <ChatMessage message={userMessage} showThinking={false} />
        <ChatMessage message={assistantMessage} showThinking={false} />
      </div>,
    );

    expect(screen.getAllByTitle('Copy')).toHaveLength(2);
  });

  it('marks chat images as lazy async media so long sessions scroll with less pressure', () => {
    const assistantImageMessage: RawMessage = {
      role: 'assistant',
      timestamp: 1710000100,
      _attachedFiles: [
        {
          fileName: 'preview.png',
          mimeType: 'image/png',
          preview: 'data:image/png;base64,ZmFrZQ==',
          filePath: '/tmp/preview.png',
          fileSize: 12,
        },
      ],
    };

    render(
      <ChatMessage message={assistantImageMessage} showThinking={false} />,
    );

    const image = screen.getByAltText('preview.png');
    expect(image).toHaveAttribute('loading', 'lazy');
    expect(image).toHaveAttribute('decoding', 'async');
  });

  it('renders a three-dot streaming indicator for assistant messages instead of a single pulse bar', () => {
    const message: RawMessage = {
      role: 'assistant',
      content: 'Still streaming',
      timestamp: 1710000200,
    };

    render(
      <ChatMessage message={message} showThinking={false} isStreaming />,
    );

    const indicator = screen.getByTestId('chat-streaming-indicator');
    expect(indicator.children).toHaveLength(3);
  });
});
