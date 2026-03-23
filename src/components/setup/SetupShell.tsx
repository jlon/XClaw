import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface SetupShellProps {
  rail: ReactNode;
  footer: ReactNode;
  children: ReactNode;
  className?: string;
  railClassName?: string;
  contentClassName?: string;
  footerClassName?: string;
}

export function SetupShell({
  rail,
  footer,
  children,
  className,
  railClassName,
  contentClassName,
  footerClassName,
}: SetupShellProps) {
  return (
    <div className={cn('app-setup-shell flex min-h-0 flex-1 flex-col overflow-hidden bg-background text-foreground', className)}>
      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[15rem_minmax(0,1fr)] xl:grid-cols-[16rem_minmax(0,1fr)]">
        <aside className={cn('app-setup-rail app-setup-scrollbar-hidden min-h-0 overflow-auto border-b border-border/70 bg-[hsl(var(--chrome)/0.58)] lg:border-b-0 lg:border-r', railClassName)}>
          {rail}
        </aside>
        <main className={cn('app-setup-content app-setup-scrollbar-hidden min-h-0 overflow-auto bg-[hsl(var(--surface-base)/0.3)]', contentClassName)}>
          {children}
        </main>
      </div>
      <div className={cn('app-setup-footer border-t border-border/70 bg-[hsl(var(--chrome)/0.62)]', footerClassName)}>
        {footer}
      </div>
    </div>
  );
}
