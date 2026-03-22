import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import type { ChannelType } from '@/types/channel';
import { ChannelEntryCard, type ChannelEntryCardProps } from '@/components/channels/ChannelEntryCard';

export type ChannelEntryBoardItem = Omit<ChannelEntryCardProps, 'onSelect'>;

export interface ChannelEntryBoardSection {
  id: 'configured' | 'available';
  title: string;
  description: string;
  items: ChannelEntryBoardItem[];
}

interface ChannelEntryBoardProps {
  title: string;
  subtitle: string;
  query: string;
  queryPlaceholder: string;
  onQueryChange: (value: string) => void;
  sections: ChannelEntryBoardSection[];
  emptyMessage: string;
  columnCount: 1 | 2 | 3 | 4;
  onSelectChannel: (channelType: ChannelType) => void;
}

export function ChannelEntryBoard({
  title,
  subtitle,
  query,
  queryPlaceholder,
  onQueryChange,
  sections,
  emptyMessage,
  columnCount,
  onSelectChannel,
}: ChannelEntryBoardProps) {
  const visibleSections = sections.filter((section) => section.items.length > 0);

  return (
    <section
      data-testid="channel-entry-board"
      className="space-y-6"
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="max-w-2xl">
          <h2 className="text-[18px] font-semibold tracking-tight text-foreground md:text-[20px]">{title}</h2>
          <p className="mt-1 text-[13px] leading-6 text-muted-foreground/78">{subtitle}</p>
        </div>
        <div className="relative w-full md:max-w-[320px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/68" />
          <Input
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder={queryPlaceholder}
            className="h-10 rounded-[14px] border border-[hsl(var(--border-subtle)/0.48)] bg-[hsl(var(--surface-panel)/0.82)] pl-9 text-[12.5px] shadow-none placeholder:text-muted-foreground/52 hover:border-[hsl(var(--border-subtle)/0.72)] hover:bg-[hsl(var(--surface-elevated)/0.98)] focus-visible:border-[hsl(var(--border-strong)/0.52)] focus-visible:bg-[hsl(var(--surface-elevated)/1)] focus-visible:ring-0"
          />
        </div>
      </div>

      {visibleSections.length > 0 ? (
        visibleSections.map((section) => (
          <div key={section.id} className="space-y-3.5">
            <div className="flex flex-col gap-1 md:flex-row md:items-end md:justify-between">
              <div>
                <h3 className="text-[13px] font-semibold uppercase tracking-[0.08em] text-foreground/66">{section.title}</h3>
                <p className="mt-1 text-[12px] leading-5 text-muted-foreground/72">{section.description}</p>
              </div>
            </div>
            <div
              className="grid gap-4"
              style={{ gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))` }}
            >
              {section.items.map((item) => (
                <ChannelEntryCard
                  key={item.channelType}
                  {...item}
                  onSelect={() => onSelectChannel(item.channelType)}
                />
              ))}
            </div>
          </div>
        ))
      ) : (
        <div className="app-empty-surface rounded-[18px] px-4 py-6 text-sm text-muted-foreground">
          {emptyMessage}
        </div>
      )}
    </section>
  );
}
