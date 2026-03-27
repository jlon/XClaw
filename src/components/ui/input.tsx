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
          'appearance-none flex h-[32px] w-full rounded-[6px] border border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface-base))] px-3 py-1 text-[13px] text-foreground caret-[hsl(var(--foreground))] shadow-none transition-colors duration-[var(--motion-fast)] ease-out placeholder:text-muted-foreground/70 focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(var(--glow-brand),0.25)] focus-visible:border-[hsl(var(--border-subtle))] disabled:cursor-not-allowed disabled:opacity-50 file:border-0 file:bg-transparent file:text-[13px] file:font-medium',
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
