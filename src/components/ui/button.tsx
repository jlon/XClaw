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
  'workbench-motion-button inline-flex items-center justify-center whitespace-nowrap rounded-[6px] border border-transparent text-[13px] font-medium transition-colors duration-[var(--motion-fast)] ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(var(--glow-brand),0.25)] disabled:pointer-events-none disabled:opacity-50 cursor-default motion-safe:active:scale-[0.98]',
  {
    variants: {
      variant: {
        default:
          'bg-primary text-primary-foreground shadow-none hover:bg-primary/90',
        destructive:
          'bg-destructive text-destructive-foreground shadow-none hover:bg-destructive/90',
        outline:
          'border-[hsl(var(--border-subtle))] bg-transparent text-foreground shadow-none hover:bg-[hsl(var(--surface-hover))]',
        secondary:
          'bg-[hsl(var(--surface-base))] border border-[hsl(var(--border-subtle))] text-foreground shadow-none hover:bg-[hsl(var(--surface-hover))]',
        ghost: 'hover:bg-[hsl(var(--surface-hover))] hover:text-foreground',
        link: 'text-primary underline-offset-4 hover:underline hover:text-primary cursor-pointer',
      },
      size: {
        default: 'h-[32px] px-3 py-1.5',
        sm: 'h-7 rounded-[4px] px-2.5 text-xs',
        lg: 'h-9 px-4',
        icon: 'h-[32px] w-[32px]',
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
