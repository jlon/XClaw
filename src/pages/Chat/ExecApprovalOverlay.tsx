import { Button } from '@/components/ui/button';
import type { ExecApprovalRequest } from '@/lib/exec-approval-queue';
import { cn } from '@/lib/utils';
import { Loader2, ShieldAlert } from 'lucide-react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

type ExecApprovalOverlayProps = {
  entry: ExecApprovalRequest;
  queueCount: number;
  busy: boolean;
  error: string | null;
  onDecision: (decision: 'allow-once' | 'allow-always' | 'deny') => void;
};

function formatExpiryTime(expiresAtMs: number): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date(expiresAtMs));
}

export function ExecApprovalOverlay({
  entry,
  queueCount,
  busy,
  error,
  onDecision,
}: ExecApprovalOverlayProps) {
  const { t } = useTranslation('chat');
  const remainingText = useMemo(
    () => formatExpiryTime(entry.expiresAtMs),
    [entry.expiresAtMs],
  );

  return (
    <div className="pointer-events-none absolute inset-0 z-40 flex items-start justify-center px-6 pt-6">
      <div className="pointer-events-auto w-full max-w-[44rem] rounded-[24px] border border-[hsl(var(--border)/0.78)] bg-[hsl(var(--background)/0.92)] p-5 shadow-[0_26px_80px_rgba(15,23,42,0.14)] backdrop-blur-xl">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,rgba(248,113,113,0.14),rgba(251,191,36,0.16))] text-[hsl(var(--foreground))] shadow-[inset_0_1px_0_rgba(255,255,255,0.55)]">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div className="space-y-1">
              <div className="text-[1.05rem] font-semibold tracking-[-0.02em] text-[hsl(var(--foreground))]">
                {t('execApproval.title')}
              </div>
              <div className="text-sm text-[hsl(var(--muted-foreground))]">
                {t('execApproval.subtitle', { remaining: remainingText })}
              </div>
            </div>
          </div>
          {queueCount > 1 ? (
            <div className="rounded-full border border-[hsl(var(--border)/0.82)] bg-[hsl(var(--background)/0.8)] px-3 py-1 text-xs font-medium text-[hsl(var(--muted-foreground))]">
              {t('execApproval.queueCount', { count: queueCount })}
            </div>
          ) : null}
        </div>

        <div className="mt-4 rounded-[18px] border border-[hsl(var(--border)/0.82)] bg-[linear-gradient(180deg,rgba(248,250,252,0.72),rgba(241,245,249,0.92))] px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.45),rgba(15,23,42,0.72))]">
          <div className="text-xs uppercase tracking-[0.18em] text-[hsl(var(--muted-foreground))]">
            {t('execApproval.commandLabel')}
          </div>
          <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-words text-[0.9rem] leading-6 text-[hsl(var(--foreground))]">
            {entry.request.command}
          </pre>
        </div>

        <div className="mt-4 grid gap-2 text-sm text-[hsl(var(--muted-foreground))] md:grid-cols-3">
          <div className="rounded-2xl border border-[hsl(var(--border)/0.72)] bg-[hsl(var(--background)/0.72)] px-3 py-2">
            <div className="text-[0.72rem] uppercase tracking-[0.16em]">{t('execApproval.cwdLabel')}</div>
            <div className="mt-1 truncate text-[hsl(var(--foreground))]">{entry.request.cwd || '—'}</div>
          </div>
          <div className="rounded-2xl border border-[hsl(var(--border)/0.72)] bg-[hsl(var(--background)/0.72)] px-3 py-2">
            <div className="text-[0.72rem] uppercase tracking-[0.16em]">{t('execApproval.hostLabel')}</div>
            <div className="mt-1 text-[hsl(var(--foreground))]">{entry.request.host || 'gateway'}</div>
          </div>
          <div className="rounded-2xl border border-[hsl(var(--border)/0.72)] bg-[hsl(var(--background)/0.72)] px-3 py-2">
            <div className="text-[0.72rem] uppercase tracking-[0.16em]">{t('execApproval.policyLabel')}</div>
            <div className="mt-1 text-[hsl(var(--foreground))]">
              {[entry.request.security, entry.request.ask].filter(Boolean).join(' / ') || 'interactive'}
            </div>
          </div>
        </div>

        {error ? (
          <div className="mt-4 rounded-2xl border border-[rgba(239,68,68,0.18)] bg-[rgba(239,68,68,0.08)] px-4 py-3 text-sm text-[rgb(185,28,28)] dark:text-[rgb(254,202,202)]">
            {error}
          </div>
        ) : null}

        <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            className="h-11 rounded-2xl border-[rgba(220,38,38,0.22)] bg-[rgba(255,255,255,0.72)] px-4 text-[rgb(185,28,28)] hover:bg-[rgba(254,242,242,0.95)]"
            onClick={() => onDecision('deny')}
          >
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {t('execApproval.deny')}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            className="h-11 rounded-2xl border-[hsl(var(--border)/0.8)] bg-[rgba(255,255,255,0.78)] px-4 hover:bg-[rgba(248,250,252,0.96)]"
            onClick={() => onDecision('allow-always')}
          >
            {busy && <Loader2 className={cn('mr-2 h-4 w-4 animate-spin')} />}
            {t('execApproval.allowAlways')}
          </Button>
          <Button
            type="button"
            disabled={busy}
            className="h-11 rounded-2xl bg-[linear-gradient(135deg,#1f2937,#374151)] px-5 text-white shadow-[0_16px_40px_rgba(15,23,42,0.18)] hover:opacity-95"
            onClick={() => onDecision('allow-once')}
          >
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {t('execApproval.allowOnce')}
          </Button>
        </div>
      </div>
    </div>
  );
}
