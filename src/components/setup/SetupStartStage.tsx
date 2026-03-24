import { motion } from 'framer-motion';
import { AlertTriangle, Bot, CheckCircle2, FolderOpen, Loader2, PlugZap, Puzzle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import XClawIcon from '@/assets/logo.svg';
import { SUPPORTED_LANGUAGES } from '@/i18n';
import { cn } from '@/lib/utils';
import { useSettingsStore } from '@/stores/settings';
import type { SetupInspectionSummary, SetupMode, SetupPlanSummary, TakeoverImportSummary } from '@/lib/setup-takeover';
import { setupStageContainerVariants, setupStageItemVariants } from './setup-motion';

interface SetupStartStageProps {
  inspection: SetupInspectionSummary | null;
  activePlan: SetupPlanSummary | null;
  mode: SetupMode;
  onModeChange: (mode: SetupMode) => void;
  status: TakeoverImportSummary | null;
  submitting: boolean;
  modeLocked?: boolean;
}

const uniq = (values: string[]) => [...new Set(values)];

export function SetupStartStage({
  inspection,
  activePlan,
  mode,
  onModeChange,
  status,
  submitting,
  modeLocked = false,
}: SetupStartStageProps) {
  const shouldShowTakeover = Boolean(
    inspection && (
      inspection.bootstrap?.source === 'legacy-footprint'
      || inspection.hasExistingOpenClaw
    ),
  );

  return shouldShowTakeover ? (
    <TakeoverStartContent
      inspection={inspection}
      activePlan={activePlan}
      mode={mode}
      onModeChange={onModeChange}
      status={status}
      submitting={submitting}
      modeLocked={modeLocked}
    />
  ) : (
    <WelcomeStartContent />
  );
}

function TakeoverStartContent({
  inspection,
  activePlan,
  mode,
  onModeChange,
  status,
  submitting,
  modeLocked,
}: SetupStartStageProps) {
  const { t } = useTranslation('setup');
  const warnings = mode === 'takeover'
    ? uniq([...(activePlan?.warnings ?? []), ...(inspection?.warnings ?? [])])
    : activePlan?.warnings ?? [];
  const takeoverSummaryItems = [
    {
      key: 'providers',
      icon: PlugZap,
      label: t('takeover.summary.providers'),
      value: inspection?.counts?.runtimeProviders ?? 0,
    },
    {
      key: 'skills',
      icon: Puzzle,
      label: t('takeover.summary.skills'),
      value: inspection?.counts?.skills ?? 0,
    },
    {
      key: 'extensions',
      icon: Bot,
      label: t('takeover.summary.extensions'),
      value: inspection?.counts?.extensions ?? 0,
    },
  ];

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={setupStageContainerVariants}
      className="space-y-5"
    >
      <motion.div variants={setupStageItemVariants} className="space-y-2">
        <h2 className="text-[1.9rem] font-semibold tracking-[-0.04em] text-foreground xl:text-[2.35rem]">{t('takeover.title')}</h2>
        <p className="max-w-3xl text-sm leading-7 text-muted-foreground xl:text-[15px]">
          {t('takeover.description')}
        </p>
      </motion.div>

      <motion.div variants={setupStageItemVariants} className="inline-flex rounded-[1.35rem] border border-border/75 bg-[hsl(var(--surface-elevated)/0.88)] p-1 shadow-sm">
        <button
          type="button"
          onClick={() => onModeChange('takeover')}
          disabled={modeLocked}
          className={cn(
            'workbench-motion-button workbench-motion-button--lift rounded-[1.1rem] px-4 py-3 text-left min-w-[13.5rem]',
            mode === 'takeover'
              ? 'app-field-surface shadow-sm'
              : 'text-muted-foreground hover:bg-[hsl(var(--surface-hover)/0.75)] hover:text-foreground',
            modeLocked && 'cursor-not-allowed opacity-70',
          )}
          aria-pressed={mode === 'takeover'}
        >
          <div className="font-medium">{t('takeover.choice.takeover')}</div>
        </button>
        <button
          type="button"
          onClick={() => onModeChange('fresh')}
          disabled={modeLocked}
          className={cn(
            'workbench-motion-button workbench-motion-button--lift rounded-[1.1rem] px-4 py-3 text-left min-w-[13.5rem]',
            mode === 'fresh'
              ? 'app-field-surface shadow-sm'
              : 'text-muted-foreground hover:bg-[hsl(var(--surface-hover)/0.75)] hover:text-foreground',
            modeLocked && 'cursor-not-allowed opacity-70',
          )}
          aria-pressed={mode === 'fresh'}
        >
          <div className="font-medium">{t('takeover.choice.fresh')}</div>
        </button>
      </motion.div>

      <motion.div variants={setupStageItemVariants} className="app-pane-surface rounded-[1.6rem] p-5 xl:p-6">
        {mode === 'takeover' ? (
          <div className="space-y-5">
            <div className="space-y-2">
              <div className="text-[1.05rem] font-semibold text-foreground">{t('takeover.choice.takeover')}</div>
              <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
                {t('takeover.mode.takeoverDescription')}
              </p>
            </div>

            <div className="grid gap-3 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
              <div className="app-insight-surface rounded-[1.2rem] p-4">
                <div className="flex items-start gap-3">
                  <span className="app-field-surface flex h-10 w-10 items-center justify-center rounded-[0.95rem]">
                    <FolderOpen className="h-4.5 w-4.5 text-primary" />
                  </span>
                  <div className="min-w-0">
                    <div className="text-xs uppercase tracking-[0.14em] text-muted-foreground/70">{t('takeover.summary.workspace')}</div>
                    <div className="mt-1 break-all text-sm font-medium leading-6 text-foreground">
                      {inspection?.openClawDir || inspection?.defaultWorkspacePath}
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1 2xl:grid-cols-3">
                {takeoverSummaryItems.map(({ key, icon: Icon, label, value }) => (
                  <div key={key} className="app-insight-surface rounded-[1.2rem] p-4">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Icon className="h-4 w-4" />
                      <span className="text-xs uppercase tracking-[0.14em]">{label}</span>
                    </div>
                    <div className="mt-3 text-2xl font-semibold tracking-[-0.03em] text-foreground">{value}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="space-y-2">
              <div className="text-[1.05rem] font-semibold text-foreground">{t('takeover.choice.fresh')}</div>
              <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
                {t('takeover.mode.freshDescription')}
              </p>
            </div>

            <div className="grid gap-3 xl:grid-cols-2">
              <div className="app-insight-surface rounded-[1.2rem] p-4">
                <div className="flex items-start gap-3">
                  <span className="app-field-surface flex h-10 w-10 items-center justify-center rounded-[0.95rem]">
                    <FolderOpen className="h-4.5 w-4.5 text-primary" />
                  </span>
                  <div className="min-w-0">
                    <div className="text-xs uppercase tracking-[0.14em] text-muted-foreground/70">{t('takeover.mode.recommendedWorkspace')}</div>
                    <div className="mt-1 break-all text-sm font-medium leading-6 text-foreground">
                      {activePlan?.workspace?.defaultPath || inspection?.defaultWorkspacePath}
                    </div>
                  </div>
                </div>
              </div>
              <div className="app-insight-surface rounded-[1.2rem] p-4">
                <div className="flex items-start gap-3">
                  <span className="app-field-surface flex h-10 w-10 items-center justify-center rounded-[0.95rem]">
                    <PlugZap className="h-4.5 w-4.5 text-primary" />
                  </span>
                  <div className="min-w-0">
                    <div className="text-xs uppercase tracking-[0.14em] text-muted-foreground/70">{t('takeover.mode.recommendedPort')}</div>
                    <div className="mt-1 text-sm font-medium leading-6 text-foreground">
                      {activePlan?.runtime?.gatewayPort ?? inspection?.gatewayPort}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </motion.div>

      {activePlan?.blockingIssues?.length ? (
        <motion.div variants={setupStageItemVariants} className="app-pane-surface rounded-[1.3rem] border-red-500/18 p-4">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[0.9rem] bg-[hsl(var(--danger)/0.08)] text-destructive">
              <AlertTriangle className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <div className="font-medium text-foreground">
                {mode === 'takeover' ? t('takeover.blockingTitle') : t('takeover.mode.freshBlockingTitle')}
              </div>
              <ul className="mt-2 space-y-1 text-sm leading-6 text-muted-foreground">
                {activePlan.blockingIssues.map((issue) => (
                  <li key={issue}>• {issue}</li>
                ))}
              </ul>
            </div>
          </div>
        </motion.div>
      ) : null}

      {warnings.length ? (
        <motion.div variants={setupStageItemVariants} className="app-pane-surface rounded-[1.3rem] p-4">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[0.9rem] bg-[hsl(var(--warning)/0.08)] text-amber-700 dark:text-amber-100">
              <AlertTriangle className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <div className="font-medium text-foreground">
                {mode === 'takeover' ? t('takeover.warningsTitle') : t('takeover.mode.freshWarningsTitle')}
              </div>
              <ul className="mt-2 space-y-1 text-sm leading-6 text-muted-foreground">
                {warnings.map((warning) => (
                  <li key={warning}>• {warning}</li>
                ))}
              </ul>
            </div>
          </div>
        </motion.div>
      ) : null}

      {mode === 'takeover' && status?.error ? (
        <motion.div variants={setupStageItemVariants} className="rounded-[18px] border border-red-500/20 bg-[hsl(var(--danger)/0.08)] p-4 text-sm leading-6 text-destructive">
          {status.error}
        </motion.div>
      ) : null}

      {mode === 'takeover' && submitting && status?.step ? (
        <motion.div variants={setupStageItemVariants} className="inline-flex items-center gap-2 rounded-full border border-primary/15 bg-[hsl(var(--surface-elevated)/0.92)] px-3 py-1.5 text-xs font-medium text-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          {t(`takeover.progress.${status.step}`)}
        </motion.div>
      ) : null}
    </motion.div>
  );
}

function WelcomeStartContent() {
  const { t } = useTranslation(['setup', 'settings']);
  const { language, setLanguage } = useSettingsStore();
  const orderedLanguages = ['zh', 'en', 'ja']
    .map((code) => SUPPORTED_LANGUAGES.find((lang) => lang.code === code))
    .filter((lang): lang is (typeof SUPPORTED_LANGUAGES)[number] => Boolean(lang));
  const features = [
    t('welcome.features.noCommand'),
    t('welcome.features.modernUI'),
    t('welcome.features.bundles'),
    t('welcome.features.crossPlatform'),
  ];

  return (
    <motion.div
      data-testid="setup-start-hero"
      initial="hidden"
      animate="visible"
      variants={setupStageContainerVariants}
      className="app-setup-hero w-full space-y-5 rounded-[2rem] p-6 xl:p-8"
    >
      <motion.div variants={setupStageItemVariants} className="space-y-5">
        <div className="flex items-center gap-4">
          <div className="app-field-surface flex h-16 w-16 items-center justify-center rounded-[1.4rem] shadow-sm">
            <img src={XClawIcon} alt="XClaw" className="h-10 w-10" />
          </div>
          <div className="text-left">
            <h2 className="text-[2rem] font-semibold tracking-[-0.04em] text-foreground xl:text-[2.6rem]">{t('welcome.title')}</h2>
          </div>
        </div>

        <p className="max-w-3xl text-left text-sm leading-7 text-muted-foreground xl:text-[15px]">
          {t('welcome.description')}
        </p>

        <div className="flex flex-wrap gap-2">
          {orderedLanguages.map((lang) => (
            <button
              key={lang.code}
              type="button"
              onClick={() => setLanguage(lang.code)}
              className={cn(
                'inline-flex h-8 items-center rounded-[12px] border px-3 text-xs transition-colors',
                language === lang.code
                  ? 'border-primary/25 bg-primary text-primary-foreground shadow-sm'
                  : 'border-border/70 bg-[hsl(var(--surface-elevated)/0.66)] text-muted-foreground hover:bg-[hsl(var(--surface-elevated)/0.82)] hover:text-foreground',
              )}
            >
              {lang.label}
            </button>
          ))}
        </div>
      </motion.div>

      <motion.div variants={setupStageItemVariants} className="rounded-[1.5rem] border border-border/70 app-insight-surface p-5">
        <div className="space-y-3">
          {features.map((feature) => (
            <div key={feature} className="flex items-start gap-3 text-left">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--glow-brand)/0.14)] text-primary">
                <CheckCircle2 className="h-3.5 w-3.5" />
              </span>
              <span className="text-sm leading-6 text-foreground/86">{feature}</span>
            </div>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}
