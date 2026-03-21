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
    <div className="space-y-6">
      <div className="app-setup-hero rounded-[2rem] p-6 xl:p-8">
        <div className="space-y-2">
          <div className="app-setup-kicker">{t('wizard.rail.title')}</div>
          <h2 className="text-[2rem] font-semibold tracking-[-0.04em] text-foreground xl:text-[2.6rem]">{t('takeover.title')}</h2>
          <p className="max-w-3xl text-sm leading-7 text-muted-foreground xl:text-[15px]">
            {t('takeover.description')}
          </p>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-2">
          <button
            type="button"
            onClick={() => onModeChange('takeover')}
            className={cn(
              'rounded-[1.4rem] border px-5 py-4 text-left transition-all',
              mode === 'takeover'
                ? 'border-primary/35 app-field-surface shadow-sm ring-1 ring-primary/10'
                : 'border-border/70 bg-[hsl(var(--surface-elevated)/0.5)] hover:border-primary/20 hover:bg-[hsl(var(--surface-elevated)/0.72)]',
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
              'rounded-[1.4rem] border px-5 py-4 text-left transition-all',
              mode === 'fresh'
                ? 'border-primary/35 app-field-surface shadow-sm ring-1 ring-primary/10'
                : 'border-border/70 bg-[hsl(var(--surface-elevated)/0.5)] hover:border-primary/20 hover:bg-[hsl(var(--surface-elevated)/0.72)]',
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
      </div>

      <div className="rounded-3xl border border-border/70 app-panel-surface p-5">
        <div className="space-y-1">
          <h3 className="text-lg font-semibold">
            {mode === 'takeover' ? t('takeover.mode.takeoverTitle') : t('takeover.mode.freshTitle')}
          </h3>
          <p className="text-sm leading-6 text-muted-foreground">
            {mode === 'takeover' ? t('takeover.mode.takeoverDescription') : t('takeover.mode.freshDescription')}
          </p>
        </div>

        {mode === 'takeover' ? (
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-border/70 app-field-surface p-4">
              <div className="text-sm text-muted-foreground">{t('takeover.summary.providers')}</div>
              <div className="mt-1 text-2xl font-semibold">{inspection?.counts?.runtimeProviders ?? 0}</div>
            </div>
            <div className="rounded-2xl border border-border/70 app-field-surface p-4">
              <div className="text-sm text-muted-foreground">{t('takeover.summary.skills')}</div>
              <div className="mt-1 text-2xl font-semibold">{inspection?.counts?.skills ?? 0}</div>
            </div>
            <div className="rounded-2xl border border-border/70 app-field-surface p-4">
              <div className="text-sm text-muted-foreground">{t('takeover.summary.extensions')}</div>
              <div className="mt-1 text-2xl font-semibold">{inspection?.counts?.extensions ?? 0}</div>
            </div>
            <div className="rounded-2xl border border-border/70 app-field-surface p-4">
              <div className="text-sm text-muted-foreground">{t('takeover.summary.workspace')}</div>
              <div className="mt-1 break-all text-sm font-medium">{currentWorkspace}</div>
            </div>
          </div>
        ) : (
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-border/70 app-field-surface p-4">
              <div className="text-sm text-muted-foreground">{t('takeover.mode.currentWorkspace')}</div>
              <div className="mt-2 break-all text-sm font-medium">{currentWorkspace}</div>
            </div>
            <div className="rounded-2xl border border-border/70 app-field-surface p-4">
              <div className="text-sm text-muted-foreground">{t('takeover.mode.recommendedWorkspace')}</div>
              <div className="mt-2 break-all text-sm font-medium">{recommendedWorkspace}</div>
              <p className="mt-3 text-xs leading-5 text-muted-foreground">{t('takeover.mode.workspaceHint')}</p>
            </div>
            <div className="rounded-2xl border border-border/70 app-field-surface p-4">
              <div className="text-sm text-muted-foreground">{t('takeover.mode.currentPort')}</div>
              <div className="mt-2 text-2xl font-semibold">{currentPort}</div>
            </div>
            <div className="rounded-2xl border border-border/70 app-field-surface p-4">
              <div className="text-sm text-muted-foreground">{t('takeover.mode.recommendedPort')}</div>
              <div className="mt-2 text-2xl font-semibold">{recommendedPort}</div>
              <p className="mt-3 text-xs leading-5 text-muted-foreground">{t('takeover.mode.portHint')}</p>
            </div>
          </div>
        )}

        {mode === 'fresh' ? (
          <p className="mt-4 text-sm text-muted-foreground">{t('takeover.mode.nextHint')}</p>
        ) : null}
      </div>

      {activePlan?.blockingIssues?.length ? (
        <div className="rounded-2xl border border-red-500/20 bg-[hsl(var(--danger)/0.08)] p-4">
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
        <div className="rounded-2xl border border-amber-500/20 bg-[hsl(var(--warning)/0.08)] p-4">
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
        <div className="rounded-2xl border border-red-500/20 bg-[hsl(var(--danger)/0.08)] p-4 text-sm leading-6 text-destructive">
          {status.error}
        </div>
      ) : null}

      {submitting ? (
        <div className="rounded-2xl border border-primary/20 app-panel-surface p-4">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t('takeover.running')}
          </div>
          {status ? (
            <div className="mt-2 text-sm text-muted-foreground">
              {t(`takeover.progress.${status.step}`)}
            </div>
          ) : null}
          {status?.warnings.length ? (
            <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
              {status.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          ) : null}
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
              'inline-flex h-8 items-center rounded-full border px-3 text-xs transition-colors',
              language === lang.code
                ? 'border-primary/25 bg-primary text-primary-foreground shadow-sm'
                : 'border-border/70 bg-[hsl(var(--surface-elevated)/0.66)] text-muted-foreground hover:bg-accent hover:text-accent-foreground',
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
