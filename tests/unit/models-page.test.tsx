import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { ProviderAccount } from '@/lib/providers';
import {
  buildProviderUsageSummaries,
  buildUsageKpis,
  getBreakdownDimension,
  resolveSelectedRuntimeProviderKey,
} from '@/pages/Models/workbench-view-model';
import {
  getModelsWorkbenchMode,
  getProviderInspectorShell,
  getProviderBoardColumns,
  getTokenIntelligenceLayout,
} from '@/pages/Models/workbench-layout';
import type { UsageHistoryEntry } from '@/pages/Models/usage-history';

const {
  gatewayState,
  settingsState,
  providerState,
  resizeObserverWidth,
  hostApiFetchMock,
  trackUiEventMock,
  toastErrorMock,
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
  resizeObserverWidth: { value: 1200 },
  hostApiFetchMock: vi.fn(),
  trackUiEventMock: vi.fn(),
  toastErrorMock: vi.fn(),
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

vi.mock('sonner', () => ({
  toast: {
    error: (...args: unknown[]) => toastErrorMock(...args),
    success: vi.fn(),
  },
}));

vi.mock('@/lib/host-events', () => ({
  subscribeHostEvent: vi.fn().mockReturnValue(() => {}),
}));

vi.mock('@/components/common/FeedbackState', () => ({
  FeedbackState: ({ title }: { title: string }) => <div>{title}</div>,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, arg?: string | Record<string, unknown>) => {
      if (typeof arg === 'string') {
        return arg;
      }
      if (arg && typeof arg === 'object' && typeof arg.defaultValue === 'string') {
        return arg.defaultValue;
      }
      return key;
    },
    i18n: { language: 'en' },
  }),
}));

function createAccount(overrides: Partial<ProviderAccount> = {}): ProviderAccount {
  return {
    id: 'custom-a',
    vendorId: 'custom',
    label: 'Custom Prod',
    runtimeKey: 'custom-prod',
    authMode: 'api_key',
    enabled: true,
    isDefault: false,
    createdAt: '2026-03-20T00:00:00.000Z',
    updatedAt: '2026-03-20T00:00:00.000Z',
    ...overrides,
  };
}

function createEntry(overrides: Partial<UsageHistoryEntry> = {}): UsageHistoryEntry {
  return {
    timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
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
    ...overrides,
  };
}

describe('models workbench mode contract', () => {
  it('matches the workbench mode thresholds for default, focused and ultrawide layouts', () => {
    expect(getModelsWorkbenchMode({ contentWidth: 980, hasSelection: false, inspectorPinned: false })).toBe('default');
    expect(getModelsWorkbenchMode({ contentWidth: 980, hasSelection: true, inspectorPinned: false })).toBe('focused');
    expect(getModelsWorkbenchMode({ contentWidth: 1620, hasSelection: true, inspectorPinned: false })).toBe('ultrawide');
  });

  it('caps provider board columns when the inspector is pinned', () => {
    expect(getProviderBoardColumns({ contentWidth: 459, inspectorPinned: false })).toBe(1);
    expect(getProviderBoardColumns({ contentWidth: 460, inspectorPinned: false })).toBe(2);
    expect(getProviderBoardColumns({ contentWidth: 700, inspectorPinned: false })).toBe(3);
    expect(getProviderBoardColumns({ contentWidth: 960, inspectorPinned: false })).toBe(4);
    expect(getProviderBoardColumns({ contentWidth: 1200, inspectorPinned: false })).toBe(5);
    expect(getProviderBoardColumns({ contentWidth: 1600, inspectorPinned: false })).toBe(6);
    expect(getProviderBoardColumns({ contentWidth: 1520, inspectorPinned: true })).toBe(3);
  });

  it('keeps the token intelligence surface stacked until the workbench reaches ultrawide space', () => {
    expect(getTokenIntelligenceLayout({ contentWidth: 980, inspectorPinned: false })).toBe('stack');
    expect(getTokenIntelligenceLayout({ contentWidth: 1620, inspectorPinned: false })).toBe('split');
  });

  it('uses modal below ultrawide and switches to pane only at ultrawide width', () => {
    expect(getProviderInspectorShell({ contentWidth: 620 })).toBe('modal');
    expect(getProviderInspectorShell({ contentWidth: 860 })).toBe('modal');
    expect(getProviderInspectorShell({ contentWidth: 1680 })).toBe('pane');
  });
});

describe('models runtime provider key and breakdown dimension contract', () => {
  it('resolves the selected runtime provider key from the selected account id', () => {
    const accounts = [
      createAccount(),
      createAccount({
        id: 'openai-1',
        vendorId: 'openai',
        label: 'OpenAI',
        runtimeKey: undefined,
        authMode: 'api_key',
      }),
    ];

    expect(resolveSelectedRuntimeProviderKey({ accountId: 'custom-a', accounts })).toBe('custom-prod');
    expect(resolveSelectedRuntimeProviderKey({ accountId: 'missing', accounts })).toBeNull();
  });

  it('summarizes provider usage by runtime key and keeps the selected provider marked', () => {
    const accounts = [
      createAccount(),
      createAccount({
        id: 'openai-1',
        vendorId: 'openai',
        label: 'OpenAI',
        runtimeKey: undefined,
        authMode: 'api_key',
      }),
    ];
    const entries = [
      createEntry({ provider: 'custom-prod', totalTokens: 18, costUsd: 0.42 }),
      createEntry({ provider: 'openai', totalTokens: 12, costUsd: 0.31, model: 'gpt-5.4' }),
    ];

    const summaries = buildProviderUsageSummaries({
      accounts,
      entries,
      selectedRuntimeProviderKey: 'custom-prod',
    });

    expect(summaries).toEqual([
      expect.objectContaining({
        accountIds: ['custom-a'],
        accountLabels: ['Custom Prod'],
        accountCount: 1,
        runtimeProviderKey: 'custom-prod',
        label: 'Custom Prod',
        vendorIds: ['custom'],
        totalTokens: 18,
        totalCostUsd: 0.42,
        requestCount: 1,
        selected: true,
      }),
      expect.objectContaining({
        accountIds: ['openai-1'],
        accountLabels: ['OpenAI'],
        accountCount: 1,
        runtimeProviderKey: 'openai',
        label: 'OpenAI',
        vendorIds: ['openai'],
        totalTokens: 12,
        totalCostUsd: 0.31,
        requestCount: 1,
        selected: false,
      }),
    ]);
  });

  it('deduplicates summaries when multiple accounts share the same runtime provider key', () => {
    const accounts = [
      createAccount({
        id: 'openai-1',
        vendorId: 'openai',
        label: 'OpenAI Primary',
        runtimeKey: undefined,
        authMode: 'api_key',
      }),
      createAccount({
        id: 'openai-2',
        vendorId: 'openai',
        label: 'OpenAI Backup',
        runtimeKey: undefined,
        authMode: 'api_key',
      }),
    ];
    const entries = [
      createEntry({ provider: 'openai', totalTokens: 12, costUsd: 0.31, model: 'gpt-5.4' }),
    ];

    const summaries = buildProviderUsageSummaries({
      accounts,
      entries,
      selectedRuntimeProviderKey: 'openai',
    });

    expect(summaries).toHaveLength(1);
    expect(summaries[0]).toEqual(expect.objectContaining({
      accountIds: ['openai-1', 'openai-2'],
      accountLabels: ['OpenAI Primary', 'OpenAI Backup'],
      accountCount: 2,
      runtimeProviderKey: 'openai',
      vendorIds: ['openai'],
      totalTokens: 12,
      selected: true,
    }));
  });

  it('builds usage KPIs from the selected provider scope', () => {
    const entries = [
      createEntry({ provider: 'custom-prod', totalTokens: 18, costUsd: 0.42, model: 'gpt-5' }),
      createEntry({ provider: 'custom-prod', totalTokens: 7, costUsd: 0.12, model: 'gpt-5.4' }),
      createEntry({ provider: 'openai', totalTokens: 12, costUsd: 0.31, model: 'gpt-4.1' }),
    ];

    const kpis = buildUsageKpis({
      entries,
      selectedRuntimeProviderKey: 'custom-prod',
    });
    const byKey = new Map(kpis.map((kpi) => [kpi.key, kpi.value]));

    expect(byKey.get('tokens')).toBe(25);
    expect(byKey.get('cost')).toBeCloseTo(0.54, 2);
    expect(byKey.get('requests')).toBe(2);
    expect(byKey.get('models')).toBe(2);
  });

  it('falls back to the global scope when nothing is selected', () => {
    const entries = [
      createEntry({ provider: 'custom-prod', totalTokens: 18, costUsd: 0.42, model: 'gpt-5' }),
      createEntry({ provider: 'openai', totalTokens: 12, costUsd: 0.31, model: 'gpt-4.1' }),
    ];

    const kpis = buildUsageKpis({
      entries,
    });
    const byKey = new Map(kpis.map((kpi) => [kpi.key, kpi.value]));

    expect(byKey.get('tokens')).toBe(30);
    expect(byKey.get('requests')).toBe(2);
    expect(byKey.get('models')).toBe(2);
  });

  it('returns the provider breakdown dimension when nothing is selected', () => {
    expect(getBreakdownDimension({ hasSelection: false })).toBe('provider');
    expect(getBreakdownDimension({ hasSelection: true })).toBe('model');
    expect(getBreakdownDimension({ hasSelection: true, preferredFocusedDimension: 'request' })).toBe('request');
  });
});

describe('models page render contract', () => {
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
    providerState.statuses = [
      {
        id: 'custom-a',
        name: 'Custom Prod',
        type: 'custom',
        hasKey: true,
        keyMasked: 'sk-***',
        enabled: true,
        createdAt: '2026-03-20T00:00:00.000Z',
        updatedAt: '2026-03-20T00:00:00.000Z',
      },
      {
        id: 'openai-1',
        name: 'OpenAI',
        type: 'openai',
        hasKey: true,
        keyMasked: 'sk-***',
        enabled: true,
        createdAt: '2026-03-20T00:00:00.000Z',
        updatedAt: '2026-03-20T00:00:00.000Z',
      },
    ];
    providerState.vendors = [
      {
        id: 'custom',
        name: 'Custom',
        icon: '⚙️',
        placeholder: 'API key...',
        requiresApiKey: true,
        showBaseUrl: true,
        showModelId: true,
        category: 'custom',
        supportedAuthModes: ['api_key'],
        defaultAuthMode: 'api_key',
        supportsMultipleAccounts: true,
      },
      {
        id: 'openai',
        name: 'OpenAI',
        icon: '💚',
        placeholder: 'sk-proj-...',
        requiresApiKey: true,
        category: 'official',
        supportedAuthModes: ['api_key', 'oauth_browser'],
        defaultAuthMode: 'api_key',
        supportsMultipleAccounts: false,
      },
    ];
    providerState.defaultAccountId = 'openai-1';
    providerState.loading = false;
    providerState.refreshProviderSnapshot.mockReset();
    providerState.createAccount.mockReset();
    providerState.setDefaultAccount.mockReset();
    providerState.removeAccount.mockReset();
    providerState.updateAccount.mockReset();
    providerState.validateAccountApiKey.mockReset();
    providerState.validateAccountApiKey.mockResolvedValue({ valid: true });
    resizeObserverWidth.value = 1200;
    hostApiFetchMock.mockReset();
    trackUiEventMock.mockReset();
    toastErrorMock.mockReset();
    hostApiFetchMock.mockImplementation(async (path: string) => {
      if (path === '/api/usage/recent-token-history') {
        return [
          {
            timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
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
            timestamp: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
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
        this.callback([{ contentRect: { width: resizeObserverWidth.value, height: 900 } } as ResizeObserverEntry], this as unknown as ResizeObserver);
      }

      disconnect() {}

      unobserve() {}
    }

    vi.stubGlobal('ResizeObserver', ResizeObserverMock);
  });

  it('renders a provider-first shell instead of the old kpi-first dashboard', async () => {
    const { Models } = await import('@/pages/Models');
    render(<Models />);

    await screen.findByTestId('models-provider-card-select-custom-prod');

    expect(screen.getByTestId('models-workbench-header')).toBeInTheDocument();
    expect(screen.getByTestId('models-provider-board')).toHaveAttribute('data-columns', '3');
    expect(screen.getByTestId('models-provider-board')).toHaveAttribute('data-max-visible-rows', '2');
    expect(screen.getByTestId('models-provider-board')).toHaveAttribute('data-overflow-mode', 'clamp');
    expect(screen.queryByTestId('models-provider-board-all')).not.toBeInTheDocument();
    expect(screen.queryByTestId('models-usage-kpis')).not.toBeInTheDocument();
    expect(screen.getByTestId('models-token-summary-strip')).toBeInTheDocument();
    expect(screen.getByTestId('models-token-intelligence-header')).toBeInTheDocument();
    expect(screen.getByTestId('models-usage-window-toggle')).toBeInTheDocument();
    expect(screen.getByTestId('models-token-intelligence')).toHaveAttribute('data-primary-chart-visible', 'true');
    expect(screen.getByText('默认')).toBeInTheDocument();
    expect(screen.getAllByText('已配置').length).toBeGreaterThan(0);
    expect(screen.getByTestId('models-provider-card-custom-prod')).toHaveTextContent(/7d tokens/i);
  });

  it('enters focused mode with a collapsed provider header when a provider card is selected', async () => {
    const { Models } = await import('@/pages/Models');
    render(<Models />);

    await screen.findByTestId('models-provider-card-select-custom-prod');
    fireEvent.click(screen.getByTestId('models-provider-card-select-custom-prod'));

    await waitFor(() => {
      expect(screen.getByTestId('models-page-root')).toHaveAttribute('data-workbench-mode', 'focused');
    });
    expect(screen.getByTestId('models-provider-board')).toHaveAttribute('data-presentation', 'header');
    expect(screen.getByTestId('models-provider-focus-header')).toHaveTextContent('Custom Prod');
    expect(screen.queryByTestId('models-provider-inspector')).not.toBeInTheDocument();
  });

  it('switches the token intelligence metric between tokens and cost', async () => {
    const { Models } = await import('@/pages/Models');
    render(<Models />);

    await screen.findByTestId('models-provider-card-select-custom-prod');
    fireEvent.click(screen.getByRole('button', { name: /Cost/i }));

    await waitFor(() => {
      expect(screen.getByTestId('models-token-summary-strip')).toHaveAttribute('data-metric', 'cost');
      expect(screen.getByTestId('models-trend-chart')).toHaveAttribute('data-metric', 'cost');
    });
  });

  it('renders provider inspector in view mode only after clicking the details icon', async () => {
    const { Models } = await import('@/pages/Models');
    render(<Models />);

    await screen.findByTestId('models-provider-card-select-openai');
    expect(screen.queryByTestId('models-provider-inspector')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('models-provider-card-details-openai'));

    await waitFor(() => {
      expect(screen.getByTestId('models-provider-inspector')).toHaveAttribute('data-mode', 'view');
    });
    expect(screen.getByTestId('models-provider-focus-header')).toBeInTheDocument();
    expect(screen.getByTestId('models-provider-inspector')).toHaveAttribute('data-shell', 'modal');
    expect(screen.getByText('基础信息')).toBeInTheDocument();
    expect(screen.getByText('接入配置')).toBeInTheDocument();
    expect(screen.getByText('回退策略')).toBeInTheDocument();
    expect(screen.getByText('凭证与验证')).toBeInTheDocument();
    expect(screen.getByTestId('models-provider-inspector-footer')).toBeInTheDocument();
    expect(within(screen.getByTestId('models-provider-inspector')).queryByRole('link')).not.toBeInTheDocument();
  });

  it('lets the inspector switch between accounts that share one runtime provider scope', async () => {
    providerState.accounts = [
      {
        id: 'openai-1',
        vendorId: 'openai',
        label: 'OpenAI Primary',
        authMode: 'api_key',
        enabled: true,
        isDefault: true,
        createdAt: '2026-03-20T00:00:00.000Z',
        updatedAt: '2026-03-20T00:00:00.000Z',
      },
      {
        id: 'openai-2',
        vendorId: 'openai',
        label: 'OpenAI Backup',
        authMode: 'api_key',
        enabled: true,
        isDefault: false,
        createdAt: '2026-03-20T00:00:00.000Z',
        updatedAt: '2026-03-21T00:00:00.000Z',
      },
    ];
    providerState.defaultAccountId = 'openai-1';
    hostApiFetchMock.mockImplementation(async (path: string) => {
      if (path === '/api/usage/recent-token-history') {
        return [
          createEntry({ provider: 'openai', totalTokens: 12, costUsd: 0.31, model: 'gpt-5.4' }),
        ] satisfies UsageHistoryEntry[];
      }
      return [];
    });

    const { Models } = await import('@/pages/Models');
    render(<Models />);

    await screen.findByTestId('models-provider-card-details-openai');
    fireEvent.click(screen.getByTestId('models-provider-card-details-openai'));
    await screen.findByTestId('models-provider-inspector');
    expect(screen.getByTestId('models-provider-account-switcher')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('models-provider-account-switch-openai-2'));

    await waitFor(() => {
      expect(screen.getByTestId('models-provider-inspector')).toHaveTextContent('OpenAI Backup');
      expect(screen.getByTestId('models-provider-inspector')).toHaveTextContent('openai-2 · openai');
    });
  });

  it('renders provider inspector in edit mode after clicking edit', async () => {
    const { Models } = await import('@/pages/Models');
    render(<Models />);

    await screen.findByTestId('models-provider-card-details-openai');
    fireEvent.click(screen.getByTestId('models-provider-card-details-openai'));
    await screen.findByTestId('models-provider-inspector');
    fireEvent.click(screen.getByRole('button', { name: /(?:编辑|Edit) OpenAI/i }));

    await waitFor(() => {
      expect(screen.getByTestId('models-provider-inspector')).toHaveAttribute('data-mode', 'edit');
    });
    expect(screen.getByText('基础与接入')).toBeInTheDocument();
    expect(screen.getByText('回退策略')).toBeInTheDocument();
    expect(screen.getByText('凭证与验证')).toBeInTheDocument();
    expect(screen.getByLabelText('API Key')).toBeInTheDocument();
    expect(screen.getByTestId('models-provider-inspector-footer')).toBeInTheDocument();
    expect(within(screen.getByTestId('models-provider-inspector')).getByRole('link')).toHaveAttribute('href', 'https://platform.openai.com/api-keys');
  });

  it('uses modal below ultrawide and pane at ultrawide for the provider inspector', async () => {
    resizeObserverWidth.value = 620;
    const { Models } = await import('@/pages/Models');
    const modalRender = render(<Models />);

    await screen.findByTestId('models-provider-card-details-openai');
    fireEvent.click(screen.getByTestId('models-provider-card-details-openai'));
    await screen.findByTestId('models-provider-inspector');
    fireEvent.click(screen.getByRole('button', { name: /(?:编辑|Edit) OpenAI/i }));

    await waitFor(() => {
      expect(screen.getByTestId('models-provider-inspector')).toHaveAttribute('data-shell', 'modal');
    });

    modalRender.unmount();
    resizeObserverWidth.value = 860;
    const mediumRender = render(<Models />);

    await screen.findByTestId('models-provider-card-details-openai');
    fireEvent.click(screen.getByTestId('models-provider-card-details-openai'));
    await screen.findByTestId('models-provider-inspector');
    fireEvent.click(screen.getByRole('button', { name: /(?:编辑|Edit) OpenAI/i }));

    await waitFor(() => {
      expect(screen.getByTestId('models-provider-inspector')).toHaveAttribute('data-shell', 'modal');
    });

    mediumRender.unmount();
    resizeObserverWidth.value = 1680;
    render(<Models />);

    await screen.findByTestId('models-provider-card-details-openai');
    fireEvent.click(screen.getByTestId('models-provider-card-details-openai'));
    await screen.findByTestId('models-provider-inspector');
    fireEvent.click(screen.getByRole('button', { name: /(?:编辑|Edit) OpenAI/i }));

    await waitFor(() => {
      expect(screen.getByTestId('models-provider-inspector')).toHaveAttribute('data-shell', 'pane');
    });
  }, 15000);

  it('opens the add provider dialog without rendering the legacy provider manager block', async () => {
    const { Models } = await import('@/pages/Models');
    render(<Models />);

    await screen.findByTestId('models-provider-card-select-openai');
    expect(screen.queryByTestId('models-provider-manager')).not.toBeInTheDocument();

    fireEvent.click(screen.getAllByRole('button', { name: /添加提供商/i })[0]);

    await waitFor(() => {
      expect(screen.getByTestId('provider-add-dialog')).toBeInTheDocument();
    });
    expect(within(screen.getByTestId('provider-add-dialog')).queryByRole('link')).not.toBeInTheDocument();
  });

  it('keeps the add provider dialog viewport bounded with a hidden-scrollbar body', async () => {
    const { Models } = await import('@/pages/Models');
    render(<Models />);

    await screen.findByTestId('models-provider-card-select-openai');
    fireEvent.click(screen.getAllByRole('button', { name: /添加提供商/i })[0]);

    const dialog = await screen.findByTestId('provider-add-dialog');
    const card = dialog.querySelector('.app-modal-surface');
    const body = dialog.querySelector('.app-provider-dialog-body');
    const footer = dialog.querySelector('.app-provider-dialog-footer');

    expect(card).not.toBeNull();
    expect(card).toHaveClass('flex', 'max-h-[88vh]', 'flex-col', 'overflow-hidden', 'max-w-[64rem]');
    expect(body).not.toBeNull();
    expect(body).toHaveClass('min-h-0', 'flex-1', 'overflow-y-auto', 'overscroll-contain', 'app-setup-scrollbar-hidden');
    expect(footer).not.toBeNull();
    expect(footer).toHaveClass('shrink-0');
  });

  it('keeps the models scroll area inside a vertical flex shell so the page can scroll', async () => {
    const { Models } = await import('@/pages/Models');
    render(<Models />);

    await screen.findByTestId('models-provider-card-select-openai');

    const scrollArea = document.querySelector('.workspace-page-scroll');
    expect(scrollArea).not.toBeNull();
    expect(scrollArea?.parentElement).toHaveClass('flex', 'flex-col');
  });

  it('renders in browser fallback mode without electron platform bindings', async () => {
    const previousElectron = window.electron;
    // @ts-expect-error test fallback contract
    window.electron = undefined;
    const { Models } = await import('@/pages/Models');
    render(<Models />);

    await screen.findByTestId('models-provider-card-select-openai');
    expect(screen.getByTestId('models-provider-board')).toBeInTheDocument();

    window.electron = previousElectron;
  });

  it('keeps breakdown focused on models after selecting a provider', async () => {
    const { Models } = await import('@/pages/Models');
    render(<Models />);

    await screen.findByTestId('models-provider-card-select-openai');
    fireEvent.click(screen.getByTestId('models-provider-card-select-openai'));

    const breakdownChart = await screen.findByTestId('models-breakdown-chart');
    await waitFor(() => {
      expect(breakdownChart).toHaveAttribute('data-dimension', 'model');
    });
    expect(within(breakdownChart).queryByRole('button', { name: /openai/i })).not.toBeInTheDocument();
  }, 15000);

  it('keeps breakdown and recent requests out of the default overview until a provider is selected', async () => {
    const { Models } = await import('@/pages/Models');
    render(<Models />);

    await screen.findByTestId('models-provider-card-select-openai');
    expect(screen.getByTestId('models-token-intelligence')).toHaveAttribute('data-layout', 'overview');
    expect(screen.queryByTestId('models-breakdown-chart')).not.toBeInTheDocument();
    expect(screen.queryByTestId('models-recent-requests')).not.toBeInTheDocument();
  });

  it('reveals breakdown and recent requests after entering provider focus', async () => {
    const { Models } = await import('@/pages/Models');
    render(<Models />);

    await screen.findByTestId('models-provider-card-select-openai');
    fireEvent.click(screen.getByTestId('models-provider-card-select-openai'));

    await waitFor(() => {
      expect(screen.getByTestId('models-page-root')).toHaveAttribute('data-workbench-mode', 'focused');
      expect(screen.getByTestId('models-breakdown-chart')).toHaveAttribute('data-dimension', 'model');
      expect(screen.getByTestId('models-recent-requests')).toBeInTheDocument();
    });
  });

  it('keeps provider focus stable when a missing provider is requested from the light overview', async () => {
    hostApiFetchMock.mockImplementation(async (path: string) => {
      if (path === '/api/usage/recent-token-history') {
        return [
          createEntry({ provider: 'custom-prod', totalTokens: 18, costUsd: 0.42, model: 'gpt-5' }),
          createEntry({
            provider: 'orphan-provider',
            totalTokens: 11,
            costUsd: 0.2,
            model: 'claude-sonnet',
            sessionId: 'session-2',
            timestamp: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
          }),
        ] satisfies UsageHistoryEntry[];
      }
      return [];
    });

    const { Models } = await import('@/pages/Models');
    render(<Models />);

    await screen.findByTestId('models-provider-card-select-openai');
    const selectProviderForScope = screen.getByText('点击一个提供商卡片，查看归因分布与最近请求。');
    expect(selectProviderForScope).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('models-provider-card-select-custom-prod'));
    await screen.findByTestId('models-breakdown-chart');
    fireEvent.click(within(screen.getByTestId('models-provider-board')).getByText('全部提供商'));

    expect(screen.getByTestId('models-page-root')).toHaveAttribute('data-workbench-mode', 'default');
    expect(screen.queryByTestId('models-provider-inspector')).not.toBeInTheDocument();
  });

  it('keeps the default overview free of provider-driven request actions', async () => {
    const { Models } = await import('@/pages/Models');
    render(<Models />);

    await screen.findByTestId('models-provider-card-select-openai');
    expect(screen.queryByTestId('models-recent-requests')).not.toBeInTheDocument();
  });

  it('switches into ultrawide mode and split token layout on wide containers', async () => {
    resizeObserverWidth.value = 1680;
    const { Models } = await import('@/pages/Models');
    render(<Models />);

    await screen.findByTestId('models-provider-card-select-openai');
    fireEvent.click(screen.getByTestId('models-provider-card-select-openai'));

    await waitFor(() => {
      expect(screen.getByTestId('models-page-root')).toHaveAttribute('data-workbench-mode', 'ultrawide');
      expect(screen.getByTestId('models-provider-board')).toHaveAttribute('data-presentation', 'rail');
      expect(screen.getByTestId('models-provider-rail')).toBeInTheDocument();
      expect(screen.getByTestId('models-token-intelligence')).toHaveAttribute('data-layout', 'split');
    });
  });

  it('lets the default board grow beyond four columns on wide windows while keeping auto-fit card sizing', async () => {
    resizeObserverWidth.value = 1200;
    const { Models } = await import('@/pages/Models');
    render(<Models />);

    await screen.findByTestId('models-provider-card-select-openai');

    expect(screen.getByTestId('models-provider-board')).toHaveAttribute('data-columns', '5');
    expect(screen.getByTestId('models-provider-board-grid')).toHaveStyle({
      gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 14rem), 1fr))',
    });
  });

  it('keeps four provider columns on medium desktop widths instead of collapsing to two oversized cards', async () => {
    resizeObserverWidth.value = 960;
    const { Models } = await import('@/pages/Models');
    render(<Models />);

    await screen.findByTestId('models-provider-card-select-openai');

    expect(screen.getByTestId('models-provider-board')).toHaveAttribute('data-columns', '4');
    expect(screen.getByTestId('models-provider-board-grid')).toHaveStyle({
      gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 14rem), 1fr))',
    });
  });
});
