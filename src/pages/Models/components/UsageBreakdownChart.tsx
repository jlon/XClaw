import { cn } from '@/lib/utils';
import type { UsageGroup } from '../usage-history';
import type { BreakdownDimension, UsageMetric } from '../workbench-view-model';

interface UsageBreakdownChartProps {
  groups: UsageGroup[];
  dimension: BreakdownDimension;
  metric: UsageMetric;
  emptyLabel: string;
  costIncompleteLabel: string;
  title: string;
  requestsLabel: string;
  onSelect?: (label: string) => void;
}

const formatTokenCount = (value: number): string => Intl.NumberFormat().format(value);
const formatUsageCost = (value: number): string => `$${value.toFixed(2)}`;
const surfaceClass = 'app-insight-surface rounded-[14px] border border-[hsl(var(--border-subtle)/0.78)] px-3.5 py-3';
const rowBaseClass = 'space-y-1.5 border-t border-[hsl(var(--border-subtle)/0.62)] py-2.5 first:border-t-0 first:pt-0 last:pb-0';

const hasIncompleteCost = (groups: UsageGroup[]): boolean =>
  groups.some((group) => group.requestCount > group.costEntryCount);

export function UsageBreakdownChart({
  groups,
  dimension,
  metric,
  emptyLabel,
  costIncompleteLabel,
  title,
  requestsLabel,
  onSelect,
}: UsageBreakdownChartProps) {
  if (groups.length === 0) {
    return (
      <section className={`${surfaceClass} flex min-h-[260px] items-center justify-center text-[14px] font-medium text-muted-foreground`} data-testid="models-breakdown-chart" data-metric={metric} data-dimension={dimension}>
        {emptyLabel}
      </section>
    );
  }

  if (metric === 'cost' && hasIncompleteCost(groups)) {
    return (
      <section className={`${surfaceClass} flex min-h-[260px] items-center justify-center text-[14px] font-medium text-muted-foreground`} data-testid="models-breakdown-chart" data-metric={metric} data-dimension={dimension}>
        {costIncompleteLabel}
      </section>
    );
  }

  const maxValue = Math.max(...groups.map((group) => metric === 'cost' ? group.totalCostUsd : group.totalTokens), metric === 'cost' ? 0.01 : 1);

  return (
    <section className={surfaceClass} data-testid="models-breakdown-chart" data-metric={metric} data-dimension={dimension}>
      <div className="mb-2.5 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">{title}</p>
        </div>
      </div>
      <div>
        {groups.map((group) => {
          const value = metric === 'cost' ? group.totalCostUsd : group.totalTokens;
          const width = Math.max((value / maxValue) * 100, value > 0 ? 6 : 0);
          const content = (
            <>
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-medium text-foreground">{group.label}</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {requestsLabel}: {group.requestCount}
                  </p>
                </div>
                <p className="shrink-0 text-[13px] font-semibold text-foreground">
                  {metric === 'cost' ? formatUsageCost(group.totalCostUsd) : formatTokenCount(group.totalTokens)}
                </p>
              </div>
              <svg viewBox="0 0 100 6" className="mt-1.5 h-1.5 w-full overflow-visible" preserveAspectRatio="none">
                <rect x="0" y="0" width="100" height="6" rx="3" fill="hsl(var(--surface-hover) / 0.74)" />
                <rect
                  x="0"
                  y="0"
                  width={width}
                  height="6"
                  rx="3"
                  fill={metric === 'cost' ? 'hsl(var(--success) / 0.82)' : 'hsl(var(--accent) / 0.74)'}
                />
              </svg>
            </>
          );

          if (!onSelect) {
            return (
              <div key={group.label} className={rowBaseClass} data-testid="usage-breakdown-row">
                {content}
              </div>
            );
          }

          return (
            <button
              key={group.label}
              type="button"
              className={cn('w-full text-left transition-colors hover:text-foreground', rowBaseClass)}
              data-testid="usage-breakdown-row"
              onClick={() => onSelect(group.label)}
            >
              {content}
            </button>
          );
        })}
      </div>
    </section>
  );
}
