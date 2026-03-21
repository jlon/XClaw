import { useEffect, type ReactNode } from 'react';

export interface SetupExitGuardProps {
  children: ReactNode;
  enabled?: boolean;
  onExitRequest?: () => void;
}

export function SetupExitGuard({
  children,
  enabled = true,
  onExitRequest,
}: SetupExitGuardProps) {
  useEffect(() => {
    if (!enabled) {
      return undefined;
    }

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
      onExitRequest?.();
      return '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [enabled, onExitRequest]);

  return <>{children}</>;
}
