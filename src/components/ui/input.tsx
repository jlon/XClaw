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
          'appearance-none flex h-8 w-full rounded-md border border-border/70 bg-[hsl(var(--surface-panel))] px-3 py-1.5 text-[13px] text-foreground caret-foreground shadow-sm transition-colors placeholder:text-muted-foreground/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-0 disabled:pointer-events-none disabled:opacity-50 file:border-0 file:bg-transparent file:text-[13px] file:font-medium',
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
