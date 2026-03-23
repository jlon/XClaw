import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { UsageBreakdownChart } from '@/pages/Models/components/UsageBreakdownChart';
import { UsageTrendChart } from '@/pages/Models/components/UsageTrendChart';
import type { UsageGroup } from '@/pages/Models/usage-history';

function createGroup(overrides: Partial<UsageGroup> = {}): UsageGroup {
  return {
    label: 'Mar 20',
    totalTokens: 120,
    inputTokens: 60,
    outputTokens: 40,
    cacheTokens: 20,
    totalCostUsd: 1.2,
    requestCount: 3,
    costEntryCount: 3,
    sortKey: 1,
    ...overrides,
  };
}

describe('models token intelligence charts', () => {
  it('renders one trend bar per usage group', () => {
    render(
      <UsageTrendChart
        groups={[
          createGroup({ label: 'Mar 18', sortKey: 1 }),
          createGroup({ label: 'Mar 19', sortKey: 2 }),
          createGroup({ label: 'Mar 20', sortKey: 3 }),
        ]}
        metric="tokens"
        emptyLabel="No usage"
        costIncompleteLabel="成本数据不完整"
        inputLabel="Input"
        outputLabel="Output"
        cacheLabel="Cache"
        costLabel="Cost"
      />,
    );

    expect(screen.getAllByTestId('usage-trend-bar')).toHaveLength(3);
  });

  it('does not render large exact value labels above each trend column by default', () => {
    render(
      <UsageTrendChart
        groups={[createGroup({ totalTokens: 1234, inputTokens: 600, outputTokens: 400, cacheTokens: 234 })]}
        metric="tokens"
        emptyLabel="No usage"
        costIncompleteLabel="成本数据不完整"
        inputLabel="Input"
        outputLabel="Output"
        cacheLabel="Cache"
        costLabel="Cost"
      />,
    );

    expect(screen.queryByText('1,234')).not.toBeInTheDocument();
  });

  it('caps the breakdown chart rows to the supplied top groups', () => {
    render(
      <UsageBreakdownChart
        groups={Array.from({ length: 8 }, (_, index) => createGroup({
          label: `provider-${index + 1}`,
          sortKey: index,
          totalTokens: 100 - index,
        }))}
        dimension="provider"
        metric="tokens"
        emptyLabel="No usage"
        costIncompleteLabel="成本数据不完整"
        title="Provider breakdown"
        requestsLabel="Requests"
      />,
    );

    expect(screen.getAllByTestId('usage-breakdown-row')).toHaveLength(8);
  });

  it('shows a fallback when cost data is incomplete', () => {
    render(
      <UsageTrendChart
        groups={[createGroup({ requestCount: 3, costEntryCount: 1 })]}
        metric="cost"
        emptyLabel="No usage"
        costIncompleteLabel="成本数据不完整"
        inputLabel="Input"
        outputLabel="Output"
        cacheLabel="Cache"
        costLabel="Cost"
      />,
    );

    expect(screen.getByText('成本数据不完整')).toBeInTheDocument();
  });
});
