import { Button } from '@/components/ui/button';
import type { ProviderAccount } from '@/lib/providers';
import { cn } from '@/lib/utils';
import { getProviderDocsUrl, getProviderTypeInfo } from '@/lib/providers';
import type { ProviderUsageSummary } from '../workbench-view-model';

interface ProviderBoardCardProps {
  summary: ProviderUsageSummary;
  account: ProviderAccount | null;
  defaultAccountId: string | null;
  selected: boolean;
  language: string;
  configuredLabel: string;
  defaultLabel: string;
  tokensLabel: string;
  requestsLabel: string;
  accountsLabel: string;
  docsLabel: string;
  openLabel: string;
  viewingLabel: string;
  onSelect: (accountId: string) => void;
}

const cardClass = 'rounded-[18px] border border-border/70 bg-[hsl(var(--surface-elevated)/0.98)] px-4 py-3 text-left transition-colors hover:bg-[hsl(var(--surface-hover)/0.72)]';
const selectedCardClass = 'border-primary/45 bg-[hsl(var(--accent)/0.12)]';

export const ProviderBoardCard = ({
  summary,
  account,
  defaultAccountId,
  selected,
  language,
  configuredLabel,
  defaultLabel,
  tokensLabel,
  requestsLabel,
  accountsLabel,
  docsLabel,
  openLabel,
  viewingLabel,
  onSelect,
}: ProviderBoardCardProps) => {
  const primaryAccountId = account?.id ?? summary.accountIds[0] ?? null;
  const providerTypeInfo = account ? getProviderTypeInfo(account.vendorId) : undefined;
  const docsUrl = providerTypeInfo
    ? getProviderDocsUrl(providerTypeInfo, language) ?? providerTypeInfo.apiKeyUrl
    : undefined;
  const isDefaultScope = defaultAccountId ? summary.accountIds.includes(defaultAccountId) : false;
  const handleSelect = () => {
    if (primaryAccountId) {
      onSelect(primaryAccountId);
    }
  };

  return (
    <article
      className={cn(
        cardClass,
        'flex min-h-[176px] cursor-pointer flex-col focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25',
        selected && selectedCardClass,
      )}
      role="button"
      tabIndex={primaryAccountId ? 0 : -1}
      aria-pressed={selected}
      data-testid={`models-provider-card-${summary.runtimeProviderKey}`}
      data-clickable={primaryAccountId ? 'true' : 'false'}
      onClick={handleSelect}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget || !primaryAccountId) {
          return;
        }
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          handleSelect();
        }
      }}
    >
      <div
        className="flex flex-1 flex-col"
        data-testid={`models-provider-card-select-${summary.runtimeProviderKey}`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] border border-border/70 bg-[hsl(var(--surface-panel)/0.88)] text-[20px]">
              {providerTypeInfo?.icon ?? '⚙️'}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-[16px] font-semibold text-foreground">{summary.label}</p>
                  {isDefaultScope ? (
                    <span className="rounded-full bg-[hsl(var(--accent)/0.14)] px-2 py-0.5 text-[11px] font-medium text-foreground/78">
                      {defaultLabel}
                    </span>
                  ) : null}
                  {summary.accountCount > 0 ? (
                    <span className="rounded-full bg-[hsl(var(--surface-hover)/0.8)] px-2 py-0.5 text-[11px] font-medium text-foreground/82">
                      {configuredLabel}
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 truncate text-[12px] text-muted-foreground">
                  {summary.runtimeProviderKey}
                </p>
              </div>
            </div>
          </div>
          <span className="rounded-full bg-[hsl(var(--surface-hover)/0.8)] px-2 py-0.5 text-[11px] font-medium text-foreground/82">
            {summary.accountCount} {accountsLabel}
          </span>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-muted-foreground">
          <span>
            {tokensLabel}: {Intl.NumberFormat().format(summary.totalTokens)}
          </span>
          <span>
            {requestsLabel}: {Intl.NumberFormat().format(summary.requestCount)}
          </span>
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between gap-3 border-t border-border/60 pt-3">
        {docsUrl ? (
          <Button asChild variant="ghost" size="sm" className="h-7 rounded-full px-2.5 text-[12px] text-muted-foreground hover:text-foreground">
            <a
              href={docsUrl}
              target="_blank"
              rel="noreferrer"
              aria-label={`${summary.label} ${docsLabel}`}
              onClick={(event) => event.stopPropagation()}
            >
              {docsLabel}
            </a>
          </Button>
        ) : <span />}
        <span className="text-[12px] font-medium text-muted-foreground/86">
          {selected ? viewingLabel : openLabel}
        </span>
      </div>
    </article>
  );
};
