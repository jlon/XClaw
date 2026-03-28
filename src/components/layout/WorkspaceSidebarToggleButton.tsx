import type { ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export const workspaceSidebarToggleButtonClassName =
  'app-desktop-sidebar-toggle rounded-full border border-transparent bg-transparent text-foreground/88 shadow-none transition-[background-color,color,border-color,box-shadow] hover:border-transparent hover:bg-[hsl(var(--surface-hover)/0.96)] hover:text-foreground hover:shadow-none';

export function WorkspaceSidebarToggleIcon({ className }: { className?: string }) {
  return (
    <svg
      data-testid="qclaw-session-toggle-icon"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={cn('block', className)}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M12 4.90039C12.9033 4.90039 13.966 4.98944 14.9531 5.10254C17.2949 5.37099 19.129 7.20515 19.3975 9.54688C19.5106 10.534 19.5996 11.5967 19.5996 12.5C19.5996 13.4033 19.5106 14.466 19.3975 15.4531C19.129 17.7949 17.2949 19.629 14.9531 19.8975C13.966 20.0106 12.9033 20.0996 12 20.0996C11.0967 20.0996 10.034 20.0106 9.04688 19.8975C6.70515 19.629 4.871 17.7949 4.60254 15.4531C4.48944 14.466 4.40039 13.4033 4.40039 12.5C4.40039 11.5967 4.48944 10.534 4.60254 9.54688C4.87099 7.20515 6.70515 5.371 9.04688 5.10254C10.034 4.98944 11.0967 4.90039 12 4.90039Z"
        stroke="currentColor"
        strokeWidth="1.2"
      />
      <path
        d="M10 5L10 20"
        stroke="currentColor"
        strokeWidth="1.2"
      />
    </svg>
  );
}

type WorkspaceSidebarToggleButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'type'> & {
  iconClassName?: string;
};

export function WorkspaceSidebarToggleButton({
  className,
  iconClassName,
  ...props
}: WorkspaceSidebarToggleButtonProps) {
  return (
    <button
      type="button"
      className={cn(
        workspaceSidebarToggleButtonClassName,
        'no-drag inline-flex h-6 w-6 items-center justify-center rounded-[7px] p-0 leading-none',
        className,
      )}
      {...props}
    >
      <WorkspaceSidebarToggleIcon className={cn('block h-6 w-6 shrink-0', iconClassName)} />
    </button>
  );
}
