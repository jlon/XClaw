import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ChatMessage } from '@/pages/Chat/ChatMessage';
import type { RawMessage } from '@/stores/chat';

vi.mock('@/lib/api-client', () => ({
  invokeIpc: vi.fn(),
}));

vi.mock('@/components/agents/AgentAvatar', () => ({
  AgentAvatar: () => <img data-testid="agent-avatar-mock" src="data:image/svg+xml;base64,ZmFrZQ==" alt="agent avatar mock" />,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, vars?: Record<string, unknown>) => {
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
        case 'message.toolCalls':
          return `${String(vars?.count ?? 0)} tool calls`;
        case 'message.generatedFiles':
          return `${String(vars?.count ?? 0)} generated files`;
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
  it('does not render system/runtime messages as normal chat bubbles', () => {
    const systemMessage: RawMessage = {
      role: 'system',
      content: 'Exec approval allow-once submitted for 08d6b8cd.',
      timestamp: 1710000000,
    };

    const { container, queryByText } = render(
      <ChatMessage message={systemMessage} showThinking={false} />,
    );

    expect(queryByText('Exec approval allow-once submitted for 08d6b8cd.')).not.toBeInTheDocument();
    expect(container).toBeEmptyDOMElement();
  });

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
    expect(userBubble).toHaveClass('app-chat-bubble-user-v3');
    expect(userBubble).toHaveClass('rounded-[18px]');
    expect(userBubble).toHaveClass('rounded-tr-[4px]');
    expect(userBubble).toHaveClass('border');
    expect(assistantBubble).toHaveClass('app-chat-bubble-assistant-v3');
    expect(assistantBubble).toHaveClass('px-0');
    expect(assistantBubble).toHaveClass('py-0');
    expect(assistantBubble).toHaveClass('bg-transparent');
    expect(assistantBubble).toHaveClass('border-transparent');
    expect(assistantBubble).not.toHaveClass('rounded-[18px]');
    expect(assistantBubble).not.toHaveClass('rounded-tl-[4px]');
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

    const hoverbars = Array.from(document.querySelectorAll('.app-chat-message-meta'));
    expect(hoverbars).toHaveLength(2);
    hoverbars.forEach((hoverbar) => {
      expect(hoverbar).not.toHaveClass('absolute');
      expect(hoverbar).not.toHaveClass('bottom-full');
    });
  });

  it('renders a subtle assistant name label when the avatar is shown', () => {
    const assistantMessage: RawMessage = {
      role: 'assistant',
      content: 'And me',
      timestamp: 1710000100,
    };

    render(<ChatMessage message={assistantMessage} showThinking={false} assistantAvatar={{ id: 'main', name: 'Main Agent' }} />);

    expect(screen.getByText('Main Agent')).toBeInTheDocument();
  });

  it('does not render the legacy assistant feedback rail anymore', () => {
    const assistantMessage: RawMessage = {
      role: 'assistant',
      content: 'And me',
      timestamp: 1710000100,
    };

    render(<ChatMessage message={assistantMessage} showThinking={false} />);

    expect(screen.queryByRole('button', { name: 'Helpful' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Not helpful' })).not.toBeInTheDocument();
  });

  it('marks chat images as lazy async media so long sessions scroll with less pressure', () => {
    const assistantImageMessage: RawMessage = {
      role: 'assistant',
      content: 'Generated preview',
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

    fireEvent.click(screen.getByRole('button', { name: /1 generated files/i }));
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
    fireEvent.click(screen.getByRole('button', { name: /1 generated files/i }));
    expect(screen.getByText('notes.txt')).toBeInTheDocument();
  });

  it('renders a three-dot streaming indicator for assistant messages instead of a single pulse bar', () => {
    const message: RawMessage = {
      role: 'assistant',
      content: 'Still streaming',
      timestamp: 1710000200,
    };

    render(
      <ChatMessage
        message={message}
        showThinking={false}
        isStreaming
        streamingTools={[
          {
            name: 'models.list',
            status: 'running',
          },
        ]}
      />,
    );

    const indicator = screen.getByTestId('chat-streaming-indicator');
    expect(indicator.children).toHaveLength(3);
    expect(screen.getByTestId('chat-process-timeline')).toBeInTheDocument();
    expect(document.querySelectorAll('.app-chat-process-row')).toHaveLength(1);
    expect(document.querySelectorAll('.app-chat-tool-chip')).toHaveLength(0);
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

    render(<ChatMessage message={message} showThinking assistantAvatar={{ id: 'main', name: 'Main Agent' }} />);

    const thinkingToggle = screen.getByRole('button', { name: /Thinking/i });
    const answer = screen.getByText('Final answer');
    const relation = thinkingToggle.compareDocumentPosition(answer);

    expect((relation & Node.DOCUMENT_POSITION_FOLLOWING) !== 0).toBe(true);
    expect(screen.getByTestId('chat-process-timeline')).toBeInTheDocument();
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
        assistantAvatar={{ id: 'main', name: 'Main Agent' }}
        showAvatar={false}
      />,
    );

    expect(screen.getByTestId('chat-assistant-avatar-placeholder')).toBeInTheDocument();
  });

  it('renders the current agent avatar instead of the legacy letter badge when assistant agent metadata exists', () => {
    const assistantMessage: RawMessage = {
      role: 'assistant',
      content: 'Agent-specific avatar',
      timestamp: 1710000500,
    };

    const { container } = render(
      <ChatMessage
        message={assistantMessage}
        showThinking={false}
        assistantAvatar={{ id: 'main', name: 'Main Agent' }}
      />,
    );

    const image = container.querySelector('img');
    expect(image).toBeInTheDocument();
    expect(image?.getAttribute('src')).toContain('data:image/svg+xml');
  });
});
