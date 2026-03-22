import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { Channels } from '@/pages/Channels/index';

const hostApiFetchMock = vi.fn();
const subscribeHostEventMock = vi.fn();
const modalSavePayload = {
  channelType: 'feishu',
  accountId: 'default',
};

const { gatewayState, lastChannelConfigModalProps } = vi.hoisted(() => ({
  gatewayState: {
    status: { state: 'running', port: 18789 },
  },
  lastChannelConfigModalProps: {
    current: null as null | Record<string, unknown>,
  },
}));

vi.mock('@/stores/gateway', () => ({
  useGatewayStore: (selector: (state: typeof gatewayState) => unknown) => selector(gatewayState),
}));

vi.mock('@/lib/host-api', () => ({
  hostApiFetch: (...args: unknown[]) => hostApiFetchMock(...args),
}));

vi.mock('@/lib/host-events', () => ({
  subscribeHostEvent: (...args: unknown[]) => subscribeHostEventMock(...args),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  },
}));

vi.mock('@/components/channels/ChannelConfigModal', () => ({
  ChannelConfigModal: (props: {
    initialSelectedType?: string | null;
    availableAgents?: Array<{ id: string; name: string }>;
    agentId?: string;
    onClose: () => void;
    onChannelSaved?: (channelType: string, accountId?: string) => void | Promise<void>;
  }) => {
    lastChannelConfigModalProps.current = props;
    return (
      <div data-testid="channel-config-modal">
        <button type="button" onClick={() => props.onClose()}>
          mock-modal-close
        </button>
        <button
          type="button"
          onClick={() => props.onChannelSaved?.(modalSavePayload.channelType, modalSavePayload.accountId)}
        >
          mock-modal-save
        </button>
      </div>
    );
  },
}));

async function enterChannelFromBoard(channelType: string, options?: { trigger?: 'card' | 'action' }) {
  await waitFor(() => {
    expect(screen.getByTestId('channel-entry-board')).toBeInTheDocument();
  });

  const card = screen.getByTestId(`channel-entry-card-${channelType}`);

  await act(async () => {
    if (options?.trigger === 'action') {
      fireEvent.click(within(card).getByRole('button'));
      return;
    }

    fireEvent.click(card);
  });

  await waitFor(() => {
    expect(screen.getByTestId('channels-workbench')).toBeInTheDocument();
    expect(screen.getByTestId(`channel-rail-item-${channelType}`)).toHaveAttribute('aria-pressed', 'true');
  });
}

describe('Channels page status refresh', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    gatewayState.status = { state: 'running', port: 18789 };
    lastChannelConfigModalProps.current = null;
    modalSavePayload.channelType = 'feishu';
    modalSavePayload.accountId = 'default';
    let feishuEditorValues = {
      appId: 'cli_xxx',
      appSecret: 'secret',
      dmPolicy: 'open',
      groupPolicy: 'allowlist',
    };
    hostApiFetchMock.mockImplementation(async (path: string) => {
      if (path.startsWith('/api/channels/accounts')) {
        return {
          success: true,
          channels: [
            {
              channelType: 'feishu',
              defaultAccountId: 'default',
              enabled: true,
              status: 'connected',
              accounts: [
                {
                  accountId: 'default',
                  name: 'Primary Account',
                  configured: true,
                  enabled: true,
                  status: 'connected',
                  isDefault: true,
                },
              ],
            },
            {
              channelType: 'telegram',
              defaultAccountId: 'default',
              enabled: true,
              status: 'disconnected',
              accounts: [
                {
                  accountId: 'default',
                  name: 'Telegram Account',
                  configured: true,
                  enabled: true,
                  status: 'disconnected',
                  isDefault: true,
                },
              ],
            },
            {
              channelType: 'wecom',
              defaultAccountId: 'default',
              enabled: true,
              status: 'disconnected',
              accounts: [
                {
                  accountId: 'default',
                  name: 'WeCom Account',
                  configured: true,
                  enabled: true,
                  status: 'disconnected',
                  isDefault: true,
                },
              ],
            },
            {
              channelType: 'dingtalk',
              defaultAccountId: 'default',
              enabled: true,
              status: 'disconnected',
              accounts: [
                {
                  accountId: 'default',
                  name: 'DingTalk Account',
                  configured: true,
                  enabled: true,
                  status: 'disconnected',
                  isDefault: true,
                },
              ],
            },
          ],
        };
      }

      if (path === '/api/agents') {
        return {
          success: true,
          agents: [],
        };
      }

      if (path.startsWith('/api/channels/config-editor/feishu')) {
        return {
          success: true,
          values: feishuEditorValues,
        };
      }

      if (path.startsWith('/api/channels/config-editor/telegram')) {
        return {
          success: true,
          values: {
            botToken: 'telegram-token',
            allowedUsers: '123456',
          },
        };
      }

      if (path.startsWith('/api/channels/config-editor/wecom')) {
        return {
          success: true,
          values: {
            botId: 'aibVSuoUd2im_LWIl',
            secret: 'wecom-secret',
            dmPolicy: 'open',
            groupPolicy: 'allowlist',
          },
        };
      }

      if (path.startsWith('/api/channels/config-editor/dingtalk')) {
        return {
          success: true,
          values: {
            clientId: 'ding-client',
            clientSecret: 'ding-secret',
            robotCode: 'robot-code',
            corpId: 'corp-id',
            agentId: 'agent-id',
            dmPolicy: 'open',
            groupPolicy: 'allowlist',
          },
        };
      }

      if (path === '/api/channels/config') {
        feishuEditorValues = {
          appId: 'normalized-app-id',
          appSecret: 'secret',
          dmPolicy: 'open',
          groupPolicy: 'allowlist',
        };
        return {
          success: true,
        };
      }

      throw new Error(`Unexpected host API path: ${path}`);
    });
  });

  it('refetches channel accounts when gateway channel-status events arrive', async () => {
    let channelStatusHandler: (() => void) | undefined;
    subscribeHostEventMock.mockImplementation((eventName: string, handler: () => void) => {
      if (eventName === 'gateway:channel-status') {
        channelStatusHandler = handler;
      }
      return vi.fn();
    });

    render(<Channels />);

    await waitFor(() => {
      expect(hostApiFetchMock).toHaveBeenCalledWith('/api/channels/accounts');
      expect(hostApiFetchMock).toHaveBeenCalledWith('/api/agents');
    });
    expect(subscribeHostEventMock).toHaveBeenCalledWith('gateway:channel-status', expect.any(Function));

    await act(async () => {
      channelStatusHandler?.();
    });

    await waitFor(() => {
      const channelFetchCalls = hostApiFetchMock.mock.calls.filter(([path]) => path === '/api/channels/accounts');
      const agentFetchCalls = hostApiFetchMock.mock.calls.filter(([path]) => path === '/api/agents');
      expect(channelFetchCalls).toHaveLength(2);
      expect(agentFetchCalls).toHaveLength(2);
    });
  });

  it('keeps the first load lightweight and only probes runtime on manual refresh', async () => {
    render(<Channels />);

    await waitFor(() => {
      expect(hostApiFetchMock).toHaveBeenCalledWith('/api/channels/accounts');
    });

    expect(hostApiFetchMock).not.toHaveBeenCalledWith('/api/channels/accounts?probe=1');

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'refresh' }));
    });

    await waitFor(() => {
      expect(hostApiFetchMock).toHaveBeenCalledWith('/api/channels/accounts?probe=1');
    });
  });

  it('shows WeChat in the primary channel catalog even before it is configured', async () => {
    render(<Channels />);

    await waitFor(() => {
      expect(hostApiFetchMock).toHaveBeenCalledWith('/api/channels/accounts');
    });

    expect(screen.getByText('WeChat')).toBeInTheDocument();
  });

  it('uses QR onboarding instead of inline save when weixin has no configured account yet', async () => {
    hostApiFetchMock.mockImplementation(async (path: string) => {
      if (path.startsWith('/api/channels/accounts')) {
        return {
          success: true,
          channels: [],
        };
      }

      if (path === '/api/agents') {
        return {
          success: true,
          agents: [],
        };
      }

      if (path.startsWith('/api/channels/config-editor/openclaw-weixin')) {
        return {
          success: true,
          values: {},
        };
      }

      throw new Error(`Unexpected host API path: ${path}`);
    });

    render(<Channels />);

    await waitFor(() => {
      expect(hostApiFetchMock).toHaveBeenCalledWith('/api/channels/accounts');
      expect(screen.getByTestId('channel-entry-card-openclaw-weixin')).toBeInTheDocument();
    });

    await enterChannelFromBoard('openclaw-weixin');

    expect(screen.getAllByRole('button', { name: 'account.addByQr' }).length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: 'dialog.saveAndConnect' })).not.toBeInTheDocument();
  });

  it('keeps the weixin account id read-only and exposes QR-specific actions from the workbench', async () => {
    hostApiFetchMock.mockImplementation(async (path: string) => {
      if (path.startsWith('/api/channels/accounts')) {
        return {
          success: true,
          channels: [
            {
              channelType: 'openclaw-weixin',
              defaultAccountId: 'wx-im-bot',
              enabled: true,
              status: 'connected',
              accounts: [
                {
                  accountId: 'wx-im-bot',
                  name: 'WeChat Bot',
                  configured: true,
                  enabled: true,
                  status: 'connected',
                  isDefault: true,
                },
              ],
            },
          ],
        };
      }

      if (path === '/api/agents') {
        return {
          success: true,
          agents: [],
        };
      }

      if (path.startsWith('/api/channels/config-editor/openclaw-weixin')) {
        return {
          success: true,
          values: {
            name: 'WeChat Bot',
            cdnBaseUrl: 'https://cdn.example.com',
            routeTag: 7,
          },
        };
      }

      throw new Error(`Unexpected host API path: ${path}`);
    });

    render(<Channels />);

    await enterChannelFromBoard('openclaw-weixin');

    await waitFor(() => {
      expect(hostApiFetchMock).toHaveBeenCalledWith('/api/channels/config-editor/openclaw-weixin?accountId=wx-im-bot');
    });

    expect(screen.getByDisplayValue('wx-im-bot')).toHaveAttribute('readonly');
    expect(screen.getByRole('button', { name: 'account.addByQr' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'account.relogin' })).toBeInTheDocument();
  });

  it('passes agent choices into the weixin QR modal during onboarding', async () => {
    hostApiFetchMock.mockImplementation(async (path: string) => {
      if (path.startsWith('/api/channels/accounts')) {
        return {
          success: true,
          channels: [],
        };
      }

      if (path === '/api/agents') {
        return {
          success: true,
          agents: [
            { id: 'planner', name: 'Planner' },
            { id: 'sales', name: 'Sales' },
          ],
        };
      }

      throw new Error(`Unexpected host API path: ${path}`);
    });

    render(<Channels />);

    await enterChannelFromBoard('openclaw-weixin');

    await act(async () => {
      fireEvent.click(screen.getAllByRole('button', { name: 'account.addByQr' })[0]);
    });

    expect(lastChannelConfigModalProps.current).toMatchObject({
      initialSelectedType: 'openclaw-weixin',
      availableAgents: [
        { id: 'planner', name: 'Planner' },
        { id: 'sales', name: 'Sales' },
      ],
      agentId: undefined,
    });
  });

  it('passes the current binding into the relogin modal so editing keeps the selected agent', async () => {
    hostApiFetchMock.mockImplementation(async (path: string) => {
      if (path.startsWith('/api/channels/accounts')) {
        return {
          success: true,
          channels: [
            {
              channelType: 'openclaw-weixin',
              defaultAccountId: 'wx-im-bot',
              enabled: true,
              status: 'connected',
              accounts: [
                {
                  accountId: 'wx-im-bot',
                  name: 'WeChat Bot',
                  configured: true,
                  enabled: true,
                  status: 'connected',
                  isDefault: true,
                  agentId: 'planner',
                },
              ],
            },
          ],
        };
      }

      if (path === '/api/agents') {
        return {
          success: true,
          agents: [
            { id: 'planner', name: 'Planner' },
            { id: 'sales', name: 'Sales' },
          ],
        };
      }

      if (path.startsWith('/api/channels/config-editor/openclaw-weixin')) {
        return {
          success: true,
          values: {
            name: 'WeChat Bot',
          },
        };
      }

      throw new Error(`Unexpected host API path: ${path}`);
    });

    render(<Channels />);

    await enterChannelFromBoard('openclaw-weixin');

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'account.relogin' })).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'account.relogin' }));
    });

    expect(lastChannelConfigModalProps.current).toMatchObject({
      initialSelectedType: 'openclaw-weixin',
      availableAgents: [
        { id: 'planner', name: 'Planner' },
        { id: 'sales', name: 'Sales' },
      ],
      agentId: 'planner',
    });
  });

  it('shows the weixin health guard card and persists its toggle', async () => {
    hostApiFetchMock.mockImplementation(async (path: string, init?: RequestInit) => {
      if (path.startsWith('/api/channels/accounts')) {
        return {
          success: true,
          channels: [
            {
              channelType: 'openclaw-weixin',
              defaultAccountId: 'wx-im-bot',
              enabled: true,
              status: 'connected',
              accounts: [
                {
                  accountId: 'wx-im-bot',
                  name: 'WeChat Bot',
                  configured: true,
                  enabled: true,
                  status: 'connected',
                  isDefault: true,
                  lastOutboundAt: Date.now() - 21 * 60 * 60 * 1000,
                },
              ],
            },
          ],
        };
      }

      if (path === '/api/agents') {
        return {
          success: true,
          agents: [],
        };
      }

      if (path.startsWith('/api/channels/config-editor/openclaw-weixin')) {
        return {
          success: true,
          values: {
            name: 'WeChat Bot',
          },
        };
      }

      if (path === '/api/channels/weixin/guardian?accountId=wx-im-bot') {
        return {
          success: true,
          enabled: true,
        };
      }

      if (path === '/api/channels/weixin/guardian' && init?.method === 'PUT') {
        return {
          success: true,
          enabled: false,
        };
      }

      throw new Error(`Unexpected host API path: ${path}`);
    });

    render(<Channels />);

    await enterChannelFromBoard('openclaw-weixin');

    await waitFor(() => {
      expect(hostApiFetchMock).toHaveBeenCalledWith('/api/channels/weixin/guardian?accountId=wx-im-bot');
    });

    expect(screen.getByText('weixin.guardian.title')).toBeInTheDocument();
    expect(screen.getByText('weixin.guardian.warningIdle')).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByTestId('weixin-guardian-switch'));
    });

    await waitFor(() => {
      expect(hostApiFetchMock).toHaveBeenCalledWith('/api/channels/weixin/guardian', expect.objectContaining({
        method: 'PUT',
      }));
    });
  });

  it('refetches when the gateway transitions to running after mount', async () => {
    gatewayState.status = { state: 'starting', port: 18789 };

    const { rerender } = render(<Channels />);

    await waitFor(() => {
      expect(hostApiFetchMock).toHaveBeenCalledWith('/api/channels/accounts');
      expect(hostApiFetchMock).toHaveBeenCalledWith('/api/agents');
    });

    gatewayState.status = { state: 'running', port: 18789 };
    await act(async () => {
      rerender(<Channels />);
    });

    await waitFor(() => {
      const channelFetchCalls = hostApiFetchMock.mock.calls.filter(([path]) => path === '/api/channels/accounts');
      const agentFetchCalls = hostApiFetchMock.mock.calls.filter(([path]) => path === '/api/agents');
      expect(channelFetchCalls.length).toBeGreaterThanOrEqual(2);
      expect(agentFetchCalls.length).toBeGreaterThanOrEqual(2);
    });
  });

  it('shows the entry board by default and does not auto-enter any channel editor', async () => {
    render(<Channels />);

    await waitFor(() => {
      expect(screen.getByTestId('channel-entry-board')).toBeInTheDocument();
    });

    expect(screen.queryByTestId('channels-workbench')).not.toBeInTheDocument();
    expect(screen.queryByDisplayValue('cli_xxx')).not.toBeInTheDocument();
    expect(screen.getByText('configuredSection')).toBeInTheDocument();
    expect(screen.getByText('availableSection')).toBeInTheDocument();
  });

  it('renders entry cards with icon, action, summary, and breathing indicator', async () => {
    render(<Channels />);

    const configuredCard = await screen.findByTestId('channel-entry-card-feishu');
    const availableCard = screen.getByTestId('channel-entry-card-discord');

    expect(within(configuredCard).getByTestId('channel-icon-feishu')).toBeInTheDocument();
    expect(within(configuredCard).getByText('Feishu / Lark')).toBeInTheDocument();
    expect(within(configuredCard).getByRole('button', { name: 'configuredBadge' })).toBeInTheDocument();
    expect(within(configuredCard).getAllByText('account.connectionStatus.connected').length).toBeGreaterThan(0);
    expect(within(configuredCard).getByText('enabledLabel')).toBeInTheDocument();
    expect(within(configuredCard).getByTestId('channel-entry-indicator-feishu')).toBeInTheDocument();

    expect(within(availableCard).getByTestId('channel-icon-discord')).toBeInTheDocument();
    expect(within(availableCard).getByRole('button', { name: 'addChannel' })).toBeInTheDocument();
    expect(within(availableCard).getAllByText('dialog.token').length).toBeGreaterThan(0);
    expect(within(availableCard).getByTestId('channel-entry-indicator-discord')).toBeInTheDocument();
  });

  it('enters a channel when clicking the card action or the card itself', async () => {
    render(<Channels />);

    await enterChannelFromBoard('feishu', { trigger: 'action' });

    await act(async () => {
      fireEvent.click(screen.getByTestId('channel-rail-item-telegram'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('channel-rail-item-telegram')).toHaveAttribute('aria-pressed', 'true');
    });
    expect(screen.getByTestId('channel-account-item-default')).toHaveTextContent('Telegram Account');
  });

  it('filters the rail with the search box', async () => {
    render(<Channels />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('searchPlaceholder')).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.change(screen.getByPlaceholderText('searchPlaceholder'), {
        target: { value: 'tele' },
      });
    });

    expect(screen.queryByTestId('channel-entry-card-feishu')).not.toBeInTheDocument();
    expect(screen.getByTestId('channel-entry-card-telegram')).toBeInTheDocument();

    await act(async () => {
      fireEvent.change(screen.getByPlaceholderText('searchPlaceholder'), {
        target: { value: 'missing-channel' },
      });
    });

    expect(screen.getByText('emptySearch')).toBeInTheDocument();
  });

  it('shows configured summaries for collapsed advanced sections', async () => {
    render(<Channels />);

    await enterChannelFromBoard('feishu');

    await act(async () => {
      fireEvent.click(screen.getByTestId('channel-rail-item-dingtalk'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('channel-rail-item-dingtalk')).toHaveAttribute('aria-pressed', 'true');
    });

    expect(
      screen.getByText((text) =>
        text.includes('Robot Code')
        && text.includes('robot-code')
        && text.includes('Corp ID')
        && text.includes('corp-id')),
    ).toBeInTheDocument();
  });

  it('asks before discarding unsaved editor changes when switching channel', async () => {
    render(<Channels />);

    await enterChannelFromBoard('feishu');

    await waitFor(() => {
      expect(screen.getByDisplayValue('cli_xxx')).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.change(screen.getByDisplayValue('cli_xxx'), {
        target: { value: 'changed-app-id' },
      });
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('channel-rail-item-telegram'));
    });

    expect(screen.getByText('editor.unsavedChangesTitle')).toBeInTheDocument();
    expect(screen.getByText('editor.unsavedChangesMessage')).toBeInTheDocument();
    expect(screen.getByTestId('channel-rail-item-feishu')).toHaveAttribute('aria-pressed', 'true');

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'editor.discardChangesConfirm' }));
    });

    await waitFor(() => {
      expect(screen.getByTestId('channel-rail-item-telegram')).toHaveAttribute('aria-pressed', 'true');
    });
    expect(screen.getByDisplayValue('telegram-token')).toBeInTheDocument();
  });

  it('uses theme-compatible surfaces instead of fixed warm-only fills', async () => {
    render(<Channels />);

    await enterChannelFromBoard('feishu');

    await waitFor(() => {
      expect(screen.getByTestId('channel-rail-item-feishu').className).toContain('bg-[hsl(var(--surface-elevated)/0.98)]');
    });

    expect(screen.getByTestId('channel-rail-item-feishu').className).not.toContain('#f7f2e9');
    expect(screen.getByTestId('channel-rail-item-feishu').className).toContain('bg-[hsl(var(--surface-elevated)/0.98)]');
    expect(screen.getByTestId('channel-rail-item-feishu').className).toContain('rounded-[14px]');
    expect(screen.getByTestId('channel-rail-item-feishu').className).toContain('shadow-[0_12px_26px_rgba(15,23,42,0.06)]');

    expect(screen.getByPlaceholderText('searchPlaceholder').className).not.toContain('#f5f1e8');
    expect(screen.getByPlaceholderText('searchPlaceholder').className).toContain('bg-[hsl(var(--surface-panel)/0.86)]');
  });

  it('uses a staged responsive workbench so default windows prefer two columns before expanding to three', async () => {
    render(<Channels />);

    await waitFor(() => {
      expect(screen.getByTestId('channels-shell')).toBeInTheDocument();
    });

    await enterChannelFromBoard('feishu');

    expect(screen.getByTestId('channels-shell').className).toContain('max-w-[1680px]');
    expect(screen.getByTestId('channels-shell').className).not.toContain('max-w-5xl');
    expect(screen.getByTestId('channels-workbench').className).toContain('xl:grid-cols-[minmax(272px,0.82fr)_minmax(560px,1.34fr)]');
    expect(screen.getByTestId('channels-workbench').className).toContain('min-[1440px]:grid-cols-[minmax(224px,0.74fr)_minmax(336px,1fr)_minmax(520px,1.48fr)]');
    expect(screen.getByTestId('channels-navigation-stack').className).toContain('min-[1440px]:contents');
    expect(within(screen.getByTestId('channel-rail-item-feishu')).queryByText('pluginBadge')).not.toBeInTheDocument();
  });

  it('renders the left rail as compact adaptive cards instead of loose full-width rows', async () => {
    render(<Channels />);

    await enterChannelFromBoard('feishu');

    expect(screen.getByTestId('channel-rail-item-feishu').className).toContain('rounded-[14px]');
    expect(screen.getByTestId('channel-rail-item-feishu').className).toContain('px-2.5');
    expect(screen.getByTestId('channel-rail-item-feishu').className).toContain('py-2');
    expect(screen.getByTestId('channel-rail-meta-feishu').className).toContain('gap-1.5');
    expect(screen.getByTestId('channel-rail-count-feishu')).toHaveTextContent('1');
    expect(screen.getByTestId('channel-rail-indicator-feishu')).toBeInTheDocument();
  });

  it('uses subtle page scrollbars and keeps only save as the primary action', async () => {
    render(<Channels />);

    await enterChannelFromBoard('feishu');

    await waitFor(() => {
      expect(screen.getByTestId('channels-editor-scroll')).toBeInTheDocument();
    });

    expect(screen.getByTestId('channels-scroll-area').className).toContain('workspace-page-scroll');
    expect(screen.getByTestId('channels-editor-scroll').className).toContain('subtle-scrollbar');
    expect(screen.getByRole('button', { name: 'addChannel' }).className).not.toContain('bg-primary');
    expect(screen.getByRole('button', { name: 'account.add' }).className).not.toContain('bg-primary');
    expect(screen.getByRole('button', { name: 'dialog.updateAndReconnect' }).className).toContain('bg-primary');
  });

  it('keeps the behavior section concise instead of repeating extra helper copy', async () => {
    render(<Channels />);

    await enterChannelFromBoard('feishu');

    await waitFor(() => {
      expect(screen.getByText('editor.behaviorTitle')).toBeInTheDocument();
    });

    expect(screen.queryByText('account.bindAgentHint')).not.toBeInTheDocument();
    expect(screen.getAllByText('account.unassigned').length).toBeGreaterThan(0);
  });

  it('uses custom select triggers for agent binding and policy fields instead of native selects', async () => {
    hostApiFetchMock.mockImplementation(async (path: string) => {
      if (path === '/api/channels/accounts') {
        return {
          success: true,
          channels: [
            {
              channelType: 'wecom',
              defaultAccountId: 'default',
              enabled: true,
              status: 'disconnected',
              accounts: [
                {
                  accountId: 'default',
                  name: 'WeCom Account',
                  configured: true,
                  enabled: true,
                  status: 'disconnected',
                  isDefault: true,
                  agentId: 'pangtong',
                },
              ],
            },
          ],
        };
      }

      if (path === '/api/agents') {
        return {
          success: true,
          agents: [
            { id: 'pangtong', name: 'pangtong' },
            { id: 'zhugeliang', name: 'zhugeliang' },
          ],
        };
      }

      if (path.startsWith('/api/channels/config-editor/wecom')) {
        return {
          success: true,
          values: {
            botId: 'aibVSuoUd2im_LWIl',
            secret: 'wecom-secret',
            dmPolicy: 'open',
            groupPolicy: 'allowlist',
          },
        };
      }

      throw new Error(`Unexpected host API path: ${path}`);
    });

    render(<Channels />);

    await enterChannelFromBoard('wecom');

    await waitFor(() => {
      expect(screen.getByTestId('channel-agent-select-trigger')).toBeInTheDocument();
    });

    expect(screen.getByTestId('channel-agent-select-trigger').tagName).toBe('BUTTON');
    expect(screen.getByTestId('channel-field-select-trigger-dmPolicy').tagName).toBe('BUTTON');
    expect(screen.getByTestId('channel-field-select-trigger-groupPolicy').tagName).toBe('BUTTON');
    expect(document.querySelector('select')).not.toBeInTheDocument();
  });

  it('keeps the selected account header actions compact without wrapping into a loose second row', async () => {
    render(<Channels />);

    await enterChannelFromBoard('feishu');

    await waitFor(() => {
      expect(screen.getByTestId('channel-account-header-actions')).toBeInTheDocument();
    });

    expect(screen.getByTestId('channel-account-header-actions').className).toContain('grid-flow-col');
    expect(screen.getByTestId('channel-account-header-actions').className).not.toContain('flex-wrap');
  });

  it('shows human-readable rail connection copy and labels the account + agent controls', async () => {
    render(<Channels />);

    await enterChannelFromBoard('feishu');

    await waitFor(() => {
      expect(screen.getByTestId('channel-rail-item-feishu')).toBeInTheDocument();
      expect(screen.getByLabelText('account.customIdLabel')).toHaveValue('default');
      expect(screen.getByLabelText('account.bindAgentLabel')).toBeInTheDocument();
    });

    expect(screen.getByTestId('channel-rail-item-feishu')).toHaveTextContent('account.connectionStatus.connected');
    expect(screen.getByTestId('channel-rail-item-telegram')).toHaveTextContent('account.connectionStatus.disconnected');
  });

  it('keeps configured rail indicators green when the channel is enabled even if it is currently disconnected', async () => {
    render(<Channels />);

    await enterChannelFromBoard('wecom');

    await waitFor(() => {
      expect(screen.getByTestId('channel-rail-indicator-wecom')).toBeInTheDocument();
    });

    expect(screen.getByTestId('channel-rail-item-wecom')).toHaveTextContent('account.connectionStatus.disconnected');
    expect(screen.getByTestId('channel-rail-indicator-wecom').className).toContain('status-indicator-connected');
  });

  it('keeps the basic config stacked until wide screens so labels do not collapse into narrow columns', async () => {
    render(<Channels />);

    await enterChannelFromBoard('wecom');

    await waitFor(() => {
      expect(screen.getByDisplayValue('aibVSuoUd2im_LWIl')).toBeInTheDocument();
    });

    expect(screen.getByTestId('channel-basic-fields-grid').className).toContain('xl:grid-cols-2');
    expect(screen.getByTestId('channel-basic-fields-grid').className).not.toContain('md:grid-cols-2');
    expect(screen.getByTestId('channel-account-id-card').className).not.toContain('md:grid-cols-');
    expect(screen.getByTestId('channel-field-header-botId').className).not.toContain('md:min-h-[3.5rem]');
  });

  it('retries channel account loading after the runtime becomes available', async () => {
    const scheduledCallbacks: Array<() => void | Promise<void>> = [];
    const originalSetTimeout = globalThis.setTimeout.bind(globalThis);
    const originalClearTimeout = globalThis.clearTimeout.bind(globalThis);
    const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout').mockImplementation(((callback: TimerHandler, delay?: number, ...args: unknown[]) => {
      if (typeof callback === 'function' && delay === 1500) {
        scheduledCallbacks.push(callback as () => void);
        return 1 as ReturnType<typeof setTimeout>;
      }
      return originalSetTimeout(callback, delay, ...(args as []));
    }) as typeof setTimeout);
    const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout').mockImplementation(((timeoutId?: Parameters<typeof clearTimeout>[0]) => {
      originalClearTimeout(timeoutId);
    }) as typeof clearTimeout);
    try {
      const runtimeStates = [
        {
          success: true,
          runtimeAvailable: false,
          gatewayState: 'starting',
          channels: [
            {
              channelType: 'wecom',
              defaultAccountId: 'default',
              enabled: true,
              status: 'disconnected',
              accounts: [
                {
                  accountId: 'default',
                  name: 'WeCom Account',
                  configured: true,
                  enabled: true,
                  status: 'disconnected',
                  isDefault: true,
                },
              ],
            },
          ],
        },
        {
          success: true,
          runtimeAvailable: true,
          gatewayState: 'running',
          channels: [
            {
              channelType: 'wecom',
              defaultAccountId: 'default',
              enabled: true,
              status: 'connected',
              accounts: [
                {
                  accountId: 'default',
                  name: 'WeCom Account',
                  configured: true,
                  enabled: true,
                  status: 'connected',
                  isDefault: true,
                },
              ],
            },
          ],
        },
      ];

      hostApiFetchMock.mockImplementation(async (path: string) => {
        if (path === '/api/channels/accounts') {
          return runtimeStates.shift() ?? runtimeStates[runtimeStates.length - 1];
        }

        if (path === '/api/agents') {
          return {
            success: true,
            agents: [],
          };
        }

        if (path.startsWith('/api/channels/config-editor/wecom')) {
          return {
            success: true,
            values: {
              botId: 'aibVSuoUd2im_LWIl',
              secret: 'wecom-secret',
              dmPolicy: 'open',
              groupPolicy: 'allowlist',
            },
          };
        }

        throw new Error(`Unexpected host API path: ${path}`);
      });

      gatewayState.status = { state: 'running', port: 18789 };

      render(<Channels />);

      await enterChannelFromBoard('wecom');

      await act(async () => {
        await Promise.resolve();
      });

      expect(
        hostApiFetchMock.mock.calls.filter(([path]) => path === '/api/channels/accounts'),
      ).toHaveLength(1);
      expect(scheduledCallbacks).toHaveLength(1);

      await act(async () => {
        await scheduledCallbacks.shift()?.();
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(
        hostApiFetchMock.mock.calls.filter(([path]) => path === '/api/channels/accounts'),
      ).toHaveLength(2);
      expect(screen.getByTestId('channel-rail-item-wecom')).toHaveTextContent('account.connectionStatus.connected');
    } finally {
      setTimeoutSpy.mockRestore();
      clearTimeoutSpy.mockRestore();
    }
  });

  it('shows WeCom access allowlists inline with message access rules', async () => {
    hostApiFetchMock.mockImplementation(async (path: string) => {
      if (path === '/api/channels/accounts') {
        return {
          success: true,
          channels: [
            {
              channelType: 'wecom',
              defaultAccountId: 'default',
              enabled: true,
              status: 'connected',
              accounts: [
                {
                  accountId: 'default',
                  name: 'WeCom Account',
                  configured: true,
                  enabled: true,
                  status: 'connected',
                  isDefault: true,
                },
              ],
            },
          ],
        };
      }

      if (path === '/api/agents') {
        return {
          success: true,
          agents: [],
        };
      }

      if (path.startsWith('/api/channels/config-editor/wecom')) {
        return {
          success: true,
          values: {
            botId: 'aibVSuoUd2im_LWIl',
            secret: 'wecom-secret',
            dmPolicy: 'allowlist',
            allowFrom: ['pangtong'],
            groupPolicy: 'allowlist',
            groupAllowFrom: ['group-alpha'],
            requireMention: true,
          },
        };
      }

      throw new Error(`Unexpected host API path: ${path}`);
    });

    render(<Channels />);

    await enterChannelFromBoard('wecom');

    await waitFor(() => {
      expect(screen.getByDisplayValue('aibVSuoUd2im_LWIl')).toBeInTheDocument();
    }, { timeout: 3000 });

    await waitFor(() => {
      expect(screen.getByText('消息接入规则')).toBeInTheDocument();
      expect(screen.getByText('允许进入的私聊用户')).toBeInTheDocument();
      expect(screen.getByDisplayValue('pangtong')).toBeInTheDocument();
      expect(screen.getByText('允许进入的群聊')).toBeInTheDocument();
      expect(screen.getByDisplayValue('group-alpha')).toBeInTheDocument();
      expect(screen.getByText('仅在被 @ 时回复')).toBeInTheDocument();
    }, { timeout: 3000 });
  });

  it('uses runtime-unavailable copy instead of disconnected when the gateway state is not ready', async () => {
    hostApiFetchMock.mockImplementation(async (path: string) => {
      if (path === '/api/channels/accounts') {
        return {
          success: true,
          runtimeAvailable: false,
          gatewayState: 'stopped',
          channels: [
            {
              channelType: 'wecom',
              defaultAccountId: 'default',
              enabled: true,
              status: 'disconnected',
              accounts: [
                {
                  accountId: 'default',
                  name: 'WeCom Account',
                  configured: true,
                  enabled: true,
                  status: 'disconnected',
                  isDefault: true,
                },
              ],
            },
          ],
        };
      }

      if (path === '/api/agents') {
        return {
          success: true,
          agents: [],
        };
      }

      if (path.startsWith('/api/channels/config-editor/wecom')) {
        return {
          success: true,
          values: {
            botId: 'aibVSuoUd2im_LWIl',
            secret: 'wecom-secret',
            dmPolicy: 'open',
            groupPolicy: 'allowlist',
          },
        };
      }

      throw new Error(`Unexpected host API path: ${path}`);
    });

    gatewayState.status = { state: 'stopped', port: 18789 };

    render(<Channels />);

    await enterChannelFromBoard('wecom');

    await waitFor(() => {
      expect(screen.getByText('gatewayRuntimeUnavailable')).toBeInTheDocument();
      expect(screen.getByTestId('channel-account-item-default')).toBeInTheDocument();
    }, { timeout: 3000 });

    expect(screen.getByTestId('channel-rail-item-wecom')).toHaveTextContent('account.connectionStatus.runtimeUnavailable');
    expect(screen.getByTestId('channel-account-item-default')).not.toHaveTextContent('account.connectionStatus.disconnected');
  });

  it('renames the selected account id and keeps the workbench focused on the renamed account', async () => {
    let activeAccountId = 'default';
    hostApiFetchMock.mockImplementation(async (path: string, init?: RequestInit) => {
      if (path === '/api/channels/accounts') {
        return {
          success: true,
          channels: [
            {
              channelType: 'feishu',
              defaultAccountId: activeAccountId,
              enabled: true,
              status: 'connected',
              accounts: [
                {
                  accountId: activeAccountId,
                  name: 'Primary Account',
                  configured: true,
                  enabled: true,
                  status: 'connected',
                  isDefault: true,
                },
              ],
            },
          ],
        };
      }

      if (path === '/api/agents') {
        return { success: true, agents: [] };
      }

      if (path.startsWith('/api/channels/config-editor/feishu')) {
        return {
          success: true,
          values: {
            appId: activeAccountId === 'sales-bot' ? 'renamed-app' : 'cli_xxx',
            appSecret: 'secret',
            dmPolicy: 'open',
            groupPolicy: 'allowlist',
          },
        };
      }

      if (path === '/api/channels/account-id/rename') {
        const body = JSON.parse(String(init?.body || '{}')) as { nextAccountId?: string };
        activeAccountId = body.nextAccountId || activeAccountId;
        return { success: true, accountId: activeAccountId };
      }

      if (path === '/api/channels/config') {
        return { success: true };
      }

      throw new Error(`Unexpected host API path: ${path}`);
    });

    render(<Channels />);

    await enterChannelFromBoard('feishu');

    await waitFor(() => {
      expect(screen.getByLabelText('account.customIdLabel')).toHaveValue('default');
    });

    await act(async () => {
      fireEvent.change(screen.getByLabelText('account.customIdLabel'), {
        target: { value: 'sales-bot' },
      });
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'dialog.updateAndReconnect' }));
    });

    await waitFor(() => {
      expect(screen.getByTestId('channel-account-item-sales-bot')).toBeInTheDocument();
    });

    expect(screen.queryByTestId('channel-account-item-default')).not.toBeInTheDocument();
    expect(screen.getByLabelText('account.customIdLabel')).toHaveValue('sales-bot');
  });

  it('asks before discarding unsaved editor changes when switching account', async () => {
    hostApiFetchMock.mockImplementation(async (path: string) => {
      if (path === '/api/channels/accounts') {
        return {
          success: true,
          channels: [
            {
              channelType: 'feishu',
              defaultAccountId: 'default',
              enabled: true,
              status: 'connected',
              accounts: [
                {
                  accountId: 'default',
                  name: 'Primary Account',
                  configured: true,
                  enabled: true,
                  status: 'connected',
                  isDefault: true,
                },
                {
                  accountId: 'secondary',
                  name: 'Secondary Account',
                  configured: true,
                  enabled: true,
                  status: 'disconnected',
                  isDefault: false,
                },
              ],
            },
          ],
        };
      }

      if (path === '/api/agents') {
        return {
          success: true,
          agents: [],
        };
      }

      if (path.startsWith('/api/channels/config-editor/feishu')) {
        const isSecondary = path.includes('accountId=secondary');
        return {
          success: true,
          values: {
            appId: isSecondary ? 'secondary-app' : 'primary-app',
            appSecret: 'secret',
            dmPolicy: 'open',
            groupPolicy: 'allowlist',
          },
        };
      }

      throw new Error(`Unexpected host API path: ${path}`);
    });

    render(<Channels />);

    await enterChannelFromBoard('feishu');

    await waitFor(() => {
      expect(screen.getByDisplayValue('primary-app')).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.change(screen.getByDisplayValue('primary-app'), {
        target: { value: 'edited-primary-app' },
      });
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('channel-account-item-secondary'));
    });

    expect(screen.getByText('editor.unsavedChangesTitle')).toBeInTheDocument();
    expect(screen.getByTestId('channel-account-item-default')).toHaveTextContent('Primary Account');

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'editor.discardChangesConfirm' }));
    });

    await waitFor(() => {
      expect(screen.getByDisplayValue('secondary-app')).toBeInTheDocument();
    });
  });

  it('reloads editor values after save so normalized values are shown immediately', async () => {
    render(<Channels />);

    await enterChannelFromBoard('feishu');

    await waitFor(() => {
      expect(screen.getByDisplayValue('cli_xxx')).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.change(screen.getByDisplayValue('cli_xxx'), {
        target: { value: '  next-app-id  ' },
      });
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'dialog.updateAndReconnect' }));
    });

    await waitFor(() => {
      expect(screen.getByDisplayValue('normalized-app-id')).toBeInTheDocument();
    });
  });

  it('selects the newly saved account after the add-account modal closes', async () => {
    let createdSecondaryAccount = false;
    hostApiFetchMock.mockImplementation(async (path: string) => {
      if (path === '/api/channels/accounts') {
        return {
          success: true,
          channels: [
            {
              channelType: 'feishu',
              defaultAccountId: 'default',
              enabled: true,
              status: 'connected',
              accounts: [
                {
                  accountId: 'default',
                  name: 'Primary Account',
                  configured: true,
                  enabled: true,
                  status: 'connected',
                  isDefault: true,
                },
                ...(createdSecondaryAccount
                  ? [{
                    accountId: 'secondary',
                    name: 'Secondary Account',
                    configured: true,
                    enabled: true,
                    status: 'connected',
                    isDefault: false,
                  }]
                  : []),
              ],
            },
          ],
        };
      }

      if (path === '/api/agents') {
        return {
          success: true,
          agents: [],
        };
      }

      if (path.startsWith('/api/channels/config-editor/feishu')) {
        const isSecondary = path.includes('accountId=secondary');
        return {
          success: true,
          values: {
            appId: isSecondary ? 'secondary-app' : 'primary-app',
            appSecret: 'secret',
            dmPolicy: 'open',
            groupPolicy: 'allowlist',
          },
        };
      }

      throw new Error(`Unexpected host API path: ${path}`);
    });

    render(<Channels />);

    await enterChannelFromBoard('feishu');

    await waitFor(() => {
      expect(screen.getByDisplayValue('primary-app')).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'account.add' }));
    });

    expect(screen.getByTestId('channel-config-modal')).toBeInTheDocument();

    modalSavePayload.channelType = 'feishu';
    modalSavePayload.accountId = 'secondary';
    createdSecondaryAccount = true;

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'mock-modal-save' }));
    });

    await waitFor(() => {
      expect(screen.getByTestId('channel-account-item-secondary')).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByDisplayValue('secondary-app')).toBeInTheDocument();
    });
  }, 15_000);
});
