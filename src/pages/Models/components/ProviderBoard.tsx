import type { ProviderAccount } from '@/lib/providers';
import { cn } from '@/lib/utils';
import type { ProviderUsageSummary } from '../workbench-view-model';
import type { ProviderBoardPresentation } from '../workbench-layout';
import { ProviderBoardCard } from './ProviderBoardCard';

interface ProviderBoardProps {
  summaries: ProviderUsageSummary[];
  accounts: ProviderAccount[];
  selectedRuntimeProviderKey: string | null;
  selectedAccountId: string | null;
  loading: boolean;
  defaultAccountId: string | null;
  presentation: ProviderBoardPresentation;
  columns: 1 | 2 | 3 | 4;
  maxVisibleRows: number;
  language: string;
  configuredLabel: string;
  defaultLabel: string;
  boardTitle: string;
  boardHint: string;
  emptyTitle: string;
  emptyHint: string;
  tokensLabel: string;
  requestsLabel: string;
  docsLabel: string;
  accountsLabel: string;
  openLabel: string;
  viewingLabel: string;
  clearLabel: string;
  activeScopeLabel: string;
  onSelect: (accountId: string) => void;
  onClearSelection: () => void;
}

const gridClassMap = {
  1: 'grid-cols-1',
  2: 'md:grid-cols-2',
  3: 'md:grid-cols-2 xl:grid-cols-3',
  4: 'md:grid-cols-2 xl:grid-cols-4',
} as const;

const railListClass = 'space-y-2';
const railRowClass = 'w-full rounded-[14px] border border-[hsl(var(--border-subtle)/0.78)] bg-[hsl(var(--surface-elevated)/0.98)] px-3 py-2.5 text-left transition-colors hover:bg-[hsl(var(--surface-hover)/0.72)]';
const railRowActiveClass = 'border-[hsl(var(--border-strong)/0.34)] bg-[hsl(var(--surface-elevated)/1)]';

const resolvePrimaryAccountId = (
  summary: ProviderUsageSummary,
  accounts: ProviderAccount[],
  defaultAccountId: string | null,
): string | null => {
  const matchingAccounts = accounts.filter((account) => summary.accountIds.includes(account.id));

  if (matchingAccounts.length === 0) {
    return summary.accountIds[0] ?? null;
  }

  return (
    (defaultAccountId ? matchingAccounts.find((account) => account.id === defaultAccountId)?.id : null)
    || matchingAccounts[0]?.id
    || null
  );
};

export const ProviderBoard = ({
  summaries,
  accounts,
  selectedRuntimeProviderKey,
  selectedAccountId,
  loading,
  defaultAccountId,
  presentation,
  columns,
  maxVisibleRows,
  language,
  configuredLabel,
  defaultLabel,
  boardTitle,
  boardHint,
  emptyTitle,
  emptyHint,
  tokensLabel,
  requestsLabel,
  docsLabel,
  accountsLabel,
  openLabel,
  viewingLabel,
  clearLabel,
  activeScopeLabel,
  onSelect,
  onClearSelection,
}: ProviderBoardProps) => {
  const shouldClampBoard = presentation === 'board' && summaries.length > columns * maxVisibleRows;
  const selectedSummary = selectedRuntimeProviderKey
    ? summaries.find((summary) => summary.runtimeProviderKey === selectedRuntimeProviderKey) ?? null
    : null;
  const selectedAccount = selectedAccountId
    ? accounts.find((account) => account.id === selectedAccountId) ?? null
    : null;

  if (presentation === 'header' && selectedSummary) {
    return (
      <section
        className="space-y-3"
        data-testid="models-provider-board"
        data-presentation="header"
        data-columns={columns}
        data-max-visible-rows={maxVisibleRows}
        data-selected-provider={selectedRuntimeProviderKey ?? ''}
        data-overflow-mode="clamp"
      >
        <div
          className="rounded-[16px] border border-[hsl(var(--border-subtle)/0.82)] bg-[hsl(var(--surface-elevated)/0.985)] px-4 py-3"
          data-testid="models-provider-focus-header"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/66">
                {activeScopeLabel}
              </p>
              <h2 className="mt-1 truncate text-[18px] font-semibold tracking-tight text-foreground">
                {selectedAccount?.label || selectedSummary.label}
              </h2>
              <p className="mt-1 truncate text-[12px] text-muted-foreground">
                {[selectedAccount?.id, selectedSummary.runtimeProviderKey].filter(Boolean).join(' · ')}
              </p>
            </div>
            <button
              type="button"
              className="shrink-0 rounded-full border border-[hsl(var(--border-subtle)/0.82)] bg-[hsl(var(--surface-base)/0.9)] px-3 py-1 text-[12px] font-medium text-foreground/76 transition-colors hover:bg-[hsl(var(--surface-hover)/0.72)] hover:text-foreground"
              onClick={onClearSelection}
            >
              {clearLabel}
            </button>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-muted-foreground">
            <span>{tokensLabel}: {Intl.NumberFormat().format(selectedSummary.totalTokens)}</span>
            <span>{requestsLabel}: {Intl.NumberFormat().format(selectedSummary.requestCount)}</span>
          </div>
        </div>
      </section>
    );
  }

  if (presentation === 'rail') {
    return (
      <section
        className="space-y-3"
        data-testid="models-provider-board"
        data-presentation="rail"
        data-columns={columns}
        data-max-visible-rows={maxVisibleRows}
        data-selected-provider={selectedRuntimeProviderKey ?? ''}
        data-overflow-mode="clamp"
      >
        <div className="flex items-center justify-between gap-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/66">
            {activeScopeLabel}
          </p>
          <button
            type="button"
            className="rounded-full border border-[hsl(var(--border-subtle)/0.82)] bg-[hsl(var(--surface-base)/0.9)] px-3 py-1 text-[12px] font-medium text-foreground/76 transition-colors hover:bg-[hsl(var(--surface-hover)/0.72)] hover:text-foreground"
            onClick={onClearSelection}
          >
            {clearLabel}
          </button>
        </div>
        <div className={railListClass} data-testid="models-provider-rail">
          {summaries.map((summary) => {
            const accountId = resolvePrimaryAccountId(summary, accounts, defaultAccountId);
            const selected = summary.runtimeProviderKey === selectedRuntimeProviderKey;

            return (
              <button
                key={summary.runtimeProviderKey}
                type="button"
                className={cn(railRowClass, selected && railRowActiveClass)}
                data-testid={`models-provider-rail-row-${summary.runtimeProviderKey}`}
                onClick={() => {
                  if (accountId) {
                    onSelect(accountId);
                  }
                }}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-semibold text-foreground">{summary.label}</p>
                    <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{summary.runtimeProviderKey}</p>
                  </div>
                  <span className="rounded-full bg-[hsl(var(--surface-hover)/0.82)] px-2 py-0.5 text-[11px] font-medium text-foreground/74">
                    {Intl.NumberFormat().format(summary.totalTokens)}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </section>
    );
  }

  return (
    <section
      className="space-y-3"
      data-testid="models-provider-board"
      data-presentation="board"
      data-columns={columns}
      data-max-visible-rows={maxVisibleRows}
      data-selected-provider={selectedRuntimeProviderKey ?? ''}
      data-overflow-mode="clamp"
    >
      {loading && summaries.length === 0 ? (
        <div className="rounded-[16px] border border-[hsl(var(--border-subtle)/0.72)] bg-[hsl(var(--surface-elevated)/0.72)] px-4 py-6">
          <p className="text-[14px] font-semibold text-foreground">{boardTitle}</p>
          <p className="mt-1 text-[12px] text-muted-foreground">{boardHint}</p>
        </div>
      ) : null}
      {!loading && summaries.length === 0 ? (
        <div className="rounded-[16px] border border-dashed border-[hsl(var(--border-subtle)/0.76)] bg-[hsl(var(--surface-elevated)/0.72)] px-4 py-5">
          <p className="text-[14px] font-semibold text-foreground">{emptyTitle}</p>
          <p className="mt-1 text-[12px] text-muted-foreground">{emptyHint}</p>
        </div>
      ) : null}
      <div
        className={cn(
          'grid gap-3',
          gridClassMap[columns],
          shouldClampBoard && 'max-h-[calc(2*11rem+0.75rem)] overflow-y-auto pr-1',
          summaries.length === 0 && 'hidden',
        )}
      >
        {summaries.map((summary) => {
          const primaryAccountId = resolvePrimaryAccountId(summary, accounts, defaultAccountId);
          const account = primaryAccountId
            ? accounts.find((candidate) => candidate.id === primaryAccountId) ?? null
            : accounts.find((candidate) => summary.accountIds.includes(candidate.id)) ?? null;

          return (
            <ProviderBoardCard
              key={summary.runtimeProviderKey}
              summary={summary}
              account={account}
              defaultAccountId={defaultAccountId}
              selected={summary.selected}
              language={language}
              configuredLabel={configuredLabel}
              defaultLabel={defaultLabel}
              tokensLabel={tokensLabel}
              requestsLabel={requestsLabel}
              accountsLabel={accountsLabel}
              docsLabel={docsLabel}
              openLabel={openLabel}
              viewingLabel={viewingLabel}
              onSelect={onSelect}
            />
          );
        })}
      </div>
    </section>
  );
};
