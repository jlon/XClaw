/* eslint-disable react-refresh/only-export-components */
/**
 * Badge Component
 * Based on shadcn/ui badge
 */
import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold tracking-[0.02em] transition-colors focus:outline-none focus:ring-2 focus:ring-ring/30 focus:ring-offset-2 focus:ring-offset-background',
  {
    variants: {
      variant: {
        default:
          'border-transparent bg-primary text-primary-foreground shadow-sm hover:bg-primary/80',
        secondary:
          'border-border/70 bg-muted/70 text-foreground/80 hover:bg-muted hover:text-foreground',
        destructive:
          'border-transparent bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/80',
        outline: 'border-border/70 bg-background/80 text-foreground shadow-sm',
        success:
          'border-transparent bg-emerald-500/12 text-emerald-700 dark:text-emerald-200',
        warning:
          'border-transparent bg-amber-500/12 text-amber-700 dark:text-amber-200',
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
