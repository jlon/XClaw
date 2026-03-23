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
}

const uniq = (values: string[]) => [...new Set(values)];

export function SetupStartStage({
  inspection,
  activePlan,
  mode,
  onModeChange,
  status,
  submitting,
}: SetupStartStageProps) {
  return inspection?.hasExistingOpenClaw ? (
    <TakeoverStartContent
      inspection={inspection}
      activePlan={activePlan}
      mode={mode}
      onModeChange={onModeChange}
      status={status}
      submitting={submitting}
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
}: SetupStartStageProps) {
  const { t } = useTranslation('setup');
  const currentWorkspace = inspection?.defaultWorkspacePath || inspection?.openClawDir || '-';
  const recommendedWorkspace = activePlan?.workspace?.defaultPath || currentWorkspace;
  const currentPort = inspection?.gatewayPort ? String(inspection.gatewayPort) : '-';
  const recommendedPort = activePlan?.runtime?.gatewayPort
    ? String(activePlan.runtime.gatewayPort)
    : currentPort;
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
          className={cn(
            'rounded-[1.35rem] border px-5 py-4 text-left transition-all',
            mode === 'takeover'
              ? 'border-primary/35 app-field-surface shadow-sm ring-1 ring-primary/10'
              : 'border-border/70 bg-[hsl(var(--surface-elevated)/0.55)] hover:border-primary/20 hover:bg-[hsl(var(--surface-elevated)/0.75)]',
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
          className={cn(
            'rounded-[1.35rem] border px-5 py-4 text-left transition-all',
            mode === 'fresh'
              ? 'border-primary/35 app-field-surface shadow-sm ring-1 ring-primary/10'
              : 'border-border/70 bg-[hsl(var(--surface-elevated)/0.55)] hover:border-primary/20 hover:bg-[hsl(var(--surface-elevated)/0.75)]',
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

      <div className="rounded-[1.5rem] border border-border/70 app-insight-surface p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold">
              {mode === 'takeover' ? t('takeover.mode.takeoverTitle') : t('takeover.mode.freshTitle')}
            </h3>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              {mode === 'takeover' ? t('takeover.mode.takeoverDescription') : t('takeover.mode.freshDescription')}
            </p>
          </div>
          {submitting ? (
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/15 bg-[hsl(var(--surface-elevated)/0.92)] px-3 py-1.5 text-xs font-medium text-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              {t('takeover.running')}
            </div>
          ) : null}
        </div>

        {mode === 'takeover' ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-[1.1rem] border border-border/70 bg-[hsl(var(--surface-elevated)/0.86)] px-4 py-3">
              <div className="text-xs uppercase tracking-[0.14em] text-muted-foreground/90">{t('takeover.summary.providers')}</div>
              <div className="mt-2 text-lg font-semibold text-foreground">{inspection?.counts?.runtimeProviders ?? 0}</div>
            </div>
            <div className="rounded-[1.1rem] border border-border/70 bg-[hsl(var(--surface-elevated)/0.86)] px-4 py-3">
              <div className="text-xs uppercase tracking-[0.14em] text-muted-foreground/90">{t('takeover.summary.skills')}</div>
              <div className="mt-2 text-lg font-semibold text-foreground">{inspection?.counts?.skills ?? 0}</div>
            </div>
            <div className="rounded-[1.1rem] border border-border/70 bg-[hsl(var(--surface-elevated)/0.86)] px-4 py-3">
              <div className="text-xs uppercase tracking-[0.14em] text-muted-foreground/90">{t('takeover.summary.extensions')}</div>
              <div className="mt-2 text-lg font-semibold text-foreground">{inspection?.counts?.extensions ?? 0}</div>
            </div>
            <div className="rounded-[1.1rem] border border-border/70 bg-[hsl(var(--surface-elevated)/0.86)] px-4 py-3">
              <div className="text-xs uppercase tracking-[0.14em] text-muted-foreground/90">{t('takeover.summary.workspace')}</div>
              <div className="mt-2 break-all text-sm font-medium text-foreground">{currentWorkspace}</div>
            </div>
          </div>
        ) : (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-[1.1rem] border border-border/70 bg-[hsl(var(--surface-elevated)/0.86)] px-4 py-3">
              <div className="text-xs uppercase tracking-[0.14em] text-muted-foreground/90">{t('takeover.mode.recommendedWorkspace')}</div>
              <div className="mt-2 break-all text-sm font-medium text-foreground">{recommendedWorkspace}</div>
            </div>
            <div className="rounded-[1.1rem] border border-border/70 bg-[hsl(var(--surface-elevated)/0.86)] px-4 py-3">
              <div className="text-xs uppercase tracking-[0.14em] text-muted-foreground/90">{t('takeover.mode.recommendedPort')}</div>
              <div className="mt-2 text-lg font-semibold text-foreground">{recommendedPort}</div>
            </div>
          </div>
        )}

        {status?.state === 'running' && status.step ? (
          <div className="mt-4 rounded-[1.1rem] border border-primary/15 bg-[hsl(var(--surface-elevated)/0.88)] px-4 py-3 text-sm text-muted-foreground">
            {t(`takeover.progress.${status.step}`)}
          </div>
        ) : null}
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

      {status?.error ? (
        <div className="rounded-[18px] border border-red-500/20 bg-[hsl(var(--danger)/0.08)] p-4 text-sm leading-6 text-destructive">
          {status.error}
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
    <div data-testid="setup-start-hero" className="app-setup-hero space-y-6 rounded-[2rem] p-6 xl:p-8">
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

      <div className="grid gap-3 pt-1 sm:grid-cols-2">
        {features.map((feature) => (
          <div key={feature} className="app-field-surface flex items-start gap-3 rounded-[1.35rem] p-4 text-left shadow-sm">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--glow-brand)/0.14)] text-primary">
              <CheckCircle2 className="h-4.5 w-4.5" />
            </span>
            <span className="text-sm leading-6 text-foreground/86">{feature}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
