import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { RefreshCw, AlertCircle, Search, PlugZap, CheckCircle2, CircleOff, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Input } from '@/components/ui/input';
import { useGatewayStore } from '@/stores/gateway';
import {
  WorkspacePageFrame,
  WorkspacePageLoading,
  WorkspacePageScrollArea,
  WorkspacePageShell,
} from '@/components/layout/WorkspacePage';
import { WorkbenchHeader } from '@/components/layout/WorkbenchHeader';
import { WorkbenchHeaderActions } from '@/components/layout/WorkbenchHeaderActions';
import { WorkbenchHeaderTitleBlock } from '@/components/layout/WorkbenchHeaderTitleBlock';
import { WorkbenchSummaryStrip } from '@/components/layout/WorkbenchSummaryStrip';
import { workbenchToolbarButtonClasses } from '@/components/layout/workbench-button-styles';
import { hostApiFetch } from '@/lib/host-api';
import { subscribeHostEvent } from '@/lib/host-events';
import { ChannelConfigModal } from '@/components/channels/ChannelConfigModal';
import { ChannelIcon } from '@/components/channels/ChannelIcon';
import { ChannelEntryBoard } from '@/components/channels/ChannelEntryBoard';
import { ChannelFocusWorkspace } from '@/components/channels/ChannelFocusWorkspace';
import { ChannelAccountList } from '@/components/channels/ChannelAccountList';
import { ChannelConfigEditor } from '@/components/channels/ChannelConfigEditor';
import { getChannelBoardColumnCount, getChannelCenterLayoutMode } from '@/lib/channel-center-layout';
import { CHANNEL_FIELD_REGISTRY, V1_CHANNEL_REGISTRY_ORDER } from '@/lib/channel-registry';
import { generateUuid } from '@/lib/uuid';
import { cn } from '@/lib/utils';
import { evaluateWeixinGuardian, type WeixinGuardianEvaluation } from '../../../shared/weixin-guardian';
import {
  CHANNEL_META,
  getPrimaryChannels,
  type ChannelType,
  type ChannelConfigContractField,
  type ChannelConfigContractSection,
} from '@/types/channel';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

interface ChannelAccountItem {
  accountId: string;
  name: string;
  configured: boolean;
  status: 'connected' | 'connecting' | 'disconnected' | 'error';
  enabled: boolean;
  lastError?: string;
  lastConnectedAt?: number | null;
  lastInboundAt?: number | null;
  lastOutboundAt?: number | null;
  isDefault: boolean;
  agentId?: string;
}

interface ChannelGroupItem {
  channelType: string;
  defaultAccountId: string;
  enabled: boolean;
  status: 'connected' | 'connecting' | 'disconnected' | 'error';
  accounts: ChannelAccountItem[];
}

interface AgentItem {
  id: string;
  name: string;
}

interface ChannelAccountsResponse {
  success: boolean;
  channels?: ChannelGroupItem[];
  runtimeAvailable?: boolean;
  gatewayState?: string;
  error?: string;
}

interface DeleteTarget {
  channelType: string;
  accountId?: string;
}

type PendingNavigationTarget =
  | { kind: 'selection'; channelType: ChannelType; accountId?: string }
  | { kind: 'board' };

type RegistryChannelType = keyof typeof CHANNEL_FIELD_REGISTRY;
type EditorValue = string | boolean | number | string[];
const FALLBACK_ACCOUNT_ID = 'default';

const paneSurfaceClass = 'app-pane-surface min-w-0 rounded-xl border border-[hsl(var(--border-subtle)/0.82)] bg-[hsl(var(--surface-elevated)/0.98)] shadow-none';
const searchFieldClass = 'app-field-surface workbench-motion-control h-8 rounded-md border border-[hsl(var(--border-subtle)/0.48)] bg-[hsl(var(--surface-panel)/0.86)] pl-9 text-[12.5px] shadow-sm placeholder:text-muted-foreground/52 hover:border-[hsl(var(--border-subtle)/0.72)] hover:bg-[hsl(var(--surface-elevated)/0.98)] focus-visible:border-[hsl(var(--border-strong)/0.52)] focus-visible:bg-[hsl(var(--surface-elevated)/1)] focus-visible:ring-0';
const railRowClass = 'workbench-motion-card group w-full rounded-md border border-transparent px-2.5 py-1.5 text-left select-none';
const selectedRailCardClass = 'border-transparent bg-[hsl(var(--surface-active))] text-foreground shadow-none font-medium';
const idleRailCardClass = 'bg-transparent hover:bg-[hsl(var(--surface-hover))]';
const railIconClass = 'flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-transparent bg-transparent shadow-none';
const railMetaBadgeClass = 'inline-flex shrink-0 items-center rounded-sm border border-transparent bg-[hsl(var(--foreground)/0.035)] px-1.5 py-0.5 text-[10px] font-medium leading-none text-foreground/62 select-none';
const railStateBadgeClass = 'inline-flex shrink-0 items-center rounded-sm border border-transparent bg-[hsl(var(--surface-elevated)/0.98)] px-2 py-0.5 text-[10px] font-medium leading-none text-foreground/68 select-none';
const sectionLabelClass = 'px-0.5 text-[10px] font-semibold uppercase tracking-[0.09em] text-muted-foreground/52';
function isRegistryChannelType(channelType: string): channelType is RegistryChannelType {
  return channelType in CHANNEL_FIELD_REGISTRY;
}

function isWeixinChannel(channelType: ChannelType | null | undefined): channelType is 'openclaw-weixin' {
  return channelType === 'openclaw-weixin';
}

function removeDeletedTarget(groups: ChannelGroupItem[], target: DeleteTarget): ChannelGroupItem[] {
  if (target.accountId) {
    return groups
      .map((group) => {
        if (group.channelType !== target.channelType) return group;
        return {
          ...group,
          accounts: group.accounts.filter((account) => account.accountId !== target.accountId),
        };
      })
      .filter((group) => group.accounts.length > 0);
  }

  return groups.filter((group) => group.channelType !== target.channelType);
}

function isStringArrayValue(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function getEditorStringValue(editorValues: Record<string, EditorValue>, key: string): string {
  const value = editorValues[key];
  return typeof value === 'string' ? value.trim() : '';
}

function hasEditorValue(editorValues: Record<string, EditorValue>, key: string): boolean {
  const value = editorValues[key];
  if (typeof value === 'string') return value.trim().length > 0;
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value === 'boolean') return value;
  return isStringArrayValue(value) && value.some((item) => item.trim().length > 0);
}

function shouldShowFieldForChannel(
  channelType: ChannelType | null,
  field: ChannelConfigContractField,
  editorValues: Record<string, EditorValue>,
): boolean {
  if (channelType !== 'wecom' && channelType !== 'feishu') {
    return true;
  }

  if (field.key === 'allowFrom') {
    return getEditorStringValue(editorValues, 'dmPolicy') === 'allowlist' || hasEditorValue(editorValues, 'allowFrom');
  }

  if (field.key === 'groupAllowFrom') {
    return getEditorStringValue(editorValues, 'groupPolicy') === 'allowlist' || hasEditorValue(editorValues, 'groupAllowFrom');
  }

  if (field.key === 'requireMention') {
    return getEditorStringValue(editorValues, 'groupPolicy') !== 'disabled' || editorValues.requireMention === true;
  }

  return true;
}

function getVisibleSection(
  channelType: ChannelType | null,
  section: ChannelConfigContractSection,
  editorValues: Record<string, EditorValue>,
): ChannelConfigContractSection | null {
  const fields = section.fields.filter((field) => shouldShowFieldForChannel(channelType, field, editorValues));
  if (fields.length === 0) {
    return null;
  }
  return {
    ...section,
    fields,
  };
}

function cloneEditorValue(value: EditorValue): EditorValue {
  return isStringArrayValue(value) ? [...value] : value;
}

function cloneEditorValues(values: Record<string, EditorValue>): Record<string, EditorValue> {
  return Object.fromEntries(Object.entries(values).map(([key, value]) => [key, cloneEditorValue(value)]));
}

function toComparableEditorValues(values: Record<string, EditorValue>): Record<string, string> {
  const next: Record<string, string> = {};
  for (const [key, value] of Object.entries(values)) {
    if (typeof value === 'string') {
      const normalized = value.trim();
      if (normalized) {
        next[key] = normalized;
      }
      continue;
    }
    if (typeof value === 'boolean' || typeof value === 'number') {
      next[key] = String(value);
      continue;
    }
    if (isStringArrayValue(value)) {
      const normalized = value.map((item) => item.trim()).filter(Boolean);
      if (normalized.length > 0) {
        next[key] = normalized.join('\n');
      }
    }
  }
  return next;
}

function areEditorValuesEqual(left: Record<string, EditorValue>, right: Record<string, EditorValue>): boolean {
  const current = toComparableEditorValues(left);
  const baseline = toComparableEditorValues(right);
  const keys = new Set([...Object.keys(current), ...Object.keys(baseline)]);
  for (const key of keys) {
    if ((current[key] ?? '') !== (baseline[key] ?? '')) {
      return false;
    }
  }
  return true;
}

function getChannelStatusTone(status: ChannelGroupItem['status'] | ChannelAccountItem['status']): string {
  switch (status) {
    case 'connected':
      return 'status-indicator status-indicator-connected status-indicator-glow';
    case 'connecting':
      return 'status-indicator status-indicator-connecting status-indicator-glow';
    case 'error':
      return 'status-indicator status-indicator-error status-indicator-glow';
    default:
      return 'status-indicator status-indicator-disconnected status-indicator-glow';
  }
}

function getRuntimeAwareStatusTone(
  status: ChannelGroupItem['status'] | ChannelAccountItem['status'],
  runtimeAvailable: boolean,
): string {
  return runtimeAvailable ? getChannelStatusTone(status) : 'status-indicator status-indicator-runtime status-indicator-glow';
}

function getRuntimeAwareStatusLabel(
  status: ChannelGroupItem['status'] | ChannelAccountItem['status'],
  runtimeAvailable: boolean,
  t: (key: string, options?: Record<string, unknown>) => string,
): string {
  return runtimeAvailable ? t(`account.connectionStatus.${status}`) : t('account.connectionStatus.runtimeUnavailable');
}

function getConfiguredChannelRailTone(enabled: boolean): string {
  return enabled
    ? 'status-indicator status-indicator-connected status-indicator-glow'
    : 'status-indicator status-indicator-idle';
}

function getChannelCardIndicatorTone(
  status: ChannelGroupItem['status'],
  runtimeAvailable: boolean,
): string {
  if (!runtimeAvailable) {
    return 'status-indicator status-indicator-runtime';
  }

  switch (status) {
    case 'connected':
      return 'status-indicator status-indicator-connected';
    case 'connecting':
      return 'status-indicator status-indicator-connecting';
    case 'error':
      return 'status-indicator status-indicator-error';
    default:
      return 'status-indicator status-indicator-disconnected';
  }
}

function getChannelConnectionLabel(channelType: ChannelType, t: (key: string) => string): string {
  switch (CHANNEL_META[channelType].connectionType) {
    case 'qr':
      return t('dialog.qrCode');
    case 'webhook':
      return 'Webhook';
    case 'oauth':
      return 'OAuth';
    default:
      return t('dialog.token');
  }
}

function getChannelEntryDescription(channelType: ChannelType, t: (key: string) => string): string {
  const entryBlurbKey = `meta.${channelType}.entryBlurb`;
  const entryBlurb = t(entryBlurbKey);
  if (entryBlurb !== entryBlurbKey) {
    return entryBlurb;
  }
  return t(CHANNEL_META[channelType].description.replace('channels:', ''));
}

function getWeixinGuardianTone(evaluation: WeixinGuardianEvaluation | null): string {
  if (!evaluation) {
    return 'border-[hsl(var(--border-subtle)/0.58)] bg-transparent text-muted-foreground';
  }
  if (evaluation.level === 'expired') {
    return 'border-destructive/30 bg-destructive/10 text-destructive';
  }
  if (evaluation.level === 'warning') {
    return 'border-[hsl(var(--warning))/0.26] bg-[hsl(var(--warning))/0.1] text-[hsl(var(--warning))]';
  }
  return 'border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-300';
}

function getWeixinGuardianMessageKey(evaluation: WeixinGuardianEvaluation | null, enabled: boolean): string {
  if (!enabled) {
    return 'weixin.guardian.disabled';
  }
  if (!evaluation) {
    return 'weixin.guardian.disabled';
  }
  if (evaluation.reason === 'runtime-error') {
    return 'weixin.guardian.expiredError';
  }
  if (evaluation.level === 'expired') {
    return 'weixin.guardian.expiredIdle';
  }
  if (evaluation.level === 'warning') {
    return 'weixin.guardian.warningIdle';
  }
  return 'weixin.guardian.healthy';
}

export function Channels() {
  const { t } = useTranslation('channels');
  const gatewayStatus = useGatewayStore((state) => state.status);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const lastGatewayStateRef = useRef(gatewayStatus.state);
  const runtimeRetryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [runtimeAvailable, setRuntimeAvailable] = useState(true);
  const [runtimeGatewayState, setRuntimeGatewayState] = useState<string>('stopped');
  const [channelGroups, setChannelGroups] = useState<ChannelGroupItem[]>([]);
  const [agents, setAgents] = useState<AgentItem[]>([]);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [showEntryBoard, setShowEntryBoard] = useState(true);
  const [selectedChannelType, setSelectedChannelType] = useState<ChannelType | null>(null);
  const [selectedAccountId, setSelectedAccountId] = useState<string | undefined>(undefined);
  const [allowExistingConfigInModal, setAllowExistingConfigInModal] = useState(true);
  const [allowEditAccountIdInModal, setAllowEditAccountIdInModal] = useState(false);
  const [existingAccountIdsForModal, setExistingAccountIdsForModal] = useState<string[]>([]);
  const [initialAgentIdForModal, setInitialAgentIdForModal] = useState<string | undefined>(undefined);
  const [initialConfigValuesForModal, setInitialConfigValuesForModal] = useState<Record<string, string> | undefined>(undefined);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [boardQuery, setBoardQuery] = useState('');
  const [railQuery, setRailQuery] = useState('');
  const [containerWidth, setContainerWidth] = useState(() => (typeof window !== 'undefined' ? window.innerWidth : 0));
  const [accountIdDraft, setAccountIdDraft] = useState('');
  const [editorValues, setEditorValues] = useState<Record<string, EditorValue>>({});
  const [loadedEditorValues, setLoadedEditorValues] = useState<Record<string, EditorValue>>({});
  const [editorLoading, setEditorLoading] = useState(false);
  const [editorSaving, setEditorSaving] = useState(false);
  const [editorValidating, setEditorValidating] = useState(false);
  const [editorTogglingEnabled, setEditorTogglingEnabled] = useState(false);
  const [weixinGuardianEnabled, setWeixinGuardianEnabled] = useState(false);
  const [weixinGuardianLoading, setWeixinGuardianLoading] = useState(false);
  const [weixinGuardianSaving, setWeixinGuardianSaving] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<PendingNavigationTarget | null>(null);
  const [editorValidation, setEditorValidation] = useState<{
    valid: boolean;
    errors: string[];
    warnings: string[];
  } | null>(null);

  const displayedChannelTypes = useMemo(
    () => Array.from(new Set<ChannelType>([...V1_CHANNEL_REGISTRY_ORDER, ...getPrimaryChannels()])),
    [],
  );

  const fetchPageData = useCallback(async (options?: { probe?: boolean; silent?: boolean }) => {
    const probe = options?.probe === true;
    const silent = options?.silent === true;
    if (runtimeRetryTimerRef.current) {
      clearTimeout(runtimeRetryTimerRef.current);
      runtimeRetryTimerRef.current = null;
    }
    if (!silent) {
      setLoading(true);
    }
    setError(null);
    try {
      const channelsPath = probe ? '/api/channels/accounts?probe=1' : '/api/channels/accounts';
      const [channelsRes, agentsRes] = await Promise.all([
        hostApiFetch<ChannelAccountsResponse>(channelsPath),
        hostApiFetch<{ success: boolean; agents?: AgentItem[]; error?: string }>('/api/agents'),
      ]);

      if (!channelsRes.success) {
        throw new Error(channelsRes.error || 'Failed to load channels');
      }

      if (!agentsRes.success) {
        throw new Error(agentsRes.error || 'Failed to load agents');
      }

      const nextChannelGroups = channelsRes.channels || [];
      const nextConfiguredTypes = nextChannelGroups.map((group) => group.channelType as ChannelType);
      const nextExtraConfiguredTypes = nextConfiguredTypes.filter((type) => !displayedChannelTypes.includes(type));
      const nextAllChannelTypes = [...displayedChannelTypes, ...nextExtraConfiguredTypes];
      const preferredChannel = nextConfiguredTypes[0] ?? nextAllChannelTypes[0] ?? null;

      setChannelGroups(nextChannelGroups);
      setRuntimeAvailable(channelsRes.runtimeAvailable !== false);
      setRuntimeGatewayState(channelsRes.gatewayState || gatewayStatus.state);
      setAgents(agentsRes.agents || []);
      setSelectedChannelType((current) => {
        if (current && nextAllChannelTypes.includes(current)) {
          return current;
        }
        return current === null ? null : preferredChannel;
      });

      if (
        channelsRes.runtimeAvailable === false
        && (gatewayStatus.state === 'running' || gatewayStatus.state === 'starting')
      ) {
        runtimeRetryTimerRef.current = setTimeout(() => {
          runtimeRetryTimerRef.current = null;
          void fetchPageData({ silent: true });
        }, 1500);
      }
    } catch (fetchError) {
      setError(String(fetchError));
    } finally {
      if (!silent) {
        setLoading(false);
      }
      if (probe) {
        setRefreshing(false);
      }
    }
  }, [displayedChannelTypes, gatewayStatus.state]);

  useEffect(() => {
    void fetchPageData();
  }, [fetchPageData]);

  useEffect(() => {
    return () => {
      if (runtimeRetryTimerRef.current) {
        clearTimeout(runtimeRetryTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const node = contentRef.current;
    const updateWidth = (nextWidth?: number) => {
      const fallbackWidth = typeof window !== 'undefined' ? window.innerWidth : 0;
      setContainerWidth(Math.max(Math.round(nextWidth ?? node?.clientWidth ?? fallbackWidth), 0));
    };

    updateWidth();

    const handleResize = () => updateWidth();
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', handleResize);
    }

    if (!node || typeof ResizeObserver === 'undefined') {
      return () => {
        if (typeof window !== 'undefined') {
          window.removeEventListener('resize', handleResize);
        }
      };
    }

    const observer = new ResizeObserver((entries) => {
      updateWidth(entries[0]?.contentRect.width);
    });

    observer.observe(node);

    return () => {
      observer.disconnect();
      if (typeof window !== 'undefined') {
        window.removeEventListener('resize', handleResize);
      }
    };
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeHostEvent('gateway:channel-status', () => {
      void fetchPageData({ silent: true });
    });
    return () => {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, [fetchPageData]);

  useEffect(() => {
    const previousGatewayState = lastGatewayStateRef.current;
    lastGatewayStateRef.current = gatewayStatus.state;

    if (previousGatewayState !== 'running' && gatewayStatus.state === 'running') {
      void fetchPageData({ silent: true });
    }
  }, [fetchPageData, gatewayStatus.state]);

  const configuredTypes = useMemo(
    () => channelGroups.map((group) => group.channelType),
    [channelGroups],
  );

  const groupedByType = useMemo(() => {
    return Object.fromEntries(channelGroups.map((group) => [group.channelType, group]));
  }, [channelGroups]);

  const unsupportedGroups = displayedChannelTypes.filter((type) => !configuredTypes.includes(type));
  const allChannelTypes = useMemo(() => {
    const extraConfiguredTypes = channelGroups
      .map((group) => group.channelType as ChannelType)
      .filter((type) => !displayedChannelTypes.includes(type));
    return [...displayedChannelTypes, ...extraConfiguredTypes];
  }, [channelGroups, displayedChannelTypes]);
  const selectedGroup = selectedChannelType ? groupedByType[selectedChannelType] : undefined;
  const selectedMeta = selectedChannelType ? CHANNEL_META[selectedChannelType] : null;
  const selectedRegistry = selectedChannelType && isRegistryChannelType(selectedChannelType)
    ? CHANNEL_FIELD_REGISTRY[selectedChannelType]
    : null;
  const visibleAdvancedSections = useMemo(() => {
    if (!selectedRegistry) return [] as ChannelConfigContractSection[];
    return selectedRegistry.advancedSections
      .map((section) => getVisibleSection(selectedChannelType, section, editorValues))
      .filter((section): section is ChannelConfigContractSection => Boolean(section));
  }, [editorValues, selectedChannelType, selectedRegistry]);
  const candidateSections = useMemo(() => {
    if (!selectedRegistry) return [] as ChannelConfigContractSection[];
    const sections = [...selectedRegistry.candidateFields.advancedSections];
    if (selectedRegistry.candidateFields.basicFields.length > 0) {
      sections.unshift({
        id: 'plugin-basics',
        label: t('editor.pluginBasicsTitle'),
        fields: selectedRegistry.candidateFields.basicFields,
      });
    }
    return sections
      .map((section) => getVisibleSection(selectedChannelType, section, editorValues))
      .filter((section): section is ChannelConfigContractSection => Boolean(section));
  }, [editorValues, selectedChannelType, selectedRegistry, t]);
  const selectedAccount = useMemo(
    () => selectedGroup?.accounts.find((account) => account.accountId === selectedAccountId),
    [selectedAccountId, selectedGroup],
  );
  const selectedIsWeixin = useMemo(() => isWeixinChannel(selectedChannelType), [selectedChannelType]);
  const weixinGuardianEvaluation = useMemo(
    () => (selectedIsWeixin && selectedAccount
      ? evaluateWeixinGuardian({
        enabled: weixinGuardianEnabled,
        lastError: selectedAccount.lastError,
        lastConnectedAt: selectedAccount.lastConnectedAt,
        lastInboundAt: selectedAccount.lastInboundAt,
        lastOutboundAt: selectedAccount.lastOutboundAt,
      })
      : null),
    [selectedAccount, selectedIsWeixin, weixinGuardianEnabled],
  );
  const hasSelectedContext = useMemo(
    () => !showEntryBoard && Boolean(selectedChannelType),
    [selectedChannelType, showEntryBoard],
  );
  const layoutMode = useMemo(
    () => getChannelCenterLayoutMode(containerWidth, hasSelectedContext),
    [containerWidth, hasSelectedContext],
  );
  const effectiveGatewayState = runtimeGatewayState || gatewayStatus.state;
  const showGatewayStoppedBanner = layoutMode === 'board' && effectiveGatewayState !== 'running' && effectiveGatewayState !== 'starting';
  const showRuntimeWaitingBanner = !error && !runtimeAvailable && !showGatewayStoppedBanner;
  const configuredChannelCount = channelGroups.length;
  const connectedChannelCount = channelGroups.filter((group) => group.status === 'connected').length;
  const disconnectedChannelCount = Math.max(configuredChannelCount - connectedChannelCount, 0);
  const summaryItems = [
    {
      id: 'configured',
      icon: <PlugZap className="h-3.5 w-3.5" />,
      label: t('stats.configured'),
      value: configuredChannelCount,
      tone: 'neutral' as const,
    },
    {
      id: 'connected',
      icon: <CheckCircle2 className="h-3.5 w-3.5" />,
      label: t('stats.connected'),
      value: connectedChannelCount,
      tone: 'success' as const,
    },
    {
      id: 'disconnected',
      icon: <CircleOff className="h-3.5 w-3.5" />,
      label: t('stats.disconnected'),
      value: disconnectedChannelCount,
      tone: 'warning' as const,
    },
  ];
  const boardColumnCount = useMemo(
    () => getChannelBoardColumnCount(containerWidth),
    [containerWidth],
  );
  const filterChannelTypes = useCallback((queryValue: string) => {
    const query = queryValue.trim().toLowerCase();
    if (!query) return allChannelTypes;
    return allChannelTypes.filter((type) => {
      const meta = CHANNEL_META[type];
      return (
        meta.name.toLowerCase().includes(query)
        || t(meta.description.replace('channels:', '')).toLowerCase().includes(query)
        || getChannelEntryDescription(type, t).toLowerCase().includes(query)
        || type.toLowerCase().includes(query)
      );
    });
  }, [allChannelTypes, t]);
  const boardFilteredChannelTypes = useMemo(
    () => filterChannelTypes(boardQuery),
    [boardQuery, filterChannelTypes],
  );
  const railFilteredChannelTypes = useMemo(
    () => filterChannelTypes(railQuery),
    [filterChannelTypes, railQuery],
  );
  const filteredChannelTypes = useMemo(
    () => (layoutMode === 'board' ? boardFilteredChannelTypes : railFilteredChannelTypes),
    [boardFilteredChannelTypes, layoutMode, railFilteredChannelTypes],
  );
  const activeQuery = layoutMode === 'board' ? boardQuery : railQuery;
  const setActiveQuery = layoutMode === 'board' ? setBoardQuery : setRailQuery;
  const configuredFilteredChannelTypes = useMemo(
    () => filteredChannelTypes.filter((type) => Boolean(groupedByType[type])),
    [filteredChannelTypes, groupedByType],
  );
  const unconfiguredFilteredChannelTypes = useMemo(
    () => filteredChannelTypes.filter((type) => !groupedByType[type]),
    [filteredChannelTypes, groupedByType],
  );
  const configuredBoardItems = useMemo(
    () => configuredFilteredChannelTypes.map((channelType) => {
      const meta = CHANNEL_META[channelType];
      const group = groupedByType[channelType];
      return {
        channelType,
        name: meta.name,
        description: getChannelEntryDescription(channelType, t),
        primaryActionLabel: t('configuredBadge'),
        summaryItems: [
          { value: getRuntimeAwareStatusLabel(group.status, runtimeAvailable, t) },
          { value: group.enabled ? t('enabledLabel') : t('disabledLabel') },
          { value: t('entryAccountCount', { count: group.accounts.length }) },
        ],
        indicatorClassName: getChannelCardIndicatorTone(group.status, runtimeAvailable),
      };
    }),
    [configuredFilteredChannelTypes, groupedByType, runtimeAvailable, t],
  );
  const availableBoardItems = useMemo(
    () => unconfiguredFilteredChannelTypes.map((channelType) => {
      const meta = CHANNEL_META[channelType];
      return {
        channelType,
        name: meta.name,
        description: getChannelEntryDescription(channelType, t),
        primaryActionLabel: t('addChannel'),
        summaryItems: [{ value: getChannelConnectionLabel(channelType, t) }],
        indicatorClassName: 'status-indicator status-indicator-idle',
      };
    }),
    [t, unconfiguredFilteredChannelTypes],
  );
  const selectedChannelDescription = useMemo(
    () => (selectedChannelType ? getChannelEntryDescription(selectedChannelType, t) : t('availableDesc')),
    [selectedChannelType, t],
  );
  const selectedAccountSummary = useMemo(
    () => (selectedGroup ? t('entryAccountCount', { count: selectedGroup.accounts.length }) : t('availableDesc')),
    [selectedGroup, t],
  );
  const accountIdBaseline = useMemo(
    () => (selectedChannelType && selectedChannelType !== 'whatsapp' ? (selectedAccountId || FALLBACK_ACCOUNT_ID) : ''),
    [selectedAccountId, selectedChannelType],
  );
  const isEditorDirty = useMemo(
    () => accountIdDraft.trim() !== accountIdBaseline.trim() || !areEditorValuesEqual(editorValues, loadedEditorValues),
    [accountIdBaseline, accountIdDraft, editorValues, loadedEditorValues],
  );
  const editorScrollbarClass = useMemo(
    () => (typeof window !== 'undefined' && window.electron?.platform === 'win32' ? 'subtle-scrollbar-win' : 'subtle-scrollbar'),
    [],
  );
  const applySelection = useCallback((channelType: ChannelType, accountId?: string) => {
    setShowEntryBoard(false);
    setSelectedChannelType(channelType);
    setSelectedAccountId(accountId);
  }, []);

  const requestSelectionChange = useCallback((channelType: ChannelType, accountId?: string) => {
    if (!showEntryBoard && selectedChannelType === channelType && selectedAccountId === accountId) {
      return;
    }
    if (isEditorDirty && !editorSaving) {
      setPendingNavigation({ kind: 'selection', channelType, accountId });
      return;
    }
    applySelection(channelType, accountId);
  }, [applySelection, editorSaving, isEditorDirty, selectedAccountId, selectedChannelType, showEntryBoard]);

  const requestBoardReturn = useCallback(() => {
    if (showEntryBoard) {
      return;
    }
    if (isEditorDirty && !editorSaving) {
      setPendingNavigation({ kind: 'board' });
      return;
    }
    setShowEntryBoard(true);
  }, [editorSaving, isEditorDirty, showEntryBoard]);

  const fetchEditorValues = useCallback(async (channelType: ChannelType, accountId?: string) => {
    const accountParam = accountId ? `?accountId=${encodeURIComponent(accountId)}` : '';
    const result = await hostApiFetch<{ success: boolean; values?: Record<string, EditorValue> }>(
      `/api/channels/config-editor/${encodeURIComponent(channelType)}${accountParam}`,
    );
    return cloneEditorValues(result.success ? (result.values || {}) : {});
  }, []);

  useEffect(() => {
    if (!selectedChannelType) {
      setSelectedAccountId(undefined);
      return;
    }
    if (!selectedGroup) {
      setSelectedAccountId(undefined);
      return;
    }
    const nextAccountId = selectedGroup.defaultAccountId || selectedGroup.accounts[0]?.accountId;
    if (!selectedAccountId || !selectedGroup.accounts.some((account) => account.accountId === selectedAccountId)) {
      setSelectedAccountId(nextAccountId);
    }
  }, [selectedAccountId, selectedChannelType, selectedGroup]);

  useEffect(() => {
    if (!selectedChannelType) {
      setEditorValues({});
      setLoadedEditorValues({});
      setEditorValidation(null);
      return;
    }
    if (selectedChannelType === 'whatsapp') {
      setEditorValues({});
      setLoadedEditorValues({});
      setEditorValidation(null);
      return;
    }
    let cancelled = false;
    setEditorLoading(true);
    setEditorValidation(null);

    void fetchEditorValues(selectedChannelType, selectedAccountId).then((values) => {
      if (cancelled) return;
      setEditorValues(values);
      setLoadedEditorValues(values);
    }).catch(() => {
      if (cancelled) return;
      setEditorValues({});
      setLoadedEditorValues({});
    }).finally(() => {
      if (!cancelled) {
        setEditorLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [fetchEditorValues, selectedAccountId, selectedChannelType]);

  useEffect(() => {
    if (!selectedChannelType || selectedChannelType === 'whatsapp') {
      setAccountIdDraft('');
      return;
    }
    setAccountIdDraft(selectedAccountId || FALLBACK_ACCOUNT_ID);
  }, [selectedAccountId, selectedChannelType]);

  useEffect(() => {
    if (!selectedIsWeixin || !selectedAccountId) {
      setWeixinGuardianEnabled(false);
      setWeixinGuardianLoading(false);
      return;
    }

    let cancelled = false;
    setWeixinGuardianLoading(true);

    void hostApiFetch<{ success: boolean; enabled?: boolean }>(
      `/api/channels/weixin/guardian?accountId=${encodeURIComponent(selectedAccountId)}`,
    ).then((result) => {
      if (cancelled) return;
      setWeixinGuardianEnabled(result.enabled === true);
    }).catch(() => {
      if (cancelled) return;
      setWeixinGuardianEnabled(false);
    }).finally(() => {
      if (!cancelled) {
        setWeixinGuardianLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [selectedAccountId, selectedIsWeixin]);

  const handleRefresh = () => {
    setRefreshing(true);
    void fetchPageData({ probe: true, silent: true });
  };

  const handleEditorValueChange = (key: string, value: EditorValue) => {
    setEditorValues((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleValidateConfig = async () => {
    if (!selectedChannelType || selectedChannelType === 'whatsapp') return;
    setEditorValidating(true);
    setEditorValidation(null);
    try {
      const result = await hostApiFetch<{
        success: boolean;
        valid?: boolean;
        errors?: string[];
        warnings?: string[];
      }>('/api/channels/credentials/validate', {
        method: 'POST',
        body: JSON.stringify({
          channelType: selectedChannelType,
          config: editorValues,
        }),
      });
      setEditorValidation({
        valid: result.valid || false,
        errors: result.errors || [],
        warnings: result.warnings || [],
      });
    } catch (validateError) {
      setEditorValidation({
        valid: false,
        errors: [String(validateError)],
        warnings: [],
      });
    } finally {
      setEditorValidating(false);
    }
  };

  const handleSaveInlineConfig = async () => {
    if (!selectedChannelType || selectedChannelType === 'whatsapp') return;
    const nextAccountId = accountIdDraft.trim();
    if (!nextAccountId) {
      toast.error(t('account.invalidId'));
      return;
    }
    if (selectedIsWeixin && selectedAccountId && nextAccountId !== selectedAccountId) {
      setAccountIdDraft(selectedAccountId);
      toast.error(t('account.readonlyIdHint'));
      return;
    }
    if (selectedGroup?.accounts.some((account) => account.accountId === nextAccountId && account.accountId !== selectedAccountId)) {
      toast.error(t('account.accountIdExists', { accountId: nextAccountId }));
      return;
    }
    setEditorSaving(true);
    setEditorValidation(null);
    let resolvedAccountId = selectedAccountId || nextAccountId;
    let renamedAccountId: string | null = null;
    try {
      if (selectedAccountId && nextAccountId !== selectedAccountId) {
        const renameResult = await hostApiFetch<{ success: boolean; error?: string; accountId?: string }>(
          '/api/channels/account-id/rename',
          {
            method: 'PUT',
            body: JSON.stringify({
              channelType: selectedChannelType,
              accountId: selectedAccountId,
              nextAccountId,
            }),
          },
        );
        if (!renameResult.success) {
          throw new Error(renameResult.error || 'Failed to rename channel account');
        }
        resolvedAccountId = renameResult.accountId || nextAccountId;
        renamedAccountId = resolvedAccountId;
      }
      const result = await hostApiFetch<{ success: boolean; error?: string }>('/api/channels/config', {
        method: 'POST',
        body: JSON.stringify({
          channelType: selectedChannelType,
          accountId: resolvedAccountId,
          config: editorValues,
        }),
      });
      if (!result.success) {
        throw new Error(result.error || 'Failed to save channel config');
      }
      await fetchPageData({ silent: true });
      applySelection(selectedChannelType, resolvedAccountId);
      setAccountIdDraft(resolvedAccountId);
      const reloadedValues = await fetchEditorValues(selectedChannelType, resolvedAccountId);
      setEditorValues(reloadedValues);
      setLoadedEditorValues(reloadedValues);
      toast.success(t('toast.channelSaved', { name: selectedMeta ? selectedMeta.name : selectedChannelType }));
    } catch (saveError) {
      if (renamedAccountId) {
        await fetchPageData({ silent: true });
        applySelection(selectedChannelType, renamedAccountId);
        setAccountIdDraft(renamedAccountId);
      }
      toast.error(t('toast.configFailed', { error: String(saveError) }));
    } finally {
      setEditorSaving(false);
    }
  };

  const handleBindAgent = async (channelType: string, accountId: string, agentId: string) => {
    try {
      if (!agentId) {
        await hostApiFetch<{ success: boolean; error?: string }>('/api/channels/binding', {
          method: 'DELETE',
          body: JSON.stringify({ channelType, accountId }),
        });
      } else {
        await hostApiFetch<{ success: boolean; error?: string }>('/api/channels/binding', {
          method: 'PUT',
          body: JSON.stringify({ channelType, accountId, agentId }),
        });
      }
      await fetchPageData({ silent: true });
      toast.success(t('toast.bindingUpdated'));
    } catch (bindError) {
      toast.error(t('toast.configFailed', { error: String(bindError) }));
    }
  };

  const handleSetDefaultAccount = async (channelType: string, accountId: string) => {
    try {
      await hostApiFetch<{ success: boolean; error?: string }>('/api/channels/default-account', {
        method: 'PUT',
        body: JSON.stringify({ channelType, accountId }),
      });
      await fetchPageData({ silent: true });
      toast.success(t('toast.defaultUpdated'));
    } catch (defaultError) {
      toast.error(t('toast.configFailed', { error: String(defaultError) }));
    }
  };

  const handleSetChannelEnabled = async (channelType: string, enabled: boolean) => {
    setEditorTogglingEnabled(true);
    try {
      await hostApiFetch<{ success: boolean; error?: string }>('/api/channels/config/enabled', {
        method: 'PUT',
        body: JSON.stringify({ channelType, enabled }),
      });
      await fetchPageData({ silent: true });
      toast.success(t('toast.channelSaved', { name: CHANNEL_META[channelType as ChannelType]?.name || channelType }));
    } catch (toggleError) {
      toast.error(t('toast.configFailed', { error: String(toggleError) }));
    } finally {
      setEditorTogglingEnabled(false);
    }
  };

  const handleWeixinGuardianToggle = async (enabled: boolean) => {
    if (!selectedIsWeixin || !selectedAccountId) return;
    setWeixinGuardianSaving(true);
    try {
      const result = await hostApiFetch<{ success: boolean; enabled?: boolean }>('/api/channels/weixin/guardian', {
        method: 'PUT',
        body: JSON.stringify({
          accountId: selectedAccountId,
          enabled,
        }),
      });
      setWeixinGuardianEnabled(result.enabled === true);
    } catch (error) {
      toast.error(t('toast.configFailed', { error: String(error) }));
    } finally {
      setWeixinGuardianSaving(false);
    }
  };

  const openConfigModal = async (
    channelType: ChannelType,
    options?: {
      accountId?: string;
      allowExistingConfig?: boolean;
      allowEditAccountId?: boolean;
      existingAccountIds?: string[];
      initialAgentId?: string;
      initialConfigValues?: Record<string, string>;
    },
  ) => {
    setSelectedChannelType(channelType);
    setSelectedAccountId(options?.accountId);
    setAllowExistingConfigInModal(options?.allowExistingConfig ?? true);
    setAllowEditAccountIdInModal(options?.allowEditAccountId ?? false);
    setExistingAccountIdsForModal(options?.existingAccountIds ?? []);
    setInitialAgentIdForModal(options?.initialAgentId);
    setInitialConfigValuesForModal(options?.initialConfigValues);
    setShowConfigModal(true);
  };

  const resetConfigModalState = useCallback(() => {
    setShowConfigModal(false);
    setAllowExistingConfigInModal(true);
    setAllowEditAccountIdInModal(false);
    setExistingAccountIdsForModal([]);
    setInitialAgentIdForModal(undefined);
    setInitialConfigValuesForModal(undefined);
  }, []);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const suffix = deleteTarget.accountId
        ? `?accountId=${encodeURIComponent(deleteTarget.accountId)}`
        : '';
      await hostApiFetch(`/api/channels/config/${encodeURIComponent(deleteTarget.channelType)}${suffix}`, {
        method: 'DELETE',
      });
      setChannelGroups((prev) => removeDeletedTarget(prev, deleteTarget));
      toast.success(deleteTarget.accountId ? t('toast.accountDeleted') : t('toast.channelDeleted'));
      window.setTimeout(() => {
        void fetchPageData({ silent: true });
      }, 1200);
    } catch (deleteError) {
      toast.error(t('toast.configFailed', { error: String(deleteError) }));
    } finally {
      setDeleteTarget(null);
    }
  };

  const createNewAccountId = (channelType: string, existingAccounts: string[]): string => {
    let nextAccountId = `${channelType}-${generateUuid().slice(0, 8)}`;
    while (existingAccounts.includes(nextAccountId)) {
      nextAccountId = `${channelType}-${generateUuid().slice(0, 8)}`;
    }
    return nextAccountId;
  };

  const handleAddAccount = () => {
    if (!selectedChannelType) return;
    if (selectedGroup) {
      if (isWeixinChannel(selectedGroup.channelType as ChannelType)) {
        void openConfigModal(selectedGroup.channelType as ChannelType, {
          allowExistingConfig: true,
        });
        return;
      }
      const nextAccountId = createNewAccountId(
        selectedGroup.channelType,
        selectedGroup.accounts.map((item) => item.accountId),
      );
      void openConfigModal(selectedGroup.channelType as ChannelType, {
        accountId: nextAccountId,
        allowExistingConfig: false,
        allowEditAccountId: true,
        existingAccountIds: selectedGroup.accounts.map((item) => item.accountId),
      });
      return;
    }
    void openConfigModal(selectedChannelType, {
      allowExistingConfig: true,
    });
  };

  const handleOpenSelectedModal = () => {
    if (!selectedChannelType) return;
    void openConfigModal(selectedChannelType, {
      accountId: selectedAccountId,
      allowExistingConfig: true,
      initialAgentId: selectedAccount?.agentId,
    });
  };

  const accountPane = selectedChannelType ? (
    <ChannelAccountList
      channelType={selectedChannelType}
      title={selectedMeta?.name || ''}
      summary={selectedAccountSummary}
      emptyDescription={selectedChannelDescription}
      addActionLabel={selectedGroup ? (selectedIsWeixin ? t('account.addByQr') : t('account.add')) : (selectedIsWeixin ? t('account.addByQr') : t('addChannel'))}
      accounts={selectedGroup?.accounts}
      selectedAccountId={selectedAccountId}
      t={t}
      onAddAccount={handleAddAccount}
      onDeleteChannel={() => {
        if (!selectedGroup) return;
        setDeleteTarget({ channelType: selectedGroup.channelType });
      }}
      onSelectAccount={(accountId) => {
        requestSelectionChange(selectedChannelType, accountId);
      }}
      onSetDefaultAccount={(accountId) => {
        if (!selectedGroup) return;
        void handleSetDefaultAccount(selectedGroup.channelType, accountId);
      }}
      onDeleteAccount={(accountId) => {
        if (!selectedGroup) return;
        setDeleteTarget({ channelType: selectedGroup.channelType, accountId });
      }}
      getStatusLabel={(status) => getRuntimeAwareStatusLabel(status, runtimeAvailable, t)}
      getStatusTone={(status) => getRuntimeAwareStatusTone(status, runtimeAvailable)}
    />
  ) : null;

  const editorPane = (
    <ChannelConfigEditor
      channelType={selectedChannelType}
      title={selectedMeta?.name}
      description={selectedChannelDescription}
      selectedAccountId={selectedAccountId}
      selectedAccount={selectedAccount
        ? {
          accountId: selectedAccount.accountId,
          isDefault: selectedAccount.isDefault,
          agentId: selectedAccount.agentId,
        }
        : undefined}
      selectedGroup={selectedGroup ? { enabled: selectedGroup.enabled } : undefined}
      hasRegistry={Boolean(selectedRegistry)}
      basicFields={selectedRegistry?.basicFields || []}
      visibleAdvancedSections={visibleAdvancedSections}
      candidateSections={candidateSections}
      editorValues={editorValues}
      accountIdDraft={accountIdDraft}
      agents={agents}
      editorLoading={editorLoading}
      editorSaving={editorSaving}
      editorValidating={editorValidating}
      editorTogglingEnabled={editorTogglingEnabled}
      selectedIsWeixin={selectedIsWeixin}
      weixinGuardianEnabled={weixinGuardianEnabled}
      weixinGuardianLoading={weixinGuardianLoading}
      weixinGuardianSaving={weixinGuardianSaving}
      weixinGuardianToneClass={getWeixinGuardianTone(weixinGuardianEvaluation)}
      weixinGuardianMessageKey={getWeixinGuardianMessageKey(weixinGuardianEvaluation, weixinGuardianEnabled)}
      showWeixinGuardianRelogin={Boolean(weixinGuardianEnabled && weixinGuardianEvaluation && weixinGuardianEvaluation.level !== 'healthy')}
      editorValidation={editorValidation}
      editorScrollbarClass={editorScrollbarClass}
      t={t}
      onAccountIdChange={setAccountIdDraft}
      onFieldChange={handleEditorValueChange}
      onValidate={() => {
        void handleValidateConfig();
      }}
      onSave={() => {
        void handleSaveInlineConfig();
      }}
      onToggleEnabled={(checked) => {
        if (!selectedChannelType) return;
        void handleSetChannelEnabled(selectedChannelType, checked);
      }}
      onBindAgent={(agentId) => {
        if (!selectedChannelType || !selectedAccountId) return;
        void handleBindAgent(selectedChannelType, selectedAccountId, agentId);
      }}
      onOpenModal={handleOpenSelectedModal}
      onWeixinGuardianToggle={(checked) => {
        void handleWeixinGuardianToggle(checked);
      }}
    />
  );

  if (loading) {
    return <WorkspacePageLoading />;
  }

  return (
    <WorkspacePageFrame>
      <WorkspacePageShell
        data-testid="channels-shell"
        className="app-channels-shell"
      >
        <WorkbenchHeader
          className="app-channels-header"
          titleBlock={(
            <WorkbenchHeaderTitleBlock
              title={t('title')}
              subtitle={t('subtitle')}
              className="app-channels-header-copy"
            />
          )}
          summary={(
            <div className="app-channels-header-toolbar">
              <WorkbenchSummaryStrip items={summaryItems} className="app-channels-summary-strip" />

              {layoutMode === 'focus' ? null : (
                <div className="app-channels-header-toolbar-rail">
                  <div className="app-channels-header-search relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/68" />
                    <Input
                      value={activeQuery}
                      onChange={(event) => setActiveQuery(event.target.value)}
                      placeholder={t('searchPlaceholder')}
                      className={cn(searchFieldClass, 'h-8 rounded-md')}
                    />
                  </div>

                  <WorkbenchHeaderActions className="app-channels-header-actions">
                    <Button
                      variant="outline"
                      onClick={handleRefresh}
                      disabled={gatewayStatus.state !== 'running' || refreshing}
                      className={cn('app-channels-header-refresh', workbenchToolbarButtonClasses)}
                    >
                      <RefreshCw className={cn('mr-2 h-3.5 w-3.5', refreshing && 'animate-spin')} />
                      {t('refresh')}
                    </Button>
                  </WorkbenchHeaderActions>
                </div>
              )}
            </div>
          )}
        />

        <WorkspacePageScrollArea data-testid="channels-scroll-area">
          {showGatewayStoppedBanner && (
            <div className="app-insight-surface mb-6 flex items-center gap-3 rounded-md border border-[hsl(var(--warning))/0.14] px-3.5 py-2.5 text-[hsl(var(--warning))]">
              <AlertCircle className="h-5 w-5" />
              <span className="text-sm font-medium">
                {t('gatewayWarning')}
              </span>
            </div>
          )}

          {error && (
            <div className="app-insight-surface mb-6 flex items-center gap-3 rounded-md border border-destructive/16 px-3.5 py-2.5">
              <AlertCircle className="h-5 w-5 text-destructive" />
              <span className="text-destructive text-sm font-medium">
                {error}
              </span>
            </div>
          )}

          {showRuntimeWaitingBanner && (
            <div className="app-insight-surface mb-6 rounded-md border border-[hsl(var(--warning))/0.14] px-3.5 py-2.5 text-sm text-[hsl(var(--warning))]">
              {t('gatewayRuntimeUnavailable', { state: effectiveGatewayState })}
            </div>
          )}

          <div ref={contentRef} className="min-w-0">
            {layoutMode === 'board' ? (
              <ChannelEntryBoard
                sections={[
                  {
                    id: 'configured',
                    title: t('configuredSection'),
                    description: t('configuredDesc'),
                    items: configuredBoardItems,
                  },
                  {
                    id: 'available',
                    title: t('availableSection'),
                    description: t('availableDesc'),
                    items: availableBoardItems,
                  },
                ]}
                emptyMessage={t('emptySearch')}
                columnCount={boardColumnCount}
                onSelectChannel={(channelType) => requestSelectionChange(channelType)}
              />
            ) : layoutMode === 'focus' ? (
              <ChannelFocusWorkspace
                backLabel={t('backToBoard')}
                title={selectedMeta?.name || t('supportedChannels')}
                description={selectedChannelDescription}
                icon={selectedChannelType ? <ChannelLogo type={selectedChannelType} /> : null}
                onBack={requestBoardReturn}
                accountPane={accountPane}
                editorPane={editorPane}
              />
            ) : (
              <div
                data-testid="channels-workbench"
                className="grid min-w-0 gap-5 xl:grid-cols-[minmax(272px,0.82fr)_minmax(560px,1.34fr)] min-[1440px]:grid-cols-[minmax(224px,0.74fr)_minmax(336px,1fr)_minmax(520px,1.48fr)]"
              >
                <div data-testid="channels-navigation-stack" className="grid min-w-0 gap-5 min-[1440px]:contents">
                  <section className={cn(paneSurfaceClass, 'p-2.5')}>
                    <div className="flex items-start justify-between gap-2.5">
                      <div>
                        <h2 className="text-sm font-semibold text-foreground">{t('supportedChannels')}</h2>
                        <p className="mt-0.5 hidden text-[11px] leading-5 text-muted-foreground/78 xl:block">{t('availableDesc')}</p>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 rounded-md px-2.5 text-[11.5px] font-medium text-foreground/64 shadow-sm transition-colors hover:bg-[hsl(var(--surface-hover)/0.42)] hover:text-foreground"
                        onClick={() => {
                          const nextChannel = unsupportedGroups[0] || allChannelTypes[0];
                          if (nextChannel) {
                            requestSelectionChange(nextChannel);
                          }
                        }}
                      >
                        <Plus className="mr-1 h-3.25 w-3.25" />
                        {t('addChannel')}
                      </Button>
                    </div>

                    <div className="mt-2.5 space-y-2.5">
                      {configuredFilteredChannelTypes.length > 0 && (
                        <div className="space-y-1.5">
                          <p className={sectionLabelClass}>{t('configuredSection')}</p>
                          {configuredFilteredChannelTypes.map((channelType) => {
                            const meta = CHANNEL_META[channelType];
                            const group = groupedByType[channelType];
                            const isSelected = selectedChannelType === channelType;
                            const statusLabel = getRuntimeAwareStatusLabel(group.status, runtimeAvailable, t);

                            return (
                              <button
                                key={channelType}
                                type="button"
                                data-testid={`channel-rail-item-${channelType}`}
                                aria-pressed={isSelected}
                                onClick={() => requestSelectionChange(channelType)}
                                className={cn(railRowClass, isSelected ? selectedRailCardClass : idleRailCardClass)}
                              >
                                <div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2.5">
                                  <div className={railIconClass}>
                                    <ChannelLogo type={channelType} />
                                  </div>
                                  <div className="min-w-0 space-y-1">
                                    <p className="truncate text-[13px] font-semibold text-foreground">{meta.name}</p>
                                    <div
                                      data-testid={`channel-rail-meta-${channelType}`}
                                      className="flex min-w-0 items-center gap-1.5 overflow-hidden text-[10.5px] leading-none text-muted-foreground/76"
                                    >
                                      <span className="truncate">{statusLabel}</span>
                                      <span className="hidden shrink-0 min-[420px]:inline text-foreground/28">·</span>
                                      <span className="hidden truncate min-[420px]:inline">{getChannelConnectionLabel(channelType, t)}</span>
                                    </div>
                                  </div>
                                  <div className="flex shrink-0 items-center gap-1.5 self-start">
                                    <span data-testid={`channel-rail-count-${channelType}`} className={railMetaBadgeClass}>{group.accounts.length}</span>
                                    <span className="hidden min-[420px]:inline-flex shrink-0 items-center rounded-full border border-[hsl(var(--border-subtle)/0.54)] bg-[hsl(var(--surface-elevated)/0.98)] px-2 py-0.5 text-[10px] font-medium leading-none text-foreground/68">
                                      {group.enabled ? t('enabledLabel') : t('disabledLabel')}
                                    </span>
                                    <div
                                      data-testid={`channel-rail-indicator-${channelType}`}
                                      className={cn('h-2.5 w-2.5 shrink-0 rounded-full', getConfiguredChannelRailTone(group.enabled))}
                                    />
                                  </div>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}

                      {unconfiguredFilteredChannelTypes.length > 0 && (
                        <div className="space-y-1.5">
                          <p className={sectionLabelClass}>{t('availableSection')}</p>
                          {unconfiguredFilteredChannelTypes.map((channelType) => {
                            const meta = CHANNEL_META[channelType];
                            const isSelected = selectedChannelType === channelType;

                            return (
                              <button
                                key={channelType}
                                type="button"
                                data-testid={`channel-rail-item-${channelType}`}
                                aria-pressed={isSelected}
                                onClick={() => requestSelectionChange(channelType)}
                                className={cn(railRowClass, isSelected ? selectedRailCardClass : idleRailCardClass)}
                              >
                                <div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2.5">
                                  <div className={railIconClass}>
                                    <ChannelLogo type={channelType} />
                                  </div>
                                  <div className="min-w-0 space-y-1">
                                    <p className="truncate text-[13px] font-semibold text-foreground">{meta.name}</p>
                                    <div
                                      data-testid={`channel-rail-meta-${channelType}`}
                                      className="flex min-w-0 items-center gap-1.5 overflow-hidden text-[10.5px] leading-none text-muted-foreground/76"
                                    >
                                      <span className="truncate">{getChannelConnectionLabel(channelType, t)}</span>
                                    </div>
                                  </div>
                                  <div className="flex shrink-0 items-center gap-1.5 self-start">
                                    <span className={railStateBadgeClass}>{t('available')}</span>
                                    <div
                                      data-testid={`channel-rail-indicator-${channelType}`}
                                      className="status-indicator status-indicator-idle h-2.5 w-2.5 shrink-0 rounded-full"
                                    />
                                  </div>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}

                      {filteredChannelTypes.length === 0 && (
                        <div className="app-empty-surface rounded-md px-3 py-4 text-xs text-muted-foreground">
                          {t('emptySearch')}
                        </div>
                      )}
                    </div>
                  </section>

                  {accountPane}
                </div>

                {editorPane}
              </div>
            )}
          </div>
        </WorkspacePageScrollArea>
      </WorkspacePageShell>

      {showConfigModal && (
        <ChannelConfigModal
          initialSelectedType={selectedChannelType}
          accountId={selectedAccountId}
          configuredTypes={configuredTypes}
          allowExistingConfig={allowExistingConfigInModal}
          allowEditAccountId={allowEditAccountIdInModal}
          existingAccountIds={existingAccountIdsForModal}
          availableAgents={agents}
          agentId={initialAgentIdForModal}
          initialConfigValues={initialConfigValuesForModal}
          showChannelName={false}
          onClose={resetConfigModalState}
          onChannelSaved={async (channelType, accountId) => {
            await fetchPageData({ silent: true });
            applySelection(channelType, accountId);
            setAccountIdDraft(accountId || FALLBACK_ACCOUNT_ID);
            resetConfigModalState();
          }}
        />
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title={t('common.confirm', 'Confirm')}
        message={deleteTarget?.accountId ? t('account.deleteConfirm') : t('deleteConfirm')}
        confirmLabel={t('common.delete', 'Delete')}
        cancelLabel={t('common.cancel', 'Cancel')}
        variant="destructive"
        onConfirm={() => {
          void handleDelete();
        }}
        onCancel={() => setDeleteTarget(null)}
      />

      <ConfirmDialog
        open={!!pendingNavigation}
        title={t('editor.unsavedChangesTitle')}
        message={t('editor.unsavedChangesMessage')}
        confirmLabel={t('editor.discardChangesConfirm')}
        cancelLabel={t('common.cancel', 'Cancel')}
        onConfirm={() => {
          if (pendingNavigation?.kind === 'selection') {
            applySelection(pendingNavigation.channelType, pendingNavigation.accountId);
          }
          if (pendingNavigation?.kind === 'board') {
            setShowEntryBoard(true);
          }
          setPendingNavigation(null);
        }}
        onCancel={() => setPendingNavigation(null)}
      />
    </WorkspacePageFrame>
  );
}

function ChannelLogo({ type }: { type: ChannelType }) {
  return <ChannelIcon type={type} size={22} />;
}

export default Channels;
