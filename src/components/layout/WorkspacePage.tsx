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
    <div className={cn('workspace-page-frame', className)} {...props}>
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
    <div className={cn('workspace-page-shell', className)} {...props}>
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
        'workspace-page-scroll',
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
