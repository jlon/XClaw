import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { UsageMetric } from '../workbench-view-model';

interface UsageMetricToggleProps {
  value: UsageMetric;
  onChange: (value: UsageMetric) => void;
  tokensLabel: string;
  costLabel: string;
}

const trackClass = 'app-field-surface inline-flex rounded-[9px] border border-[hsl(var(--border-subtle)/0.82)] p-0.5';
const activeClass = 'rounded-[8px] border border-[hsl(var(--primary)/0.16)] bg-[hsl(var(--surface-elevated)/0.98)] text-primary shadow-none';
const idleClass = 'rounded-[8px] text-muted-foreground hover:bg-[hsl(var(--surface-hover)/0.82)] hover:text-foreground';

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
