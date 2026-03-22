import { cn } from '@/lib/utils';
import logoSvg from '@/assets/logo.svg';

export function AppBrandLockup({
  collapsed = false,
  compact = false,
  className,
  testIdPrefix = 'app-brand',
}: {
  collapsed?: boolean;
  compact?: boolean;
  className?: string;
  testIdPrefix?: string;
}) {
  return (
    <div
      data-testid={`${testIdPrefix}-lockup`}
      className={cn(
        'flex items-center overflow-hidden transition-[padding,gap,justify-content] duration-300 ease-out',
        collapsed ? 'justify-center px-0' : 'gap-2 px-2',
        className,
      )}
    >
      <img
        src={logoSvg}
        alt="XClaw"
        className={cn(
          'app-brand-mark w-auto shrink-0 object-contain',
          collapsed ? 'h-[16px]' : compact ? 'h-[20px]' : 'h-[21px]',
        )}
      />
      <span
        data-testid={`${testIdPrefix}-wordmark`}
        aria-hidden={collapsed}
        className={cn(
          'sidebar-brand-wordmark overflow-hidden whitespace-nowrap transition-[max-width,opacity,transform] duration-300 ease-out',
          collapsed ? 'max-w-0 -translate-x-1.5 opacity-0 pointer-events-none' : 'max-w-[140px] translate-x-0 opacity-100',
        )}
      >
        <span className="sidebar-brand-wordmark-initial">X</span>
        <span className="sidebar-brand-wordmark-rest">Claw</span>
      </span>
    </div>
  );
}
