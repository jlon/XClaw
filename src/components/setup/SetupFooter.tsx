import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { SetupCompletePhase, SetupStage } from './types';

interface SetupFooterProps {
  stage: SetupStage;
  completePhase?: SetupCompletePhase;
  canProceed?: boolean;
  primaryLabel?: string;
  secondaryLabel?: string;
  onBack?: () => void;
  onPrimary?: () => void;
  onExit?: () => void;
  className?: string;
}

export function SetupFooter({
  stage,
  completePhase = 'summary',
  canProceed = true,
  primaryLabel,
  secondaryLabel,
  onBack,
  onPrimary,
  onExit,
  className,
}: SetupFooterProps) {
  const { t } = useTranslation('setup');
  const stageCopy: Record<SetupStage, { title: string; body: string; primary: string; secondary?: string }> = {
    start: {
      title: t('wizard.footer.start.title'),
      body: t('wizard.footer.start.body'),
      primary: t('wizard.footer.start.primary'),
      secondary: t('wizard.footer.start.secondary'),
    },
    preparation: {
      title: t('wizard.footer.preparation.title'),
      body: t('wizard.footer.preparation.body'),
      primary: t('wizard.footer.preparation.primary'),
      secondary: t('wizard.footer.preparation.secondary'),
    },
    provider: {
      title: t('wizard.footer.provider.title'),
      body: t('wizard.footer.provider.body'),
      primary: t('wizard.footer.provider.primary'),
      secondary: t('wizard.footer.provider.secondary'),
    },
    complete: {
      title: t('wizard.footer.complete.title'),
      body: t('wizard.footer.complete.body'),
      primary: t('wizard.footer.complete.primary'),
      secondary: t('wizard.footer.complete.secondary'),
    },
  };
  const copy = stageCopy[stage];
  const isApplying = stage === 'complete' && completePhase === 'applying';
  const resolvedPrimary = primaryLabel ?? copy.primary;
  const resolvedSecondary = secondaryLabel ?? copy.secondary;

  return (
    <footer className={cn('flex min-h-[5.5rem] items-center justify-between gap-4 px-6 py-4', className)}>
      <div className="min-w-0">
        <div className="text-sm font-medium text-foreground">{isApplying ? t('wizard.footer.applying.title') : copy.title}</div>
        <div className="mt-1 text-sm leading-6 text-muted-foreground">
          {isApplying ? t('wizard.footer.applying.body') : copy.body}
        </div>
      </div>
      <div className="flex items-center gap-2">
        {stage === 'start' && onExit ? (
          <Button variant="outline" onClick={onExit}>
            {resolvedSecondary ?? t('wizard.footer.start.secondary')}
          </Button>
        ) : null}
        {!isApplying && stage !== 'start' && resolvedSecondary && onBack ? (
          <Button variant="ghost" onClick={onBack}>
            {resolvedSecondary}
          </Button>
        ) : null}
        {!isApplying && onPrimary ? (
          <Button onClick={onPrimary} disabled={!canProceed}>
            {resolvedPrimary}
          </Button>
        ) : null}
      </div>
    </footer>
  );
}
