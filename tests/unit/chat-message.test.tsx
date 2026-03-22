import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
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
        case 'message.feedbackHelpful':
          return 'Helpful';
        case 'message.feedbackNotHelpful':
          return 'Not helpful';
        case 'message.feedbackPanelTitle':
          return 'Thanks for the feedback';
        case 'message.feedbackPlaceholder':
          return 'Tell us what was not helpful';
        case 'message.feedbackSubmit':
          return 'Submit';
        case 'common:actions.close':
          return 'Close';
        case 'common:actions.copy':
          return 'Copy';
        default:
          return key;
      }
    },
  }),
}));

describe('ChatMessage', () => {
  it('renders user and assistant replies on dedicated desktop-im primary shells', () => {
    const userMessage: RawMessage = {
      role: 'user',
      content: 'Need a calmer bubble',
      timestamp: 1710000000,
    };
    const assistantMessage: RawMessage = {
      role: 'assistant',
      content: 'Keep the assistant as document flow',
      timestamp: 1710000100,
    };

    render(
      <div>
        <ChatMessage message={userMessage} showThinking={false} />
        <ChatMessage message={assistantMessage} showThinking={false} />
      </div>,
    );

    const userBubble = screen.getByTestId('chat-user-bubble');
    const assistantBubble = screen.getByTestId('chat-assistant-bubble');
    const userPrimary = userBubble.closest('.app-chat-message-primary');
    const assistantPrimary = assistantBubble.closest('.app-chat-message-primary');

    expect(userPrimary).toBeInTheDocument();
    expect(assistantPrimary).toBeInTheDocument();
    expect(userBubble).toHaveClass('rounded-[12px]');
    expect(userBubble).toHaveClass('rounded-br-[4px]');
    expect(userBubble).toHaveClass('border');
    expect(assistantBubble).toHaveClass('rounded-[12px]');
    expect(assistantBubble).toHaveClass('rounded-bl-[4px]');
    expect(assistantBubble).not.toHaveClass('rounded-tl-[6px]');
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

  it('renders a visible assistant feedback rail with desktop-im thumbs affordances', () => {
    const assistantMessage: RawMessage = {
      role: 'assistant',
      content: 'And me',
      timestamp: 1710000100,
    };

    render(<ChatMessage message={assistantMessage} showThinking={false} />);

    expect(screen.getByRole('button', { name: 'Helpful' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Not helpful' })).toBeInTheDocument();
  });

  it('opens a dislike feedback panel with a close action and optional input', () => {
    const assistantMessage: RawMessage = {
      role: 'assistant',
      content: 'And me',
      timestamp: 1710000100,
    };

    render(<ChatMessage message={assistantMessage} showThinking={false} />);

    fireEvent.click(screen.getByRole('button', { name: 'Not helpful' }));

    expect(screen.getByText('Thanks for the feedback')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Tell us what was not helpful')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Submit' })).toBeDisabled();
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

  it('keeps code blocks and non-image file attachments on their existing content branches', () => {
    const assistantMessage: RawMessage = {
      role: 'assistant',
      content: '```ts\nconst answer = 42;\n```',
      timestamp: 1710000150,
      _attachedFiles: [
        {
          fileName: 'notes.txt',
          mimeType: 'text/plain',
          filePath: '/tmp/notes.txt',
          fileSize: 12,
        },
      ],
    };

    render(<ChatMessage message={assistantMessage} showThinking={false} />);

    expect(screen.getByText('const answer = 42;')).toBeInTheDocument();
    expect(screen.getByText('notes.txt')).toBeInTheDocument();
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

  it('renders assistant process rails before the final answer body', () => {
    const message: RawMessage = {
      role: 'assistant',
      content: [
        { type: 'thinking', thinking: 'First think through the approach' },
        { type: 'text', text: 'Final answer' },
      ],
      timestamp: 1710000300,
    };

    render(<ChatMessage message={message} showThinking assistantAvatar={{ label: 'A', style: 'from-primary to-primary' }} />);

    const thinkingToggle = screen.getByRole('button', { name: /Thinking/i });
    const answer = screen.getByText('Final answer');
    const relation = thinkingToggle.compareDocumentPosition(answer);

    expect((relation & Node.DOCUMENT_POSITION_FOLLOWING) !== 0).toBe(true);
  });

  it('uses an invisible spacer instead of repeating the assistant avatar when chrome is suppressed', () => {
    const assistantMessage: RawMessage = {
      role: 'assistant',
      content: 'Grouped follow-up',
      timestamp: 1710000400,
    };

    render(
      <ChatMessage
        message={assistantMessage}
        showThinking={false}
        assistantAvatar={{ label: 'A', style: 'from-primary to-primary' }}
        showAvatar={false}
      />,
    );

    expect(screen.getByTestId('chat-assistant-avatar-placeholder')).toBeInTheDocument();
  });
});
