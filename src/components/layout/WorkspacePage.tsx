import type { HTMLAttributes, PropsWithChildren } from 'react';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { cn } from '@/lib/utils';

function resolveWorkspacePlatform(platform?: string): string | undefined {
  if (platform) return platform;
  if (typeof window === 'undefined') return undefined;
  return window.electron?.platform;
}

export function WorkspacePageFrame({
  children,
  className,
  ...props
}: PropsWithChildren<HTMLAttributes<HTMLDivElement>>) {
  return (
    <div className={cn('workspace-page-frame desktop-workspace-frame flex h-[calc(100vh-2.5rem)] w-full flex-col overflow-hidden bg-background/30', className)} {...props}>
      {children}
    </div>
  );
}

export function WorkspacePageShell({
  children,
  className,
  ...props
}: PropsWithChildren<HTMLAttributes<HTMLDivElement>>) {
  return (
    <div className={cn('workspace-page-shell desktop-workspace-shell mx-auto flex h-full w-full max-w-[1560px] flex-col rounded-[28px] border border-border/70 bg-card/60 px-3 py-8 shadow-[0_18px_48px_rgba(15,23,42,0.06)] md:px-4 xl:px-6', className)} {...props}>
      {children}
    </div>
  );
}

export function WorkspacePageScrollArea({
  children,
  className,
  platform,
  ...props
}: PropsWithChildren<HTMLAttributes<HTMLDivElement> & { platform?: string }>) {
  const resolvedPlatform = resolveWorkspacePlatform(platform);
  return (
    <div
      className={cn(
        'workspace-page-scroll desktop-workspace-scroll min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain pb-8',
        resolvedPlatform === 'win32' ? 'workspace-page-scroll-win' : 'workspace-page-scroll-default',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function WorkspacePageLoading() {
  return (
    <WorkspacePageFrame>
      <div className="flex min-h-full w-full items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    </WorkspacePageFrame>
  );
}
