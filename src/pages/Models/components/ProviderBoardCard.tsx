import { PanelRightOpen } from 'lucide-react';
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
  openInspectorLabel: string;
  onSelect: (accountId: string) => void;
  onOpenInspector: (accountId: string) => void;
}

const cardClass = 'app-pane-surface workbench-motion-card rounded-xl border border-[hsl(var(--border-subtle)/0.82)] bg-[hsl(var(--surface-elevated)/0.985)] px-3.5 py-2.5 text-left hover:border-[hsl(var(--border-strong)/0.28)] hover:bg-[hsl(var(--surface-elevated)/1)] hover:shadow-sm';
const selectedCardClass = 'border-[hsl(var(--border-strong)/0.42)] bg-[hsl(var(--surface-elevated)/1)] shadow-sm';

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
  openInspectorLabel,
  onSelect,
  onOpenInspector,
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
        'relative flex min-h-[92px] flex-col gap-1.5 overflow-hidden focus-within:outline-none',
        primaryAccountId ? 'cursor-pointer' : 'cursor-default',
        selected && selectedCardClass,
      )}
      data-testid={`models-provider-card-${summary.runtimeProviderKey}`}
      data-clickable={primaryAccountId ? 'true' : 'false'}
    >
      {primaryAccountId ? (
        <button
          type="button"
          className="desktop-focus-ring absolute inset-0 rounded-xl focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-0"
          data-testid={`models-provider-card-select-${summary.runtimeProviderKey}`}
          aria-pressed={selected}
          aria-label={summary.label}
          onClick={handleSelect}
        />
      ) : (
        <div data-testid={`models-provider-card-select-${summary.runtimeProviderKey}`} className="absolute inset-0" />
      )}
      <div className="relative z-10 space-y-1.5 pointer-events-none">
        <div className="flex items-start justify-between gap-2.5">
          <div className="flex min-w-0 items-start gap-2.5">
            <div className="app-field-surface flex h-8 w-8 shrink-0 items-center justify-center rounded-[11px] border border-[hsl(var(--border-subtle)/0.76)] bg-[hsl(var(--surface-base)/0.92)]">
              {providerIconUrl ? (
                <img
                  src={providerIconUrl}
                  alt={providerTypeInfo?.name || summary.label}
                  className={getProviderIconClass(account?.vendorId || '', 'h-4 w-4')}
                />
              ) : (
                <span className="text-[16px] text-foreground/76">{providerTypeInfo?.icon ?? '⚙️'}</span>
              )}
            </div>
            <div className="min-w-0 space-y-0.5">
              <div className="flex flex-wrap items-center gap-1.5">
                <p className="truncate text-[14px] font-semibold tracking-tight text-foreground">{summary.label}</p>
                {isDefaultScope ? (
                  <span className="text-[10px] font-medium text-primary/82">
                    {defaultLabel}
                  </span>
                ) : null}
              </div>
              <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] text-muted-foreground">
                {metaItems.map((item, index) => (
                  <span key={`${summary.runtimeProviderKey}-${item}-${index}`} className="truncate">
                    {item}
                  </span>
                ))}
              </div>
            </div>
          </div>
          <div className="pointer-events-auto flex shrink-0 items-center gap-1">
            {primaryAccountId ? (
              <button
                type="button"
                className="desktop-focus-ring app-field-surface inline-flex h-6 w-6 items-center justify-center rounded-[8px] border border-[hsl(var(--border-subtle)/0.72)] bg-[hsl(var(--surface-base)/0.82)] text-muted-foreground transition-colors hover:bg-[hsl(var(--surface-hover)/0.82)] hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-0"
                aria-label={openInspectorLabel}
                data-testid={`models-provider-card-details-${summary.runtimeProviderKey}`}
                onClick={() => onOpenInspector(primaryAccountId)}
              >
                <PanelRightOpen className="h-3.5 w-3.5" />
              </button>
            ) : null}
            <span
              data-testid={`models-provider-card-accounts-${summary.runtimeProviderKey}`}
              className="app-field-surface shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium text-foreground/76"
            >
              {summary.accountCount} {accountsLabel}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 border-t border-[hsl(var(--border-subtle)/0.7)] pt-1.5 text-[11px] text-muted-foreground">
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
