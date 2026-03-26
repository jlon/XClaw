import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { UsageHistoryEntry } from '../usage-history';

interface UsageRecentRequestsProps {
  entries: UsageHistoryEntry[];
  title: string;
  devModeUnlocked: boolean;
  unknownModelLabel: string;
  inputLabel: (value: string) => string;
  outputLabel: (value: string) => string;
  cacheReadLabel: (value: string) => string;
  cacheWriteLabel: (value: string) => string;
  costLabel: (value: string) => string;
  viewContentLabel: string;
  pageLabel: (current: number, total: number) => string;
  prevLabel: string;
  nextLabel: string;
  currentPage: number;
  totalPages: number;
  onPrevPage: () => void;
  onNextPage: () => void;
  onViewContent: (entry: UsageHistoryEntry) => void;
  onSelectProvider?: (provider: string) => void;
}

const sectionClass = 'app-insight-surface rounded-lg border border-[hsl(var(--border-subtle)/0.78)] px-3.5 py-3';
const rowClass = 'border-t border-[hsl(var(--border-subtle)/0.62)] py-2.5 first:border-t-0 first:pt-0 last:pb-0 transition-colors';
const formatTokenCount = (value: number): string => Intl.NumberFormat().format(value);

function formatUsageTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return timestamp;
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function UsageRecentRequests({
  entries,
  title,
  devModeUnlocked,
  unknownModelLabel,
  inputLabel,
  outputLabel,
  cacheReadLabel,
  cacheWriteLabel,
  costLabel,
  viewContentLabel,
  pageLabel,
  prevLabel,
  nextLabel,
  currentPage,
  totalPages,
  onPrevPage,
  onNextPage,
  onViewContent,
  onSelectProvider,
}: UsageRecentRequestsProps) {
  return (
    <section className={sectionClass} data-testid="models-recent-requests">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">{title}</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">{pageLabel(currentPage, totalPages)}</p>
        </div>
        <div className="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="sm"
            onClick={onPrevPage}
            disabled={currentPage <= 1}
            className="app-field-surface h-7 rounded-md px-2.5 shadow-none"
            aria-label={prevLabel}
            title={prevLabel}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onNextPage}
            disabled={currentPage >= totalPages}
            className="app-field-surface h-7 rounded-md px-2.5 shadow-none"
            aria-label={nextLabel}
            title={nextLabel}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div>
        {entries.map((entry, index) => (
          <div
            key={[entry.sessionId, entry.timestamp, entry.model, entry.provider, index].filter(Boolean).join('-')}
            className={rowClass}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-[13px] font-medium text-foreground">
                  {entry.model || unknownModelLabel}
                </p>
                <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[12px] text-muted-foreground">
                  {entry.provider ? (
                    onSelectProvider ? (
                      <button
                        type="button"
                        className="truncate font-medium text-foreground/80 transition-colors hover:text-foreground"
                        onClick={() => onSelectProvider(entry.provider!)}
                      >
                        {entry.provider}
                      </button>
                    ) : (
                      <span className="truncate">{entry.provider}</span>
                    )
                  ) : null}
                  {[entry.agentId, entry.sessionId].filter(Boolean).map((value) => (
                    <span key={`${entry.sessionId}-${value}`} className="truncate">{value}</span>
                  ))}
                  <span>{formatUsageTimestamp(entry.timestamp)}</span>
                </div>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-[13px] font-semibold">{formatTokenCount(entry.totalTokens)}</p>
                {typeof entry.costUsd === 'number' && Number.isFinite(entry.costUsd) ? (
                  <p className="mt-0.5 text-[11px] text-muted-foreground">{costLabel(entry.costUsd.toFixed(4))}</p>
                ) : null}
              </div>
            </div>
            <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
              <span>{inputLabel(formatTokenCount(entry.inputTokens))}</span>
              <span>{outputLabel(formatTokenCount(entry.outputTokens))}</span>
              {entry.cacheReadTokens > 0 ? <span>{cacheReadLabel(formatTokenCount(entry.cacheReadTokens))}</span> : null}
              {entry.cacheWriteTokens > 0 ? <span>{cacheWriteLabel(formatTokenCount(entry.cacheWriteTokens))}</span> : null}
              {devModeUnlocked && entry.content ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="ml-auto h-6 rounded-sm px-2 text-[11px] shadow-none"
                  onClick={() => onViewContent(entry)}
                >
                  {viewContentLabel}
                </Button>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
