import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface WorkbenchHeaderProps extends HTMLAttributes<HTMLElement> {
  icon?: ReactNode;
  titleBlock: ReactNode;
  actions?: ReactNode;
  utility?: ReactNode;
  summary?: ReactNode;
}

export function WorkbenchHeader({
  icon,
  titleBlock,
  actions,
  utility,
  summary,
  className,
  ...props
}: WorkbenchHeaderProps) {
  return (
    <header
      data-testid="workbench-header"
      className={cn('app-workbench-header', className)}
      {...props}
    >
      <div className="app-workbench-header-main">
        <div className={cn('app-workbench-header-leading', !icon && 'app-workbench-header-leading--iconless')}>
          {icon ? icon : null}
          <div className="min-w-0 flex-1">{titleBlock}</div>
        </div>

        {(utility || actions) ? (
          <div className="app-workbench-header-rail">
            {utility ? <div className="app-workbench-header-utility">{utility}</div> : null}
            {actions}
          </div>
        ) : null}
      </div>

      {summary}
    </header>
  );
}
