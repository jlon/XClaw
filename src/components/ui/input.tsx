/**
 * Input Component
 * Based on shadcn/ui input
 */
import * as React from 'react';
import { cn } from '@/lib/utils';

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          'desktop-focus-ring appearance-none flex h-[32px] w-full rounded-[6px] border border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface-base))] px-3 py-1 text-[13px] text-foreground caret-foreground shadow-none placeholder:text-muted-foreground/70 disabled:cursor-not-allowed disabled:opacity-50 file:border-0 file:bg-transparent file:text-[13px] file:font-medium',
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = 'Input';

export { Input };
