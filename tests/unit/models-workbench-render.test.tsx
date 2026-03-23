import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ProviderAccount } from '@/lib/providers';
import type { UsageHistoryEntry } from '@/pages/Models/usage-history';

const {
  gatewayState,
  settingsState,
  providerState,
  hostApiFetchMock,
  trackUiEventMock,
} = vi.hoisted(() => ({
  gatewayState: {
    status: { state: 'running', pid: 321, connectedAt: '2026-03-23T08:00:00.000Z' },
  },
  settingsState: {
    devModeUnlocked: false,
  },
  providerState: {
    accounts: [] as ProviderAccount[],
    statuses: [] as Array<Record<string, unknown>>,
    vendors: [] as Array<Record<string, unknown>>,
    defaultAccountId: null as string | null,
    loading: false,
    refreshProviderSnapshot: vi.fn(),
    createAccount: vi.fn(),
    setDefaultAccount: vi.fn(),
    removeAccount: vi.fn(),
    updateAccount: vi.fn(),
    validateAccountApiKey: vi.fn(),
  },
  hostApiFetchMock: vi.fn(),
  trackUiEventMock: vi.fn(),
}));

vi.mock('@/stores/gateway', () => ({
  useGatewayStore: (selector: (state: typeof gatewayState) => unknown) => selector(gatewayState),
}));

vi.mock('@/stores/settings', () => ({
  useSettingsStore: (selector: (state: typeof settingsState) => unknown) => selector(settingsState),
}));

vi.mock('@/stores/providers', () => ({
  useProviderStore: (selector: (state: typeof providerState) => unknown) => selector(providerState),
}));

vi.mock('@/lib/host-api', () => ({
  hostApiFetch: (...args: unknown[]) => hostApiFetchMock(...args),
}));

vi.mock('@/lib/telemetry', () => ({
  trackUiEvent: (...args: unknown[]) => trackUiEventMock(...args),
}));

vi.mock('@/components/common/FeedbackState', () => ({
  FeedbackState: ({ title }: { title: string }) => <div>{title}</div>,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, arg?: Record<string, unknown>) => {
      if (arg && typeof arg.defaultValue === 'string') {
        return arg.defaultValue;
      }
      switch (key) {
        case 'dashboard:models.kpis.tokens':
          return '窗口总 Tokens';
        case 'dashboard:models.kpis.cost':
          return '窗口总 Cost';
        case 'dashboard:models.kpis.providers':
          return '活跃提供商';
        case 'dashboard:models.kpis.models':
          return '活跃模型';
        case 'dashboard:models.allProviders':
          return '全部提供商';
        case 'dashboard:models.activeScope':
          return '当前范围';
        case 'dashboard:models.windowTokens':
          return '窗口 Tokens';
        case 'dashboard:models.windowRequests':
          return '请求';
        case 'dashboard:models.defaultProvider':
          return '默认';
        case 'dashboard:models.globalScopeHint':
          return '全局范围';
        case 'dashboard:models.accounts':
          return '账号';
        case 'dashboard:recentTokenHistory.groupByProvider':
          return '按提供商';
        default:
          return key;
      }
    },
    i18n: { language: 'en' },
  }),
}));

describe('models workbench render chain', () => {
  beforeEach(() => {
    window.electron.platform = 'darwin';
    providerState.accounts = [
      {
        id: 'custom-a',
        vendorId: 'custom',
        label: 'Custom Prod',
        runtimeKey: 'custom-prod',
        authMode: 'api_key',
        enabled: true,
        isDefault: false,
        createdAt: '2026-03-20T00:00:00.000Z',
        updatedAt: '2026-03-20T00:00:00.000Z',
      },
      {
        id: 'openai-1',
        vendorId: 'openai',
        label: 'OpenAI',
        authMode: 'api_key',
        enabled: true,
        isDefault: true,
        createdAt: '2026-03-20T00:00:00.000Z',
        updatedAt: '2026-03-20T00:00:00.000Z',
      },
    ];
    providerState.defaultAccountId = 'openai-1';
    providerState.loading = false;
    providerState.refreshProviderSnapshot.mockReset();
    providerState.setDefaultAccount.mockReset();
    providerState.removeAccount.mockReset();
    hostApiFetchMock.mockReset();
    trackUiEventMock.mockReset();
    hostApiFetchMock.mockImplementation(async (path: string) => {
      if (path === '/api/usage/recent-token-history') {
        return [
          {
            timestamp: '2026-03-20T12:00:00.000Z',
            sessionId: 'session-1',
            agentId: 'main',
            model: 'gpt-5',
            provider: 'custom-prod',
            inputTokens: 10,
            outputTokens: 5,
            cacheReadTokens: 2,
            cacheWriteTokens: 1,
            totalTokens: 18,
            costUsd: 0.42,
          },
          {
            timestamp: '2026-03-21T12:00:00.000Z',
            sessionId: 'session-2',
            agentId: 'main',
            model: 'gpt-4.1',
            provider: 'openai',
            inputTokens: 8,
            outputTokens: 3,
            cacheReadTokens: 1,
            cacheWriteTokens: 0,
            totalTokens: 12,
            costUsd: 0.31,
          },
        ] satisfies UsageHistoryEntry[];
      }
      return [];
    });

    class ResizeObserverMock {
      private readonly callback: ResizeObserverCallback;

      constructor(callback: ResizeObserverCallback) {
        this.callback = callback;
      }

      observe() {
        this.callback([{ contentRect: { width: 1200, height: 900 } } as ResizeObserverEntry], this as unknown as ResizeObserver);
      }

      disconnect() {}

      unobserve() {}
    }

    vi.stubGlobal('ResizeObserver', ResizeObserverMock);
  });

  it('consumes workbench contracts in the production models page and follows the provider-first shell', async () => {
    const { Models } = await import('@/pages/Models');
    render(<Models />);

    await screen.findByTestId('models-provider-card-custom-prod');
    expect(providerState.refreshProviderSnapshot).toHaveBeenCalled();

    expect(screen.getByTestId('models-page-root')).toHaveAttribute('data-workbench-mode', 'default');
    expect(screen.getByTestId('models-provider-board')).toHaveAttribute('data-columns', '3');
    expect(screen.getByTestId('models-token-intelligence')).toHaveAttribute('data-layout', 'overview');
    expect(screen.getByTestId('models-token-summary-strip')).toBeInTheDocument();
    expect(screen.getByTestId('models-token-intelligence-header')).toBeInTheDocument();
    expect(screen.getByTestId('models-trend-chart')).toBeInTheDocument();
    expect(screen.queryByTestId('models-breakdown-chart')).not.toBeInTheDocument();
    expect(screen.queryByTestId('models-recent-requests')).not.toBeInTheDocument();
    expect(screen.queryByTestId('models-usage-kpis')).not.toBeInTheDocument();
    expect(screen.queryByTestId('models-provider-board-all')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('models-provider-card-custom-prod'));

    await waitFor(() => {
      expect(screen.getByTestId('models-page-root')).toHaveAttribute('data-workbench-mode', 'focused');
    });
    expect(screen.getByTestId('models-provider-focus-header')).toHaveTextContent('Custom Prod');
    expect(screen.getAllByText('gpt-5').length).toBeGreaterThan(0);
    expect(screen.queryAllByText('gpt-4.1')).toHaveLength(0);

    fireEvent.click(screen.getByRole('button', { name: '编辑 Custom Prod' }));

    await waitFor(() => {
      expect(screen.getByTestId('provider-account-form-sections')).toHaveAttribute('data-density', 'compact');
    });
  });
});
