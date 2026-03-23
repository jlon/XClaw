import type { HTMLAttributes, PropsWithChildren } from 'react';
import { cn } from '@/lib/utils';

export function WorkbenchHeaderActions({
  children,
  className,
  ...props
}: PropsWithChildren<HTMLAttributes<HTMLDivElement>>) {
  return (
    <div className={cn('app-workbench-header-actions', className)} {...props}>
      {children}
    </div>
  );
}
