import type { HTMLAttributes, PropsWithChildren } from 'react';
import { cn } from '@/lib/utils';

type WorkbenchHeaderIconTone = 'slate' | 'coral' | 'teal' | 'amber' | 'plum';

const toneClasses: Record<WorkbenchHeaderIconTone, string> = {
  slate: 'border-[hsl(var(--runtime)/0.22)] bg-[hsl(var(--runtime)/0.14)] text-[hsl(var(--runtime))]',
  coral: 'border-[hsl(var(--primary)/0.22)] bg-[hsl(var(--primary)/0.14)] text-primary',
  teal: 'border-[hsl(var(--success)/0.22)] bg-[hsl(var(--success)/0.14)] text-[hsl(var(--success))]',
  amber: 'border-[hsl(var(--warning)/0.22)] bg-[hsl(var(--warning)/0.14)] text-[hsl(var(--warning))]',
  plum: 'border-[hsl(var(--info)/0.22)] bg-[hsl(var(--info)/0.14)] text-[hsl(var(--info))]',
};

interface WorkbenchHeaderIconProps extends PropsWithChildren<HTMLAttributes<HTMLDivElement>> {
  tone?: WorkbenchHeaderIconTone;
}

export function WorkbenchHeaderIcon({
  children,
  tone = 'slate',
  className,
  ...props
}: WorkbenchHeaderIconProps) {
  return (
    <div
      data-testid="workbench-header-icon"
      className={cn('app-workbench-header-icon', toneClasses[tone], className)}
      {...props}
    >
      {children}
    </div>
  );
}
