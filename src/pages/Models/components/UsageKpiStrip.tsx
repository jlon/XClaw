import { cn } from '@/lib/utils';
import type { UsageKpi, UsageMetric } from '../workbench-view-model';

interface UsageKpiStripProps {
  items: UsageKpi[];
  activeMetric: UsageMetric;
  tokensLabel: string;
  costLabel: string;
  requestsLabel: string;
  modelsLabel: string;
}

const formatTokenCount = (value: number): string => Intl.NumberFormat().format(value);

const formatUsageCost = (value: number): string =>
  Number.isFinite(value) ? `$${value.toFixed(2)}` : '$0.00';

const stripClass = 'flex flex-wrap items-center gap-x-4 gap-y-1.5';

export const UsageKpiStrip = ({
  items,
  activeMetric,
  tokensLabel,
  costLabel,
  requestsLabel,
  modelsLabel,
}: UsageKpiStripProps) => {
  const itemMap = new Map(items.map((item) => [item.key, item.value]));
  const cards = [
    { key: 'tokens', label: tokensLabel, value: formatTokenCount(itemMap.get('tokens') ?? 0) },
    { key: 'cost', label: costLabel, value: formatUsageCost(itemMap.get('cost') ?? 0) },
    { key: 'requests', label: requestsLabel, value: formatTokenCount(itemMap.get('requests') ?? 0) },
    { key: 'models', label: modelsLabel, value: formatTokenCount(itemMap.get('models') ?? 0) },
  ] as const;

  return (
    <div className={stripClass} data-testid="models-token-summary-strip" data-metric={activeMetric}>
      {cards.map((item, index) => (
        <div
          key={item.key}
          className={cn(
            'inline-flex items-baseline gap-1.5',
            index > 0 && 'before:mr-1 before:text-border before:content-["·"]',
          )}
          data-testid={`models-summary-${item.key}`}
        >
          <span className="truncate text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground/74">
            {item.label}
          </span>
          <span className={cn(
            'text-[13px] font-semibold tracking-tight text-foreground/88',
            (item.key === 'tokens' || item.key === 'cost') && item.key === activeMetric && 'text-primary',
          )}>
            {item.value}
          </span>
        </div>
      ))}
    </div>
  );
};
