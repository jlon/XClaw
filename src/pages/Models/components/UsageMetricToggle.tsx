import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { UsageMetric } from '../workbench-view-model';

interface UsageMetricToggleProps {
  value: UsageMetric;
  onChange: (value: UsageMetric) => void;
  tokensLabel: string;
  costLabel: string;
}

const trackClass = 'inline-flex rounded-[8px] border border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface-panel))] p-[2px]';
const activeClass = 'rounded-[6px] border-transparent bg-[hsl(var(--surface-base))] text-foreground shadow-sm';
const idleClass = 'rounded-[6px] text-muted-foreground hover:text-foreground';

export function UsageMetricToggle({
  value,
  onChange,
  tokensLabel,
  costLabel,
}: UsageMetricToggleProps) {
  return (
    <div className={trackClass} data-testid="models-usage-metric-toggle" data-metric={value}>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className={cn('h-7 px-2.5 text-[11px] font-medium shadow-none', value === 'tokens' ? activeClass : idleClass)}
        onClick={() => onChange('tokens')}
      >
        {tokensLabel}
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className={cn('h-7 px-2.5 text-[11px] font-medium shadow-none', value === 'cost' ? activeClass : idleClass)}
        onClick={() => onChange('cost')}
      >
        {costLabel}
      </Button>
    </div>
  );
}
