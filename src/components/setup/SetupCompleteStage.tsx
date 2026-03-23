import type { ReactNode } from 'react';
import { AlertCircle, CheckCircle2, Loader2, XCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';

export interface SetupCompleteSkill {
  id: string;
  name: ReactNode;
  description?: ReactNode;
  status: 'pending' | 'installing' | 'completed' | 'failed';
}

export interface SetupCompleteMetric {
  label: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
}

export interface SetupCompleteStageProps {
  phase: 'applying' | 'summary';
  title: ReactNode;
  subtitle?: ReactNode;
  progress?: number;
  progressLabel?: ReactNode;
  skills?: SetupCompleteSkill[];
  summaryCards?: SetupCompleteMetric[];
  warningMessage?: ReactNode;
  footerNote?: ReactNode;
  children?: ReactNode;
  className?: string;
}

const renderMetricCard = (metric: SetupCompleteMetric) => (
  <div key={String(metric.label)} className="rounded-2xl border border-border/70 app-field-surface p-4">
    <div className="text-sm text-muted-foreground">{metric.label}</div>
    <div className="mt-1 break-all text-sm font-medium text-foreground">{metric.value}</div>
    {metric.hint ? <div className="mt-3 text-xs leading-5 text-muted-foreground">{metric.hint}</div> : null}
  </div>
);

const statusIcon = (status: SetupCompleteSkill['status']) => {
  switch (status) {
    case 'pending':
      return <div className="h-5 w-5 rounded-full border-2 border-border/70 bg-[hsl(var(--surface-panel)/0.86)]" />;
    case 'installing':
      return <Loader2 className="h-5 w-5 animate-spin text-primary" />;
    case 'completed':
      return <CheckCircle2 className="h-5 w-5 text-green-400" />;
    case 'failed':
      return <XCircle className="h-5 w-5 text-red-400" />;
  }
};

const statusLabelClass = (status: SetupCompleteSkill['status']) => {
  switch (status) {
    case 'pending':
      return 'text-muted-foreground';
    case 'installing':
      return 'text-primary';
    case 'completed':
      return 'text-green-400';
    case 'failed':
      return 'text-red-400';
  }
};

export function SetupCompleteStage({
  phase,
  title,
  subtitle,
  progress,
  progressLabel,
  skills,
  summaryCards,
  warningMessage,
  footerNote,
  children,
  className,
}: SetupCompleteStageProps) {
  const { t } = useTranslation('setup');
  const isApplying = phase === 'applying';

  return (
    <div className={cn('space-y-6', className)}>
      <div className="space-y-2 text-center">
        <div className="flex justify-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full border border-border/70 bg-[hsl(var(--surface-elevated)/0.95)] text-2xl">
            {isApplying ? '⚙️' : '🎉'}
          </div>
        </div>
        <h2 className="text-xl font-semibold">{title}</h2>
        {subtitle ? <p className="text-muted-foreground">{subtitle}</p> : null}
      </div>

      {isApplying && typeof progress === 'number' ? (
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">{progressLabel ?? t('complete.progress')}</span>
            <span className="text-primary">{progress}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-secondary">
            <div className="h-full rounded-full bg-primary transition-[width] duration-300" style={{ width: `${progress}%` }} />
          </div>
        </div>
      ) : null}

      {isApplying && skills?.length ? (
        <div className="space-y-2">
          {skills.map((skill) => (
            <div
              key={skill.id}
              className={cn(
                'flex items-center justify-between rounded-2xl border border-border/70 p-3',
                skill.status === 'installing' ? 'app-field-surface' : 'bg-transparent',
              )}
            >
              <div className="flex items-center gap-3">
                {statusIcon(skill.status)}
                <div>
                  <p className="font-medium text-foreground">{skill.name}</p>
                  {skill.description ? <p className="text-xs text-muted-foreground">{skill.description}</p> : null}
                </div>
              </div>
              <span className={cn('text-sm font-medium', statusLabelClass(skill.status))}>
                {skill.status === 'pending'
                  ? t('installing.status.pending')
                  : skill.status === 'installing'
                    ? t('installing.status.installing')
                    : skill.status === 'completed'
                      ? t('installing.status.installed')
                      : t('installing.status.failed')}
              </span>
            </div>
          ))}
        </div>
      ) : null}

      {!isApplying && summaryCards?.length ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {summaryCards.map(renderMetricCard)}
        </div>
      ) : null}

      {warningMessage ? (
        <div className="rounded-2xl border border-red-500/20 bg-[hsl(var(--danger)/0.08)] p-4 text-sm leading-6 text-destructive">
          <div className="flex items-start gap-2">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-400" />
            <div>{warningMessage}</div>
          </div>
        </div>
      ) : null}

      {footerNote ? (
        <div className="rounded-[18px] app-insight-surface p-4 text-sm leading-6 text-muted-foreground">
          {footerNote}
        </div>
      ) : null}

      {children}
    </div>
  );
}
