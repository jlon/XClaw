import { Check, Store } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { AgentAvatar } from '@/components/agents/AgentAvatar';
import { resolveMarketCategoryLabel, resolveMarketItemCopy } from '@/lib/agent-market-copy';
import { cn } from '@/lib/utils';
import type { AgentMarketCatalogItem } from '@/types/agent-market';

export interface AgentMarketCardsPaneProps {
  items: AgentMarketCatalogItem[];
  selectedMarketItemId: string;
  onSelectMarketItem: (item: AgentMarketCatalogItem) => void;
  className?: string;
}

function getPathLeaf(value: string) {
  const parts = value.split(/[/\\]/).filter(Boolean);
  return parts[parts.length - 1] ?? value;
}

export function AgentMarketCardsPane({
  items,
  selectedMarketItemId,
  onSelectMarketItem,
  className,
}: AgentMarketCardsPaneProps) {
  const { t, i18n } = useTranslation('agents');
  const resolvedLanguage = i18n?.resolvedLanguage;

  return (
    <div className={className}>
      {items.length > 0 ? (
        <div>
          <div data-testid="agents-market-grid" className="grid gap-4 md:grid-cols-2 min-[1500px]:grid-cols-3">
            {items.map((item) => {
              const selected = item.id === selectedMarketItemId;
              const copy = resolveMarketItemCopy(t, item, resolvedLanguage);
              const showHeadline = copy.headline && copy.headline.trim() && copy.headline !== copy.name;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelectMarketItem(item)}
                  className={cn(
                    'workbench-motion-card group relative flex min-h-[172px] flex-col overflow-hidden rounded-[22px] border px-4 py-4 text-left',
                    selected
                      ? 'border-[hsl(var(--primary)/0.18)] bg-[linear-gradient(180deg,hsl(var(--surface-elevated)/1)_0%,hsl(var(--surface-panel)/0.978)_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.86),0_16px_28px_rgba(15,23,42,0.05)]'
                      : 'border-border/60 bg-[linear-gradient(180deg,hsl(var(--surface-elevated)/0.997)_0%,hsl(var(--surface-panel)/0.97)_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.8),0_10px_20px_rgba(15,23,42,0.03)] motion-safe:hover:-translate-y-[1px] hover:border-border/74 hover:bg-[linear-gradient(180deg,hsl(var(--surface-elevated)/1)_0%,hsl(var(--surface-panel)/0.978)_100%)] hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.84),0_14px_24px_rgba(15,23,42,0.04)]',
                  )}
                >
                  <div className="relative flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-3">
                      <AgentAvatar agentId={`${item.id}:${item.category}`} size={48} />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-foreground/46">
                          <span className="inline-flex h-5 items-center rounded-full border border-border/55 bg-[hsl(var(--surface-panel)/0.9)] px-2 font-medium text-foreground/52 shadow-[inset_0_1px_0_rgba(255,255,255,0.62)]">
                            {resolveMarketCategoryLabel(t, item.category)}
                          </span>
                        </div>
                        <h3 className="mt-2 truncate text-[15px] font-semibold tracking-[-0.01em] text-foreground">
                          {copy.name}
                        </h3>
                        {showHeadline ? (
                          <p className="mt-1 line-clamp-1 text-[12px] font-medium text-foreground/48">{copy.headline}</p>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {selected ? (
                        <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-[hsl(var(--primary)/0.18)] bg-[hsl(var(--primary)/0.08)] text-primary/80">
                          <Check className="h-3.5 w-3.5" />
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <div className="relative mt-4 flex flex-1 flex-col justify-between border-t border-border/55 pt-3">
                    <p className="line-clamp-3 min-h-[56px] text-[12.5px] leading-[1.58] text-foreground/60">
                      {copy.summary || t('workbench.market.noRole')}
                    </p>
                    <div className="mt-2.5 flex items-start gap-2 text-[11.5px] text-foreground/46">
                      <span className="mt-[6px] h-1.5 w-1.5 shrink-0 rounded-full bg-foreground/24" />
                      <span className="min-w-0 truncate font-medium text-foreground/48">{copy.highlights[0] || getPathLeaf(item.sourcePath)}</span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <div
          data-testid="agents-market-empty-state"
          className="app-empty-surface flex h-full min-h-[420px] flex-col items-center justify-center rounded-[20px] border border-dashed border-border/55 px-6 py-10 text-center"
        >
          <div className="rounded-[18px] border border-border/55 bg-[hsl(var(--surface-panel)/0.92)] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.56)]">
            <Store className="h-10 w-10 text-foreground/28" />
          </div>
          <h3 className="mt-4 text-[20px] font-semibold tracking-tight text-foreground">
            {t('workbench.market.emptyTitle')}
          </h3>
          <p className="mt-2 max-w-[420px] text-[13px] leading-[1.65] text-foreground/58">
            {t('workbench.market.emptySearchDescription')}
          </p>
        </div>
      )}
    </div>
  );
}
