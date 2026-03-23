import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useGatewayStore } from '@/stores/gateway';
import { useProviderStore } from '@/stores/providers';
import { useSettingsStore } from '@/stores/settings';
import { hostApiFetch } from '@/lib/host-api';
import { trackUiEvent } from '@/lib/telemetry';
import { cn } from '@/lib/utils';
import { buildProviderListItems, findProviderAccountsByRuntimeKey } from '@/lib/provider-accounts';
import { WorkspacePageFrame, WorkspacePageScrollArea, WorkspacePageShell } from '@/components/layout/WorkspacePage';
import { FeedbackState } from '@/components/common/FeedbackState';
import { AddProviderDialog } from '@/components/settings/providers/AddProviderDialog';
import type { ProviderType } from '@/lib/providers';
import {
  createProviderAccountFromDialog,
  type AddProviderDialogOptions,
} from '@/components/settings/providers/provider-account-create';
import { ModelsWorkbenchHeader } from './components/ModelsWorkbenchHeader';
import { ProviderBoard } from './components/ProviderBoard';
import { ProviderInspector } from './components/ProviderInspector';
import { UsageBreakdownChart } from './components/UsageBreakdownChart';
import { UsageKpiStrip } from './components/UsageKpiStrip';
import { UsageMetricToggle } from './components/UsageMetricToggle';
import { UsageRecentRequests } from './components/UsageRecentRequests';
import { UsageTrendChart } from './components/UsageTrendChart';
import {
  filterUsageHistoryByWindow,
  groupUsageHistory,
  groupUsageHistoryByWindow,
  type UsageHistoryEntry,
  type UsageWindow,
} from './usage-history';
import {
  getModelsWorkbenchMode,
  getProviderBoardPresentation,
  getProviderInspectorShell,
  getProviderBoardColumns,
  getTokenIntelligenceLayout,
} from './workbench-layout';
import {
  buildProviderUsageSummaries,
  buildUsageKpis,
  getBreakdownDimension,
  resolveSelectedRuntimeProviderKey,
  type UsageMetric,
} from './workbench-view-model';

const DEFAULT_USAGE_FETCH_MAX_ATTEMPTS = 6;
const WINDOWS_USAGE_FETCH_MAX_ATTEMPTS = 10;
const USAGE_FETCH_RETRY_DELAY_MS = 1500;
const toggleGroupClass = 'app-field-surface flex rounded-[9px] p-0.5';
const toggleActiveClass = 'rounded-[8px] bg-[hsl(var(--accent)/0.14)] text-foreground';
const toggleIdleClass = 'rounded-[8px] text-muted-foreground hover:bg-[hsl(var(--surface-hover)/0.84)] hover:text-foreground';
const emptyStateClass = 'app-empty-surface flex items-center justify-center rounded-[20px] py-12 text-muted-foreground';
const usageSurfaceClass = 'app-pane-surface rounded-[18px] border border-[hsl(var(--border-subtle)/0.82)] px-4 py-3.5';
const usageChipClass = 'rounded-md bg-[hsl(var(--surface-hover)/0.76)] px-1.5 py-0.5 text-foreground/76';

function normalizeUsageProviderKey(provider: string | null | undefined): string {
  return provider?.trim().toLowerCase() || 'unknown';
}

export function Models() {
  const { t, i18n } = useTranslation(['dashboard', 'settings']);
  const gatewayStatus = useGatewayStore((state) => state.status);
  const providerAccounts = useProviderStore((state) => state.accounts);
  const providerStatuses = useProviderStore((state) => state.statuses);
  const providerVendors = useProviderStore((state) => state.vendors);
  const defaultProviderAccountId = useProviderStore((state) => state.defaultAccountId);
  const providerLoading = useProviderStore((state) => state.loading);
  const refreshProviderSnapshot = useProviderStore((state) => state.refreshProviderSnapshot);
  const createAccount = useProviderStore((state) => state.createAccount);
  const setDefaultAccount = useProviderStore((state) => state.setDefaultAccount);
  const removeAccount = useProviderStore((state) => state.removeAccount);
  const updateAccount = useProviderStore((state) => state.updateAccount);
  const validateAccountApiKey = useProviderStore((state) => state.validateAccountApiKey);
  const devModeUnlocked = useSettingsStore((state) => state.devModeUnlocked);
  const isGatewayRunning = gatewayStatus.state === 'running';
  const platform = typeof window === 'undefined' ? undefined : window.electron?.platform;
  const usageFetchMaxAttempts = platform === 'win32'
    ? WINDOWS_USAGE_FETCH_MAX_ATTEMPTS
    : DEFAULT_USAGE_FETCH_MAX_ATTEMPTS;

  const [usageHistory, setUsageHistory] = useState<UsageHistoryEntry[]>([]);
  const [usageMetric, setUsageMetric] = useState<UsageMetric>('tokens');
  const [usageWindow, setUsageWindow] = useState<UsageWindow>('7d');
  const [usagePage, setUsagePage] = useState(1);
  const [selectedUsageEntry, setSelectedUsageEntry] = useState<UsageHistoryEntry | null>(null);
  const [selectedProviderAccountId, setSelectedProviderAccountId] = useState<string | null>(null);
  const [editingProviderAccountId, setEditingProviderAccountId] = useState<string | null>(null);
  const [showAddProviderDialog, setShowAddProviderDialog] = useState(false);
  const [usageFetchDoneKey, setUsageFetchDoneKey] = useState<string | null>(null);
  const [contentWidth, setContentWidth] = useState(0);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const usageFetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const usageFetchGenerationRef = useRef(0);

  // Stable key derived from the effect's dependencies — changes whenever a new
  // fetch cycle should start.  Comparing this to `usageFetchDoneKey` lets us
  // derive the loading state without calling setState in the effect body or
  // reading refs during render.
  const usageFetchKey = isGatewayRunning
    ? `${gatewayStatus.pid ?? 'na'}:${gatewayStatus.connectedAt ?? 'na'}:${usageFetchMaxAttempts}`
    : null;

  useEffect(() => {
    trackUiEvent('models.page_viewed');
  }, []);

  useEffect(() => {
    void refreshProviderSnapshot();
  }, [refreshProviderSnapshot]);

  useEffect(() => {
    const node = contentRef.current;
    if (!node || typeof ResizeObserver === 'undefined') {
      return;
    }

    setContentWidth(node.getBoundingClientRect().width);
    const observer = new ResizeObserver((entries) => {
      setContentWidth(entries[0]?.contentRect.width ?? node.getBoundingClientRect().width);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (usageFetchTimerRef.current) {
      clearTimeout(usageFetchTimerRef.current);
      usageFetchTimerRef.current = null;
    }

    if (!isGatewayRunning) {
      return;
    }

    const fetchKey = `${gatewayStatus.pid ?? 'na'}:${gatewayStatus.connectedAt ?? 'na'}:${usageFetchMaxAttempts}`;
    const generation = usageFetchGenerationRef.current + 1;
    usageFetchGenerationRef.current = generation;
    const restartMarker = `${gatewayStatus.pid ?? 'na'}:${gatewayStatus.connectedAt ?? 'na'}`;
    trackUiEvent('models.token_usage_fetch_started', {
      generation,
      restartMarker,
    });

    const fetchUsageHistoryWithRetry = async (attempt: number) => {
      trackUiEvent('models.token_usage_fetch_attempt', {
        generation,
        attempt,
        restartMarker,
      });
      try {
        const entries = await hostApiFetch<UsageHistoryEntry[]>('/api/usage/recent-token-history');
        if (usageFetchGenerationRef.current !== generation) return;

        const normalized = Array.isArray(entries) ? entries : [];
        setUsageHistory(normalized);
        setUsagePage(1);
        trackUiEvent('models.token_usage_fetch_succeeded', {
          generation,
          attempt,
          records: normalized.length,
          restartMarker,
        });

        if (normalized.length === 0 && attempt < usageFetchMaxAttempts) {
          trackUiEvent('models.token_usage_fetch_retry_scheduled', {
            generation,
            attempt,
            reason: 'empty',
            restartMarker,
          });
          usageFetchTimerRef.current = setTimeout(() => {
            void fetchUsageHistoryWithRetry(attempt + 1);
          }, USAGE_FETCH_RETRY_DELAY_MS);
        } else {
          if (normalized.length === 0) {
            trackUiEvent('models.token_usage_fetch_exhausted', {
              generation,
              attempt,
              reason: 'empty',
              restartMarker,
            });
          }
          setUsageFetchDoneKey(fetchKey);
        }
      } catch (error) {
        if (usageFetchGenerationRef.current !== generation) return;
        trackUiEvent('models.token_usage_fetch_failed_attempt', {
          generation,
          attempt,
          restartMarker,
          message: error instanceof Error ? error.message : String(error),
        });
        if (attempt < usageFetchMaxAttempts) {
          trackUiEvent('models.token_usage_fetch_retry_scheduled', {
            generation,
            attempt,
            reason: 'error',
            restartMarker,
          });
          usageFetchTimerRef.current = setTimeout(() => {
            void fetchUsageHistoryWithRetry(attempt + 1);
          }, USAGE_FETCH_RETRY_DELAY_MS);
          return;
        }
        setUsageHistory([]);
        setUsageFetchDoneKey(fetchKey);
        trackUiEvent('models.token_usage_fetch_exhausted', {
          generation,
          attempt,
          reason: 'error',
          restartMarker,
        });
      }
    };

    void fetchUsageHistoryWithRetry(1);

    return () => {
      if (usageFetchTimerRef.current) {
        clearTimeout(usageFetchTimerRef.current);
        usageFetchTimerRef.current = null;
      }
    };
  }, [isGatewayRunning, gatewayStatus.connectedAt, gatewayStatus.pid, usageFetchMaxAttempts]);

  const selectedRuntimeProviderKey = useMemo(() => resolveSelectedRuntimeProviderKey({
    accountId: selectedProviderAccountId,
    accounts: providerAccounts,
  }), [providerAccounts, selectedProviderAccountId]);
  const providerItems = useMemo(
    () => buildProviderListItems(providerAccounts, providerStatuses, providerVendors, defaultProviderAccountId),
    [defaultProviderAccountId, providerAccounts, providerStatuses, providerVendors],
  );
  const selectedInspectorAccountIds = useMemo(
    () => findProviderAccountsByRuntimeKey(providerAccounts, selectedRuntimeProviderKey).map((account) => account.id),
    [providerAccounts, selectedRuntimeProviderKey],
  );
  const selectedProviderItem = useMemo(() => {
    if (editingProviderAccountId) {
      return providerItems.find((item) => item.account.id === editingProviderAccountId) ?? null;
    }

    if (selectedInspectorAccountIds.length === 0) {
      return null;
    }

    return (
      (selectedProviderAccountId
        ? providerItems.find((item) => item.account.id === selectedProviderAccountId && selectedInspectorAccountIds.includes(item.account.id))
        : undefined)
      || (
      (defaultProviderAccountId
        ? providerItems.find((item) => item.account.id === defaultProviderAccountId && selectedInspectorAccountIds.includes(item.account.id))
        : undefined)
      )
      || providerItems.find((item) => selectedInspectorAccountIds.includes(item.account.id))
      || null
    );
  }, [defaultProviderAccountId, editingProviderAccountId, providerItems, selectedInspectorAccountIds, selectedProviderAccountId]);
  const selectedInspectorItems = useMemo(
    () => providerItems.filter((item) => selectedInspectorAccountIds.includes(item.account.id)),
    [providerItems, selectedInspectorAccountIds],
  );
  const inspectorShell = selectedProviderItem
    ? getProviderInspectorShell({ contentWidth })
    : null;
  const inspectorPinned = inspectorShell === 'pane';
  const workbenchMode = getModelsWorkbenchMode({
    contentWidth,
    hasSelection: Boolean(selectedProviderAccountId),
    inspectorPinned,
  });
  const providerBoardPresentation = getProviderBoardPresentation({
    contentWidth,
    hasSelection: Boolean(selectedProviderAccountId),
    inspectorPinned,
  });
  const providerBoardColumns = getProviderBoardColumns({
    contentWidth,
    inspectorPinned,
  });
  const tokenIntelligenceLayout = getTokenIntelligenceLayout({
    contentWidth,
    inspectorPinned,
  });
  const breakdownDimension = getBreakdownDimension({
    hasSelection: Boolean(selectedProviderAccountId),
    preferredFocusedDimension: 'model',
  });
  const primaryBreakdownGroupBy = breakdownDimension === 'provider' ? 'provider' : 'model';
  const visibleUsageHistory = isGatewayRunning ? usageHistory : [];
  const windowedUsageHistory = filterUsageHistoryByWindow(visibleUsageHistory, usageWindow);
  const scopedWindowedUsageHistory = selectedRuntimeProviderKey
    ? windowedUsageHistory.filter((entry) => normalizeUsageProviderKey(entry.provider) === selectedRuntimeProviderKey)
    : windowedUsageHistory;
  const filteredUsageHistory = scopedWindowedUsageHistory;
  const trendGroups = groupUsageHistoryByWindow(
    selectedRuntimeProviderKey
      ? visibleUsageHistory.filter((entry) => normalizeUsageProviderKey(entry.provider) === selectedRuntimeProviderKey)
      : visibleUsageHistory,
    usageWindow,
    'day',
  );
  const breakdownGroups = groupUsageHistory(filteredUsageHistory, primaryBreakdownGroupBy);
  const usageWindowLabel = usageWindow === '7d'
    ? '7d'
    : usageWindow === '30d'
      ? '30d'
      : 'all';
  const providerUsageSummaries = buildProviderUsageSummaries({
    accounts: providerAccounts,
    entries: windowedUsageHistory,
    selectedRuntimeProviderKey,
  });
  const usageKpis = buildUsageKpis({
    entries: windowedUsageHistory,
    selectedRuntimeProviderKey,
  });
  const usagePageSize = 5;
  const usageTotalPages = Math.max(1, Math.ceil(filteredUsageHistory.length / usagePageSize));
  const safeUsagePage = Math.min(usagePage, usageTotalPages);
  const pagedUsageHistory = filteredUsageHistory.slice((safeUsagePage - 1) * usagePageSize, safeUsagePage * usagePageSize);
  const usageLoading = isGatewayRunning && usageFetchDoneKey !== usageFetchKey;

  const resolveProviderAccountIdForRuntimeKey = (runtimeProviderKey: string): string | null => {
    const matchedAccounts = findProviderAccountsByRuntimeKey(providerAccounts, runtimeProviderKey);

    return (
      (defaultProviderAccountId
        ? matchedAccounts.find((account) => account.id === defaultProviderAccountId)?.id
        : null)
      || matchedAccounts[0]?.id
      || null
    );
  };

  const handleSelectProviderAccount = (accountId: string | null) => {
    setSelectedProviderAccountId(accountId);
    setEditingProviderAccountId(null);
  };

  const handleSelectProviderScope = (value: string | null) => {
    if (!value) {
      handleSelectProviderAccount(null);
      return;
    }

    const accountId = resolveProviderAccountIdForRuntimeKey(value);

    if (!accountId) {
      toast.error(t('dashboard:models.missingProviderScope', {
        provider: value,
        defaultValue: `${value} 已不在当前配置中，请先添加或恢复对应提供商。`,
      }));
      return;
    }

    handleSelectProviderAccount(accountId);
  };

  const handleEditProvider = (accountId: string) => {
    setSelectedProviderAccountId(accountId);
    setEditingProviderAccountId(accountId);
  };

  const handleDeleteProvider = async (accountId: string) => {
    await removeAccount(accountId);
    setEditingProviderAccountId(null);
    setSelectedProviderAccountId((current) => (current === accountId ? null : current));
  };

  const handleSaveProvider = async (payload: { newApiKey?: string; updates?: Record<string, unknown> }) => {
    if (!selectedProviderItem) {
      return;
    }

    await updateAccount(
      selectedProviderItem.account.id,
      (payload.updates as Parameters<typeof updateAccount>[1]) ?? {},
      payload.newApiKey
    );
    setEditingProviderAccountId(null);
  };

  const handleAddProvider = async (
    type: ProviderType,
    name: string,
    apiKey: string,
    options?: AddProviderDialogOptions,
  ) => {
    try {
      const accountId = await createProviderAccountFromDialog({
        type,
        name,
        apiKey,
        vendors: providerVendors,
        defaultAccountId: defaultProviderAccountId,
        createAccount,
        setDefaultAccount,
        options,
      });
      setShowAddProviderDialog(false);
      setSelectedProviderAccountId(accountId);
      setEditingProviderAccountId(null);
      toast.success(t('settings:aiProviders.toast.added', '已添加 Provider'));
    } catch (error) {
      toast.error(`${t('settings:aiProviders.toast.failedAdd', '添加 Provider 失败')}: ${error}`);
    }
  };

  const handleValidateSelectedProviderKey = async (
    key: string,
    options?: { baseUrl?: string; apiProtocol?: 'openai-completions' | 'openai-responses' | 'anthropic-messages' },
  ) => {
    if (!selectedProviderItem) {
      return { valid: false, error: t('settings:aiProviders.toast.invalidKey', '无效的 API Key') };
    }

    return validateAccountApiKey(selectedProviderItem.account.id, key, options);
  };

  const breakdownTitle = primaryBreakdownGroupBy === 'provider'
    ? t('dashboard:models.breakdown.provider', 'Provider breakdown')
    : t('dashboard:models.breakdown.model', 'Model breakdown');

  const tokenIntelligenceSection = (
    <section
      className={usageSurfaceClass}
      data-testid="models-token-intelligence"
      data-layout={tokenIntelligenceLayout}
      data-primary-chart-visible="true"
    >
      <div className="space-y-3.5">
        <div
          className="app-insight-surface space-y-2 rounded-[13px] border border-[hsl(var(--border-subtle)/0.78)] px-3 py-2.5"
          data-testid="models-token-intelligence-header"
        >
          <UsageKpiStrip
            items={usageKpis}
            activeMetric={usageMetric}
            tokensLabel={t('dashboard:models.kpis.tokens', '窗口总 Tokens')}
            costLabel={t('dashboard:models.kpis.cost', '窗口总 Cost')}
            requestsLabel={t('dashboard:models.windowRequests', '窗口总 Requests')}
            modelsLabel={t('dashboard:models.kpis.models', '活跃模型')}
          />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <UsageMetricToggle
                value={usageMetric}
                onChange={setUsageMetric}
                tokensLabel={t('dashboard:models.metrics.tokens', 'Tokens')}
                costLabel={t('dashboard:models.metrics.cost', 'Cost')}
              />
              <div className={toggleGroupClass} data-testid="models-usage-window-toggle">
                <Button
                  variant={usageWindow === '7d' ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => {
                    setUsageWindow('7d');
                    setUsagePage(1);
                  }}
                  className={cn('h-7 px-2.5 text-[11px] font-medium shadow-none', usageWindow === '7d' ? toggleActiveClass : toggleIdleClass)}
                >
                  {t('dashboard:recentTokenHistory.last7Days')}
                </Button>
                <Button
                  variant={usageWindow === '30d' ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => {
                    setUsageWindow('30d');
                    setUsagePage(1);
                  }}
                  className={cn('h-7 px-2.5 text-[11px] font-medium shadow-none', usageWindow === '30d' ? toggleActiveClass : toggleIdleClass)}
                >
                  {t('dashboard:recentTokenHistory.last30Days')}
                </Button>
                <Button
                  variant={usageWindow === 'all' ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => {
                    setUsageWindow('all');
                    setUsagePage(1);
                  }}
                  className={cn('h-7 px-2.5 text-[11px] font-medium shadow-none', usageWindow === 'all' ? toggleActiveClass : toggleIdleClass)}
                >
                  {t('dashboard:recentTokenHistory.allTime')}
                </Button>
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground">
              {t('dashboard:recentTokenHistory.showingLast', { count: filteredUsageHistory.length })}
            </p>
          </div>
        </div>

        <div>
        {usageLoading ? (
          <div className={emptyStateClass}>
            <FeedbackState state="loading" title={t('dashboard:recentTokenHistory.loading')} />
          </div>
        ) : visibleUsageHistory.length === 0 ? (
          <div className={emptyStateClass}>
            <FeedbackState state="empty" title={t('dashboard:recentTokenHistory.empty')} />
          </div>
        ) : filteredUsageHistory.length === 0 ? (
          <div className={emptyStateClass}>
            <FeedbackState state="empty" title={t('dashboard:recentTokenHistory.emptyForWindow')} />
          </div>
        ) : (
          <div className={cn(tokenIntelligenceLayout === 'split' ? 'grid gap-4 xl:grid-cols-[minmax(0,1.12fr)_minmax(0,0.88fr)] xl:items-start' : 'space-y-4')}>
            <div className="space-y-4">
              <UsageTrendChart
                groups={trendGroups}
                metric={usageMetric}
                emptyLabel={t('dashboard:recentTokenHistory.empty')}
                costIncompleteLabel={t('dashboard:models.costIncomplete', '成本数据不完整')}
                inputLabel={t('dashboard:recentTokenHistory.inputShort')}
                outputLabel={t('dashboard:recentTokenHistory.outputShort')}
                cacheLabel={t('dashboard:recentTokenHistory.cacheShort')}
                costLabel={t('dashboard:models.metrics.cost', 'Cost')}
              />
            </div>

            <div className="space-y-4">
              <UsageBreakdownChart
                groups={breakdownGroups}
                dimension={breakdownDimension}
                metric={usageMetric}
                emptyLabel={t('dashboard:recentTokenHistory.empty')}
                costIncompleteLabel={t('dashboard:models.costIncomplete', '成本数据不完整')}
                title={breakdownTitle}
                requestsLabel={t('dashboard:models.windowRequests', 'Requests')}
                onSelect={breakdownDimension === 'provider' ? handleSelectProviderScope : undefined}
              />
              <UsageRecentRequests
                entries={pagedUsageHistory}
                title={t('dashboard:recentTokenHistory.title', '最近请求')}
                devModeUnlocked={devModeUnlocked}
                usageChipClass={usageChipClass}
                unknownModelLabel={t('dashboard:recentTokenHistory.unknownModel')}
                inputLabel={(value) => t('dashboard:recentTokenHistory.input', { value })}
                outputLabel={(value) => t('dashboard:recentTokenHistory.output', { value })}
                cacheReadLabel={(value) => t('dashboard:recentTokenHistory.cacheRead', { value })}
                cacheWriteLabel={(value) => t('dashboard:recentTokenHistory.cacheWrite', { value })}
                costLabel={(value) => t('dashboard:recentTokenHistory.cost', { amount: value })}
                viewContentLabel={t('dashboard:recentTokenHistory.viewContent')}
                pageLabel={(current, total) => t('dashboard:recentTokenHistory.page', { current, total })}
                prevLabel={t('dashboard:recentTokenHistory.prev')}
                nextLabel={t('dashboard:recentTokenHistory.next')}
                currentPage={safeUsagePage}
                totalPages={usageTotalPages}
                onPrevPage={() => setUsagePage((page) => Math.max(1, page - 1))}
                onNextPage={() => setUsagePage((page) => Math.min(usageTotalPages, page + 1))}
                onViewContent={setSelectedUsageEntry}
                onSelectProvider={handleSelectProviderScope}
              />
            </div>
          </div>
        )}
        </div>
      </div>
    </section>
  );

  return (
    <WorkspacePageFrame>
      <WorkspacePageShell className="max-w-[1720px]" data-testid="models-page-root" data-workbench-mode={workbenchMode}>
        <ModelsWorkbenchHeader
          title={t('dashboard:models.title')}
          subtitle={t('dashboard:models.subtitle')}
          actions={(
            <Button
              type="button"
              variant="outline"
              className="rounded-full px-4"
              onClick={() => setShowAddProviderDialog(true)}
            >
              {t('settings:aiProviders.add', '添加提供商')}
            </Button>
          )}
        />
        <div ref={contentRef} className="min-h-0 flex flex-1 flex-col">
          <WorkspacePageScrollArea className="space-y-6 pt-2">
            <div className={cn(inspectorShell === 'pane' ? 'grid gap-6 xl:grid-cols-[minmax(0,1.08fr)_minmax(360px,420px)] xl:items-start' : 'space-y-8')}>
              <div className="space-y-8">
                <ProviderBoard
                  summaries={providerUsageSummaries}
                  accounts={providerAccounts}
                  selectedRuntimeProviderKey={selectedRuntimeProviderKey}
                  selectedAccountId={selectedProviderItem?.account.id ?? null}
                  loading={providerLoading}
                  defaultAccountId={defaultProviderAccountId}
                  presentation={providerBoardPresentation}
                  columns={providerBoardColumns}
                  maxVisibleRows={2}
                  language={i18n.language}
                  clearLabel={t('dashboard:models.allProviders', '全部提供商')}
                  activeScopeLabel={t('dashboard:models.activeScope', '当前范围')}
                  boardTitle={t('dashboard:models.providersTitle', '模型提供商')}
                  boardHint={t('dashboard:models.providersHint', '选择一个提供商，进入配置并联动下方用量分析')}
                  emptyTitle={t('dashboard:models.providersEmptyTitle', '还没有提供商')}
                  emptyHint={t('dashboard:models.providersEmptyHint', '先添加一个提供商，模型控制台才会显示可配置入口和联动分析。')}
                  configuredLabel={t('dashboard:models.configured', '已配置')}
                  defaultLabel={t('dashboard:models.defaultProvider', '默认')}
                  tokensLabel={t('dashboard:models.windowTokens', `${usageWindowLabel} tokens`)}
                  requestsLabel={t('dashboard:models.windowRequests', `${usageWindowLabel} requests`)}
                  docsLabel={t('dashboard:models.docs', 'docs')}
                  accountsLabel={t('dashboard:models.accounts', '账号')}
                  openLabel={t('dashboard:models.openProvider', '进入配置')}
                  viewingLabel={t('dashboard:models.viewingProvider', '正在查看')}
                  onSelect={handleSelectProviderAccount}
                  onClearSelection={() => handleSelectProviderAccount(null)}
                />
                {tokenIntelligenceSection}
              </div>
              {inspectorShell === 'pane' ? (
                <ProviderInspector
                  shell="pane"
                  mode={editingProviderAccountId ? 'edit' : 'view'}
                  item={selectedProviderItem}
                  allProviders={providerItems}
                  scopeItems={selectedInspectorItems}
                  defaultAccountId={defaultProviderAccountId}
                  devModeUnlocked={devModeUnlocked}
                  selectedAccountId={selectedProviderItem?.account.id ?? null}
                  onClose={() => {
                    setSelectedProviderAccountId(null);
                    setEditingProviderAccountId(null);
                  }}
                  onEdit={() => {
                    if (selectedProviderItem) {
                      handleEditProvider(selectedProviderItem.account.id);
                    }
                  }}
                  onDelete={() => {
                    if (selectedProviderItem) {
                      void handleDeleteProvider(selectedProviderItem.account.id);
                    }
                  }}
                  onSetDefault={() => {
                    if (selectedProviderItem) {
                      void setDefaultAccount(selectedProviderItem.account.id);
                    }
                  }}
                  onSelectAccount={(accountId) => {
                    setSelectedProviderAccountId(accountId);
                    setEditingProviderAccountId(null);
                  }}
                  onSave={(payload) => handleSaveProvider(payload)}
                  onCancelEdit={() => setEditingProviderAccountId(null)}
                  onValidateKey={handleValidateSelectedProviderKey}
                />
              ) : null}
            </div>
          </WorkspacePageScrollArea>
        </div>
      </WorkspacePageShell>
      {inspectorShell && inspectorShell !== 'pane' ? (
        <ProviderInspector
          shell={inspectorShell}
          mode={editingProviderAccountId ? 'edit' : 'view'}
          item={selectedProviderItem}
          allProviders={providerItems}
          scopeItems={selectedInspectorItems}
          defaultAccountId={defaultProviderAccountId}
          devModeUnlocked={devModeUnlocked}
          selectedAccountId={selectedProviderItem?.account.id ?? null}
          onClose={() => {
            setSelectedProviderAccountId(null);
            setEditingProviderAccountId(null);
          }}
          onEdit={() => {
            if (selectedProviderItem) {
              handleEditProvider(selectedProviderItem.account.id);
            }
          }}
          onDelete={() => {
            if (selectedProviderItem) {
              void handleDeleteProvider(selectedProviderItem.account.id);
            }
          }}
          onSetDefault={() => {
            if (selectedProviderItem) {
              void setDefaultAccount(selectedProviderItem.account.id);
            }
          }}
          onSelectAccount={(accountId) => {
            setSelectedProviderAccountId(accountId);
            setEditingProviderAccountId(null);
          }}
          onSave={(payload) => handleSaveProvider(payload)}
          onCancelEdit={() => setEditingProviderAccountId(null)}
          onValidateKey={handleValidateSelectedProviderKey}
        />
      ) : null}
      {showAddProviderDialog ? (
        <AddProviderDialog
          existingVendorIds={new Set(providerAccounts.map((account) => account.vendorId))}
          vendors={providerVendors}
          onClose={() => setShowAddProviderDialog(false)}
          onAdd={handleAddProvider}
          onValidateKey={(type, key, options) => validateAccountApiKey(type, key, options)}
          devModeUnlocked={devModeUnlocked}
        />
      ) : null}
      {devModeUnlocked && selectedUsageEntry && (
        <UsageContentPopup
          entry={selectedUsageEntry}
          onClose={() => setSelectedUsageEntry(null)}
          title={t('dashboard:recentTokenHistory.contentDialogTitle')}
          closeLabel={t('dashboard:recentTokenHistory.close')}
          unknownModelLabel={t('dashboard:recentTokenHistory.unknownModel')}
        />
      )}
    </WorkspacePageFrame>
  );
}

function formatUsageTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return timestamp;
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export default Models;

function UsageContentPopup({
  entry,
  onClose,
  title,
  closeLabel,
  unknownModelLabel,
}: {
  entry: UsageHistoryEntry;
  onClose: () => void;
  title: string;
  closeLabel: string;
  unknownModelLabel: string;
}) {
  return (
    <div className="app-modal-overlay fixed inset-0 z-50 flex items-center justify-center px-4" role="dialog" aria-modal="true">
      <div className="app-panel-surface-elevated w-full max-w-3xl rounded-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-border/70 px-5 py-4">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">{title}</p>
            <p className="text-xs text-muted-foreground truncate mt-0.5">
              {(entry.model || unknownModelLabel)} • {formatUsageTimestamp(entry.timestamp)}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-full"
            onClick={onClose}
            aria-label={closeLabel}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="max-h-[65vh] overflow-y-auto px-5 py-4">
          <pre className="whitespace-pre-wrap break-words text-sm text-foreground font-mono">
            {entry.content}
          </pre>
        </div>
        <div className="flex justify-end border-t border-border/70 px-5 py-3">
          <Button variant="outline" onClick={onClose}>
            {closeLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
