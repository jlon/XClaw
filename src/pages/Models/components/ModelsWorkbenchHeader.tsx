import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface ModelsWorkbenchHeaderProps {
  title: string;
  subtitle: string;
  actions?: ReactNode;
  className?: string;
}

export const ModelsWorkbenchHeader = ({
  title,
  subtitle,
  actions,
  className,
}: ModelsWorkbenchHeaderProps) => (
  <header
    className={cn(
      'mb-3 shrink-0 flex flex-col gap-2 md:flex-row md:items-center md:justify-between',
      className,
    )}
    data-testid="models-workbench-header"
  >
    <div className="max-w-[640px]">
      <h1 className="text-[22px] font-semibold leading-none tracking-tight text-foreground md:text-[24px]">
        {title}
      </h1>
      <p className="mt-1 max-w-[50ch] text-[12px] text-foreground/62">
        {subtitle}
      </p>
    </div>
    {actions ? <div className="flex flex-wrap items-center gap-2 self-start md:self-auto">{actions}</div> : null}
  </header>
);
