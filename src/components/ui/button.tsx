/* eslint-disable react-refresh/only-export-components */
/**
 * Button Component
 * Based on shadcn/ui button
 */
import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'workbench-motion-button inline-flex items-center justify-center whitespace-nowrap rounded-md border border-transparent text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-0 disabled:pointer-events-none disabled:opacity-50 motion-safe:active:translate-y-[0.5px] select-none',
  {
    variants: {
      variant: {
        default:
          'bg-primary text-primary-foreground shadow-sm hover:bg-primary/92',
        destructive:
          'bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/92',
        outline:
          'border-border/70 bg-[hsl(var(--surface-elevated))] text-foreground shadow-sm hover:bg-[hsl(var(--surface-hover))] hover:text-foreground',
        secondary:
          'bg-[hsl(var(--surface-panel))] text-foreground/80 shadow-none hover:bg-[hsl(var(--surface-hover))] hover:text-foreground',
        ghost: 'hover:bg-[hsl(var(--surface-hover))] hover:text-foreground',
        link: 'text-primary underline-offset-4 hover:underline hover:text-primary',
      },
      size: {
        default: 'h-8 px-3 py-1.5',
        sm: 'h-7 rounded-sm px-2.5',
        lg: 'h-9 rounded-md px-4',
        icon: 'h-8 w-8',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
