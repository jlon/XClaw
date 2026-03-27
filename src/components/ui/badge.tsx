/* eslint-disable react-refresh/only-export-components */
/**
 * Badge Component
 * Based on shadcn/ui badge
 */
import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold tracking-tight transition-colors focus:outline-none focus:ring-2 focus:ring-[rgba(var(--glow-brand),0.25)] focus:ring-offset-0',
  {
    variants: {
      variant: {
        default:
          'border-transparent bg-primary/10 text-primary shadow-none',
        secondary:
          'border-transparent bg-muted/60 text-foreground/80 hover:bg-muted hover:text-foreground shadow-none',
        destructive:
          'border-transparent bg-destructive/10 text-destructive shadow-none',
        outline: 'border-[hsl(var(--border-subtle))] bg-transparent text-foreground shadow-none',
        success:
          'border-transparent bg-emerald-500/12 text-emerald-700 dark:text-emerald-200 shadow-none',
        warning:
          'border-transparent bg-amber-500/12 text-amber-700 dark:text-amber-200 shadow-none',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
