import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ChatInput } from '@/pages/Chat/ChatInput';

const { agentsState, chatState, gatewayState, gatewayRpcMock, hostApiFetchMock } = vi.hoisted(() => ({
  agentsState: {
    agents: [] as Array<Record<string, unknown>>,
  },
  chatState: {
    currentAgentId: 'main',
    currentSessionKey: 'agent:main:main',
    sessions: [] as Array<Record<string, unknown>>,
    setSessionModel: vi.fn(),
  },
  gatewayState: {
    status: { state: 'running', port: 18789 },
    rpc: vi.fn(),
  },
  gatewayRpcMock: vi.fn(),
  hostApiFetchMock: vi.fn(),
}));

vi.mock('@/stores/agents', () => ({
  useAgentsStore: (selector: (state: typeof agentsState) => unknown) => selector(agentsState),
}));

vi.mock('@/stores/chat', () => ({
  useChatStore: (selector: (state: typeof chatState) => unknown) => selector(chatState),
}));

vi.mock('@/stores/gateway', () => ({
  useGatewayStore: (selector: (state: typeof gatewayState) => unknown) => selector(gatewayState),
}));

vi.mock('@/lib/host-api', () => ({
  hostApiFetch: hostApiFetchMock,
}));

vi.mock('@/lib/api-client', () => ({
  invokeIpc: vi.fn(),
}));

function translate(key: string, vars?: Record<string, unknown>): string | string[] {
  switch (key) {
    case 'composer.attachFiles':
      return 'Attach files';
    case 'composer.pickAgent':
      return 'Choose agent';
    case 'composer.clearTarget':
      return 'Clear target agent';
    case 'composer.targetChip':
      return `@${String(vars?.agent ?? '')}`;
    case 'composer.agentPickerTitle':
      return 'Route the next message to another agent';
    case 'composer.pickModel':
      return 'Choose model';
    case 'composer.modelPickerTitle':
      return 'Switch session model';
    case 'composer.currentModelTooltip':
      return `Current model: ${String(vars?.model ?? '')}`;
    case 'composer.modelPickerLoading':
      return 'Loading models...';
    case 'composer.modelPickerEmpty':
      return 'No models available';
    case 'composer.modelPickerDefault':
      return 'Use OpenClaw default';
    case 'composer.modelPickerDefaultHint':
      return 'Clear this session override';
    case 'composer.modelPickerLoadFailed':
      return 'Failed to load models';
    case 'composer.gatewayDisconnectedPlaceholder':
      return 'Gateway not connected...';
    case 'composer.send':
      return 'Send';
    case 'composer.stop':
      return 'Stop';
    case 'composer.gatewayConnected':
      return 'connected';
    case 'composer.gatewayStatus':
      return `gateway ${String(vars?.state ?? '')} | port: ${String(vars?.port ?? '')} ${String(vars?.pid ?? '')}`.trim();
    case 'composer.retryFailedAttachments':
      return 'Retry failed attachments';
    case 'composer.idlePrompts':
      return [
        '这次又是什么任务呢？',
        '今天先让我处理哪一件？',
        '把要做的事交给我吧',
        '我已经就位，等你发话',
        '这回先从哪一步开始？',
        '有新任务了？直接告诉我',
        '文件、想法、待办，都可以丢过来',
        '今天这张桌面先忙什么？',
        '想好了就说，我开始推进',
        '这次准备让我接哪项活？',
      ];
    default:
      return key;
  }
}

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: translate,
  }),
}));

describe('ChatInput agent targeting', () => {
  beforeEach(() => {
    agentsState.agents = [];
    chatState.currentAgentId = 'main';
    chatState.currentSessionKey = 'agent:main:main';
    chatState.sessions = [];
    chatState.setSessionModel = vi.fn();
    gatewayState.status = { state: 'running', port: 18789 };
    gatewayState.rpc = gatewayRpcMock;
    gatewayRpcMock.mockReset();
    hostApiFetchMock.mockReset();
    hostApiFetchMock.mockResolvedValue([]);
  });

  it('hides the @agent picker when only one agent is configured', () => {
    agentsState.agents = [
      {
        id: 'main',
        name: 'Main',
        isDefault: true,
        modelDisplay: 'MiniMax',
        inheritedModel: true,
        workspace: '~/.openclaw/workspace',
        agentDir: '~/.openclaw/agents/main/agent',
        mainSessionKey: 'agent:main:main',
        channelTypes: [],
      },
    ];

    render(<ChatInput onSend={vi.fn()} />);

    expect(screen.queryByTitle('Choose agent')).not.toBeInTheDocument();
  });

  it('lets the user select an agent target and sends it with the message', () => {
    const onSend = vi.fn();
    agentsState.agents = [
      {
        id: 'main',
        name: 'Main',
        isDefault: true,
        modelDisplay: 'MiniMax',
        inheritedModel: true,
        workspace: '~/.openclaw/workspace',
        agentDir: '~/.openclaw/agents/main/agent',
        mainSessionKey: 'agent:main:main',
        channelTypes: [],
      },
      {
        id: 'research',
        name: 'Research',
        isDefault: false,
        modelDisplay: 'Claude',
        inheritedModel: false,
        workspace: '~/.openclaw/workspace-research',
        agentDir: '~/.openclaw/agents/research/agent',
        mainSessionKey: 'agent:research:desk',
        channelTypes: [],
      },
    ];

    render(<ChatInput onSend={onSend} />);

    fireEvent.click(screen.getByTitle('Choose agent'));
    fireEvent.click(screen.getByText('Research'));

    expect(screen.getByText('@Research')).toBeInTheDocument();

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Hello direct agent' } });
    fireEvent.click(screen.getByTitle('Send'));

    expect(onSend).toHaveBeenCalledWith('Hello direct agent', undefined, 'research');
  });

  it('loads available models and switches the current session model', async () => {
    chatState.sessions = [
      {
        key: 'agent:main:main',
        model: 'moonshot/kimi-k2.5',
      },
    ];
    gatewayRpcMock.mockResolvedValue({
      models: [
        { provider: 'moonshot', id: 'kimi-k2.5', name: 'Kimi K2.5' },
        { provider: 'openai', id: 'gpt-5.2-codex', name: 'OpenAI Codex' },
      ],
    });
    agentsState.agents = [
      {
        id: 'main',
        name: 'Main',
        isDefault: true,
        modelDisplay: 'Kimi K2.5',
        inheritedModel: true,
        workspace: '~/.openclaw/workspace',
        agentDir: '~/.openclaw/agents/main/agent',
        mainSessionKey: 'agent:main:main',
        channelTypes: [],
      },
    ];

    render(<ChatInput onSend={vi.fn()} />);

    expect(screen.getByTestId('chat-model-trigger')).toHaveAttribute('title', 'Current model: Kimi K2.5');

    await act(async () => {
      fireEvent.click(screen.getByTestId('chat-model-trigger'));
    });

    await waitFor(() => {
      expect(gatewayRpcMock).toHaveBeenCalledWith('models.list', {});
    });

    const items = await screen.findAllByRole('button');
    const labels = items.map((item) => item.textContent ?? '');
    const kimiIndex = labels.findIndex((label) => label.includes('Kimi K2.5'));
    const defaultIndex = labels.findIndex((label) => label.includes('Use OpenClaw default'));
    const openAiIndex = labels.findIndex((label) => label.includes('OpenAI Codex'));

    expect(kimiIndex).toBeGreaterThanOrEqual(0);
    expect(defaultIndex).toBeGreaterThanOrEqual(0);
    expect(openAiIndex).toBeGreaterThan(kimiIndex);
    expect(defaultIndex).toBeGreaterThan(kimiIndex);

    await act(async () => {
      fireEvent.click(await screen.findByText('OpenAI Codex'));
    });

    expect(chatState.setSessionModel).toHaveBeenCalledWith('openai/gpt-5.2-codex');
  });

  it('keeps quick actions muted by default and only strengthens them when active', async () => {
    chatState.sessions = [
      {
        key: 'agent:main:main',
        model: 'moonshot/kimi-k2.5',
      },
    ];
    gatewayRpcMock.mockResolvedValue({
      models: [
        { provider: 'moonshot', id: 'kimi-k2.5', name: 'Kimi K2.5' },
      ],
    });
    agentsState.agents = [
      {
        id: 'main',
        name: 'Main',
        isDefault: true,
        modelDisplay: 'Kimi K2.5',
        inheritedModel: true,
        workspace: '~/.openclaw/workspace',
        agentDir: '~/.openclaw/agents/main/agent',
        mainSessionKey: 'agent:main:main',
        channelTypes: [],
      },
      {
        id: 'research',
        name: 'Research',
        isDefault: false,
        modelDisplay: 'Claude',
        inheritedModel: false,
        workspace: '~/.openclaw/workspace-research',
        agentDir: '~/.openclaw/agents/research/agent',
        mainSessionKey: 'agent:research:desk',
        channelTypes: [],
      },
    ];

    render(<ChatInput onSend={vi.fn()} />);

    const agentTrigger = screen.getByTitle('Choose agent');
    const modelTrigger = screen.getByTestId('chat-model-trigger');

    expect(agentTrigger).toHaveClass('app-chat-composer-tool-button');
    expect(agentTrigger).not.toHaveClass('app-chat-composer-tool-button--active');
    expect(modelTrigger).toHaveClass('app-chat-composer-tool-button');
    expect(modelTrigger).not.toHaveClass('app-chat-composer-tool-button--active');

    await act(async () => {
      fireEvent.click(agentTrigger);
    });
    expect(agentTrigger).toHaveClass('app-chat-composer-tool-button--active');

    await act(async () => {
      fireEvent.click(modelTrigger);
    });
    expect(modelTrigger).toHaveClass('app-chat-composer-tool-button--active');
  });

  it('hydrates the textarea from an external quick-action seed without auto-sending', async () => {
    const onSend = vi.fn();

    render(
      <ChatInput
        onSend={onSend}
        draftSeed="Help me handle a concrete task:"
        draftSeedVersion={1}
      />,
    );

    await waitFor(() => {
      expect(screen.getByRole('textbox')).toHaveValue('Help me handle a concrete task:');
    });
    expect(onSend).not.toHaveBeenCalled();
  });

  it('rotates the send icon vertically and rotates the empty-state helper prompt on click', async () => {
    const randomSpy = vi.spyOn(Math, 'random');
    randomSpy.mockReturnValueOnce(0).mockReturnValueOnce(0.36);

    render(<ChatInput onSend={vi.fn()} isEmpty />);

    const textbox = screen.getByRole('textbox');
    expect(textbox).toHaveAttribute('placeholder', '这次又是什么任务呢？');

    fireEvent.click(textbox);

    await waitFor(() => {
      expect(textbox).toHaveAttribute('placeholder', '这回先从哪一步开始？');
    });

    const sendButton = screen.getByTitle('Send');
    const sendIcon = sendButton.querySelector('svg');
    expect(sendIcon).toHaveClass('-rotate-90');

    randomSpy.mockRestore();
  });

  it('keeps the composer text and caret dark on the light composer surface in dark theme', () => {
    render(<ChatInput onSend={vi.fn()} />);

    const textbox = screen.getByRole('textbox');
    const composerShell = textbox.closest('.app-chat-composer-shell');
    const composerDock = textbox.closest('.app-chat-composer-dock');

    expect(composerShell).toBeInTheDocument();
    expect(composerDock).toBeInTheDocument();
    expect(textbox).toHaveClass('dark:text-black');
    expect(textbox).toHaveClass('dark:caret-black');
  });

  it('opens a slash command menu and filters commands as the user types', async () => {
    render(<ChatInput onSend={vi.fn()} />);

    const textbox = screen.getByRole('textbox');
    fireEvent.change(textbox, { target: { value: '/' } });

    expect(await screen.findByText('/new')).toBeInTheDocument();
    expect(screen.getByText('/help')).toBeInTheDocument();
    expect(screen.getByTestId('slash-command-icon-new')).toBeInTheDocument();
    expect(screen.getByText('4 options')).toBeInTheDocument();
    expect(screen.getAllByText('instant').length).toBeGreaterThan(0);

    fireEvent.change(textbox, { target: { value: '/th' } });

    expect(await screen.findByText('/think')).toBeInTheDocument();
    expect(screen.queryByText('/new')).not.toBeInTheDocument();
  });

  it('transitions into slash arg mode and executes the selected fixed option', async () => {
    const onSend = vi.fn();

    render(<ChatInput onSend={onSend} />);

    const textbox = screen.getByRole('textbox');
    fireEvent.change(textbox, { target: { value: '/th' } });
    fireEvent.keyDown(textbox, { key: 'Enter' });

    await waitFor(() => {
      expect(textbox).toHaveValue('/think ');
    });

    expect(screen.getByText('high')).toBeInTheDocument();

    fireEvent.click(screen.getByText('high'));

    expect(onSend).toHaveBeenCalledWith('/think high', undefined, null);
  });

  it('prefers OpenClaw key refs when provided by models.list', async () => {
    gatewayRpcMock.mockResolvedValue({
      models: [
        { key: 'openai/gpt-5.4', name: 'GPT-5.4', provider: 'openai-codex', id: 'gpt-5.4' },
      ],
    });
    agentsState.agents = [
      {
        id: 'main',
        name: 'Main',
        isDefault: true,
        modelDisplay: 'GPT-5.4',
        inheritedModel: true,
        workspace: '~/.openclaw/workspace',
        agentDir: '~/.openclaw/agents/main/agent',
        mainSessionKey: 'agent:main:main',
        channelTypes: [],
      },
    ];

    render(<ChatInput onSend={vi.fn()} />);

    await act(async () => {
      fireEvent.click(screen.getByTestId('chat-model-trigger'));
    });

    await act(async () => {
      fireEvent.click((await screen.findByText('openai/gpt-5.4')).closest('button')!);
    });

    expect(chatState.setSessionModel).toHaveBeenCalledWith('openai/gpt-5.4');
  });

  it('keeps the custom provider model searchable, pinned, and human-readable in the picker', async () => {
    gatewayRpcMock.mockResolvedValue({
      models: [
        { id: '998/gpt-4.1' },
        { id: '998/gpt-5.4' },
      ],
    });
    hostApiFetchMock.mockImplementation(async (path: string) => {
      if (path === '/api/provider-accounts') {
        return [
          {
            id: 'custom-custom01',
            vendorId: 'custom',
            label: '998',
            runtimeKey: '998',
            authMode: 'api_key',
            baseUrl: 'https://9985678.xyz/v1',
            apiProtocol: 'openai-completions',
            model: 'gpt-5.4',
            enabled: true,
            isDefault: false,
            createdAt: '2026-03-21T04:34:34.053Z',
            updatedAt: '2026-03-21T04:34:34.053Z',
          },
        ];
      }
      return [];
    });
    agentsState.agents = [
      {
        id: 'main',
        name: 'Main',
        isDefault: true,
        modelDisplay: 'GPT-5.4',
        inheritedModel: true,
        workspace: '~/.openclaw/workspace',
        agentDir: '~/.openclaw/agents/main/agent',
        mainSessionKey: 'agent:main:main',
        channelTypes: [],
      },
    ];

    render(<ChatInput onSend={vi.fn()} />);

    await act(async () => {
      fireEvent.click(screen.getByTestId('chat-model-trigger'));
    });

    const search = await screen.findByRole('textbox', { name: 'composer.modelPickerSearchLabel' });
    await waitFor(() => {
      expect(screen.getByText('gpt-5.4')).toBeInTheDocument();
      expect(screen.getByText('998 · gpt-5.4')).toBeInTheDocument();
    });

    const beforeSearchItems = screen
      .getAllByRole('button')
      .map((button) => button.textContent?.replace(/\s+/g, ' ').trim() ?? '')
      .filter((text) => text.includes('gpt-'));

    expect(beforeSearchItems[0]).toContain('gpt-5.4');
    expect(beforeSearchItems[0]).toContain('998 · gpt-5.4');
    expect(beforeSearchItems[0]).not.toContain('998 · 998/gpt-5.4');
    expect(beforeSearchItems[0]).not.toContain('custom-custom01');
    expect(beforeSearchItems[1]).toContain('gpt-4.1');
    expect(beforeSearchItems[1]).toContain('998 · gpt-4.1');
    expect(beforeSearchItems[1]).not.toContain('custom-custom01');

    fireEvent.change(search, { target: { value: '998' } });

    const afterSearchItems = screen
      .getAllByRole('button')
      .map((button) => button.textContent?.replace(/\s+/g, ' ').trim() ?? '')
      .filter((text) => text.includes('gpt-'));

    expect(afterSearchItems[0]).toContain('gpt-5.4');
    expect(afterSearchItems[0]).toContain('998 · gpt-5.4');
    expect(afterSearchItems[0]).not.toContain('998 · 998/gpt-5.4');
    expect(afterSearchItems[0]).not.toContain('custom-custom01');
    expect(afterSearchItems[1]).toContain('gpt-4.1');
    expect(afterSearchItems[1]).toContain('998 · gpt-4.1');
    expect(afterSearchItems[1]).not.toContain('custom-custom01');
    expect(screen.queryByText('998 · 998/gpt-5.4')).not.toBeInTheDocument();
    expect(screen.queryByText(/custom-custom01/i)).not.toBeInTheDocument();
    expect(screen.queryByText('No matching models')).not.toBeInTheDocument();
  });
});
