import { CheckCircle2, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import XClawIcon from '@/assets/logo.svg';
import { SUPPORTED_LANGUAGES } from '@/i18n';
import { cn } from '@/lib/utils';
import { useSettingsStore } from '@/stores/settings';
import type { SetupInspectionSummary, SetupMode, SetupPlanSummary, TakeoverImportSummary } from '@/lib/setup-takeover';

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
  return inspection?.hasExistingOpenClaw ? (
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

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <div className="app-setup-kicker">{t('wizard.rail.title')}</div>
        <h2 className="text-[1.9rem] font-semibold tracking-[-0.04em] text-foreground xl:text-[2.35rem]">{t('takeover.title')}</h2>
        <p className="max-w-3xl text-sm leading-7 text-muted-foreground xl:text-[15px]">
          {t('takeover.description')}
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <button
          type="button"
          onClick={() => onModeChange('takeover')}
          disabled={modeLocked}
          className={cn(
            'rounded-[1.35rem] border px-5 py-4 text-left transition-all',
            mode === 'takeover'
              ? 'border-primary/35 app-field-surface shadow-sm ring-1 ring-primary/10'
              : 'border-border/70 bg-[hsl(var(--surface-elevated)/0.55)] hover:border-primary/20 hover:bg-[hsl(var(--surface-elevated)/0.75)]',
            modeLocked && 'cursor-not-allowed opacity-70',
          )}
          aria-pressed={mode === 'takeover'}
        >
          <div className="font-medium">{t('takeover.choice.takeover')}</div>
          <div className="mt-1 text-sm leading-6 text-muted-foreground">
            {t('takeover.choice.takeoverDescription')}
          </div>
          <div className="mt-3 break-all text-xs font-mono text-muted-foreground/80">
            {inspection?.openClawDir || inspection?.defaultWorkspacePath}
          </div>
        </button>
        <button
          type="button"
          onClick={() => onModeChange('fresh')}
          disabled={modeLocked}
          className={cn(
            'rounded-[1.35rem] border px-5 py-4 text-left transition-all',
            mode === 'fresh'
              ? 'border-primary/35 app-field-surface shadow-sm ring-1 ring-primary/10'
              : 'border-border/70 bg-[hsl(var(--surface-elevated)/0.55)] hover:border-primary/20 hover:bg-[hsl(var(--surface-elevated)/0.75)]',
            modeLocked && 'cursor-not-allowed opacity-70',
          )}
          aria-pressed={mode === 'fresh'}
        >
          <div className="font-medium">{t('takeover.choice.fresh')}</div>
          <div className="mt-1 text-sm leading-6 text-muted-foreground">
            {t('takeover.choice.freshDescription')}
          </div>
          <div className="mt-3 break-all text-xs font-mono text-muted-foreground/80">
            {activePlan?.workspace?.defaultPath || inspection?.defaultWorkspacePath}
          </div>
        </button>
      </div>

      {activePlan?.blockingIssues?.length ? (
        <div className="rounded-[18px] border border-red-500/20 bg-[hsl(var(--danger)/0.08)] p-4">
          <div className="font-medium text-destructive">
            {mode === 'takeover' ? t('takeover.blockingTitle') : t('takeover.mode.freshBlockingTitle')}
          </div>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-destructive">
            {activePlan.blockingIssues.map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {warnings.length ? (
        <div className="rounded-[18px] border border-amber-500/20 bg-[hsl(var(--warning)/0.08)] p-4">
          <div className="font-medium text-amber-700 dark:text-amber-100">
            {mode === 'takeover' ? t('takeover.warningsTitle') : t('takeover.mode.freshWarningsTitle')}
          </div>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-amber-800 dark:text-amber-50">
            {warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {mode === 'takeover' && status?.error ? (
        <div className="rounded-[18px] border border-red-500/20 bg-[hsl(var(--danger)/0.08)] p-4 text-sm leading-6 text-destructive">
          {status.error}
        </div>
      ) : null}

      {mode === 'takeover' && submitting && status?.step ? (
        <div className="inline-flex items-center gap-2 rounded-full border border-primary/15 bg-[hsl(var(--surface-elevated)/0.92)] px-3 py-1.5 text-xs font-medium text-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          {t(`takeover.progress.${status.step}`)}
        </div>
      ) : null}
    </div>
  );
}

function WelcomeStartContent() {
  const { t } = useTranslation(['setup', 'settings']);
  const { language, setLanguage } = useSettingsStore();
  const features = [
    t('welcome.features.noCommand'),
    t('welcome.features.modernUI'),
    t('welcome.features.bundles'),
    t('welcome.features.crossPlatform'),
  ];

  return (
    <div data-testid="setup-start-hero" className="app-setup-hero space-y-5 rounded-[2rem] p-6 xl:p-8">
      <div className="flex items-center gap-4">
        <div className="app-field-surface flex h-16 w-16 items-center justify-center rounded-[1.4rem] shadow-sm">
          <img src={XClawIcon} alt="XClaw" className="h-10 w-10" />
        </div>
        <div className="text-left">
          <div className="app-setup-kicker">{t('wizard.rail.title')}</div>
          <h2 className="mt-2 text-[2rem] font-semibold tracking-[-0.04em] text-foreground xl:text-[2.6rem]">{t('welcome.title')}</h2>
        </div>
      </div>

      <p className="max-w-3xl text-left text-sm leading-7 text-muted-foreground xl:text-[15px]">
        {t('welcome.description')}
      </p>

      <div className="flex flex-wrap gap-2">
        {SUPPORTED_LANGUAGES.map((lang) => (
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

      <div className="rounded-[1.5rem] border border-border/70 app-insight-surface p-5">
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
      </div>
    </div>
  );
}
