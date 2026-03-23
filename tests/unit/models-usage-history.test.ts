import { describe, expect, it } from 'vitest';
import {
  filterUsageHistoryByWindow,
  groupUsageHistory,
  groupUsageHistoryByWindow,
  USAGE_BREAKDOWN_LIMIT,
  type UsageHistoryEntry,
} from '@/pages/Models/usage-history';

function createEntry(day: number, totalTokens: number): UsageHistoryEntry {
  return {
    timestamp: `2026-03-${String(day).padStart(2, '0')}T12:00:00.000Z`,
    sessionId: `session-${day}`,
    agentId: 'main',
    model: 'gpt-5',
    inputTokens: totalTokens,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    totalTokens,
  };
}

function createDatedEntry(timestamp: string, totalTokens: number): UsageHistoryEntry {
  return {
    timestamp,
    sessionId: `session-${timestamp}`,
    agentId: 'main',
    model: 'gpt-5',
    inputTokens: totalTokens,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    totalTokens,
  };
}

describe('models usage history helpers', () => {
  it('keeps all day buckets instead of truncating to the first eight', () => {
    const entries = Array.from({ length: 12 }, (_, index) => createEntry(index + 1, index + 1));

    const groups = groupUsageHistory(entries, 'day');

    expect(groups).toHaveLength(12);
    expect(groups[0]?.totalTokens).toBe(1);
    expect(groups[11]?.totalTokens).toBe(12);
  });

  it('limits model buckets to the top eight by total tokens', () => {
    const entries = Array.from({ length: 10 }, (_, index) => ({
      ...createEntry(index + 1, index + 1),
      model: `model-${index + 1}`,
    }));

    const groups = groupUsageHistory(entries, 'model');

    expect(USAGE_BREAKDOWN_LIMIT).toBe(8);
    expect(groups).toHaveLength(USAGE_BREAKDOWN_LIMIT);
    expect(groups[0]?.label).toBe('model-10');
    expect(groups[7]?.label).toBe('model-3');
  });

  it('enforces all window aggregation by month instead of keeping every day bucket', () => {
    const entries = [
      createDatedEntry('2026-01-05T12:00:00.000Z', 5),
      createDatedEntry('2026-01-18T12:00:00.000Z', 7),
      createDatedEntry('2026-02-02T12:00:00.000Z', 11),
      createDatedEntry('2026-02-20T12:00:00.000Z', 13),
      createDatedEntry('2026-03-09T12:00:00.000Z', 17),
    ];

    const groups = groupUsageHistoryByWindow(entries, 'all', 'day');

    expect(groups).toHaveLength(3);
    expect(groups.map((group) => group.totalTokens)).toEqual([12, 24, 17]);
    expect(groups.map((group) => group.label)).toEqual(['2026-01', '2026-02', '2026-03']);
  });

  it('filters the last 30 days relative to now instead of calendar month boundaries', () => {
    const now = Date.parse('2026-03-12T12:00:00.000Z');
    const entries = [
      {
        ...createEntry(12, 12),
        timestamp: '2026-03-12T12:00:00.000Z',
      },
      {
        ...createEntry(11, 11),
        timestamp: '2026-02-11T12:00:00.000Z',
      },
      {
        ...createEntry(10, 10),
        timestamp: '2026-02-10T11:59:59.000Z',
      },
    ];

    const filtered = filterUsageHistoryByWindow(entries, '30d', now);

    expect(filtered).toHaveLength(2);
    expect(filtered.map((entry) => entry.totalTokens)).toEqual([12, 11]);
  });
});
