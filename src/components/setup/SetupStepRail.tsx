import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import type { SetupStageStatus } from './types';
import { setupRailItemVariants, setupStageContainerVariants } from './setup-motion';
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
    <nav aria-label={t('wizard.rail.aria')} className={cn('flex h-full min-h-0 flex-col px-4 py-5 lg:px-5 lg:py-6', className)}>
      <div className="flex items-center gap-3 px-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-[0.95rem] bg-[hsl(var(--surface-elevated)/0.95)] shadow-sm ring-1 ring-border/60">
          <img src={logoSvg} alt="XClaw" className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-primary/75">{t('wizard.rail.title')}</div>
          <div className="mt-0.5 text-sm font-medium text-foreground">XClaw</div>
        </div>
      </div>
      <motion.ol
        initial="hidden"
        animate="visible"
        variants={setupStageContainerVariants}
        className="mt-5 space-y-1.5"
      >
        {stages.map((stage, index) => (
          <motion.li
            key={stage.id}
            layout
            variants={setupRailItemVariants}
            animate={stage.status === 'current' ? 'active' : 'inactive'}
          >
            <button
              type="button"
              disabled
              aria-current={stage.status === 'current' ? 'step' : undefined}
              className={cn(
                'flex w-full items-center gap-3 rounded-[1rem] border px-3 py-2.5 text-left transition-colors disabled:cursor-default disabled:opacity-100',
                statusClasses[stage.status],
              )}
            >
              <span
                className={cn(
                  'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold',
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
          </motion.li>
        ))}
      </motion.ol>
    </nav>
  );
}
