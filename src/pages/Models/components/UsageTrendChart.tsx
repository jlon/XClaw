import type { UsageGroup } from '../usage-history';
import type { UsageMetric } from '../workbench-view-model';

interface UsageTrendChartProps {
  groups: UsageGroup[];
  metric: UsageMetric;
  emptyLabel: string;
  costIncompleteLabel: string;
  inputLabel: string;
  outputLabel: string;
  cacheLabel: string;
  costLabel: string;
}

const surfaceClass = 'app-insight-surface rounded-[14px] border border-[hsl(var(--border-subtle)/0.78)] px-3.5 py-3';

const getMaxMetricValue = (groups: UsageGroup[], metric: UsageMetric): number => {
  const values = groups.map((group) => metric === 'cost' ? group.totalCostUsd : group.totalTokens);
  return Math.max(...values, metric === 'cost' ? 0.01 : 1);
};

const hasIncompleteCost = (groups: UsageGroup[]): boolean =>
  groups.some((group) => group.requestCount > group.costEntryCount);

export function UsageTrendChart({
  groups,
  metric,
  emptyLabel,
  costIncompleteLabel,
  inputLabel,
  outputLabel,
  cacheLabel,
  costLabel,
}: UsageTrendChartProps) {
  if (groups.length === 0) {
    return (
      <div className={`${surfaceClass} flex min-h-[260px] items-center justify-center text-[14px] font-medium text-muted-foreground`} data-testid="models-trend-chart" data-metric={metric}>
        {emptyLabel}
      </div>
    );
  }

  if (metric === 'cost' && hasIncompleteCost(groups)) {
    return (
      <div className={`${surfaceClass} flex min-h-[260px] items-center justify-center text-[14px] font-medium text-muted-foreground`} data-testid="models-trend-chart" data-metric={metric}>
        {costIncompleteLabel}
      </div>
    );
  }

  const width = 720;
  const height = 240;
  const left = 24;
  const right = 18;
  const top = 18;
  const bottom = 38;
  const chartWidth = width - left - right;
  const chartHeight = height - top - bottom;
  const columnGap = 14;
  const slotWidth = chartWidth / groups.length;
  const barWidth = Math.max(Math.min(slotWidth - columnGap, 44), 12);
  const maxValue = getMaxMetricValue(groups, metric);
  const guideLines = 4;

  return (
    <section className={surfaceClass} data-testid="models-trend-chart" data-metric={metric}>
      <div className="mb-3 flex flex-wrap items-center gap-3 text-[11px] font-medium text-muted-foreground">
        {metric === 'tokens' ? (
          <>
            <span className="inline-flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-sky-500" />
              {inputLabel}
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-violet-500" />
              {outputLabel}
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
              {cacheLabel}
            </span>
          </>
        ) : (
          <span className="inline-flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
            {costLabel}
          </span>
        )}
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-[236px] w-full overflow-visible">
        {Array.from({ length: guideLines }).map((_, index) => {
          const y = top + (chartHeight / (guideLines - 1)) * index;
          return (
            <line
              key={`guide-${index}`}
              x1={left}
              x2={width - right}
              y1={y}
              y2={y}
              stroke="hsl(var(--border) / 0.45)"
              strokeDasharray={index === guideLines - 1 ? undefined : '4 8'}
            />
          );
        })}
        {groups.map((group, index) => {
          const x = left + slotWidth * index + (slotWidth - barWidth) / 2;
          const baseY = top + chartHeight;
          const totalMetricValue = metric === 'cost' ? group.totalCostUsd : group.totalTokens;
          const totalHeight = Math.max((totalMetricValue / maxValue) * chartHeight, totalMetricValue > 0 ? 12 : 0);

          if (metric === 'cost') {
            return (
              <g key={group.label} data-testid="usage-trend-bar">
                <rect
                  x={x}
                  y={baseY - totalHeight}
                  width={barWidth}
                  height={totalHeight}
                  rx={Math.min(8, barWidth / 2)}
                  fill="hsl(var(--success) / 0.92)"
                />
                <text x={x + barWidth / 2} y={baseY + 18} textAnchor="middle" className="fill-muted-foreground text-[10px] font-medium">
                  {group.label}
                </text>
              </g>
            );
          }

          const segments = [
            { key: 'input', value: group.inputTokens, fill: '#38bdf8' },
            { key: 'output', value: group.outputTokens, fill: '#8b5cf6' },
            { key: 'cache', value: group.cacheTokens, fill: '#f59e0b' },
          ];

          let currentY = baseY;

          return (
            <g key={group.label} data-testid="usage-trend-bar">
              {segments.map((segment) => {
                if (segment.value <= 0 || group.totalTokens <= 0) {
                  return null;
                }
                const segmentHeight = Math.max((segment.value / group.totalTokens) * totalHeight, 6);
                currentY -= segmentHeight;
                return (
                  <rect
                    key={segment.key}
                    x={x}
                    y={currentY}
                    width={barWidth}
                    height={segmentHeight}
                    rx={segment.key === 'input' ? Math.min(8, barWidth / 2) : 0}
                    fill={segment.fill}
                  />
                );
              })}
              <text x={x + barWidth / 2} y={baseY + 18} textAnchor="middle" className="fill-muted-foreground text-[10px] font-medium">
                {group.label}
              </text>
            </g>
          );
        })}
      </svg>
    </section>
  );
}
