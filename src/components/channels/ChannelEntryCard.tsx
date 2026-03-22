import { Button } from '@/components/ui/button';
import { ChannelIcon } from '@/components/channels/ChannelIcon';
import { cn } from '@/lib/utils';
import type { ChannelType } from '@/types/channel';

export interface ChannelEntryCardSummaryItem {
  value: string;
}

export interface ChannelEntryCardProps {
  channelType: ChannelType;
  name: string;
  description: string;
  primaryActionLabel: string;
  summaryItems: ChannelEntryCardSummaryItem[];
  indicatorClassName: string;
  onSelect: () => void;
}

export function ChannelEntryCard({
  channelType,
  name,
  description,
  primaryActionLabel,
  summaryItems,
  indicatorClassName,
  onSelect,
}: ChannelEntryCardProps) {
  return (
    <div
      role="button"
      tabIndex={0}
      data-testid={`channel-entry-card-${channelType}`}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onSelect();
        }
      }}
      className="group flex min-h-[184px] w-full flex-col rounded-[18px] border border-[hsl(var(--border-subtle)/0.72)] bg-[linear-gradient(180deg,hsl(var(--surface-elevated)/0.985),hsl(var(--surface-panel)/0.94))] p-4 text-left shadow-[0_8px_18px_hsl(var(--foreground)/0.04)] transition-[transform,border-color,box-shadow] duration-200 hover:-translate-y-0.5 hover:border-[hsl(var(--border-strong)/0.36)] hover:shadow-[0_12px_24px_hsl(var(--foreground)/0.055)]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] border border-[hsl(var(--border-subtle)/0.7)] bg-[hsl(var(--surface-elevated)/0.98)] shadow-none">
            <ChannelIcon type={channelType} size={26} />
          </div>
          <div className="min-w-0">
            <p className="truncate text-[15px] font-semibold tracking-tight text-foreground">{name}</p>
            <p className="mt-1 line-clamp-3 text-[11.5px] leading-5 text-muted-foreground/78">{description}</p>
          </div>
        </div>
        <span
          data-testid={`channel-entry-indicator-${channelType}`}
          className={cn('mt-0.5 h-3 w-3 shrink-0 rounded-full', indicatorClassName)}
        />
      </div>

      <div className="mt-4 flex flex-1 flex-col justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          {summaryItems.map((item) => (
            <span
              key={item.value}
              className="inline-flex min-h-7 items-center rounded-full border border-[hsl(var(--border-subtle)/0.54)] bg-[hsl(var(--foreground)/0.03)] px-2.5 py-1 text-[10.5px] font-medium text-foreground/68"
            >
              {item.value}
            </span>
          ))}
        </div>

        <div className="flex items-center justify-end gap-3">
          <Button
            type="button"
            size="sm"
            onClick={(event) => {
              event.stopPropagation();
              onSelect();
            }}
            className="h-8 rounded-[999px] px-3.5 text-[11.5px] font-semibold"
          >
            {primaryActionLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
