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
  sections: ChannelEntryBoardSection[];
  emptyMessage: string;
  columnCount: 1 | 2 | 3 | 4;
  onSelectChannel: (channelType: ChannelType) => void;
}

export function ChannelEntryBoard({
  sections,
  emptyMessage,
  columnCount,
  onSelectChannel,
}: ChannelEntryBoardProps) {
  const visibleSections = sections.filter((section) => section.items.length > 0);

  return (
    <section
      data-testid="channel-entry-board"
      className="space-y-3.5"
    >
      {visibleSections.length > 0 ? (
        visibleSections.map((section) => (
          <div key={section.id} className="space-y-2">
            <h3
              title={section.description}
              className="text-[11px] font-semibold uppercase tracking-[0.08em] text-foreground/58"
            >
              {section.title}
            </h3>
            <div
              className="grid gap-3.5"
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
