import * as React from 'react';
import * as SelectPrimitive from '@radix-ui/react-select';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

const EMPTY_SELECT_VALUE = '__xclaw_select_empty__';

export interface SelectOption {
  value: string;
  label: React.ReactNode;
  disabled?: boolean;
}

export interface SelectProps {
  id?: string;
  value?: string;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  contentClassName?: string;
  onValueChange?: (value: string) => void;
  'aria-label'?: string;
  'data-testid'?: string;
}

const Select = React.forwardRef<HTMLButtonElement, SelectProps>(
  (
    {
      id,
      value,
      options,
      placeholder,
      disabled,
      className,
      contentClassName,
      onValueChange,
      'aria-label': ariaLabel,
      'data-testid': dataTestId,
    },
    ref,
  ) => {
    const hasEmptyOption = options.some((option) => option.value === '');
    const selectedValue = value ?? '';
    const normalizedValue = selectedValue || hasEmptyOption ? (selectedValue || EMPTY_SELECT_VALUE) : undefined;

    return (
      <SelectPrimitive.Root
        disabled={disabled}
        value={normalizedValue}
        onValueChange={(nextValue) =>
          onValueChange?.(nextValue === EMPTY_SELECT_VALUE ? '' : nextValue)
        }
      >
        <SelectPrimitive.Trigger
          id={id}
          ref={ref}
          aria-label={ariaLabel}
          data-testid={dataTestId}
          className={cn(
            'appearance-none inline-flex h-[32px] w-full items-center justify-between gap-2 rounded-[6px] border border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface-base))] px-3 py-1.5 text-[13px] text-foreground shadow-none transition-colors duration-[var(--motion-fast)] ease-out data-[placeholder]:text-muted-foreground/70 focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(var(--glow-brand),0.25)] focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50 [&>span]:truncate',
            className,
          )}
        >
          <SelectPrimitive.Value placeholder={placeholder} />
          <SelectPrimitive.Icon asChild>
            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground/70" />
          </SelectPrimitive.Icon>
        </SelectPrimitive.Trigger>
        <SelectPrimitive.Portal>
          <SelectPrimitive.Content
            position="popper"
            sideOffset={8}
            className={cn(
              'z-50 max-h-72 min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-xl border border-[hsl(var(--border-subtle))] bg-popover text-popover-foreground shadow-lg',
              contentClassName,
            )}
          >
            <SelectPrimitive.Viewport className="p-1">
              {options.map((option) => {
                const optionValue = option.value === '' ? EMPTY_SELECT_VALUE : option.value;
                return (
                  <SelectPrimitive.Item
                    key={optionValue}
                    value={optionValue}
                    disabled={option.disabled}
                    className="relative flex w-full cursor-default select-none items-center rounded-[10px] py-2 pl-9 pr-3 text-sm outline-none transition-colors data-[disabled]:pointer-events-none data-[disabled]:opacity-40 data-[highlighted]:bg-[hsl(var(--foreground)/0.05)] data-[highlighted]:text-foreground"
                  >
                    <span className="absolute left-3 flex h-4 w-4 items-center justify-center">
                      <SelectPrimitive.ItemIndicator>
                        <Check className="h-3.5 w-3.5" />
                      </SelectPrimitive.ItemIndicator>
                    </span>
                    <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
                  </SelectPrimitive.Item>
                );
              })}
            </SelectPrimitive.Viewport>
          </SelectPrimitive.Content>
        </SelectPrimitive.Portal>
      </SelectPrimitive.Root>
    );
  },
);

Select.displayName = 'Select';

export { Select };
