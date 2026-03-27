/**
 * Switch Component
 * Based on shadcn/ui switch
 */
import * as React from 'react';
import * as SwitchPrimitives from '@radix-ui/react-switch';
import { cn } from '@/lib/utils';

const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitives.Root
    className={cn(
      'group peer relative inline-flex h-[24px] w-[40px] shrink-0 cursor-default items-center rounded-full border-2 border-transparent focus:outline-none focus-visible:ring-2 focus-visible:ring-[#007AFF]/40 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=unchecked]:bg-[#E9E9EA] dark:data-[state=unchecked]:bg-[#39393D] shadow-[inset_0_1px_2px_rgba(0,0,0,0.15)] dark:shadow-[inset_0_1px_2px_rgba(0,0,0,0.3)] transition-colors duration-[var(--motion-base)] ease-[cubic-bezier(0.16,1,0.3,1)]',
      className
    )}
    {...props}
    ref={ref}
  >
    {/* On Indicator (White vertical line) */}
    <div className="pointer-events-none absolute left-[8px] top-[7px] h-[6px] w-[2px] rounded-full bg-white opacity-0 transition-opacity duration-[var(--motion-base)] group-data-[state=checked]:opacity-100" aria-hidden="true" />

    {/* Off Indicator (Hollow circle) */}
    <div className="pointer-events-none absolute right-[6px] top-[6px] h-[8px] w-[8px] rounded-full border-[2px] border-black/20 dark:border-white/20 opacity-100 transition-opacity duration-[var(--motion-base)] group-data-[state=checked]:opacity-0" aria-hidden="true" />

    <SwitchPrimitives.Thumb
      className={cn(
        'pointer-events-none block h-[20px] w-[20px] rounded-full bg-white shadow-[0_2px_4px_rgba(0,0,0,0.2),0_0_1px_rgba(0,0,0,0.2)] ring-0 transition-transform duration-[var(--motion-base)] ease-[cubic-bezier(0.16,1,0.3,1)] data-[state=checked]:translate-x-[16px] data-[state=unchecked]:translate-x-0'
      )}
    />
  </SwitchPrimitives.Root>
));
Switch.displayName = SwitchPrimitives.Root.displayName;

export { Switch };
