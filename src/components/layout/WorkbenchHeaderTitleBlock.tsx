import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

interface WorkbenchHeaderTitleBlockProps extends HTMLAttributes<HTMLDivElement> {
  title: string;
  subtitle?: string | null;
}

export function WorkbenchHeaderTitleBlock({
  title,
  subtitle,
  className,
  ...props
}: WorkbenchHeaderTitleBlockProps) {
  return (
    <div className={cn('app-workbench-header-copy', className)} {...props}>
      <h1 className="app-workbench-header-title">{title}</h1>
      {subtitle ? <p className="app-workbench-header-subtitle">{subtitle}</p> : null}
    </div>
  );
}
