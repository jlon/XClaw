import { useState, useEffect, useCallback, useMemo, useRef, type ReactNode } from 'react';
import { RefreshCw, Trash2, AlertCircle, Plus, Search, BookOpen, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useGatewayStore } from '@/stores/gateway';
import {
  WorkspacePageFrame,
  WorkspacePageLoading,
  WorkspacePageScrollArea,
  WorkspacePageShell,
} from '@/components/layout/WorkspacePage';
import { hostApiFetch } from '@/lib/host-api';
import { subscribeHostEvent } from '@/lib/host-events';
import { ChannelConfigModal } from '@/components/channels/ChannelConfigModal';
import { CHANNEL_FIELD_REGISTRY, V1_CHANNEL_REGISTRY_ORDER } from '@/lib/channel-registry';
import { cn } from '@/lib/utils';
import {
  CHANNEL_ICONS,
  CHANNEL_META,
  getPrimaryChannels,
  type ChannelType,
  type ChannelConfigContractField,
  type ChannelConfigContractSection,
} from '@/types/channel';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import telegramIcon from '@/assets/channels/telegram.svg';
import discordIcon from '@/assets/channels/discord.svg';
import whatsappIcon from '@/assets/channels/whatsapp.svg';
import dingtalkIcon from '@/assets/channels/dingtalk.svg';
import feishuIcon from '@/assets/channels/feishu.svg';
import wecomIcon from '@/assets/channels/wecom.svg';
import qqIcon from '@/assets/channels/qq.svg';

interface ChannelAccountItem {
  accountId: string;
  name: string;
  configured: boolean;
  status: 'connected' | 'connecting' | 'disconnected' | 'error';
  enabled: boolean;
  lastError?: string;
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

interface PendingSelectionTarget {
  channelType: ChannelType;
  accountId?: string;
}

type RegistryChannelType = keyof typeof CHANNEL_FIELD_REGISTRY;
type EditorValue = string | boolean | number | string[];
const FALLBACK_ACCOUNT_ID = 'default';

const selectedWorkbenchItemClass =
  'border-primary/25 bg-primary/10 shadow-sm';

function isRegistryChannelType(channelType: string): channelType is RegistryChannelType {
  return channelType in CHANNEL_FIELD_REGISTRY;
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

function resolveTranslationText(t: (key: string) => string, value?: string): string {
  if (!value) return '';
  return value.startsWith('channels:') ? t(value.replace('channels:', '')) : value;
}

function isStringArrayValue(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function getFieldValueForDisplay(field: ChannelConfigContractField, value: EditorValue | undefined): EditorValue | undefined {
  if (value !== undefined) return value;
  return field.defaultValue;
}

function getFieldStringValue(field: ChannelConfigContractField, value: EditorValue | undefined): string {
  const resolved = getFieldValueForDisplay(field, value);
  if (typeof resolved === 'string') return resolved;
  if (typeof resolved === 'number') return String(resolved);
  if (isStringArrayValue(resolved)) return resolved.join(', ');
  return '';
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

function getFieldBooleanValue(field: ChannelConfigContractField, value: EditorValue | undefined): boolean {
  const resolved = getFieldValueForDisplay(field, value);
  return resolved === true;
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

function getFieldSummaryValue(
  field: ChannelConfigContractField,
  value: EditorValue | undefined,
  t: (key: string, options?: Record<string, unknown>) => string,
): string | null {
  const resolved = getFieldValueForDisplay(field, value);
  if (resolved === undefined || resolved === null) return null;

  if (field.valueType === 'password') {
    return typeof resolved === 'string' && resolved.trim().length > 0 ? t('editor.summaryConfigured') : null;
  }

  if (typeof resolved === 'string') {
    const trimmed = resolved.trim();
    if (!trimmed) return null;
    const option = field.options?.find((item) => item.value === trimmed);
    return resolveTranslationText(t, option?.label || trimmed);
  }

  if (typeof resolved === 'boolean') {
    return resolved ? t('enabledLabel') : t('disabledLabel');
  }

  if (typeof resolved === 'number') {
    return String(resolved);
  }

  if (isStringArrayValue(resolved)) {
    const items = resolved.map((item) => item.trim()).filter(Boolean);
    if (items.length === 0) return null;
    if (items.length <= 2) {
      return items.join(', ');
    }
    return `${items.slice(0, 2).join(', ')} ${t('editor.summaryMoreCount', { count: items.length - 2 })}`;
  }

  return null;
}

function getSectionSummary(
  section: ChannelConfigContractSection,
  editorValues: Record<string, EditorValue>,
  t: (key: string, options?: Record<string, unknown>) => string,
): string | null {
  const summaryItems = section.fields.flatMap((field) => {
    const summaryValue = getFieldSummaryValue(field, editorValues[field.key], t);
    if (!summaryValue) return [];
    return [`${resolveTranslationText(t, field.label)}：${summaryValue}`];
  });

  if (summaryItems.length === 0) return null;
  return summaryItems.slice(0, 2).join(' · ');
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

export function Channels() {
  const { t } = useTranslation('channels');
  const gatewayStatus = useGatewayStore((state) => state.status);
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
  const [selectedChannelType, setSelectedChannelType] = useState<ChannelType | null>(null);
  const [selectedAccountId, setSelectedAccountId] = useState<string | undefined>(undefined);
  const [allowExistingConfigInModal, setAllowExistingConfigInModal] = useState(true);
  const [allowEditAccountIdInModal, setAllowEditAccountIdInModal] = useState(false);
  const [existingAccountIdsForModal, setExistingAccountIdsForModal] = useState<string[]>([]);
  const [initialConfigValuesForModal, setInitialConfigValuesForModal] = useState<Record<string, string> | undefined>(undefined);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [channelQuery, setChannelQuery] = useState('');
  const [accountIdDraft, setAccountIdDraft] = useState('');
  const [editorValues, setEditorValues] = useState<Record<string, EditorValue>>({});
  const [loadedEditorValues, setLoadedEditorValues] = useState<Record<string, EditorValue>>({});
  const [editorLoading, setEditorLoading] = useState(false);
  const [editorSaving, setEditorSaving] = useState(false);
  const [editorValidating, setEditorValidating] = useState(false);
  const [editorTogglingEnabled, setEditorTogglingEnabled] = useState(false);
  const [pendingSelection, setPendingSelection] = useState<PendingSelectionTarget | null>(null);
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
        return preferredChannel;
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

  const configuredGroups = useMemo(() => {
    const known = displayedChannelTypes
      .map((type) => groupedByType[type])
      .filter((group): group is ChannelGroupItem => Boolean(group));
    const unknown = channelGroups.filter((group) => !displayedChannelTypes.includes(group.channelType as ChannelType));
    return [...known, ...unknown];
  }, [channelGroups, displayedChannelTypes, groupedByType]);

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
  const filteredChannelTypes = useMemo(() => {
    const query = channelQuery.trim().toLowerCase();
    if (!query) return allChannelTypes;
    return allChannelTypes.filter((type) => {
      const meta = CHANNEL_META[type];
      return (
        meta.name.toLowerCase().includes(query)
        || t(meta.description.replace('channels:', '')).toLowerCase().includes(query)
        || type.toLowerCase().includes(query)
      );
    });
  }, [allChannelTypes, channelQuery, t]);
  const configuredFilteredChannelTypes = useMemo(
    () => filteredChannelTypes.filter((type) => Boolean(groupedByType[type])),
    [filteredChannelTypes, groupedByType],
  );
  const unconfiguredFilteredChannelTypes = useMemo(
    () => filteredChannelTypes.filter((type) => !groupedByType[type]),
    [filteredChannelTypes, groupedByType],
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
    setSelectedChannelType(channelType);
    setSelectedAccountId(accountId);
  }, []);

  const requestSelectionChange = useCallback((channelType: ChannelType, accountId?: string) => {
    if (selectedChannelType === channelType && selectedAccountId === accountId) {
      return;
    }
    if (isEditorDirty && !editorSaving) {
      setPendingSelection({ channelType, accountId });
      return;
    }
    applySelection(channelType, accountId);
  }, [applySelection, editorSaving, isEditorDirty, selectedAccountId, selectedChannelType]);

  const fetchEditorValues = useCallback(async (channelType: ChannelType, accountId?: string) => {
    const accountParam = accountId ? `?accountId=${encodeURIComponent(accountId)}` : '';
    const result = await hostApiFetch<{ success: boolean; values?: Record<string, EditorValue> }>(
      `/api/channels/config-editor/${encodeURIComponent(channelType)}${accountParam}`,
    );
    return cloneEditorValues(result.success ? (result.values || {}) : {});
  }, []);

  useEffect(() => {
    if (loading) return;
    const preferredChannel =
      configuredGroups[0]?.channelType as ChannelType | undefined
      ?? displayedChannelTypes[0]
      ?? null;
    if (!preferredChannel) return;
    if (!selectedChannelType || !allChannelTypes.includes(selectedChannelType)) {
      setSelectedChannelType(preferredChannel);
    }
  }, [allChannelTypes, configuredGroups, displayedChannelTypes, loading, selectedChannelType]);

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

  const openChannelDocs = (channelType: ChannelType) => {
    const url = t(CHANNEL_META[channelType].docsUrl);
    try {
      if (window.electron?.openExternal) {
        window.electron.openExternal(url);
        return;
      }
    } catch {
      // ignore and fall back
    }
    window.open(url, '_blank');
  };

  const openConfigModal = async (
    channelType: ChannelType,
    options?: {
      accountId?: string;
      allowExistingConfig?: boolean;
      allowEditAccountId?: boolean;
      existingAccountIds?: string[];
      initialConfigValues?: Record<string, string>;
    },
  ) => {
    setSelectedChannelType(channelType);
    setSelectedAccountId(options?.accountId);
    setAllowExistingConfigInModal(options?.allowExistingConfig ?? true);
    setAllowEditAccountIdInModal(options?.allowEditAccountId ?? false);
    setExistingAccountIdsForModal(options?.existingAccountIds ?? []);
    setInitialConfigValuesForModal(options?.initialConfigValues);
    setShowConfigModal(true);
  };

  const resetConfigModalState = useCallback(() => {
    setShowConfigModal(false);
    setAllowExistingConfigInModal(true);
    setAllowEditAccountIdInModal(false);
    setExistingAccountIdsForModal([]);
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
    // Generate a collision-safe default account id for user editing.
    let nextAccountId = `${channelType}-${crypto.randomUUID().slice(0, 8)}`;
    while (existingAccounts.includes(nextAccountId)) {
      nextAccountId = `${channelType}-${crypto.randomUUID().slice(0, 8)}`;
    }
    return nextAccountId;
  };

  if (loading) {
    return <WorkspacePageLoading />;
  }

  return (
    <WorkspacePageFrame>
      <WorkspacePageShell
        data-testid="channels-shell"
        className="max-w-[1680px]"
      >
        <div className="mb-8 flex shrink-0 flex-col justify-between gap-4 xl:mb-10 md:flex-row md:items-start">
          <div>
            <h1 className="mb-3 font-serif text-4xl font-normal tracking-tight text-foreground md:text-5xl xl:text-6xl" style={{ fontFamily: 'Georgia, Cambria, "Times New Roman", Times, serif' }}>
              {t('title')}
            </h1>
            <p className="text-[17px] text-foreground/70 font-medium">
              {t('subtitle')}
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-3 md:mt-2">
            <Button
              variant="outline"
              onClick={handleRefresh}
              disabled={gatewayStatus.state !== 'running' || refreshing}
              className="h-9 rounded-full px-4 text-[13px] font-medium text-foreground/80 shadow-none transition-colors hover:text-foreground"
            >
              <RefreshCw className={cn('mr-2 h-3.5 w-3.5', refreshing && 'animate-spin')} />
              {t('refresh')}
            </Button>
          </div>
        </div>

        <WorkspacePageScrollArea data-testid="channels-scroll-area">
          {gatewayStatus.state !== 'running' && (
            <div className="mb-8 flex items-center gap-3 rounded-xl border border-[hsl(var(--warning))/0.28] bg-[hsl(var(--warning))/0.1] p-4 text-[hsl(var(--warning))]">
              <AlertCircle className="h-5 w-5" />
              <span className="text-sm font-medium">
                {t('gatewayWarning')}
              </span>
            </div>
          )}

          {error && (
            <div className="mb-8 p-4 rounded-xl border border-destructive/50 bg-destructive/10 flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-destructive" />
              <span className="text-destructive text-sm font-medium">
                {error}
              </span>
            </div>
          )}

          {!error && !runtimeAvailable && (
            <div className="mb-8 rounded-xl border border-[hsl(var(--warning))/0.22] bg-[hsl(var(--warning))/0.08] p-4 text-sm text-[hsl(var(--warning))]">
              {t('gatewayRuntimeUnavailable', { state: runtimeGatewayState })}
            </div>
          )}

          <div
            data-testid="channels-workbench"
            className="grid min-w-0 gap-5 xl:grid-cols-[minmax(320px,0.94fr)_minmax(540px,1.28fr)] min-[1440px]:grid-cols-[minmax(250px,0.9fr)_minmax(360px,1.08fr)_minmax(460px,1.32fr)]"
          >
            <div data-testid="channels-navigation-stack" className="grid min-w-0 gap-5 min-[1440px]:contents">
              <section className="app-panel-surface min-w-0 rounded-[28px] p-3.5 xl:p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-semibold text-foreground">{t('supportedChannels')}</h2>
                    <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{t('availableDesc')}</p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-9 rounded-full px-3 text-xs text-foreground/80 shadow-none hover:text-foreground"
                    onClick={() => {
                      const nextChannel = unsupportedGroups[0] || allChannelTypes[0];
                      if (nextChannel) {
                        requestSelectionChange(nextChannel);
                      }
                    }}
                  >
                    <Plus className="mr-1 h-3.5 w-3.5" />
                    {t('addChannel')}
                  </Button>
                </div>

                <div className="relative mt-3">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/70" />
                  <Input
                    value={channelQuery}
                    onChange={(event) => setChannelQuery(event.target.value)}
                    placeholder={t('searchPlaceholder')}
                    className="app-field-surface h-9 rounded-2xl pl-9 text-sm shadow-none"
                  />
                </div>

                <div className="mt-3 space-y-3">
                  {configuredFilteredChannelTypes.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="px-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/80">
                        {t('configuredSection')}
                      </p>
                      {configuredFilteredChannelTypes.map((channelType) => {
                        const meta = CHANNEL_META[channelType];
                        const group = groupedByType[channelType];
                        const isSelected = selectedChannelType === channelType;
                        return (
                          <button
                            key={channelType}
                            type="button"
                            data-testid={`channel-rail-item-${channelType}`}
                            aria-pressed={isSelected}
                            onClick={() => requestSelectionChange(channelType)}
                            className={cn(
                              'w-full rounded-2xl border px-3 py-2.5 text-left transition-all',
                              isSelected
                                ? selectedWorkbenchItemClass
                                : 'border-transparent hover:border-border/70 hover:bg-accent/50',
                            )}
                          >
                            <div className="flex items-center gap-3">
                              <div className="app-field-surface flex h-9 w-9 shrink-0 items-center justify-center rounded-full">
                                <ChannelLogo type={channelType} />
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-medium text-foreground">{meta.name}</p>
                                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                                  {`${group.accounts.length} · ${getRuntimeAwareStatusLabel(group.status, runtimeAvailable, t)} · ${group.enabled ? t('enabledLabel') : t('disabledLabel')}`}
                                </p>
                              </div>
                              <div
                                data-testid={`channel-rail-indicator-${channelType}`}
                                className={cn('h-2.5 w-2.5 shrink-0 rounded-full', getConfiguredChannelRailTone(group.enabled))}
                              />
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {unconfiguredFilteredChannelTypes.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="px-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/80">
                        {t('availableSection')}
                      </p>
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
                            className={cn(
                              'w-full rounded-2xl border px-3 py-2.5 text-left transition-all',
                              isSelected
                                ? selectedWorkbenchItemClass
                                : 'border-transparent hover:border-border/70 hover:bg-accent/50',
                            )}
                          >
                            <div className="flex items-center gap-3">
                              <div className="app-field-surface flex h-9 w-9 shrink-0 items-center justify-center rounded-full">
                                <ChannelLogo type={channelType} />
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-medium text-foreground">{meta.name}</p>
                                <p className="mt-0.5 truncate text-xs text-muted-foreground">{t('available')}</p>
                              </div>
                              <div className="status-indicator status-indicator-idle h-2.5 w-2.5 shrink-0 rounded-full" />
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {filteredChannelTypes.length === 0 && (
                    <div className="rounded-2xl border border-dashed border-border/70 px-3 py-4 text-xs text-muted-foreground">
                      {t('emptySearch')}
                    </div>
                  )}
                </div>
              </section>

              <section className="app-panel-surface min-w-0 rounded-[28px] p-4">
                {selectedMeta && (
                  <>
                    <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div className="min-w-0">
                        <h2 className="text-sm font-semibold text-foreground">{selectedMeta.name}</h2>
                        <p className="mt-1 text-xs leading-5 text-muted-foreground">
                          {selectedGroup
                            ? t('accountListSummary', { count: selectedGroup.accounts.length, default: selectedGroup.defaultAccountId })
                            : t('availableDesc')}
                        </p>
                      </div>
                      <div
                        data-testid="channel-account-header-actions"
                        className="grid shrink-0 grid-flow-col auto-cols-max items-center justify-end gap-2 self-start"
                      >
                        {selectedGroup && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 rounded-full px-3 text-xs text-foreground/80 shadow-none hover:text-foreground"
                            onClick={() => {
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
                            }}
                          >
                            <Plus className="mr-1 h-3.5 w-3.5" />
                            {t('account.add')}
                          </Button>
                        )}
                        {selectedGroup && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                            onClick={() => setDeleteTarget({ channelType: selectedGroup.channelType })}
                            title={t('account.deleteChannel')}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>

                    {selectedGroup ? (
                      <div className="space-y-2">
                        {selectedGroup.accounts.map((account) => {
                          const displayName =
                            account.accountId === 'default' && account.name === account.accountId
                              ? t('account.mainAccount')
                              : account.name;
                          const isSelected = selectedAccountId === account.accountId;
                          return (
                            <div
                              key={`${selectedGroup.channelType}-${account.accountId}`}
                              role="button"
                              tabIndex={0}
                              data-testid={`channel-account-item-${account.accountId}`}
                              onClick={() => requestSelectionChange(selectedGroup.channelType as ChannelType, account.accountId)}
                              onKeyDown={(event) => {
                                if (event.key === 'Enter' || event.key === ' ') {
                                  event.preventDefault();
                                  requestSelectionChange(selectedGroup.channelType as ChannelType, account.accountId);
                                }
                              }}
                              className={cn(
                                'w-full rounded-2xl border px-4 py-4 text-left transition-all',
                                isSelected
                                  ? selectedWorkbenchItemClass
                                  : 'app-field-surface hover:bg-accent/45',
                              )}
                            >
                              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2">
                                    <p className="truncate text-sm font-medium text-foreground">{displayName}</p>
                                    {account.isDefault && (
                                      <Badge variant="secondary" className="h-5 rounded-full px-1.5 text-[10px] shadow-none">
                                        {t('account.default')}
                                      </Badge>
                                    )}
                                    {!account.enabled && (
                                      <Badge variant="outline" className="h-5 rounded-full px-1.5 text-[10px] shadow-none">
                                        {t('disabledLabel')}
                                      </Badge>
                                    )}
                                  </div>
                                  <p className="mt-1 text-xs leading-5 text-muted-foreground">{t('account.idLabel', { id: account.accountId })}</p>
                                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                                    {account.agentId ? t('account.boundTo', { agent: account.agentId }) : t('account.unassigned')}
                                  </p>
                                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                                    {t('account.connectionStatusLabel', {
                                      status: getRuntimeAwareStatusLabel(account.status, runtimeAvailable, t),
                                    })}
                                  </p>
                                  {account.lastError && (
                                    <p className="mt-1 text-xs leading-5 text-destructive">{account.lastError}</p>
                                  )}
                                </div>

                                <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                                  <div className={cn('h-2.5 w-2.5 rounded-full', getRuntimeAwareStatusTone(account.status, runtimeAvailable))} />
                                  {!account.isDefault && (
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="outline"
                                      className="h-8 rounded-full px-3 text-xs"
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        void handleSetDefaultAccount(selectedGroup.channelType, account.accountId);
                                      }}
                                    >
                                      {t('account.setDefault')}
                                    </Button>
                                  )}
                                  <Button
                                    type="button"
                                    size="icon"
                                    variant="ghost"
                                    className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      setDeleteTarget({ channelType: selectedGroup.channelType, accountId: account.accountId });
                                    }}
                                    title={t('account.delete')}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="app-field-surface rounded-2xl border-dashed px-4 py-6">
                        <p className="mb-1 text-sm font-medium text-foreground">{selectedMeta.name}</p>
                        <p className="text-xs leading-5 text-muted-foreground">{t(selectedMeta.description.replace('channels:', ''))}</p>
                        <Button
                          size="sm"
                          variant="outline"
                          className="mt-4 h-8 rounded-full px-3 text-xs text-foreground/80 shadow-none hover:text-foreground"
                          onClick={() => {
                            if (!selectedChannelType) return;
                            void openConfigModal(selectedChannelType, {
                              allowExistingConfig: true,
                            });
                          }}
                        >
                          <Plus className="mr-1 h-3.5 w-3.5" />
                          {t('addChannel')}
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </section>
            </div>

            <section className="app-panel-surface min-w-0 rounded-[28px] p-4">
              {!selectedMeta && (
                <div className="rounded-2xl border border-dashed border-border/70 p-6 text-sm text-muted-foreground">
                  {t('availableDesc')}
                </div>
              )}

              {selectedMeta && selectedChannelType === 'whatsapp' && (
                <div className="space-y-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-foreground">{selectedMeta.name}</h3>
                      <p className="mt-1 text-sm leading-6 text-muted-foreground">{t(selectedMeta.description.replace('channels:', ''))}</p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 rounded-full px-3 text-xs"
                      onClick={() => openChannelDocs('whatsapp')}
                    >
                      <BookOpen className="mr-1 h-3.5 w-3.5" />
                      {t('dialog.viewDocs')}
                      <ExternalLink className="ml-1 h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <Button
                    onClick={() => {
                      void openConfigModal('whatsapp', {
                        accountId: selectedAccountId,
                        allowExistingConfig: true,
                      });
                    }}
                    className="rounded-full"
                  >
                    {t('dialog.generateQRCode')}
                  </Button>
                </div>
              )}

              {selectedMeta && selectedChannelType !== 'whatsapp' && !selectedRegistry && (
                <div className="space-y-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-foreground">{selectedMeta.name}</h3>
                      <p className="mt-1 text-sm leading-6 text-muted-foreground">{t(selectedMeta.description.replace('channels:', ''))}</p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 rounded-full px-3 text-xs"
                      onClick={() => selectedChannelType && openChannelDocs(selectedChannelType)}
                    >
                      <BookOpen className="mr-1 h-3.5 w-3.5" />
                      {t('dialog.viewDocs')}
                      <ExternalLink className="ml-1 h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <Button
                    onClick={() => {
                      if (!selectedChannelType) return;
                      void openConfigModal(selectedChannelType, {
                        accountId: selectedAccountId,
                        allowExistingConfig: true,
                      });
                    }}
                    className="rounded-full"
                  >
                    {selectedGroup ? t('account.edit') : t('dialog.saveAndConnect')}
                  </Button>
                </div>
              )}

              {selectedMeta && selectedChannelType !== 'whatsapp' && selectedRegistry && (
                <div className="flex min-h-[560px] flex-col">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-foreground">{selectedMeta.name}</h3>
                      <p className="mt-1 text-sm leading-6 text-muted-foreground">
                        {selectedAccount
                          ? t('account.idLabel', { id: selectedAccount.accountId })
                          : t(selectedMeta.description.replace('channels:', ''))}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 rounded-full px-3 text-xs"
                        onClick={() => {
                          if (!selectedChannelType) return;
                          void openConfigModal(selectedChannelType, {
                            accountId: selectedAccountId,
                            allowExistingConfig: true,
                          });
                        }}
                      >
                        {t('account.edit')}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 rounded-full px-3 text-xs"
                        onClick={() => selectedChannelType && openChannelDocs(selectedChannelType)}
                      >
                        <BookOpen className="mr-1 h-3.5 w-3.5" />
                        {t('dialog.viewDocs')}
                        <ExternalLink className="ml-1 h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>

                  <div
                    data-testid="channels-editor-scroll"
                    className={cn('mt-5 flex-1 space-y-4 overflow-y-auto pr-2', editorScrollbarClass)}
                  >
                    <div className="app-panel-surface-elevated rounded-2xl p-5">
                      <div className="mb-4">
                        <p className="text-sm font-semibold text-foreground">{t('editor.basicTitle')}</p>
                        <p className="mt-1 text-xs leading-5 text-muted-foreground">{t('editor.basicDesc')}</p>
                      </div>
                      <div data-testid="channel-basic-fields-grid" className="grid gap-3 xl:grid-cols-2">
                        <div
                          data-testid="channel-account-id-card"
                          className="app-field-surface rounded-2xl px-4 py-3 xl:col-span-2"
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <Label htmlFor="channel-account-id" className="text-xs font-medium text-foreground/80">
                              {t('account.customIdLabel')}
                            </Label>
                            {selectedAccount?.isDefault && (
                              <Badge variant="secondary" className="h-5 rounded-full px-1.5 text-[10px] shadow-none">
                                {t('account.default')}
                              </Badge>
                            )}
                          </div>
                          <p className="mt-1 text-xs leading-5 text-muted-foreground line-clamp-2" title={t('account.renameHint')}>
                            {t('account.renameHint')}
                          </p>
                          <Input
                            id="channel-account-id"
                            value={accountIdDraft}
                            disabled={editorLoading || editorSaving}
                            onChange={(event) => setAccountIdDraft(event.target.value)}
                            placeholder={t('account.customIdPlaceholder')}
                            className="app-field-surface mt-3 h-9 rounded-2xl text-[13px] shadow-none"
                          />
                        </div>
                        {selectedRegistry.basicFields.map((field) => (
                          <ChannelFieldEditor
                            key={field.key}
                            field={field}
                            t={t}
                            value={editorValues[field.key]}
                            disabled={editorLoading || editorSaving}
                            onChange={(value) => handleEditorValueChange(field.key, value)}
                          />
                        ))}
                      </div>
                    </div>

                    <div className="app-panel-surface-elevated rounded-2xl p-5">
                      <div className="mb-4">
                        <p className="text-sm font-semibold text-foreground">{t('editor.behaviorTitle')}</p>
                        <p className="mt-1 text-xs leading-5 text-muted-foreground">{t('editor.behaviorDesc')}</p>
                      </div>
                      <div className="space-y-4">
                        <div className="app-field-surface grid gap-3 rounded-2xl px-4 py-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-start">
                          <div className="min-w-0">
                            <Label className="text-sm font-medium text-foreground">{t('dialog.enableChannel')}</Label>
                            <p className="mt-1 text-xs leading-5 text-muted-foreground">
                              {selectedGroup?.enabled ? t('enabledLabel') : t('disabledLabel')}
                            </p>
                          </div>
                          <Switch
                            checked={selectedGroup?.enabled ?? true}
                            className="data-[state=checked]:bg-foreground/75 dark:data-[state=checked]:bg-white/70"
                            disabled={!selectedChannelType || editorTogglingEnabled}
                            onCheckedChange={(checked) => {
                              if (!selectedChannelType) return;
                              void handleSetChannelEnabled(selectedChannelType, checked);
                            }}
                          />
                        </div>

                        <div className="app-field-surface grid gap-3 rounded-2xl px-4 py-3 md:grid-cols-[minmax(0,1fr)_minmax(220px,240px)] md:items-start">
                          <div className="min-w-0">
                            <Label htmlFor="channel-account-agent" className="text-sm font-medium text-foreground">
                              {t('account.bindAgentLabel')}
                            </Label>
                            <p className="mt-1 text-xs leading-5 text-muted-foreground line-clamp-2">
                              {selectedAccount?.agentId || t('account.unassigned')}
                            </p>
                          </div>
                          <Select
                            id="channel-account-agent"
                            value={selectedAccount?.agentId || ''}
                            data-testid="channel-agent-select-trigger"
                            onValueChange={(agentId) => {
                              if (!selectedChannelType || !selectedAccountId) return;
                              void handleBindAgent(selectedChannelType, selectedAccountId, agentId);
                            }}
                            options={[
                              { value: '', label: t('account.unassigned') },
                              ...agents.map((agent) => ({
                                value: agent.id,
                                label: agent.name,
                              })),
                            ]}
                            className="app-field-surface h-9 w-full max-w-full rounded-2xl text-[13px] shadow-none"
                          />
                        </div>
                      </div>
                    </div>

                    {visibleAdvancedSections.map((section) => (
                      <ChannelEditorSection
                        key={section.id}
                        title={section.label}
                        subtitle={getSectionSummary(section, editorValues, t) || t('editor.sectionSubtitle', { count: section.fields.length })}
                        defaultOpen={section.id === 'access'}
                      >
                        {section.fields.map((field) => (
                          <ChannelFieldEditor
                            key={field.key}
                            field={field}
                            t={t}
                            value={editorValues[field.key]}
                            disabled={editorLoading || editorSaving}
                            onChange={(value) => handleEditorValueChange(field.key, value)}
                          />
                        ))}
                      </ChannelEditorSection>
                    ))}

                    {candidateSections.map((section) => (
                      <ChannelEditorSection
                        key={section.id}
                        title={section.label}
                        subtitle={getSectionSummary(section, editorValues, t) || t('editor.pluginSectionSubtitle', { count: section.fields.length })}
                        badge={t('editor.pluginBadge')}
                      >
                        {section.fields.map((field) => (
                          <ChannelFieldEditor
                            key={field.key}
                            field={field}
                            t={t}
                            value={editorValues[field.key]}
                            disabled={editorLoading || editorSaving}
                            onChange={(value) => handleEditorValueChange(field.key, value)}
                          />
                        ))}
                      </ChannelEditorSection>
                    ))}

                    {editorValidation && (
                      <div className={cn(
                        'rounded-2xl border px-4 py-3 text-sm',
                        editorValidation.valid
                          ? 'border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-300'
                          : 'border-destructive/30 bg-destructive/10 text-destructive',
                      )}>
                        {editorValidation.errors.length > 0 && (
                          <div className="space-y-1">
                            {editorValidation.errors.map((item) => (
                              <p key={item}>{item}</p>
                            ))}
                          </div>
                        )}
                        {editorValidation.warnings.length > 0 && (
                          <div className={cn('space-y-1', editorValidation.errors.length > 0 && 'mt-3')}>
                            {editorValidation.warnings.map((item) => (
                              <p key={item}>{item}</p>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="mt-5 flex flex-wrap items-center justify-end gap-2 border-t border-border/70 pt-4">
                    <Button
                      type="button"
                      variant="outline"
                      className="h-9 rounded-full px-4 text-xs"
                      disabled={editorLoading || editorValidating || editorSaving}
                      onClick={() => {
                        void handleValidateConfig();
                      }}
                    >
                      {editorValidating ? t('dialog.validating') : t('dialog.validateConfig')}
                    </Button>
                    <Button
                      type="button"
                      className="h-9 rounded-full px-4 text-xs"
                      disabled={editorLoading || editorSaving}
                      onClick={() => {
                        void handleSaveInlineConfig();
                      }}
                    >
                      {editorSaving ? t('dialog.validatingAndSaving') : (selectedGroup ? t('dialog.updateAndReconnect') : t('dialog.saveAndConnect'))}
                    </Button>
                  </div>
                </div>
              )}
            </section>
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
        open={!!pendingSelection}
        title={t('editor.unsavedChangesTitle')}
        message={t('editor.unsavedChangesMessage')}
        confirmLabel={t('editor.discardChangesConfirm')}
        cancelLabel={t('common.cancel', 'Cancel')}
        onConfirm={() => {
          if (pendingSelection) {
            applySelection(pendingSelection.channelType, pendingSelection.accountId);
          }
          setPendingSelection(null);
        }}
        onCancel={() => setPendingSelection(null)}
      />
    </WorkspacePageFrame>
  );
}

function ChannelEditorSection({
  title,
  subtitle,
  badge,
  defaultOpen = false,
  children,
}: {
  title: string;
  subtitle: string;
  badge?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <details
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
      className="app-panel-surface-elevated rounded-2xl px-4 py-3"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">{title}</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground line-clamp-2" title={subtitle}>{subtitle}</p>
        </div>
        {badge && (
          <Badge variant="secondary" className="h-6 rounded-full px-2 text-[10px] shadow-none">
            {badge}
          </Badge>
        )}
      </summary>
      <div className="mt-4 grid gap-4">{children}</div>
    </details>
  );
}

function ChannelFieldEditor({
  field,
  value,
  disabled,
  onChange,
  t,
}: {
  field: ChannelConfigContractField;
  value: EditorValue | undefined;
  disabled?: boolean;
  onChange: (value: EditorValue) => void;
  t: (key: string, options?: Record<string, unknown>) => string;
}) {
  const label = resolveTranslationText(t, field.label);
  const description = resolveTranslationText(t, field.description);
  const placeholder = resolveTranslationText(t, field.placeholder);
  const inputId = `channel-editor-${field.key}`;
  const defaultValueLabel = field.defaultValue === undefined
    ? null
    : typeof field.defaultValue === 'boolean'
      ? (field.defaultValue ? t('enabledLabel') : t('disabledLabel'))
      : typeof field.defaultValue === 'number'
        ? String(field.defaultValue)
        : isStringArrayValue(field.defaultValue)
          ? field.defaultValue.join(', ')
          : field.defaultValue;
  const defaultBadgeLabel = defaultValueLabel ? t('editor.defaultValueBadge', { value: defaultValueLabel }) : null;

  if (field.type === 'boolean') {
    return (
      <div className="app-field-surface rounded-2xl px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-1">
            <Label className="text-xs font-medium text-foreground/80">{label}</Label>
            {description && <p className="text-xs leading-5 text-muted-foreground line-clamp-2" title={description}>{description}</p>}
          </div>
          {defaultBadgeLabel && (
            <span
              className="max-w-[11rem] truncate rounded-full bg-secondary/80 px-2 py-1 text-[10px] font-medium text-muted-foreground"
              title={t('editor.defaultValueLabel', { value: defaultValueLabel })}
            >
              {defaultBadgeLabel}
            </span>
          )}
          <Switch
            checked={getFieldBooleanValue(field, value)}
            disabled={disabled}
            onCheckedChange={(checked) => onChange(checked)}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="app-field-surface space-y-1.5 rounded-2xl px-4 py-3">
      <div data-testid={`channel-field-header-${field.key}`}>
        <div className="flex items-start justify-between gap-3">
          <Label htmlFor={inputId} className="min-w-0 flex-1 text-xs font-medium text-foreground/80">{label}</Label>
          {defaultBadgeLabel && (
            <span
              className="max-w-[11rem] truncate rounded-full bg-secondary/80 px-2 py-1 text-[10px] font-medium text-muted-foreground"
              title={t('editor.defaultValueLabel', { value: defaultValueLabel })}
            >
              {defaultBadgeLabel}
            </span>
          )}
        </div>
        {description && <p className="text-xs leading-5 text-muted-foreground line-clamp-2" title={description}>{description}</p>}
      </div>

      {field.type === 'select' ? (
        <Select
          id={inputId}
          value={getFieldStringValue(field, value)}
          data-testid={`channel-field-select-trigger-${field.key}`}
          disabled={disabled}
          placeholder={placeholder || t('editor.selectPlaceholder')}
          onValueChange={(nextValue) => onChange(nextValue)}
          options={(field.options || []).map((option) => ({
            value: option.value,
            label: resolveTranslationText(t, option.label),
          }))}
          className="app-field-surface h-9 rounded-2xl text-[13px] shadow-none"
        />
      ) : field.type === 'array' ? (
        <Input
          id={inputId}
          type="text"
          value={getFieldStringValue(field, value)}
          disabled={disabled}
          onChange={(event) =>
            onChange(
              event.target.value
                .split(',')
                .map((item) => item.trim())
                .filter(Boolean),
            )
          }
          placeholder={placeholder}
          className="app-field-surface h-9 rounded-2xl text-[13px] shadow-none"
        />
      ) : field.type === 'number' ? (
        <Input
          id={inputId}
          type="number"
          value={getFieldStringValue(field, value)}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value === '' ? '' : Number(event.target.value))}
          placeholder={placeholder}
          className="app-field-surface h-9 rounded-2xl text-[13px] shadow-none"
        />
      ) : (
        <Input
          id={inputId}
          type={field.valueType === 'password' ? 'password' : 'text'}
          value={getFieldStringValue(field, value)}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className="app-field-surface h-9 rounded-2xl text-[13px] shadow-none"
        />
      )}
    </div>
  );
}

function ChannelLogo({ type }: { type: ChannelType }) {
  switch (type) {
    case 'telegram':
      return <img src={telegramIcon} alt="Telegram" className="w-[22px] h-[22px] dark:invert" />;
    case 'discord':
      return <img src={discordIcon} alt="Discord" className="w-[22px] h-[22px] dark:invert" />;
    case 'whatsapp':
      return <img src={whatsappIcon} alt="WhatsApp" className="w-[22px] h-[22px] dark:invert" />;
    case 'dingtalk':
      return <img src={dingtalkIcon} alt="DingTalk" className="w-[22px] h-[22px] dark:invert" />;
    case 'feishu':
      return <img src={feishuIcon} alt="Feishu" className="w-[22px] h-[22px] dark:invert" />;
    case 'wecom':
      return <img src={wecomIcon} alt="WeCom" className="w-[22px] h-[22px] dark:invert" />;
    case 'qqbot':
      return <img src={qqIcon} alt="QQ" className="w-[22px] h-[22px] dark:invert" />;
    default:
      return <span className="text-[22px]">{CHANNEL_ICONS[type] || '💬'}</span>;
  }
}

export default Channels;
