export type UsageHistoryEntry = {
  timestamp: string;
  sessionId: string;
  agentId: string;
  model?: string;
  provider?: string;
  content?: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  totalTokens: number;
  costUsd?: number;
};

export type UsageWindow = '7d' | '30d' | 'all';
export type UsageGroupBy = 'provider' | 'model' | 'day';

export type UsageGroup = {
  label: string;
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  cacheTokens: number;
  totalCostUsd: number;
  requestCount: number;
  costEntryCount: number;
  sortKey: number | string;
};

export const USAGE_BREAKDOWN_LIMIT = 8;

const normalizeUsageProviderKey = (provider: string | null | undefined): string =>
  provider?.trim().toLowerCase() || 'unknown';

export function formatUsageDay(timestamp: string): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return timestamp;
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
  }).format(date);
}

export function getUsageDaySortKey(timestamp: string): number {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return 0;
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

export function groupUsageHistory(
  entries: UsageHistoryEntry[],
  groupBy: UsageGroupBy,
): UsageGroup[] {
  const grouped = new Map<string, UsageGroup>();

  for (const entry of entries) {
    const label = groupBy === 'day'
      ? formatUsageDay(entry.timestamp)
      : groupBy === 'provider'
        ? normalizeUsageProviderKey(entry.provider)
        : (entry.model || 'Unknown');
    const current = grouped.get(label) ?? {
      label,
      totalTokens: 0,
      inputTokens: 0,
      outputTokens: 0,
      cacheTokens: 0,
      totalCostUsd: 0,
      requestCount: 0,
      costEntryCount: 0,
      sortKey: groupBy === 'day' ? getUsageDaySortKey(entry.timestamp) : label.toLowerCase(),
    };
    current.totalTokens += entry.totalTokens;
    current.inputTokens += entry.inputTokens;
    current.outputTokens += entry.outputTokens;
    current.cacheTokens += entry.cacheReadTokens + entry.cacheWriteTokens;
    current.totalCostUsd += Number.isFinite(entry.costUsd ?? NaN) ? (entry.costUsd ?? 0) : 0;
    current.requestCount += 1;
    current.costEntryCount += Number.isFinite(entry.costUsd ?? NaN) ? 1 : 0;
    grouped.set(label, current);
  }

  const sorted = Array.from(grouped.values()).sort((a, b) => {
    if (groupBy === 'day') {
      return Number(a.sortKey) - Number(b.sortKey);
    }
    return b.totalTokens - a.totalTokens;
  });

  return groupBy === 'day' ? sorted : sorted.slice(0, USAGE_BREAKDOWN_LIMIT);
}

export function filterUsageHistoryByWindow(
  entries: UsageHistoryEntry[],
  window: UsageWindow,
  now = Date.now(),
): UsageHistoryEntry[] {
  if (window === 'all') return entries;

  const days = window === '7d' ? 7 : 30;
  const cutoff = now - days * 24 * 60 * 60 * 1000;

  return entries.filter((entry) => {
    const timestamp = Date.parse(entry.timestamp);
    return Number.isFinite(timestamp) && timestamp >= cutoff;
  });
}

function formatUsageMonth(timestamp: string): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return timestamp;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function getUsageMonthSortKey(timestamp: string): number {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return 0;
  date.setDate(1);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

function groupUsageHistoryByMonth(entries: UsageHistoryEntry[]): UsageGroup[] {
  const grouped = new Map<string, UsageGroup>();

  for (const entry of entries) {
    const label = formatUsageMonth(entry.timestamp);
    const current = grouped.get(label) ?? {
      label,
      totalTokens: 0,
      inputTokens: 0,
      outputTokens: 0,
      cacheTokens: 0,
      totalCostUsd: 0,
      requestCount: 0,
      costEntryCount: 0,
      sortKey: getUsageMonthSortKey(entry.timestamp),
    };
    current.totalTokens += entry.totalTokens;
    current.inputTokens += entry.inputTokens;
    current.outputTokens += entry.outputTokens;
    current.cacheTokens += entry.cacheReadTokens + entry.cacheWriteTokens;
    current.totalCostUsd += Number.isFinite(entry.costUsd ?? NaN) ? (entry.costUsd ?? 0) : 0;
    current.requestCount += 1;
    current.costEntryCount += Number.isFinite(entry.costUsd ?? NaN) ? 1 : 0;
    grouped.set(label, current);
  }

  return Array.from(grouped.values()).sort((left, right) => Number(left.sortKey) - Number(right.sortKey));
}

export function groupUsageHistoryByWindow(
  entries: UsageHistoryEntry[],
  window: UsageWindow,
  groupBy: UsageGroupBy,
): UsageGroup[] {
  if (window === 'all' && groupBy === 'day') {
    return groupUsageHistoryByMonth(entries);
  }

  const filtered = filterUsageHistoryByWindow(entries, window);
  return groupUsageHistory(filtered, groupBy);
}
