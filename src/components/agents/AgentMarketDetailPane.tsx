import { Store } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { AgentAvatar } from '@/components/agents/AgentAvatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { resolveMarketCategoryLabel, resolveMarketItemCopy } from '@/lib/agent-market-copy';
import { cn } from '@/lib/utils';
import type { AgentMarketCatalogItem } from '@/types/agent-market';

export interface AgentMarketDetailPaneProps {
  marketItem: AgentMarketCatalogItem | null;
  marketInstallName: string;
  marketInstalling: boolean;
  onInstall: () => void;
  onInstallNameChange: (value: string) => void;
}

const shellCardClasses =
  'rounded-[24px] border border-border/70 bg-[linear-gradient(180deg,hsl(var(--surface-elevated)/0.998)_0%,hsl(var(--surface-panel)/0.972)_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.72),0_14px_28px_rgba(15,23,42,0.04)]';
const actionButtonClasses =
  'h-10 rounded-[13px] border-transparent bg-primary px-5 text-[13px] font-semibold text-primary-foreground shadow-[0_10px_22px_rgba(15,23,42,0.12)] transition-colors hover:bg-primary/92';
const summaryLabelClasses = 'text-[11px] font-medium uppercase tracking-[0.08em] text-foreground/44';
const fieldInputClasses =
  'appearance-none h-[44px] rounded-xl text-[13px] app-field-surface text-foreground placeholder:text-foreground/40 shadow-none transition-all focus:outline-none focus-visible:outline-none focus-visible:border-primary focus-visible:bg-[hsl(var(--surface-elevated)/1)] focus-visible:ring-0';
const installPanelClasses =
  'rounded-[22px] border border-[hsl(var(--primary)/0.12)] bg-[linear-gradient(180deg,hsl(var(--surface-elevated)/1)_0%,hsl(var(--surface-panel)/0.968)_100%)] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.76),0_16px_28px_rgba(15,23,42,0.05)]';

export function AgentMarketDetailPane({
  marketItem,
  marketInstallName,
  marketInstalling,
  onInstall,
  onInstallNameChange,
}: AgentMarketDetailPaneProps) {
  const { t, i18n } = useTranslation('agents');
  const resolvedLanguage = i18n?.resolvedLanguage;

  if (!marketItem) {
    return (
      <div
        data-testid="agents-market-empty-state"
        className="app-empty-surface flex h-full min-h-[520px] flex-col items-center justify-center rounded-[18px] border border-dashed border-border/55 px-6 py-10 text-center"
      >
        <Store className="h-10 w-10 text-foreground/28" />
        <h3 className="mt-4 text-[20px] font-semibold tracking-tight text-foreground">{t('workbench.detail.emptyMarketTitle')}</h3>
        <p className="mt-2 max-w-[420px] text-[13px] leading-[1.65] text-foreground/58">
          {t('workbench.detail.emptyMarketDescription')}
        </p>
      </div>
    );
  }

  const copy = resolveMarketItemCopy(t, marketItem, resolvedLanguage);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div className={cn(shellCardClasses, 'relative overflow-hidden p-5')}>
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-foreground/10 to-transparent" />
        <div className="relative flex min-w-0 flex-col gap-4">
          <div className="flex min-w-0 items-start gap-4">
            <AgentAvatar
              agentId={marketItem.avatarSeed || `${marketItem.id}:${marketItem.category}`}
              profile={marketItem.avatarProfile}
              size={60}
            />
            <div className="min-w-0 space-y-3">
              <div className="space-y-1.5">
                <h2 className="text-[24px] font-semibold tracking-tight text-foreground">
                  {copy.name}
                </h2>
                <p className="max-w-2xl text-[13px] leading-[1.68] text-foreground/60">
                  {copy.summary || t('workbench.market.noRole')}
                </p>
                <div className="flex flex-wrap items-center gap-2 text-[11.5px] text-foreground/46">
                  <span className="inline-flex h-5 items-center rounded-full border border-border/55 bg-[hsl(var(--surface-panel)/0.9)] px-2 font-medium text-foreground/52 shadow-[inset_0_1px_0_rgba(255,255,255,0.62)]">
                    {resolveMarketCategoryLabel(t, marketItem.category)}
                  </span>
                  {copy.headline && copy.headline !== copy.name ? <span>{copy.headline}</span> : null}
                </div>
              </div>
            </div>
          </div>
          <div className={installPanelClasses}>
            <p className={summaryLabelClasses}>{t('workbench.market.installPanelTitle')}</p>
            <div className="mt-4 grid gap-3 min-[1320px]:grid-cols-[minmax(0,1fr)_168px] min-[1320px]:items-end">
              <div>
                <Label htmlFor="market-install-name" className="text-[13px] font-semibold text-foreground/80">
                  {t('workbench.market.installNameLabel')}
                </Label>
                <Input
                  id="market-install-name"
                  value={marketInstallName}
                  onChange={(event) => onInstallNameChange(event.target.value)}
                  placeholder={copy.name || marketItem.id}
                  className={cn(fieldInputClasses, 'mt-2')}
                />
              </div>
              <Button
                type="button"
                onClick={onInstall}
                disabled={marketInstalling}
                className={cn(actionButtonClasses, 'h-10 w-full rounded-[13px] border-transparent bg-primary px-5 text-[13px] font-semibold text-primary-foreground hover:bg-primary/92')}
              >
                {marketInstalling ? t('workbench.market.installing') : t('workbench.market.installAction')}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className={cn(shellCardClasses, 'space-y-5 p-4')}>
        <div className="border-b border-border/55 pb-4">
          <p className="text-[13px] font-semibold tracking-tight text-foreground">{t('workbench.market.highlightsTitle')}</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {copy.highlights.length > 0 ? (
              copy.highlights.map((highlight) => (
                <div
                  key={`${marketItem.id}:${highlight}`}
                  className="flex min-h-[44px] items-start gap-2 rounded-[14px] border border-border/55 bg-[hsl(var(--surface-panel)/0.9)] px-3 py-2.5 text-[12px] text-foreground/68 shadow-[inset_0_1px_0_rgba(255,255,255,0.5)]"
                >
                  <span className="mt-[5px] h-1.5 w-1.5 shrink-0 rounded-full bg-foreground/24" />
                  <span className="leading-[1.55]">{highlight}</span>
                </div>
              ))
            ) : (
              <span className="text-[12px] text-foreground/52">{t('workbench.market.noRole')}</span>
            )}
          </div>
        </div>

        <div className="border-b border-border/55 pb-4">
          <p className="text-[13px] font-semibold tracking-tight text-foreground">{t('workbench.market.detailsTitle')}</p>
          <div className="mt-3 grid gap-4">
            {copy.detailSections.map((section, index) => (
              <div
                key={`${marketItem.id}:${section.kind}:${section.title}`}
                className={cn(index > 0 && 'border-t border-border/50 pt-4')}
              >
                <p className="text-[13px] font-semibold tracking-tight text-foreground">{section.title}</p>
                {section.body ? <p className="mt-2 text-[12.5px] leading-[1.65] text-foreground/58">{section.body}</p> : null}
                {section.items.length > 0 ? (
                  <ul className="mt-3 space-y-2 text-[12.5px] leading-[1.6] text-foreground/62">
                    {section.items.map((entry) => (
                      <li key={`${section.kind}:${entry}`} className="flex gap-2">
                        <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-foreground/28" />
                        <span>{entry}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ))}
          </div>
        </div>

        <div>
          <p className="text-[13px] font-semibold tracking-tight text-foreground">{t('workbench.market.sourceSummaryTitle')}</p>
          <div className="mt-3 space-y-2 text-[12.5px] leading-[1.6] text-foreground/58">
            <div className="flex items-start justify-between gap-3 rounded-[14px] border border-border/55 bg-[hsl(var(--surface-panel)/0.9)] px-3.5 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.5)]">
              <p className={summaryLabelClasses}>{t('workbench.market.sourcePathLabel')}</p>
              <p className="min-w-0 flex-1 break-all text-right text-foreground/64">{marketItem.sourcePath}</p>
            </div>
            <div className="flex items-start justify-between gap-3 rounded-[14px] border border-border/55 bg-[hsl(var(--surface-panel)/0.9)] px-3.5 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.5)]">
              <p className={summaryLabelClasses}>Raw URL</p>
              <p className="min-w-0 flex-1 break-all text-right text-foreground/58">{marketItem.rawUrl}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
