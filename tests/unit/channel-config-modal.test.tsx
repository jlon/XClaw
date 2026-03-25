import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ChannelConfigModal } from '@/components/channels/ChannelConfigModal';

const hostApiFetchMock = vi.fn();
const subscribeHostEventMock = vi.fn();
const addChannelMock = vi.fn();
const fetchChannelsMock = vi.fn();
const qrCodeToCanvasMock = vi.fn();

vi.mock('@/lib/host-api', () => ({
  hostApiFetch: (...args: unknown[]) => hostApiFetchMock(...args),
}));

vi.mock('@/lib/host-events', () => ({
  subscribeHostEvent: (...args: unknown[]) => subscribeHostEventMock(...args),
}));

vi.mock('@/stores/channels', () => ({
  useChannelsStore: () => ({
    channels: [],
    addChannel: addChannelMock,
    fetchChannels: fetchChannelsMock,
  }),
}));

vi.mock('qrcode', () => ({
  default: {
    toCanvas: (...args: unknown[]) => {
      qrCodeToCanvasMock(...args);
      return Promise.resolve();
    },
  },
}));

vi.mock('@/components/ui/select', () => ({
  Select: ({
    options,
    value,
    onValueChange,
    'aria-label': ariaLabel,
    'data-testid': dataTestId,
  }: {
    options: Array<{ value: string; label: string }>;
    value?: string;
    onValueChange?: (value: string) => void;
    'aria-label'?: string;
    'data-testid'?: string;
  }) => (
    <select
      aria-label={ariaLabel}
      data-testid={dataTestId}
      value={value ?? ''}
      onChange={(event) => onValueChange?.(event.target.value)}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  ),
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

describe('ChannelConfigModal theme compatibility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('uses theme-compatible surfaces instead of fixed warm-only fills', () => {
    const { container } = render(
      <ChannelConfigModal
        initialSelectedType="feishu"
        configuredTypes={[]}
        allowExistingConfig={false}
        onClose={() => {}}
      />,
    );

    expect(container.innerHTML).not.toContain('#f3f1e9');
    expect(container.innerHTML).not.toContain('#eeece3');
    expect(container.innerHTML).toContain('app-modal-overlay');
    expect(container.innerHTML).toContain('app-modal-surface');
    expect(container.innerHTML).toContain('app-pane-surface');
    expect(container.innerHTML).toContain('border-b border-border/45');
    expect(container.innerHTML).toContain('rounded-xl');
    expect(container.innerHTML).toContain('rounded-md');
    expect(screen.queryByRole('button', { name: 'dialog.viewDocs' })).not.toBeInTheDocument();
  });

  it('uses start and poll routes for openclaw-weixin without subscribing to weixin host events', async () => {
    vi.useFakeTimers();
    hostApiFetchMock.mockImplementation(async (path: string) => {
      if (path === '/api/channels/weixin/start') {
        return {
          success: true,
          qrcodeUrl: 'https://ilinkai.weixin.qq.com/qrcode/session-1',
          sessionKey: 'session-1',
        };
      }
      if (path === '/api/channels/weixin/poll') {
        return {
          success: true,
          sessionKey: 'session-1',
          status: 'wait',
          connected: false,
        };
      }
      if (path === '/api/channels/weixin/cancel') {
        return { success: true };
      }
      return { success: true };
    });
    subscribeHostEventMock.mockReturnValue(() => {});

    render(
      <ChannelConfigModal
        initialSelectedType="openclaw-weixin"
        configuredTypes={[]}
        allowExistingConfig={false}
        onClose={() => {}}
      />,
    );

    await Promise.resolve();
    expect(subscribeHostEventMock).not.toHaveBeenCalledWith('channel:weixin-qr', expect.any(Function));
    expect(subscribeHostEventMock).not.toHaveBeenCalledWith('channel:weixin-success', expect.any(Function));
    expect(subscribeHostEventMock).not.toHaveBeenCalledWith('channel:weixin-error', expect.any(Function));

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'dialog.generateQRCode' }));
      await Promise.resolve();
    });

    expect(hostApiFetchMock).toHaveBeenCalledWith('/api/channels/weixin/start', {
      method: 'POST',
      body: JSON.stringify({ config: {} }),
    });
    expect(qrCodeToCanvasMock).toHaveBeenCalledWith(
      expect.anything(),
      'https://ilinkai.weixin.qq.com/qrcode/session-1',
      expect.any(Object),
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1600);
      await Promise.resolve();
    });

    expect(hostApiFetchMock).toHaveBeenCalledWith('/api/channels/weixin/poll', {
      method: 'POST',
      body: JSON.stringify({ sessionKey: 'session-1' }),
    });
  });

  it('finishes the weixin flow after poll confirms the account', async () => {
    vi.useFakeTimers();
    const onChannelSaved = vi.fn();
    hostApiFetchMock.mockImplementation(async (path: string) => {
      if (path === '/api/channels/weixin/start') {
        return {
          success: true,
          qrcodeUrl: 'https://ilinkai.weixin.qq.com/qrcode/session-2',
          sessionKey: 'session-2',
        };
      }
      if (path === '/api/channels/weixin/poll') {
        return {
          success: true,
          sessionKey: 'session-2',
          status: 'confirmed',
          connected: true,
          accountId: 'wx-im-bot',
        };
      }
      if (path === '/api/channels/weixin/cancel') {
        return { success: true };
      }
      return { success: true };
    });
    subscribeHostEventMock.mockReturnValue(() => {});

    render(
      <ChannelConfigModal
        initialSelectedType="openclaw-weixin"
        configuredTypes={[]}
        allowExistingConfig={false}
        onClose={() => {}}
        onChannelSaved={onChannelSaved}
      />,
    );

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'dialog.generateQRCode' }));
      await Promise.resolve();
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1600);
      await Promise.resolve();
    });

    expect(hostApiFetchMock).toHaveBeenCalledWith('/api/channels/weixin/start', {
      method: 'POST',
      body: JSON.stringify({ config: {} }),
    });
    expect(onChannelSaved).toHaveBeenCalledWith('openclaw-weixin', 'wx-im-bot');
  });

  it('allows choosing an agent during weixin onboarding and binds it after login succeeds', async () => {
    vi.useFakeTimers();
    hostApiFetchMock.mockImplementation(async (path: string, init?: RequestInit) => {
      if (path === '/api/channels/weixin/start') {
        return {
          success: true,
          qrcodeUrl: 'https://ilinkai.weixin.qq.com/qrcode/session-3',
          sessionKey: 'session-3',
        };
      }
      if (path === '/api/channels/weixin/poll') {
        return {
          success: true,
          sessionKey: 'session-3',
          status: 'confirmed',
          connected: true,
          accountId: 'wx-im-bot',
        };
      }
      if (path === '/api/channels/binding' && init?.method === 'PUT') {
        return { success: true };
      }
      if (path === '/api/channels/weixin/cancel') {
        return { success: true };
      }
      return { success: true };
    });
    subscribeHostEventMock.mockReturnValue(() => {});

    render(
      <ChannelConfigModal
        initialSelectedType="openclaw-weixin"
        configuredTypes={[]}
        allowExistingConfig={false}
        availableAgents={[
          { id: 'planner', name: 'Planner' },
          { id: 'sales', name: 'Sales' },
        ]}
        onClose={() => {}}
      />,
    );

    expect(screen.getByText('account.bindAgentHint')).toBeInTheDocument();

    await act(async () => {
      fireEvent.change(screen.getByTestId('channel-config-agent-select'), {
        target: { value: 'planner' },
      });
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'dialog.generateQRCode' }));
      await Promise.resolve();
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1600);
      await Promise.resolve();
    });

    expect(hostApiFetchMock).toHaveBeenCalledWith('/api/channels/binding', {
      method: 'PUT',
      body: JSON.stringify({
        channelType: 'openclaw-weixin',
        accountId: 'wx-im-bot',
        agentId: 'planner',
      }),
    });
  });
});
