import { type RefObject, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, ChevronDown, FolderUp, Plus, RefreshCw, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { AgentCardsPane } from '@/components/agents/AgentCardsPane';
import { AgentLocalDetailPane } from '@/components/agents/AgentLocalDetailPane';
import { AgentMarketCardsPane } from '@/components/agents/AgentMarketCardsPane';
import { AgentMarketDetailPane } from '@/components/agents/AgentMarketDetailPane';
import { AgentModeSwitch } from '@/components/agents/AgentModeSwitch';
import type { AgentBrowseMode } from '@/components/agents/AgentModeSwitch';
import {
  workbenchPrimaryToolbarButtonClasses,
  workbenchToolbarButtonClasses,
} from '@/components/layout/workbench-button-styles';
import { WorkspacePageFrame, WorkspacePageLoading, WorkspacePageScrollArea, WorkspacePageShell } from '@/components/layout/WorkspacePage';
import { useAgentsStore } from '@/stores/agents';
import { useGatewayStore } from '@/stores/gateway';
import { hostApiFetch } from '@/lib/host-api';
import { subscribeHostEvent } from '@/lib/host-events';
import { resolveMarketCategoryLabel } from '@/lib/agent-market-copy';
import { getModelOptionHint, getModelOptionLabel, normalizeModelOption, type ModelOption } from '@/lib/model-options';
import { getProviderAccountRuntimeKey } from '@/lib/provider-accounts';
import type { AgentsSnapshot, AgentSummary } from '@/types/agent';
import type { ChannelType } from '@/types/channel';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { AgentMarketCatalogItem } from '@/types/agent-market';
import type { ProviderAccount } from '@/lib/providers';

interface ChannelAccountItem {
  accountId: string;
  name: string;
  configured: boolean;
  status: 'connected' | 'connecting' | 'disconnected' | 'error';
  lastError?: string;
  isDefault: boolean;
  agentId?: string;
}

interface ChannelGroupItem {
  channelType: string;
  defaultAccountId: string;
  status: 'connected' | 'connecting' | 'disconnected' | 'error';
  accounts: ChannelAccountItem[];
}

interface AgentWorkspaceFileItem {
  relativePath: string;
  displayName: string;
  reserved: boolean;
  editable: boolean;
}

interface AgentMarketCatalogResponse {
  success: boolean;
  version: number;
  source: {
    repo: string;
    license: string;
    catalogKind: string;
    note: string;
  };
  items: AgentMarketCatalogItem[];
}

const fieldInputClasses =
  'appearance-none h-[44px] rounded-xl text-[13px] app-field-surface text-foreground placeholder:text-foreground/40 shadow-none transition-all focus:outline-none focus-visible:outline-none focus-visible:border-primary focus-visible:bg-[hsl(var(--surface-elevated)/1)] focus-visible:ring-0';
const modalSurfaceClasses =
  'app-modal-surface w-full rounded-[20px]';
const badgeClasses =
  'h-5 rounded-[10px] border border-border/70 bg-[hsl(var(--surface-panel)/0.9)] px-2 text-[10px] font-medium text-foreground/70 shadow-none dark:bg-[hsl(var(--surface-elevated)/0.82)]';
const modalTitleClasses =
  'text-[20px] md:text-[22px] font-semibold tracking-tight text-foreground';
const modalDescriptionClasses =
  'mt-1 text-[13px] font-medium leading-[1.6] text-foreground/68';
const dialogIconButtonClasses =
  'h-8 w-8 rounded-[12px] border border-border/70 bg-transparent shadow-none text-muted-foreground transition-colors hover:bg-[hsl(var(--surface-hover)/0.46)] hover:text-foreground';
const dialogActionButtonClasses =
  'h-9 rounded-[12px] px-4 text-[13px] font-medium shadow-none border-border/70 bg-transparent text-foreground/80 transition-colors hover:bg-[hsl(var(--surface-hover)/0.46)] hover:text-foreground';
const browsePaneClasses =
  'app-pane-surface min-h-[600px] rounded-[24px] border border-border/70 bg-[hsl(var(--surface-elevated)/0.992)] p-4 shadow-[0_10px_24px_rgba(15,23,42,0.04),inset_0_1px_0_rgba(255,255,255,0.74)]';
const detailWorkbenchClasses =
  'app-pane-surface min-h-[600px] rounded-[24px] border border-border/70 bg-[hsl(var(--surface-elevated)/0.995)] p-4 shadow-[0_14px_32px_rgba(15,23,42,0.05),inset_0_1px_0_rgba(255,255,255,0.78)]';
const pageHeaderClasses =
  'mb-3 flex items-center justify-between gap-4';
const pageTitleClasses =
  'text-[19px] md:text-[20px] font-semibold leading-[1.05] tracking-tight text-foreground';
type DetailTab = 'persona' | 'binding';
type PickerPlacement = 'top' | 'bottom';

function getAssignedChannels(
  agentId: string,
  channelGroups: ChannelGroupItem[],
  t: (key: string, options?: Record<string, unknown>) => string,
) {
  return channelGroups.flatMap((group) =>
    group.accounts
      .filter((account) => account.agentId === agentId)
      .map((account) => ({
        channelType: group.channelType as ChannelType,
        accountId: account.accountId,
        name:
          account.accountId === 'default'
            ? t('settingsDialog.mainAccount')
            : account.name || account.accountId,
        error: account.lastError,
      })),
  );
}

function normalizeAgentQuery(value: string) {
  return value.toLowerCase().normalize('NFKC').trim();
}

function getAgentSearchText(agent: AgentSummary) {
  return [
    agent.id,
    agent.name,
    agent.modelDisplay,
    agent.workspace,
    agent.agentDir,
    agent.channelTypes.join(' '),
  ]
    .join(' ')
    .toLowerCase();
}

function getPersistedAgentModelRef(agent: AgentSummary): string | null {
  return agent.inheritedModel ? null : agent.modelRef ?? null;
}

function usePickerPlacement(anchorRef: RefObject<HTMLElement | null>, open: boolean) {
  const [placement, setPlacement] = useState<PickerPlacement>('bottom');
  const [listMaxHeight, setListMaxHeight] = useState(288);

  useEffect(() => {
    if (!open || typeof window === 'undefined') {
      return;
    }

    const updatePlacement = () => {
      const rect = anchorRef.current?.getBoundingClientRect();
      if (!rect) {
        return;
      }
      const viewportPadding = 16;
      const panelGap = 8;
      const listChromeHeight = 68;
      const spaceAbove = rect.top - viewportPadding;
      const spaceBelow = window.innerHeight - rect.bottom - viewportPadding;
      const nextPlacement: PickerPlacement =
        spaceBelow >= 320 || spaceBelow >= spaceAbove ? 'bottom' : 'top';
      const availableSpace = Math.max(
        160,
        (nextPlacement === 'bottom' ? spaceBelow : spaceAbove) - panelGap,
      );
      setPlacement(nextPlacement);
      setListMaxHeight(Math.max(120, Math.min(288, availableSpace - listChromeHeight)));
    };

    updatePlacement();
    window.addEventListener('resize', updatePlacement);
    window.addEventListener('scroll', updatePlacement, true);
    return () => {
      window.removeEventListener('resize', updatePlacement);
      window.removeEventListener('scroll', updatePlacement, true);
    };
  }, [anchorRef, open]);

  return { placement, listMaxHeight };
}

function useAvailableModelOptions(enabled: boolean) {
  const gatewayRpc = useGatewayStore((state) => state.rpc);
  const [models, setModels] = useState<ModelOption[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelsLoadError, setModelsLoadError] = useState<string | null>(null);

  const loadModels = useCallback(async () => {
    setModelsLoading(true);
    setModelsLoadError(null);
    try {
      const [response, providerAccounts] = await Promise.all([
        gatewayRpc<{ models?: unknown[] }>('models.list', {}),
        hostApiFetch<ProviderAccount[]>('/api/provider-accounts').catch(() => []),
      ]);
      const providerLabelMap = new Map(
        (providerAccounts ?? []).map((account) => [getProviderAccountRuntimeKey(account), account.label]),
      );
      const nextModels = Array.isArray(response?.models)
        ? response.models
            .map((model, index) => ({
              model: normalizeModelOption(model, providerLabelMap),
              index,
            }))
            .filter((entry): entry is { model: ModelOption; index: number } => Boolean(entry.model))
            .sort((left, right) => left.index - right.index)
            .map((entry) => entry.model)
        : [];
      setModels(nextModels);
    } catch (error) {
      setModelsLoadError(String(error));
    } finally {
      setModelsLoading(false);
    }
  }, [gatewayRpc]);

  useEffect(() => {
    if (!enabled) {
      return;
    }
    void loadModels();
  }, [enabled, loadModels]);

  return { models, modelsLoading, modelsLoadError };
}

function getMarketSearchText(item: AgentMarketCatalogItem) {
  return [
    item.id,
    item.name,
    item.role,
    item.headline,
    item.summary,
    item.category,
    item.installMode,
    ...item.tags,
    ...item.highlights,
    ...item.detailSections.flatMap((section) => [section.title, section.body, ...section.items]),
  ]
    .join(' ')
    .toLowerCase();
}

export function Agents() {
  const { t } = useTranslation('agents');
  const resolveText = (key: string, fallback: string) => {
    const value = t(key);
    return value === key ? fallback : value;
  };
  const gatewayStatus = useGatewayStore((state) => state.status);
  const lastGatewayStateRef = useRef(gatewayStatus.state);
  const {
    agents,
    loading,
    error,
    applySnapshot,
    fetchAgents,
    createAgent,
    deleteAgent,
  } = useAgentsStore();
  const [channelGroups, setChannelGroups] = useState<ChannelGroupItem[]>([]);

  const [showAddDialog, setShowAddDialog] = useState(false);
  const [createMenuOpen, setCreateMenuOpen] = useState(false);
  const [activeAgentId, setActiveAgentId] = useState<string | null>(null);
  const [settingsAgentId, setSettingsAgentId] = useState<string | null>(null);
  const [agentToDelete, setAgentToDelete] = useState<AgentSummary | null>(null);
  const [agentCreateWarning, setAgentCreateWarning] = useState<string | null>(null);
  const [browseMode, setBrowseMode] = useState<AgentBrowseMode>('agents');
  const [detailTab, setDetailTab] = useState<DetailTab>('persona');
  const [agentSearchValue, setAgentSearchValue] = useState('');
  const [marketSearchValue, setMarketSearchValue] = useState('');
  const [marketCategory, setMarketCategory] = useState('all');
  const [selectedMarketItemId, setSelectedMarketItemId] = useState('');
  const [marketItems, setMarketItems] = useState<AgentMarketCatalogItem[]>([]);
  const [marketLoading, setMarketLoading] = useState(false);
  const [_marketError, setMarketError] = useState<string | null>(null);
  const [marketInstallName, setMarketInstallName] = useState('');
  const [marketInstalling, setMarketInstalling] = useState(false);
  const [workspaceFiles, setWorkspaceFiles] = useState<AgentWorkspaceFileItem[]>([]);
  const [workspaceFilesLoading, setWorkspaceFilesLoading] = useState(false);
  const [workspaceFilesError, setWorkspaceFilesError] = useState<string | null>(null);
  const [selectedWorkspaceFilePath, setSelectedWorkspaceFilePath] = useState<string | null>(null);
  const [workspaceEditorDialogOpen, setWorkspaceEditorDialogOpen] = useState(false);
  const [workspaceFileContent, setWorkspaceFileContent] = useState('');
  const [workspaceEditorValue, setWorkspaceEditorValue] = useState('');
  const [workspaceDirty, setWorkspaceDirty] = useState(false);
  const [workspaceSaving, setWorkspaceSaving] = useState(false);
  const [workspacePendingSelection, setWorkspacePendingSelection] = useState<string | null>(null);
  const [workspacePendingAgentId, setWorkspacePendingAgentId] = useState<string | null>(null);
  const [workspacePendingDetailTab, setWorkspacePendingDetailTab] = useState<DetailTab | null>(null);
  const [workspacePendingBrowseMode, setWorkspacePendingBrowseMode] = useState<AgentBrowseMode | null>(null);
  const [workspacePendingRoute, setWorkspacePendingRoute] = useState<string | null>(null);
  const [confirmDiscardChangesOpen, setConfirmDiscardChangesOpen] = useState(false);
  const createMenuRef = useRef<HTMLDivElement | null>(null);
  const marketSearchLabel = resolveText('workbench.browse.marketSearchPlaceholder', '搜索模板、角色或分类');

  const fetchChannelAccounts = useCallback(async () => {
    try {
      const response = await hostApiFetch<{ success: boolean; channels?: ChannelGroupItem[] }>('/api/channels/accounts');
      setChannelGroups(response.channels || []);
    } catch {
      setChannelGroups([]);
    }
  }, []);

  const loadWorkspaceFiles = useCallback(async (agentId: string) => {
    setWorkspaceFilesLoading(true);
    setWorkspaceFilesError(null);
    try {
      const response = await hostApiFetch<{ success: boolean; files: AgentWorkspaceFileItem[] }>(
        `/api/agents/${encodeURIComponent(agentId)}/files?root=workspace`,
      );
      const nextFiles = response.files ?? [];
      setWorkspaceFiles(nextFiles);
      setSelectedWorkspaceFilePath((current) =>
        nextFiles.find((file) => file.relativePath === current)?.relativePath ?? nextFiles[0]?.relativePath ?? null,
      );
    } catch (error) {
      setWorkspaceFiles([]);
      setSelectedWorkspaceFilePath(null);
      setWorkspaceFileContent('');
      setWorkspaceEditorValue('');
      setWorkspaceFilesError(String(error));
    } finally {
      setWorkspaceFilesLoading(false);
    }
  }, []);

  const loadMarketCatalog = useCallback(async () => {
    setMarketLoading(true);
    setMarketError(null);
    try {
      const response = await hostApiFetch<AgentMarketCatalogResponse>('/api/agent-market/catalog');
      const nextItems = response.items ?? [];
      setMarketItems(nextItems);
      setSelectedMarketItemId((current) => nextItems.find((item) => item.id === current)?.id ?? nextItems[0]?.id ?? '');
    } catch (error) {
      setMarketItems([]);
      setSelectedMarketItemId('');
      setMarketError(String(error));
    } finally {
      setMarketLoading(false);
    }
  }, []);

  useEffect(() => {
    void Promise.all([fetchAgents(), fetchChannelAccounts()]);
  }, [fetchAgents, fetchChannelAccounts]);

  useEffect(() => {
    const unsubscribe = subscribeHostEvent('gateway:channel-status', () => {
      void fetchChannelAccounts();
    });
    return () => {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, [fetchChannelAccounts]);

  useEffect(() => {
    const previousGatewayState = lastGatewayStateRef.current;
    lastGatewayStateRef.current = gatewayStatus.state;

    if (previousGatewayState !== 'running' && gatewayStatus.state === 'running') {
      void fetchChannelAccounts();
    }
  }, [fetchChannelAccounts, gatewayStatus.state]);

  const resolvedActiveAgentId = activeAgentId && agents.some((agent) => agent.id === activeAgentId)
    ? activeAgentId
    : agents.find((agent) => agent.isDefault)?.id ?? agents[0]?.id ?? null;
  const activeAgent = agents.find((agent) => agent.id === resolvedActiveAgentId) ?? null;
  const resolvedMarketItemId = marketItems.some((item) => item.id === selectedMarketItemId)
    ? selectedMarketItemId
    : marketItems[0]?.id ?? '';
  const selectedMarketItem = marketItems.find((item) => item.id === resolvedMarketItemId) ?? null;
  const selectedWorkspaceFile = workspaceFiles.find((file) => file.relativePath === selectedWorkspaceFilePath) ?? null;
  const activeAgentChannels = activeAgent ? getAssignedChannels(activeAgent.id, channelGroups, t) : [];
  const workspaceHasUnsavedChanges =
    browseMode === 'agents' && detailTab === 'persona' && Boolean(activeAgent) && Boolean(selectedWorkspaceFilePath) && workspaceDirty;
  const normalizedAgentQuery = normalizeAgentQuery(agentSearchValue);
  const normalizedMarketQuery = normalizeAgentQuery(marketSearchValue);
  const marketCategoryStats = useMemo(() => {
    const counts = new Map<string, { category: string; count: number; firstIndex: number }>();
    marketItems.forEach((item, index) => {
      const current = counts.get(item.category);
      if (current) {
        current.count += 1;
        return;
      }
      counts.set(item.category, { category: item.category, count: 1, firstIndex: index });
    });
    return [...counts.values()].sort((left, right) =>
      right.count - left.count || left.firstIndex - right.firstIndex,
    );
  }, [marketItems]);
  const marketPrimaryCategories = useMemo(
    () => marketCategoryStats.slice(0, 5).map((entry) => entry.category),
    [marketCategoryStats],
  );
  const marketSecondaryCategoryOptions = useMemo(
    () =>
      marketCategoryStats
        .slice(5)
        .map((entry) => ({ value: entry.category, label: `${resolveMarketCategoryLabel(t, entry.category)} (${entry.count})` })),
    [marketCategoryStats, t],
  );
  const filteredAgents = useMemo(
    () => agents.filter((agent) => !normalizedAgentQuery || getAgentSearchText(agent).includes(normalizedAgentQuery)),
    [agents, normalizedAgentQuery],
  );
  const filteredMarketItems = useMemo(
    () =>
      marketItems.filter(
        (item) =>
          (marketCategory === 'all' || item.category === marketCategory) &&
          (!normalizedMarketQuery || getMarketSearchText(item).includes(normalizedMarketQuery)),
      ),
    [marketCategory, marketItems, normalizedMarketQuery],
  );
  useEffect(() => {
    if (!createMenuOpen) {
      return;
    }
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!createMenuRef.current?.contains(target)) {
        setCreateMenuOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setCreateMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [createMenuOpen]);

  useEffect(() => {
    if (browseMode !== 'agents' || detailTab !== 'persona' || !activeAgent) {
      return;
    }

    let cancelled = false;
    const run = async () => {
      try {
        await loadWorkspaceFiles(activeAgent.id);
        if (cancelled) {
          return;
        }
      } catch (error) {
        if (cancelled) {
          return;
        }
        setWorkspaceFilesError(String(error));
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [activeAgent, browseMode, detailTab, loadWorkspaceFiles]);

  useEffect(() => {
    if (browseMode !== 'agents' || detailTab !== 'persona' || !activeAgent || !selectedWorkspaceFilePath) {
      return;
    }

    let cancelled = false;
    const run = async () => {
      try {
        const response = await hostApiFetch<{ success: boolean; content: string }>(
          `/api/agents/${encodeURIComponent(activeAgent.id)}/files/content?root=workspace&relativePath=${encodeURIComponent(selectedWorkspaceFilePath)}`,
        );
        if (!cancelled) {
          const nextContent = response.content ?? '';
          setWorkspaceFileContent(nextContent);
          setWorkspaceEditorValue(nextContent);
          setWorkspaceDirty(false);
        }
      } catch (error) {
        if (!cancelled) {
          const nextContent = String(error);
          setWorkspaceFileContent(nextContent);
          setWorkspaceEditorValue(nextContent);
          setWorkspaceDirty(false);
        }
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [activeAgent, browseMode, detailTab, selectedWorkspaceFilePath]);

  useEffect(() => {
    if (browseMode !== 'market' || marketItems.length > 0 || marketLoading) {
      return;
    }
    void loadMarketCatalog();
  }, [browseMode, loadMarketCatalog, marketItems.length, marketLoading]);

  useEffect(() => {
    if (!selectedMarketItem) {
      setMarketInstallName('');
      return;
    }
    setMarketInstallName((current) => current || selectedMarketItem.name || selectedMarketItem.id);
  }, [selectedMarketItem]);
  const handleRefresh = () => {
    void Promise.all([fetchAgents(), fetchChannelAccounts()]);
  };

  const resetPendingWorkspaceNavigation = useCallback(() => {
    setWorkspacePendingSelection(null);
    setWorkspacePendingAgentId(null);
    setWorkspacePendingDetailTab(null);
    setWorkspacePendingBrowseMode(null);
    setWorkspacePendingRoute(null);
  }, []);

  const applyPendingWorkspaceNavigation = useCallback(() => {
    if (workspacePendingBrowseMode) {
      setBrowseMode(workspacePendingBrowseMode);
    }
    if (workspacePendingAgentId) {
      setActiveAgentId(workspacePendingAgentId);
      if (workspacePendingDetailTab) {
        setDetailTab(workspacePendingDetailTab);
      }
    } else if (workspacePendingDetailTab) {
      setDetailTab(workspacePendingDetailTab);
    } else if (workspacePendingSelection !== null) {
      setSelectedWorkspaceFilePath(workspacePendingSelection);
    }
    if (workspacePendingRoute) {
      window.location.hash = workspacePendingRoute;
    }
    setWorkspaceDirty(false);
    resetPendingWorkspaceNavigation();
    setConfirmDiscardChangesOpen(false);
  }, [
    resetPendingWorkspaceNavigation,
    workspacePendingAgentId,
    workspacePendingBrowseMode,
    workspacePendingDetailTab,
    workspacePendingRoute,
    workspacePendingSelection,
  ]);

  const requestDiscardChanges = useCallback((next: {
    agentId?: string | null;
    relativePath?: string | null;
    detailTab?: DetailTab | null;
    browseMode?: AgentBrowseMode | null;
    route?: string | null;
  }) => {
    setWorkspacePendingAgentId(next.agentId ?? null);
    setWorkspacePendingSelection(next.relativePath ?? null);
    setWorkspacePendingDetailTab(next.detailTab ?? null);
    setWorkspacePendingBrowseMode(next.browseMode ?? null);
    setWorkspacePendingRoute(next.route ?? null);
    setConfirmDiscardChangesOpen(true);
  }, []);

  const handleSelectAgent = useCallback((agent: AgentSummary) => {
    if (workspaceHasUnsavedChanges) {
      requestDiscardChanges({ agentId: agent.id, detailTab });
      return;
    }
    setBrowseMode('agents');
    setActiveAgentId(agent.id);
  }, [detailTab, requestDiscardChanges, workspaceHasUnsavedChanges]);

  const handleDetailTabChange = useCallback((nextTab: DetailTab) => {
    if (nextTab === detailTab) {
      return;
    }
    if (workspaceHasUnsavedChanges) {
      requestDiscardChanges({ detailTab: nextTab });
      return;
    }
    setDetailTab(nextTab);
  }, [detailTab, requestDiscardChanges, workspaceHasUnsavedChanges]);

  const handleBrowseModeChange = useCallback((nextMode: AgentBrowseMode) => {
    if (nextMode === browseMode) {
      return;
    }
    if (workspaceHasUnsavedChanges) {
      requestDiscardChanges({ browseMode: nextMode });
      return;
    }
    setBrowseMode(nextMode);
  }, [browseMode, requestDiscardChanges, workspaceHasUnsavedChanges]);

  const handleOpenWorkspaceEditor = useCallback((relativePath: string) => {
    if (relativePath !== selectedWorkspaceFilePath && workspaceHasUnsavedChanges) {
      requestDiscardChanges({ relativePath });
      return;
    }
    if (relativePath !== selectedWorkspaceFilePath) {
      setSelectedWorkspaceFilePath(relativePath);
    }
    setWorkspaceEditorDialogOpen(true);
  }, [requestDiscardChanges, selectedWorkspaceFilePath, workspaceHasUnsavedChanges]);

  const handleStartChat = useCallback((agentId: string) => {
    const nextRoute = `#/new/${encodeURIComponent(agentId)}`;
    if (workspaceHasUnsavedChanges) {
      requestDiscardChanges({ route: nextRoute });
      return;
    }
    window.location.hash = nextRoute;
  }, [requestDiscardChanges, workspaceHasUnsavedChanges]);

  const persistWorkspaceFile = useCallback(async () => {
    if (!activeAgent || !selectedWorkspaceFilePath || !workspaceDirty) {
      return true;
    }
    setWorkspaceSaving(true);
    try {
      await hostApiFetch<{ success: boolean }>(
        `/api/agents/${encodeURIComponent(activeAgent.id)}/files/content`,
        {
          method: 'PUT',
          body: JSON.stringify({
            root: 'workspace',
            relativePath: selectedWorkspaceFilePath,
            content: workspaceEditorValue,
          }),
        },
      );
      setWorkspaceFileContent(workspaceEditorValue);
      setWorkspaceDirty(false);
      toast.success(t('toast.workspaceFileSaved'));
      await loadWorkspaceFiles(activeAgent.id);
      return true;
    } catch (error) {
      toast.error(t('toast.workspaceFileSaveFailed', { error: String(error) }));
      return false;
    } finally {
      setWorkspaceSaving(false);
    }
  }, [activeAgent, loadWorkspaceFiles, selectedWorkspaceFilePath, t, workspaceDirty, workspaceEditorValue]);

  const handleSaveWorkspaceFile = useCallback(async () => {
    const saved = await persistWorkspaceFile();
    if (saved) {
      setWorkspaceEditorDialogOpen(false);
    }
  }, [persistWorkspaceFile]);

  const handleCloseWorkspaceEditor = useCallback(() => {
    setWorkspaceEditorValue(workspaceFileContent);
    setWorkspaceDirty(false);
    setWorkspaceEditorDialogOpen(false);
  }, [workspaceFileContent]);

  const handleSaveWorkspaceFileAndContinue = useCallback(async () => {
    const saved = await persistWorkspaceFile();
    if (saved) {
      applyPendingWorkspaceNavigation();
    }
  }, [applyPendingWorkspaceNavigation, persistWorkspaceFile]);

  const handleInstallFromMarket = useCallback(async () => {
    if (!selectedMarketItem) {
      return;
    }
    setMarketInstalling(true);
    try {
      const response = await hostApiFetch<AgentsSnapshot & { success: boolean; createdAgentId: string }>(
        '/api/agent-market/install',
        {
          method: 'POST',
          body: JSON.stringify({
            catalogItemId: selectedMarketItem.id,
            name: marketInstallName.trim() || selectedMarketItem.name || selectedMarketItem.id,
          }),
        },
      );
      applySnapshot(response);
      setBrowseMode('agents');
      setActiveAgentId(response.createdAgentId);
      setDetailTab('persona');
      setMarketInstallName('');
      toast.success(t('toast.marketInstallSucceeded'));
    } catch (error) {
      toast.error(t('toast.marketInstallFailed', { error: String(error) }));
    } finally {
      setMarketInstalling(false);
    }
  }, [applySnapshot, marketInstallName, selectedMarketItem, t]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (browseMode !== 'agents' || detailTab !== 'persona' || !workspaceDirty || workspaceSaving) {
        return;
      }
      if (!(event.metaKey || event.ctrlKey) || event.shiftKey || event.altKey) {
        return;
      }
      if (event.key.toLowerCase() !== 's') {
        return;
      }
      event.preventDefault();
      void handleSaveWorkspaceFile();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [browseMode, detailTab, handleSaveWorkspaceFile, workspaceDirty, workspaceSaving]);

  if (loading) {
    return <WorkspacePageLoading />;
  }

  return (
      <WorkspacePageFrame>
      <WorkspacePageShell style={{ paddingTop: '0.75rem', paddingBottom: '1rem' }}>
        <div className={pageHeaderClasses}>
          <div className="min-w-0 flex-1">
            <h1 className={pageTitleClasses}>{t('workbench.title')}</h1>
          </div>
          <div className="flex shrink-0 items-center justify-end">
            <AgentModeSwitch value={browseMode} onChange={handleBrowseModeChange} />
          </div>
        </div>

        <WorkspacePageScrollArea>
          {gatewayStatus.state !== 'running' && (
            <div className="mb-5 flex items-center gap-2.5 rounded-[14px] border border-[hsl(var(--warning))/0.15] bg-[hsl(var(--warning))/0.06] px-3.5 py-2.5 text-[hsl(var(--warning))] app-insight-surface">
              <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              <span className="text-sm font-medium text-amber-900 dark:text-amber-100">
                {t('gatewayWarning')}
              </span>
            </div>
          )}

          {error && (
            <div className="mb-5 flex items-center gap-2.5 rounded-[14px] border border-destructive/16 bg-[hsl(var(--danger))/0.06] px-3.5 py-2.5 app-insight-surface">
              <AlertCircle className="h-5 w-5 text-destructive" />
              <span className="text-sm font-medium text-destructive">
                {error}
              </span>
            </div>
          )}

          {agentCreateWarning && (
            <div className="mb-5 flex items-start gap-2.5 rounded-[14px] border border-[hsl(var(--warning))/0.15] bg-[hsl(var(--warning))/0.08] px-3.5 py-2.5 app-insight-surface">
              <AlertCircle className="mt-0.5 h-5 w-5 text-amber-600 dark:text-amber-400" />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-amber-900 dark:text-amber-100">
                  {agentCreateWarning}
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setAgentCreateWarning(null)}
                className="h-8 w-8 rounded-[12px] border-0 text-amber-700/70 hover:bg-amber-500/10 hover:text-amber-900 dark:text-amber-200/80 dark:hover:text-amber-100"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}

          <div
            data-testid="agents-workbench"
            className={cn(
              'grid min-h-[720px] gap-4',
              browseMode === 'agents'
                ? 'min-[980px]:grid-cols-[minmax(340px,0.84fr)_minmax(500px,1.16fr)] min-[1580px]:grid-cols-[minmax(360px,0.92fr)_minmax(540px,1.08fr)] min-[980px]:items-start'
                : 'min-[980px]:grid-cols-[minmax(0,1.02fr)_minmax(420px,0.98fr)] min-[1500px]:grid-cols-[minmax(0,1.08fr)_560px] min-[980px]:items-start',
            )}
          >
            <section
              className={cn(
                browsePaneClasses,
                'flex min-h-0 flex-col',
                browseMode === 'agents' && 'min-[980px]:min-w-0',
              )}
            >
              <div className="min-h-0 flex-1 overflow-y-auto pr-1">
                {browseMode === 'agents' ? (
                  <AgentCardsPane
                    agents={filteredAgents}
                    channelGroups={channelGroups}
                    selectedAgentId={resolvedActiveAgentId}
                    searchValue={agentSearchValue}
                    onSearchValueChange={setAgentSearchValue}
                    onSelectAgent={handleSelectAgent}
                    onCreateAgent={() => setShowAddDialog(true)}
                    onInstallFromMarket={() => handleBrowseModeChange('market')}
                    actionButtonClassName={workbenchToolbarButtonClasses}
                    primaryActionButtonClassName={workbenchPrimaryToolbarButtonClasses}
                    badgeClassName={badgeClasses}
                    toolbarSlot={
                      <>
                        <Button
                          variant="outline"
                          onClick={handleRefresh}
                          className={workbenchToolbarButtonClasses}
                        >
                          <RefreshCw className="mr-2 h-3.5 w-3.5" />
                          {t('refresh')}
                        </Button>
                        <CreateAgentLauncher
                          open={createMenuOpen}
                          menuRef={createMenuRef}
                          triggerLabel={t('addAgent')}
                          blankLabel={t('workbench.actions.createAgent')}
                          marketLabel={t('workbench.actions.installFromMarket')}
                          onToggle={() => setCreateMenuOpen((current) => !current)}
                          onCreateBlank={() => {
                            setCreateMenuOpen(false);
                            setShowAddDialog(true);
                          }}
                          onInstallFromMarket={() => {
                            setCreateMenuOpen(false);
                            handleBrowseModeChange('market');
                          }}
                        />
                      </>
                    }
                  />
                ) : (
                  <div className="space-y-4">
                    <section className="sticky top-0 z-[1] rounded-[20px] border border-border/60 bg-[hsl(var(--surface-panel)/0.99)] px-4 py-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.52),0_12px_24px_rgba(15,23,42,0.03)] backdrop-blur-sm">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <div className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-[14px] border border-border/65 bg-[hsl(var(--surface-elevated)/0.98)] px-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.45)] transition-colors focus-within:border-ring/50 focus-within:bg-[hsl(var(--surface-elevated)/1)]">
                          <Search className="h-4 w-4 shrink-0 text-foreground/34" />
                          <Input
                            value={marketSearchValue}
                            onChange={(event) => setMarketSearchValue(event.target.value)}
                            aria-label={marketSearchLabel}
                            placeholder={marketSearchLabel}
                            className="h-7 border-0 bg-transparent px-0 text-[13px] text-foreground shadow-none outline-none ring-0 ring-offset-0 placeholder:text-foreground/34 focus-visible:border-0 focus-visible:bg-transparent focus-visible:ring-0"
                          />
                        </div>
                        <Button
                          variant="outline"
                          className={workbenchToolbarButtonClasses}
                          onClick={() => void loadMarketCatalog()}
                        >
                          <RefreshCw className="mr-2 h-3.5 w-3.5" />
                          {t('workbench.browse.refreshCatalog')}
                        </Button>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setMarketCategory('all')}
                          className={cn(
                            'inline-flex h-7 items-center rounded-full border px-3 text-[11.5px] font-medium transition-colors',
                            marketCategory === 'all'
                              ? 'border-border/70 bg-[hsl(var(--surface-elevated)/0.98)] text-foreground'
                              : 'border-border/55 bg-[hsl(var(--surface-panel)/0.86)] text-foreground/58 hover:text-foreground',
                          )}
                        >
                          {t('workbench.market.categoryAll')}
                        </button>
                        {marketPrimaryCategories.map((category) => (
                          <button
                            key={category}
                            type="button"
                            onClick={() => setMarketCategory(category)}
                            className={cn(
                              'inline-flex h-7 items-center rounded-full border px-3 text-[11.5px] font-medium transition-colors',
                              marketCategory === category
                                ? 'border-border/70 bg-[hsl(var(--surface-elevated)/0.98)] text-foreground'
                                : 'border-border/55 bg-[hsl(var(--surface-panel)/0.86)] text-foreground/58 hover:text-foreground',
                            )}
                          >
                            {resolveMarketCategoryLabel(t, category)}
                          </button>
                        ))}
                        {marketSecondaryCategoryOptions.length > 0 ? (
                          <Select
                            aria-label={t('workbench.market.moreCategories')}
                            value={marketPrimaryCategories.includes(marketCategory) ? '' : marketCategory}
                            options={[
                              { value: '', label: t('workbench.market.moreCategories') },
                              ...marketSecondaryCategoryOptions,
                            ]}
                            onValueChange={(value) => {
                              if (value) {
                                setMarketCategory(value);
                              }
                            }}
                            className="h-7 w-[148px] rounded-full border-border/55 bg-[hsl(var(--surface-panel)/0.86)] px-3 text-[11.5px] font-medium text-foreground/58 focus-visible:bg-[hsl(var(--surface-elevated)/0.98)]"
                            contentClassName="min-w-[180px]"
                          />
                        ) : null}
                      </div>
                    </section>
                    <AgentMarketCardsPane
                      items={filteredMarketItems}
                      selectedMarketItemId={resolvedMarketItemId}
                      onSelectMarketItem={(item) => {
                        setSelectedMarketItemId(item.id);
                        setMarketInstallName(item.name || item.id);
                      }}
                    />
                  </div>
                )}
              </div>
            </section>

            <section
              data-testid="agents-detail-workbench"
              className={cn(
                detailWorkbenchClasses,
                'flex min-h-0 flex-col',
                browseMode === 'agents' && 'min-[980px]:min-w-[460px]',
              )}
            >
              {browseMode === 'agents' ? (
                <>
                  <AgentLocalDetailPane
                    agent={activeAgent}
                    activeChannels={activeAgentChannels}
                    activeTab={detailTab}
                    workspaceFiles={workspaceFiles}
                    selectedWorkspaceFilePath={selectedWorkspaceFilePath}
                    workspaceFilesLoading={workspaceFilesLoading}
                    workspaceFilesError={workspaceFilesError}
                    gatewayState={gatewayStatus.state}
                    onTabChange={handleDetailTabChange}
                    onCreateAgent={() => setShowAddDialog(true)}
                    onInstallFromMarket={() => handleBrowseModeChange('market')}
                    onEditAgent={() => {
                      if (activeAgent) {
                        setSettingsAgentId(activeAgent.id);
                      }
                    }}
                    onDeleteAgent={() => {
                      if (activeAgent) {
                        setAgentToDelete(activeAgent);
                      }
                    }}
                    onManageChannels={() => {
                      window.location.hash = '#/channels';
                    }}
                    onStartChat={() => {
                      if (activeAgent) {
                        handleStartChat(activeAgent.id);
                      }
                    }}
                    onEditWorkspaceFile={handleOpenWorkspaceEditor}
                  />
                </>
              ) : (
                  <AgentMarketDetailPane
                  marketItem={selectedMarketItem}
                  marketInstallName={marketInstallName}
                  marketInstalling={marketInstalling}
                  onInstall={() => void handleInstallFromMarket()}
                  onInstallNameChange={setMarketInstallName}
                />
              )}
            </section>
          </div>
        </WorkspacePageScrollArea>
      </WorkspacePageShell>

      {showAddDialog && (
        <AddAgentDialog
          onClose={() => setShowAddDialog(false)}
          onCreate={async (name, modelRef) => {
            setAgentCreateWarning(null);
            const { createdAgentId, warning } = await createAgent(name, modelRef);
            if (createdAgentId) {
              setBrowseMode('agents');
              setActiveAgentId(createdAgentId);
              setDetailTab('persona');
            }
            if (warning) {
              setAgentCreateWarning(warning);
              toast.warning(warning);
            }
            setShowAddDialog(false);
            toast.success(t('toast.agentCreated'));
          }}
        />
      )}

      {settingsAgentId && agents.find((agent) => agent.id === settingsAgentId) ? (
        <AgentSettingsModal
          agent={agents.find((agent) => agent.id === settingsAgentId)!}
          onClose={() => setSettingsAgentId(null)}
        />
      ) : null}

      <ConfirmDialog
        open={!!agentToDelete}
        title={t('deleteDialog.title')}
        message={agentToDelete ? t('deleteDialog.message', { name: agentToDelete.name }) : ''}
        confirmLabel={t('common:actions.delete')}
        cancelLabel={t('common:actions.cancel')}
        variant="destructive"
        onConfirm={async () => {
          if (!agentToDelete) return;
          try {
            await deleteAgent(agentToDelete.id);
            const deletedId = agentToDelete.id;
            setAgentToDelete(null);
            if (resolvedActiveAgentId === deletedId || activeAgentId === deletedId) {
              setActiveAgentId(null);
            }
            if (settingsAgentId === deletedId) {
              setSettingsAgentId(null);
            }
            toast.success(t('toast.agentDeleted'));
          } catch (error) {
            toast.error(t('toast.agentDeleteFailed', { error: String(error) }));
          }
        }}
        onCancel={() => setAgentToDelete(null)}
      />

      <WorkspaceDiscardDialog
        open={confirmDiscardChangesOpen}
        saving={workspaceSaving}
        onCancel={() => {
          setConfirmDiscardChangesOpen(false);
          resetPendingWorkspaceNavigation();
        }}
        onDiscard={applyPendingWorkspaceNavigation}
        onSaveAndContinue={() => void handleSaveWorkspaceFileAndContinue()}
      />

      {workspaceEditorDialogOpen && selectedWorkspaceFile ? (
        <WorkspaceFileEditorDialog
          title={selectedWorkspaceFile.displayName}
          path={selectedWorkspaceFile.relativePath}
          value={workspaceEditorValue}
          dirty={workspaceDirty}
          saving={workspaceSaving}
          onChange={(value) => {
            setWorkspaceEditorValue(value);
            setWorkspaceDirty(value !== workspaceFileContent);
          }}
          onClose={handleCloseWorkspaceEditor}
          onSave={() => void handleSaveWorkspaceFile()}
        />
      ) : null}
    </WorkspacePageFrame>
  );
}

function CreateAgentLauncher({
  open,
  menuRef,
  triggerLabel,
  blankLabel,
  marketLabel,
  onToggle,
  onCreateBlank,
  onInstallFromMarket,
}: {
  open: boolean;
  menuRef: RefObject<HTMLDivElement | null>;
  triggerLabel: string;
  blankLabel: string;
  marketLabel: string;
  onToggle: () => void;
  onCreateBlank: () => void;
  onInstallFromMarket: () => void;
}) {
  return (
    <div ref={menuRef} className="relative">
      <Button
        onClick={onToggle}
        className={cn(workbenchPrimaryToolbarButtonClasses, 'px-4')}
      >
        <Plus className="mr-2 h-3.5 w-3.5" />
        {triggerLabel}
        <ChevronDown className={cn('ml-2 h-3.5 w-3.5 transition-transform', open && 'rotate-180')} />
      </Button>
      {open ? (
        <div className="absolute right-0 top-[calc(100%+8px)] z-20 min-w-[220px] rounded-[16px] border border-border/70 bg-[hsl(var(--surface-elevated)/0.98)] p-2 shadow-[0_14px_40px_rgba(15,23,42,0.08)]">
          <button
            type="button"
            onClick={onCreateBlank}
            className="flex w-full items-center gap-2.5 rounded-[12px] px-3 py-2.5 text-left text-[13px] font-medium text-foreground/84 transition-colors hover:bg-[hsl(var(--surface-hover)/0.46)]"
          >
            <Plus className="h-3.5 w-3.5 text-foreground/60" />
            {blankLabel}
          </button>
          <button
            type="button"
            onClick={onInstallFromMarket}
            className="mt-1 flex w-full items-center gap-2.5 rounded-[12px] px-3 py-2.5 text-left text-[13px] font-medium text-foreground/84 transition-colors hover:bg-[hsl(var(--surface-hover)/0.46)]"
          >
            <FolderUp className="h-3.5 w-3.5 text-foreground/60" />
            {marketLabel}
          </button>
        </div>
      ) : null}
    </div>
  );
}

const inputClasses = fieldInputClasses;
const labelClasses = 'text-[14px] font-semibold text-foreground/80';

function WorkspaceFileEditorDialog({
  title,
  path,
  value,
  dirty,
  saving,
  onChange,
  onClose,
  onSave,
}: {
  title: string;
  path: string;
  value: string;
  dirty: boolean;
  saving: boolean;
  onChange: (value: string) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  const { t } = useTranslation('agents');
  const showPath = path.trim() && path.trim() !== title.trim();

  return (
    <div className="app-modal-overlay fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className={cn(modalSurfaceClasses, 'max-w-3xl overflow-hidden')}>
        <div className="flex items-start justify-between gap-4 border-b border-border/70 px-6 py-5">
          <div>
            <h2 className={modalTitleClasses}>{title}</h2>
            {showPath ? <p className={modalDescriptionClasses}>{path}</p> : null}
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className={dialogIconButtonClasses}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="space-y-5 px-6 py-5">
          <Textarea
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder={t('workbench.persona.noContent')}
            className="min-h-[420px] resize-none rounded-[16px] border-border/55 bg-[hsl(var(--surface-elevated)/0.995)] px-3.5 py-3 text-[12.5px] leading-[1.75] text-foreground/84 shadow-[inset_0_1px_0_rgba(255,255,255,0.76)]"
          />
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={onClose}
              className={dialogActionButtonClasses}
            >
              {t('common:actions.cancel')}
            </Button>
            <Button
              onClick={onSave}
              disabled={saving || !dirty}
              className="h-9 rounded-[12px] px-4 text-[13px] font-medium shadow-none"
            >
              {saving ? t('workbench.persona.saving') : t('workbench.persona.saveAction')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function WorkspaceDiscardDialog({
  open,
  saving,
  onCancel,
  onDiscard,
  onSaveAndContinue,
}: {
  open: boolean;
  saving: boolean;
  onCancel: () => void;
  onDiscard: () => void;
  onSaveAndContinue: () => void;
}) {
  const { t } = useTranslation('agents');

  if (!open) return null;

  return (
    <div className="app-modal-overlay fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className={cn(modalSurfaceClasses, 'max-w-md overflow-hidden')}>
        <div className="flex items-start justify-between gap-4 border-b border-border/70 px-6 py-5">
          <div>
            <h2 className={modalTitleClasses}>{t('workbench.persona.discardDialog.title')}</h2>
            <p className={modalDescriptionClasses}>{t('workbench.persona.discardDialog.message')}</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onCancel} className={dialogIconButtonClasses}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex justify-end gap-2 px-6 py-5">
          <Button
            variant="outline"
            onClick={onCancel}
            disabled={saving}
            className={dialogActionButtonClasses}
          >
            {t('common:actions.cancel')}
          </Button>
          <Button
            variant="outline"
            onClick={onDiscard}
            disabled={saving}
            className={cn(dialogActionButtonClasses, 'hover:bg-destructive/10 hover:text-destructive')}
          >
            {t('workbench.persona.discardDialog.confirm')}
          </Button>
          <Button
            onClick={onSaveAndContinue}
            disabled={saving}
            className="h-9 rounded-[12px] px-4 text-[13px] font-medium shadow-none"
          >
            {saving ? t('workbench.persona.saving') : t('workbench.persona.discardDialog.saveAndContinue')}
          </Button>
        </div>
      </div>
    </div>
  );
}

function AddAgentDialog({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (name: string, modelRef?: string | null) => Promise<void>;
}) {
  const { t } = useTranslation('agents');
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [selectedModelRef, setSelectedModelRef] = useState<string | null>(null);
  const [useDefaultModel, setUseDefaultModel] = useState(true);
  const [modelPickerOpen, setModelPickerOpen] = useState(false);
  const [modelSearchValue, setModelSearchValue] = useState('');
  const modelPickerRef = useRef<HTMLDivElement | null>(null);
  const { models, modelsLoading, modelsLoadError } = useAvailableModelOptions(modelPickerOpen);
  const { placement: createDialogPickerPlacement, listMaxHeight: createDialogListMaxHeight } = usePickerPlacement(modelPickerRef, modelPickerOpen);
  const modelPickerScrollClass =
    typeof window !== 'undefined' && window.electron?.platform === 'win32'
      ? 'subtle-scrollbar-win'
      : 'subtle-scrollbar';

  useEffect(() => {
    if (!modelPickerOpen) {
      return;
    }
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!modelPickerRef.current?.contains(target)) {
        setModelPickerOpen(false);
        setModelSearchValue('');
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setModelPickerOpen(false);
        setModelSearchValue('');
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [modelPickerOpen]);

  const selectedModel = useMemo(
    () => models.find((model) => model.ref === selectedModelRef) ?? null,
    [models, selectedModelRef],
  );
  const filteredModels = useMemo(() => {
    const normalizedQuery = modelSearchValue.trim().toLowerCase();
    if (!normalizedQuery) {
      return models;
    }
    return models.filter((model) =>
      [
        getModelOptionLabel(model),
        getModelOptionHint(model) ?? '',
        model.ref,
        model.modelId ?? '',
        model.vendorId ?? '',
      ]
        .join(' ')
        .toLowerCase()
        .includes(normalizedQuery),
    );
  }, [modelSearchValue, models]);
  const orderedModels = useMemo(() => {
    if (!selectedModelRef) {
      return filteredModels;
    }
    const currentIndex = filteredModels.findIndex((model) => model.ref === selectedModelRef);
    if (currentIndex <= 0) {
      return filteredModels;
    }
    const nextModels = [...filteredModels];
    const [currentModel] = nextModels.splice(currentIndex, 1);
    return currentModel ? [currentModel, ...nextModels] : filteredModels;
  }, [filteredModels, selectedModelRef]);
  const currentModelLabel = useMemo(() => {
    if (useDefaultModel) {
      return t('createDialog.useDefaultModel');
    }
    if (selectedModel) {
      return getModelOptionLabel(selectedModel);
    }
    if (selectedModelRef?.trim()) {
      const parts = selectedModelRef.trim().split('/');
      return parts[parts.length - 1] || selectedModelRef.trim();
    }
    return t('createDialog.modelLabel');
  }, [selectedModel, selectedModelRef, t, useDefaultModel]);

  const handleSubmit = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await onCreate(name.trim(), useDefaultModel ? null : (selectedModelRef?.trim() || null));
    } catch (error) {
      toast.error(t('toast.agentCreateFailed', { error: String(error) }));
      setSaving(false);
      return;
    }
    setSaving(false);
  };

  return (
    <div className="app-modal-overlay fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className={cn(modalSurfaceClasses, 'max-w-lg overflow-visible')}>
        <div className="flex items-start justify-between gap-4 border-b border-border/70 px-6 py-5">
          <div>
            <h2 className={modalTitleClasses}>{t('createDialog.title')}</h2>
            <p className={modalDescriptionClasses}>{t('createDialog.description')}</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className={dialogIconButtonClasses}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="space-y-5 px-6 py-5">
          <div className="space-y-2.5">
            <Label htmlFor="agent-name" className={labelClasses}>{t('createDialog.nameLabel')}</Label>
            <Input
              id="agent-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={t('createDialog.namePlaceholder')}
              className={inputClasses}
            />
          </div>
          <div className="space-y-1.5">
            <p className="text-[11px] font-medium text-muted-foreground/72">
              {t('createDialog.modelLabel')}
            </p>
            <div ref={modelPickerRef} className="relative z-30">
              <Button
                type="button"
                variant="outline"
                onClick={() => setModelPickerOpen((open) => {
                  if (open) {
                    setModelSearchValue('');
                  }
                  return !open;
                })}
                disabled={saving}
                className="h-10 w-full justify-between rounded-[12px] border-border/70 bg-[hsl(var(--surface-elevated)/0.96)] px-3 text-left text-[13px] font-medium text-foreground shadow-none transition-colors hover:bg-[hsl(var(--surface-hover)/0.42)]"
              >
                <span className="truncate">{currentModelLabel}</span>
                <ChevronDown className="ml-2 h-3.5 w-3.5 shrink-0 text-foreground/48" />
              </Button>
              {modelPickerOpen ? (
                <div
                  className={cn(
                    'absolute left-0 z-40 w-full overflow-hidden rounded-[14px] border border-border/70 bg-[hsl(var(--surface-elevated)/1)] p-1.5 shadow-[0_18px_42px_rgba(15,23,42,0.12)]',
                    createDialogPickerPlacement === 'top' ? 'bottom-full mb-2' : 'top-full mt-2',
                  )}
                >
                  <div className="px-2 pb-2">
                    <div className="relative">
                      <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/55" />
                      <input
                        aria-label={t('createDialog.modelSearchPlaceholder')}
                        value={modelSearchValue}
                        placeholder={t('createDialog.modelSearchPlaceholder')}
                        onChange={(event) => setModelSearchValue(event.target.value)}
                        className="h-8 w-full rounded-[10px] border border-border/65 bg-[hsl(var(--surface-panel)/0.95)] pl-8.5 pr-3 text-[12px] text-foreground outline-none placeholder:text-foreground/36 focus:border-ring/55"
                      />
                    </div>
                  </div>
                  <div className={cn('overflow-y-auto pr-0.5', modelPickerScrollClass)} style={{ maxHeight: `${createDialogListMaxHeight}px` }}>
                    <button
                      type="button"
                      onClick={() => {
                        setUseDefaultModel(true);
                        setModelPickerOpen(false);
                        setModelSearchValue('');
                      }}
                      className={cn(
                        'flex w-full items-center justify-between rounded-[10px] px-3 py-2 text-left transition-[background-color,color] hover:bg-[hsl(var(--foreground)/0.032)]',
                        useDefaultModel && 'bg-[hsl(var(--foreground)/0.032)]',
                      )}
                    >
                      <span className="text-[12.5px] font-medium text-foreground/92">{t('createDialog.useDefaultModel')}</span>
                    </button>
                    {modelsLoading ? (
                      <div className="px-3 py-6 text-center text-[12px] text-muted-foreground">
                        {t('createDialog.modelsLoading')}
                      </div>
                    ) : null}
                    {!modelsLoading && modelsLoadError ? (
                      <div className="px-3 py-6 text-center text-[12px] text-destructive">
                        {t('createDialog.modelsLoadFailed')}
                      </div>
                    ) : null}
                    {!modelsLoading && !modelsLoadError
                      ? orderedModels.map((model) => (
                          <button
                            key={model.ref}
                            type="button"
                            onClick={() => {
                              setSelectedModelRef(model.ref);
                              setUseDefaultModel(false);
                              setModelPickerOpen(false);
                              setModelSearchValue('');
                            }}
                            className={cn(
                              'flex w-full flex-col items-start rounded-[10px] px-3 py-2 text-left transition-[background-color,color] hover:bg-[hsl(var(--foreground)/0.032)]',
                              !useDefaultModel && model.ref === selectedModelRef && 'bg-[hsl(var(--foreground)/0.032)]',
                            )}
                          >
                            <span className="text-[12.5px] font-medium text-foreground/92">{getModelOptionLabel(model)}</span>
                            {getModelOptionHint(model) ? (
                              <span className="text-[10.5px] text-muted-foreground/72">{getModelOptionHint(model)}</span>
                            ) : null}
                          </button>
                        ))
                      : null}
                    {!modelsLoading && !modelsLoadError && models.length === 0 ? (
                      <div className="px-3 py-6 text-center text-[12px] text-muted-foreground">
                        {t('createDialog.modelsEmpty')}
                      </div>
                    ) : null}
                    {!modelsLoading && !modelsLoadError && models.length > 0 && orderedModels.length === 0 ? (
                      <div className="px-3 py-6 text-center text-[12px] text-muted-foreground">
                        {t('createDialog.modelsEmptySearch')}
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={onClose}
              className={dialogActionButtonClasses}
            >
              {t('common:actions.cancel')}
            </Button>
            <Button
              onClick={() => void handleSubmit()}
              disabled={saving || !name.trim() || (!useDefaultModel && !selectedModelRef)}
              className="h-9 rounded-[12px] px-4 text-[13px] font-medium shadow-none"
            >
              {saving ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  {t('creating')}
                </>
              ) : (
                t('common:actions.save')
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function AgentSettingsModal({
  agent,
  onClose,
}: {
  agent: AgentSummary;
  onClose: () => void;
}) {
  const { t } = useTranslation('agents');
  const { updateAgent } = useAgentsStore();
  const [name, setName] = useState(agent.name);
  const [selectedModelRef, setSelectedModelRef] = useState<string | null>(getPersistedAgentModelRef(agent));
  const [useDefaultModel, setUseDefaultModel] = useState(getPersistedAgentModelRef(agent) === null);
  const [modelPickerOpen, setModelPickerOpen] = useState(false);
  const [modelSearchValue, setModelSearchValue] = useState('');
  const [savingSettings, setSavingSettings] = useState(false);
  const modelPickerRef = useRef<HTMLDivElement | null>(null);
  const persistedModelRef = getPersistedAgentModelRef(agent);
  const { models, modelsLoading, modelsLoadError } = useAvailableModelOptions(modelPickerOpen);
  const { placement: settingsPickerPlacement, listMaxHeight: settingsListMaxHeight } = usePickerPlacement(modelPickerRef, modelPickerOpen);
  const modelPickerScrollClass =
    typeof window !== 'undefined' && window.electron?.platform === 'win32'
      ? 'subtle-scrollbar-win'
      : 'subtle-scrollbar';

  useEffect(() => {
    setName(agent.name);
    setSelectedModelRef(persistedModelRef);
    setUseDefaultModel(persistedModelRef === null);
    setModelPickerOpen(false);
    setModelSearchValue('');
  }, [agent.name, persistedModelRef]);

  useEffect(() => {
    if (!modelPickerOpen) {
      return;
    }
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!modelPickerRef.current?.contains(target)) {
        setModelPickerOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setModelPickerOpen(false);
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [modelPickerOpen]);

  useEffect(() => {
    if (modelPickerOpen) {
      return;
    }
    setModelSearchValue('');
  }, [modelPickerOpen]);

  const selectedModel = useMemo(
    () => models.find((model) => model.ref === selectedModelRef) ?? null,
    [models, selectedModelRef],
  );
  const filteredModels = useMemo(() => {
    const normalizedQuery = modelSearchValue.trim().toLowerCase();
    if (!normalizedQuery) {
      return models;
    }
    return models.filter((model) =>
      [
        getModelOptionLabel(model),
        getModelOptionHint(model) ?? '',
        model.ref,
        model.modelId ?? '',
        model.vendorId ?? '',
      ]
        .join(' ')
        .toLowerCase()
        .includes(normalizedQuery),
    );
  }, [modelSearchValue, models]);
  const orderedModels = useMemo(() => {
    if (!selectedModelRef) {
      return filteredModels;
    }
    const currentIndex = filteredModels.findIndex((model) => model.ref === selectedModelRef);
    if (currentIndex <= 0) {
      return filteredModels;
    }
    const nextModels = [...filteredModels];
    const [currentModel] = nextModels.splice(currentIndex, 1);
    return currentModel ? [currentModel, ...nextModels] : filteredModels;
  }, [filteredModels, selectedModelRef]);
  const currentModelLabel = useMemo(() => {
    if (useDefaultModel) {
      return agent.modelDisplay;
    }
    if (selectedModel) {
      return getModelOptionLabel(selectedModel);
    }
    if (selectedModelRef?.trim()) {
      const parts = selectedModelRef.trim().split('/');
      return parts[parts.length - 1] || selectedModelRef.trim();
    }
    return agent.modelDisplay;
  }, [agent.modelDisplay, selectedModel, selectedModelRef, useDefaultModel]);
  const trimmedName = name.trim() || agent.name;
  const nextModelRef = useDefaultModel ? null : (selectedModelRef?.trim() || null);
  const hasChanges = trimmedName !== agent.name || nextModelRef !== persistedModelRef;

  const handleSaveSettings = async () => {
    if (!hasChanges) {
      onClose();
      return;
    }
    setSavingSettings(true);
    try {
      const result = await updateAgent(agent.id, {
        name: trimmedName,
        modelRef: nextModelRef,
      });
      toast.success(t(result.applyingRuntime ? 'toast.agentUpdatedApplying' : 'toast.agentUpdated'));
      onClose();
    } catch (error) {
      toast.error(t('toast.agentUpdateFailed', { error: String(error) }));
    } finally {
      setSavingSettings(false);
    }
  };

  return (
    <div className="app-modal-overlay fixed inset-0 z-50 flex items-center justify-center p-4">
      <Card className={cn(modalSurfaceClasses, 'max-h-[90vh] max-w-2xl flex flex-col overflow-visible')}>
        <CardHeader className="flex flex-row items-start justify-between border-b border-border/70 px-6 py-5 shrink-0">
          <div>
            <CardTitle className={modalTitleClasses}>
              {t('settingsDialog.title', { name: agent.name })}
            </CardTitle>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className={dialogIconButtonClasses}
          >
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="flex-1 space-y-4 overflow-visible px-6 py-5">
          <div className="space-y-3.5">
            <div className="space-y-2.5">
              <Label htmlFor="agent-settings-name" className={labelClasses}>{t('settingsDialog.nameLabel')}</Label>
              <Input
                id="agent-settings-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                readOnly={agent.isDefault}
                className={fieldInputClasses}
              />
            </div>

            <div className="grid gap-3 md:grid-cols-[136px_minmax(0,1fr)] md:items-end">
              <div className="space-y-1.5">
                <p className="text-[11px] font-medium text-muted-foreground/72">
                  {t('settingsDialog.agentIdLabel')}
                </p>
                <div className="flex h-10 items-center rounded-[12px] border border-border/60 bg-[hsl(var(--surface-panel)/0.6)] px-3 text-[12.5px] text-foreground/84">
                  <span className="font-mono">{agent.id}</span>
                </div>
              </div>
              <div className="space-y-1.5">
                <p className="text-[11px] font-medium text-muted-foreground/72">
                  {t('settingsDialog.modelLabel')}
                </p>
                <div ref={modelPickerRef} className="relative z-30">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setModelPickerOpen((open) => !open)}
                    disabled={savingSettings}
                    className="h-10 w-full justify-between rounded-[12px] border-border/70 bg-[hsl(var(--surface-elevated)/0.96)] px-3 text-left text-[13px] font-medium text-foreground shadow-none transition-colors hover:bg-[hsl(var(--surface-hover)/0.42)]"
                  >
                    <span className="truncate">{currentModelLabel}</span>
                    <ChevronDown className="ml-2 h-3.5 w-3.5 shrink-0 text-foreground/48" />
                  </Button>
                  {modelPickerOpen ? (
                    <div
                      className={cn(
                        'absolute left-0 z-40 w-full overflow-hidden rounded-[14px] border border-border/70 bg-[hsl(var(--surface-elevated)/1)] p-1.5 shadow-[0_18px_42px_rgba(15,23,42,0.12)]',
                        settingsPickerPlacement === 'top' ? 'bottom-full mb-2' : 'top-full mt-2',
                      )}
                    >
                      <div className="px-2 pb-2">
                        <div className="relative">
                          <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/55" />
                          <input
                            aria-label={t('settingsDialog.modelSearchPlaceholder')}
                            value={modelSearchValue}
                            placeholder={t('settingsDialog.modelSearchPlaceholder')}
                            onChange={(event) => setModelSearchValue(event.target.value)}
                            className="h-8 w-full rounded-[10px] border border-border/65 bg-[hsl(var(--surface-panel)/0.95)] pl-8.5 pr-3 text-[12px] text-foreground outline-none placeholder:text-foreground/36 focus:border-ring/55"
                          />
                        </div>
                      </div>
                      <div className={cn('overflow-y-auto pr-0.5', modelPickerScrollClass)} style={{ maxHeight: `${settingsListMaxHeight}px` }}>
                        <button
                          type="button"
                          onClick={() => {
                            setUseDefaultModel(true);
                            setModelPickerOpen(false);
                          }}
                          className={cn(
                            'flex w-full items-center justify-between rounded-[10px] px-3 py-2 text-left transition-[background-color,color] hover:bg-[hsl(var(--foreground)/0.032)]',
                            useDefaultModel && 'bg-[hsl(var(--foreground)/0.032)]',
                          )}
                        >
                          <span className="text-[12.5px] font-medium text-foreground/92">{t('settingsDialog.useDefaultModel')}</span>
                        </button>
                        {modelsLoading ? (
                          <div className="px-3 py-6 text-center text-[12px] text-muted-foreground">
                            {t('settingsDialog.modelsLoading')}
                          </div>
                        ) : null}
                        {!modelsLoading && modelsLoadError ? (
                          <div className="px-3 py-6 text-center text-[12px] text-destructive">
                            {t('settingsDialog.modelsLoadFailed')}
                          </div>
                        ) : null}
                        {!modelsLoading && !modelsLoadError
                          ? orderedModels.map((model) => (
                              <button
                                key={model.ref}
                                type="button"
                                onClick={() => {
                                  setSelectedModelRef(model.ref);
                                  setUseDefaultModel(false);
                                  setModelPickerOpen(false);
                                }}
                                className={cn(
                                  'flex w-full flex-col items-start rounded-[10px] px-3 py-2 text-left transition-[background-color,color] hover:bg-[hsl(var(--foreground)/0.032)]',
                                  !useDefaultModel && model.ref === selectedModelRef && 'bg-[hsl(var(--foreground)/0.032)]',
                                )}
                              >
                                <span className="text-[12.5px] font-medium text-foreground/92">{getModelOptionLabel(model)}</span>
                                {getModelOptionHint(model) ? (
                                  <span className="text-[10.5px] text-muted-foreground/72">{getModelOptionHint(model)}</span>
                                ) : null}
                              </button>
                            ))
                          : null}
                        {!modelsLoading && !modelsLoadError && models.length === 0 ? (
                          <div className="px-3 py-6 text-center text-[12px] text-muted-foreground">
                            {t('settingsDialog.modelsEmpty')}
                          </div>
                        ) : null}
                        {!modelsLoading && !modelsLoadError && models.length > 0 && orderedModels.length === 0 ? (
                          <div className="px-3 py-6 text-center text-[12px] text-muted-foreground">
                            {t('settingsDialog.modelsEmptySearch')}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>

        </CardContent>
        <div className="flex shrink-0 items-center justify-end gap-2 border-t border-border/70 px-6 py-4">
          <Button variant="outline" onClick={onClose} className={dialogActionButtonClasses}>
            {t('common:actions.cancel')}
          </Button>
          <Button
            onClick={() => void handleSaveSettings()}
            disabled={savingSettings || !trimmedName || !hasChanges || (!useDefaultModel && !nextModelRef)}
            className="h-9 rounded-[12px] px-4 text-[13px] font-medium shadow-none"
          >
            {savingSettings ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                {t('settingsDialog.savingAndApplying')}
              </>
            ) : (
              t('settingsDialog.saveAndApply')
            )}
          </Button>
        </div>
      </Card>
    </div>
  );
}

export default Agents;
