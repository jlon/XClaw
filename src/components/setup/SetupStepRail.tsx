import type { ReactNode } from 'react';
import { Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import type { SetupStageStatus } from './types';
import logoSvg from '@/assets/logo.svg';

export interface SetupStepRailItem {
  id: string;
  label: string;
  status: SetupStageStatus;
  description?: ReactNode;
}

interface SetupStepRailProps {
  stages: SetupStepRailItem[];
  onSelect?: (stageId: string) => void;
  className?: string;
}

const statusClasses: Record<SetupStageStatus, string> = {
  complete: 'border-primary/40 bg-primary text-primary-foreground shadow-sm',
  current: 'border-primary/40 bg-[hsl(var(--surface-elevated)/0.98)] text-foreground shadow-sm',
  upcoming: 'border-border/70 bg-transparent text-muted-foreground',
};

export function SetupStepRail({ stages, className }: SetupStepRailProps) {
  const { t } = useTranslation('setup');

  return (
    <nav aria-label={t('wizard.rail.aria')} className={cn('flex h-full min-h-0 flex-col px-5 py-6', className)}>
      <div className="app-field-surface rounded-[1.6rem] p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-[1rem] bg-[hsl(var(--surface-elevated)/0.9)] shadow-sm">
            <img src={logoSvg} alt="XClaw" className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] font-medium uppercase tracking-[0.24em] text-primary/80">{t('wizard.rail.title')}</div>
            <div className="mt-1 text-sm font-medium text-foreground">XClaw</div>
          </div>
        </div>
      </div>
      <ol className="mt-6 space-y-2">
        {stages.map((stage, index) => (
          <li key={stage.id}>
            <button
              type="button"
              disabled
              aria-current={stage.status === 'current' ? 'step' : undefined}
              className={cn(
                'flex w-full items-start gap-3 rounded-2xl border px-4 py-3 text-left transition-colors disabled:cursor-default disabled:opacity-100',
                statusClasses[stage.status],
              )}
            >
              <span
                className={cn(
                  'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold',
                  stage.status === 'complete'
                    ? 'border-primary-foreground/20 bg-primary-foreground/15 text-primary-foreground'
                    : stage.status === 'current'
                      ? 'border-primary/30 bg-primary/10 text-primary'
                      : 'border-border/70 bg-background/70 text-muted-foreground',
                )}
              >
                {stage.status === 'complete' ? <Check className="h-4 w-4" /> : index + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium leading-6">{stage.label}</span>
              </span>
            </button>
          </li>
        ))}
      </ol>
    </nav>
  );
}
