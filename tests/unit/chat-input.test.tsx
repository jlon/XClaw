import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ChatInput } from '@/pages/Chat/ChatInput';

const { agentsState, chatState, gatewayState, gatewayRpcMock } = vi.hoisted(() => ({
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
  hostApiFetch: vi.fn(),
}));

vi.mock('@/lib/api-client', () => ({
  invokeIpc: vi.fn(),
}));

function translate(key: string, vars?: Record<string, unknown>): string {
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

    expect(screen.getByTestId('chat-model-trigger')).toHaveClass('rounded-2xl');

    await act(async () => {
      fireEvent.click(screen.getByTitle('Choose model'));
    });

    await waitFor(() => {
      expect(gatewayRpcMock).toHaveBeenCalledWith('models.list', {});
    });

    await act(async () => {
      fireEvent.click(await screen.findByText('OpenAI Codex'));
    });

    expect(chatState.setSessionModel).toHaveBeenCalledWith('openai/gpt-5.2-codex');
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
      fireEvent.click(screen.getByTitle('Choose model'));
    });

    await act(async () => {
      fireEvent.click((await screen.findByText('openai/gpt-5.4')).closest('button')!);
    });

    expect(chatState.setSessionModel).toHaveBeenCalledWith('openai/gpt-5.4');
  });
});
