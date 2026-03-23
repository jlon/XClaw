import { findProviderAccountsByRuntimeKey, getProviderAccountRuntimeKey } from '@/lib/provider-accounts';
import { getProviderTypeInfo, PROVIDER_TYPES, type ProviderAccount } from '@/lib/providers';
import type { UsageHistoryEntry } from './usage-history';

export type BreakdownDimension = 'provider' | 'model' | 'request';
export type UsageMetric = 'tokens' | 'cost';

export interface ResolveSelectedRuntimeProviderKeyInput {
  accountId?: string | null;
  runtimeProviderKey?: string | null;
  accounts: ProviderAccount[];
}

export interface ProviderUsageSummary {
  accountIds: string[];
  accountLabels: string[];
  accountCount: number;
  runtimeProviderKey: string;
  vendorIds: ProviderAccount['vendorId'][];
  label: string;
  totalTokens: number;
  totalCostUsd: number;
  requestCount: number;
  modelCount: number;
  selected: boolean;
}

export interface BuildProviderUsageSummariesInput {
  accounts: ProviderAccount[];
  entries: UsageHistoryEntry[];
  selectedRuntimeProviderKey?: string | null;
}

export interface UsageKpi {
  key: 'tokens' | 'cost' | 'requests' | 'models';
  value: number;
}

export interface BuildUsageKpisInput {
  entries: UsageHistoryEntry[];
  selectedRuntimeProviderKey?: string | null;
}

const normalizeRuntimeProviderKey = (value: string | null | undefined): string | null =>
  value?.trim().toLowerCase() || null;

const getUniqueStrings = (values: Array<string | null | undefined>): string[] =>
  Array.from(new Set(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value))));

const isProviderType = (value: string): value is ProviderAccount['vendorId'] =>
  PROVIDER_TYPES.includes(value as ProviderAccount['vendorId']);

const sumEntryTokens = (entries: UsageHistoryEntry[]): number =>
  entries.reduce((total, entry) => total + entry.totalTokens, 0);

const sumEntryCost = (entries: UsageHistoryEntry[]): number =>
  entries.reduce((total, entry) => total + (Number.isFinite(entry.costUsd ?? NaN) ? (entry.costUsd ?? 0) : 0), 0);

const countDistinctModels = (entries: UsageHistoryEntry[]): number =>
  new Set(entries.map((entry) => entry.model?.trim()).filter((model): model is string => Boolean(model))).size;

const getScopedEntries = (
  entries: UsageHistoryEntry[],
  selectedRuntimeProviderKey?: string | null,
): UsageHistoryEntry[] => {
  const normalizedSelectedRuntimeProviderKey = normalizeRuntimeProviderKey(selectedRuntimeProviderKey);
  return normalizedSelectedRuntimeProviderKey
    ? entries.filter((entry) => normalizeRuntimeProviderKey(entry.provider) === normalizedSelectedRuntimeProviderKey)
    : entries;
};

export const resolveSelectedRuntimeProviderKey = ({
  accountId,
  runtimeProviderKey,
  accounts,
}: ResolveSelectedRuntimeProviderKeyInput): string | null => {
  const normalizedRuntimeProviderKey = normalizeRuntimeProviderKey(runtimeProviderKey);
  if (normalizedRuntimeProviderKey) {
    return normalizedRuntimeProviderKey;
  }

  if (!accountId) {
    return null;
  }

  const selectedAccount = accounts.find((account) => account.id === accountId);

  if (selectedAccount) {
    return getProviderAccountRuntimeKey(selectedAccount).trim().toLowerCase();
  }

  return findProviderAccountsByRuntimeKey(accounts, accountId).length > 0 ? accountId.trim().toLowerCase() : null;
};

export const getBreakdownDimension = ({
  hasSelection,
  preferredFocusedDimension,
}: {
  hasSelection: boolean;
  preferredFocusedDimension?: Exclude<BreakdownDimension, 'provider'>;
}): BreakdownDimension => (hasSelection ? preferredFocusedDimension ?? 'model' : 'provider');

const getProviderUsageSummaryLabel = (
  runtimeProviderKey: string,
  providerAccounts: ProviderAccount[],
): string => {
  const accountLabels = getUniqueStrings(providerAccounts.map((account) => account.label));
  const vendorIds = getUniqueStrings(providerAccounts.map((account) => account.vendorId));

  if (providerAccounts.length === 1 && accountLabels[0]) {
    return accountLabels[0];
  }

  if (vendorIds.length === 1 && vendorIds[0] !== 'custom' && vendorIds[0] !== 'ollama' && isProviderType(vendorIds[0])) {
    return getProviderTypeInfo(vendorIds[0])?.name || runtimeProviderKey;
  }

  return runtimeProviderKey;
};

export const buildProviderUsageSummaries = ({
  accounts,
  entries,
  selectedRuntimeProviderKey,
}: BuildProviderUsageSummariesInput): ProviderUsageSummary[] => {
  const normalizedSelectedRuntimeProviderKey = normalizeRuntimeProviderKey(selectedRuntimeProviderKey);
  const groupedAccounts = new Map<string, ProviderAccount[]>();

  for (const account of accounts) {
    const runtimeProviderKey = getProviderAccountRuntimeKey(account).trim().toLowerCase();
    const existing = groupedAccounts.get(runtimeProviderKey) ?? [];
    existing.push(account);
    groupedAccounts.set(runtimeProviderKey, existing);
  }

  return Array.from(groupedAccounts.entries()).map(([runtimeProviderKey, providerAccounts]) => {
    const scopedEntries = entries.filter((entry) => normalizeRuntimeProviderKey(entry.provider) === runtimeProviderKey);

    return {
      accountIds: providerAccounts.map((account) => account.id),
      accountLabels: getUniqueStrings(providerAccounts.map((account) => account.label)),
      accountCount: providerAccounts.length,
      runtimeProviderKey,
      vendorIds: getUniqueStrings(providerAccounts.map((account) => account.vendorId)) as ProviderAccount['vendorId'][],
      label: getProviderUsageSummaryLabel(runtimeProviderKey, providerAccounts),
      totalTokens: sumEntryTokens(scopedEntries),
      totalCostUsd: sumEntryCost(scopedEntries),
      requestCount: scopedEntries.length,
      modelCount: countDistinctModels(scopedEntries),
      selected: normalizedSelectedRuntimeProviderKey === runtimeProviderKey,
    };
  });
};

export const buildUsageKpis = ({
  entries,
  selectedRuntimeProviderKey,
}: BuildUsageKpisInput): UsageKpi[] => {
  const scopedEntries = getScopedEntries(entries, selectedRuntimeProviderKey);

  return [
    {
      key: 'tokens',
      value: sumEntryTokens(scopedEntries),
    },
    {
      key: 'cost',
      value: sumEntryCost(scopedEntries),
    },
    {
      key: 'requests',
      value: scopedEntries.length,
    },
    {
      key: 'models',
      value: countDistinctModels(scopedEntries),
    },
  ];
};
