import { AnimatePresence, motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { setupStageItemVariants, setupStageTransition } from './setup-motion';
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
  const stageCopy: Record<SetupStage, { primary: string; secondary?: string }> = {
    start: {
      primary: t('wizard.footer.start.primary'),
      secondary: t('wizard.footer.start.secondary'),
    },
    preparation: {
      primary: t('wizard.footer.preparation.primary'),
      secondary: t('wizard.footer.preparation.secondary'),
    },
    provider: {
      primary: t('wizard.footer.provider.primary'),
      secondary: t('wizard.footer.provider.secondary'),
    },
    complete: {
      primary: t('wizard.footer.complete.primary'),
      secondary: t('wizard.footer.complete.secondary'),
    },
  };
  const copy = stageCopy[stage];
  const isApplying = stage === 'complete' && completePhase === 'applying';
  const isEnhancementPhase = stage === 'complete' && completePhase === 'enhancements';
  const showPrimary = !isApplying && !isEnhancementPhase && Boolean(onPrimary);
  const resolvedPrimary = primaryLabel ?? copy.primary;
  const resolvedSecondary = secondaryLabel ?? copy.secondary;

  return (
    <footer data-testid="setup-footer-shell" className={cn('flex items-center justify-end gap-4 px-6 py-3', className)}>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={`${stage}-${completePhase}`}
          data-testid="setup-footer-body"
          initial="hidden"
          animate="visible"
          exit="hidden"
          variants={setupStageItemVariants}
          transition={setupStageTransition}
          className="flex w-full items-center justify-end gap-2"
        >
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
            {showPrimary ? (
              <Button onClick={onPrimary} disabled={!canProceed}>
                {resolvedPrimary}
              </Button>
            ) : null}
          </div>
        </motion.div>
      </AnimatePresence>
    </footer>
  );
}
