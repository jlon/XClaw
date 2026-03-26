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
  'workbench-motion-button inline-flex items-center justify-center whitespace-nowrap rounded-[11px] border border-transparent text-sm font-medium ring-offset-background focus:outline-none focus-visible:outline-none focus-visible:border-ring focus-visible:ring-0 disabled:pointer-events-none disabled:opacity-50 motion-safe:active:translate-y-[0.5px]',
  {
    variants: {
      variant: {
        default:
          'bg-primary text-primary-foreground shadow-none hover:bg-primary/92',
        destructive:
          'bg-destructive text-destructive-foreground shadow-none hover:bg-destructive/92',
        outline:
          'border-border/70 bg-[hsl(var(--surface-elevated)/0.98)] text-foreground shadow-none hover:bg-[hsl(var(--foreground)/0.05)] hover:text-foreground',
        secondary:
          'bg-[hsl(var(--surface-panel)/1)] text-foreground/80 shadow-none hover:bg-[hsl(var(--foreground)/0.05)] hover:text-foreground',
        ghost: 'hover:bg-[hsl(var(--foreground)/0.05)] hover:text-foreground',
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
