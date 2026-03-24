import type { ProviderAccount } from '@/lib/providers';
import { cn } from '@/lib/utils';
import { getProviderIconClass, getProviderIconUrl, getProviderTypeInfo } from '@/lib/providers';
import type { ProviderUsageSummary } from '../workbench-view-model';

interface ProviderBoardCardProps {
  summary: ProviderUsageSummary;
  account: ProviderAccount | null;
  defaultAccountId: string | null;
  selected: boolean;
  configuredLabel: string;
  defaultLabel: string;
  tokensLabel: string;
  requestsLabel: string;
  accountsLabel: string;
  onSelect: (accountId: string) => void;
}

const cardClass = 'workbench-motion-card rounded-[18px] border border-[hsl(var(--border-subtle)/0.82)] bg-[hsl(var(--surface-elevated)/0.985)] px-4 py-3 text-left motion-safe:hover:-translate-y-px hover:border-[hsl(var(--border-strong)/0.28)] hover:bg-[hsl(var(--surface-elevated)/1)] hover:shadow-[0_8px_18px_rgba(15,23,42,0.035)]';
const selectedCardClass = 'border-[hsl(var(--border-strong)/0.42)] bg-[hsl(var(--surface-elevated)/1)] shadow-[0_10px_20px_rgba(15,23,42,0.045)]';

export const ProviderBoardCard = ({
  summary,
  account,
  defaultAccountId,
  selected,
  configuredLabel,
  defaultLabel,
  tokensLabel,
  requestsLabel,
  accountsLabel,
  onSelect,
}: ProviderBoardCardProps) => {
  const primaryAccountId = account?.id ?? summary.accountIds[0] ?? null;
  const providerTypeInfo = account ? getProviderTypeInfo(account.vendorId) : undefined;
  const providerIconUrl = account ? getProviderIconUrl(account.vendorId) : undefined;
  const isDefaultScope = defaultAccountId ? summary.accountIds.includes(defaultAccountId) : false;
  const formattedTokens = Intl.NumberFormat().format(summary.totalTokens);
  const formattedRequests = Intl.NumberFormat().format(summary.requestCount);
  const showRuntimeProviderKey = summary.label.trim().toLowerCase() !== summary.runtimeProviderKey.trim().toLowerCase();
  const metaItems = [
    showRuntimeProviderKey ? summary.runtimeProviderKey : null,
    summary.accountCount > 0 ? configuredLabel : null,
  ].filter(Boolean);
  const handleSelect = () => {
    if (primaryAccountId) {
      onSelect(primaryAccountId);
    }
  };

  return (
    <article
      className={cn(
        cardClass,
        'flex min-h-[108px] cursor-pointer flex-col gap-2 focus:outline-none focus-visible:outline-none focus-visible:border-[hsl(var(--border-strong)/0.42)] focus-visible:bg-[hsl(var(--surface-elevated)/1)] focus-visible:ring-0',
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
      <div data-testid={`models-provider-card-select-${summary.runtimeProviderKey}`} className="space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[13px] border border-[hsl(var(--border-subtle)/0.76)] bg-[hsl(var(--surface-base)/0.92)]">
              {providerIconUrl ? (
                <img
                  src={providerIconUrl}
                  alt={providerTypeInfo?.name || summary.label}
                  className={getProviderIconClass(account?.vendorId || '', 'h-[18px] w-[18px]')}
                />
              ) : (
                <span className="text-[18px] text-foreground/76">{providerTypeInfo?.icon ?? '⚙️'}</span>
              )}
            </div>
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="truncate text-[15px] font-semibold tracking-tight text-foreground">{summary.label}</p>
                {isDefaultScope ? (
                  <span className="text-[11px] font-medium text-primary/82">
                    {defaultLabel}
                  </span>
                ) : null}
              </div>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-muted-foreground">
                {metaItems.map((item, index) => (
                  <span key={`${summary.runtimeProviderKey}-${item}-${index}`} className="truncate">
                    {item}
                  </span>
                ))}
              </div>
            </div>
          </div>
          <span className="app-field-surface shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium text-foreground/76">
            {summary.accountCount} {accountsLabel}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-[hsl(var(--border-subtle)/0.7)] pt-2 text-[12px] text-muted-foreground">
          <span>
            {tokensLabel}: {formattedTokens}
          </span>
          <span className="text-border/90">·</span>
          <span>
            {requestsLabel}: {formattedRequests}
          </span>
        </div>
      </div>
    </article>
  );
};
