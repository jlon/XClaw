import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';

type WorkbenchSummaryTone = 'neutral' | 'success' | 'warning' | 'danger';

interface WorkbenchSummaryItemData {
  id: string;
  icon: ReactNode;
  label: string;
  value: string | number;
  tone?: WorkbenchSummaryTone;
}

interface WorkbenchSummaryStripProps extends HTMLAttributes<HTMLDivElement> {
  items: WorkbenchSummaryItemData[];
}

const toneClasses: Record<WorkbenchSummaryTone, string> = {
  neutral: 'bg-[hsl(var(--surface-hover)/0.82)] text-foreground/58',
  success: 'bg-[hsl(var(--success)/0.12)] text-[hsl(var(--success))]',
  warning: 'bg-[hsl(var(--warning)/0.12)] text-[hsl(var(--warning))]',
  danger: 'bg-[hsl(var(--danger)/0.12)] text-[hsl(var(--danger))]',
};

export function WorkbenchSummaryStrip({
  items,
  className,
  ...props
}: WorkbenchSummaryStripProps) {
  if (items.length === 0) {
    return null;
  }

  return (
    <div
      data-testid="workbench-summary-strip"
      className={cn('app-workbench-summary-strip', className)}
      {...props}
    >
      {items.map((item) => (
        <div
          key={item.id}
          data-testid={`workbench-summary-item-${item.id}`}
          className="app-workbench-summary-item"
          aria-label={`${item.label} ${item.value}`}
        >
          <span className={cn('app-workbench-summary-item-icon', toneClasses[item.tone ?? 'neutral'])}>
            {item.icon}
          </span>
          <span className="app-workbench-summary-item-value">{item.value}</span>
          <span className="app-workbench-summary-item-label">{item.label}</span>
        </div>
      ))}
    </div>
  );
}
