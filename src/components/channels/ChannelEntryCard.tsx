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
      className="group flex min-h-[220px] w-full flex-col rounded-[24px] border border-[hsl(var(--border-subtle)/0.76)] bg-[linear-gradient(180deg,hsl(var(--surface-elevated)/0.99),hsl(var(--surface-panel)/0.94))] p-5 text-left shadow-[0_22px_48px_rgba(15,23,42,0.08)] transition-[transform,border-color,box-shadow] duration-200 hover:-translate-y-0.5 hover:border-[hsl(var(--border-strong)/0.44)] hover:shadow-[0_26px_56px_rgba(15,23,42,0.12)]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[16px] border border-[hsl(var(--border-subtle)/0.72)] bg-[hsl(var(--surface-elevated)/0.96)] shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]">
            <ChannelIcon type={channelType} size={28} />
          </div>
          <div className="min-w-0">
            <p className="truncate text-[16px] font-semibold text-foreground">{name}</p>
            <p className="mt-1 line-clamp-2 text-[12.5px] leading-5 text-muted-foreground/82">{description}</p>
          </div>
        </div>
        <span
          data-testid={`channel-entry-indicator-${channelType}`}
          className={cn('mt-1 h-3 w-3 shrink-0 rounded-full shadow-[0_0_0_5px_rgba(255,255,255,0.04)]', indicatorClassName)}
        />
      </div>

      <div className="mt-5 flex flex-1 flex-col justify-between gap-4">
        <div className="flex flex-wrap gap-2">
          {summaryItems.map((item) => (
            <span
              key={item.value}
              className="inline-flex min-h-8 items-center rounded-full border border-[hsl(var(--border-subtle)/0.58)] bg-[hsl(var(--foreground)/0.03)] px-3 py-1 text-[11px] font-medium text-foreground/72"
            >
              {item.value}
            </span>
          ))}
        </div>

        <div className="flex items-center justify-between gap-3">
          <div className="text-[11px] leading-5 text-muted-foreground/72">
            {summaryItems[0]?.value ?? ''}
          </div>
          <Button
            type="button"
            size="sm"
            onClick={(event) => {
              event.stopPropagation();
              onSelect();
            }}
            className="h-9 rounded-[999px] px-4 text-[12px] font-semibold"
          >
            {primaryActionLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
