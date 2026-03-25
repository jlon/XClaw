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
      <div className="pointer-events-auto w-full max-w-[44rem] rounded-xl border border-border/70 bg-background p-5 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[hsl(var(--warning)/0.18)] bg-[hsl(var(--warning)/0.12)] text-[hsl(var(--warning))] shadow-none">
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

        <div className="mt-4 rounded-[18px] border border-[hsl(var(--border)/0.82)] bg-[hsl(var(--surface-panel)/0.92)] px-4 py-3 shadow-none">
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
          <div className="mt-4 rounded-2xl border border-[hsl(var(--danger)/0.22)] bg-[hsl(var(--danger)/0.1)] px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        ) : null}

        <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            className="h-11 rounded-2xl border-[hsl(var(--danger)/0.24)] bg-[hsl(var(--danger)/0.08)] px-4 text-destructive hover:bg-[hsl(var(--danger)/0.12)]"
            onClick={() => onDecision('deny')}
          >
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {t('execApproval.deny')}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            className="h-11 rounded-2xl border-[hsl(var(--border)/0.8)] bg-[hsl(var(--surface-elevated)/0.98)] px-4 hover:bg-[hsl(var(--surface-hover)/0.7)]"
            onClick={() => onDecision('allow-always')}
          >
            {busy && <Loader2 className={cn('mr-2 h-4 w-4 animate-spin')} />}
            {t('execApproval.allowAlways')}
          </Button>
          <Button
            type="button"
            disabled={busy}
            className="h-11 rounded-2xl bg-primary px-5 text-primary-foreground shadow-none hover:bg-primary/92"
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
