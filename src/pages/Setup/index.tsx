/**
 * Setup Wizard Page
 * First-time setup experience for new users
 */
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Loader2,
  AlertCircle,
  Eye,
  EyeOff,
  RefreshCw,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Copy,
} from 'lucide-react';
import { TitleBar } from '@/components/layout/TitleBar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { useGatewayStore } from '@/stores/gateway';
import { useSettingsStore } from '@/stores/settings';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { SUPPORTED_LANGUAGES } from '@/i18n';
import { toast } from 'sonner';
import { invokeIpc } from '@/lib/api-client';
import { hostApiFetch } from '@/lib/host-api';
import { subscribeHostEvent } from '@/lib/host-events';
import {
  activateSetupSession,
  loadSetupPlan,
  loadSetupTakeoverState,
  loadTakeoverImportStatus,
  startTakeoverImport,
  type SetupInspectionSummary,
  type SetupMode,
  type SetupPlanSummary,
  type TakeoverImportSummary,
} from '@/lib/setup-takeover';
interface SetupStep {
  id: string;
  title: string;
  description: string;
}

const STEP_ID = {
  TAKEOVER: 'takeover',
  WELCOME: 'welcome',
  RUNTIME: 'runtime',
  PROVIDER: 'provider',
  PROVIDER_REVIEW: 'providerReview',
  INSTALLING: 'installing',
  COMPLETE: 'complete',
} as const;

const getSteps = (
  t: TFunction,
  options: {
    includeTakeover: boolean;
    mode: SetupMode;
    requiresProviderReview: boolean;
  },
): SetupStep[] => {
  if (options.mode === 'takeover') {
    return [
      ...(options.includeTakeover ? [{
        id: STEP_ID.TAKEOVER,
        title: t('steps.takeover.title'),
        description: t('steps.takeover.description'),
      }] : []),
      ...(options.requiresProviderReview ? [{
        id: STEP_ID.PROVIDER_REVIEW,
        title: t('steps.providerReview.title'),
        description: t('steps.providerReview.description'),
      }] : []),
    ];
  }

  return [
    ...(options.includeTakeover ? [{
      id: STEP_ID.TAKEOVER,
      title: t('steps.takeover.title'),
      description: t('steps.takeover.description'),
    }] : []),
    {
      id: STEP_ID.WELCOME,
      title: t('steps.welcome.title'),
      description: t('steps.welcome.description'),
    },
    {
      id: STEP_ID.RUNTIME,
      title: t('steps.runtime.title'),
      description: t('steps.runtime.description'),
    },
    {
      id: STEP_ID.PROVIDER,
      title: t('steps.provider.title'),
      description: t('steps.provider.description'),
    },
    {
      id: STEP_ID.INSTALLING,
      title: t('steps.installing.title'),
      description: t('steps.installing.description'),
    },
    {
      id: STEP_ID.COMPLETE,
      title: t('steps.complete.title'),
      description: t('steps.complete.description'),
    },
  ];
};

// Default skills to auto-install (no additional API keys required)
interface DefaultSkill {
  id: string;
  name: string;
  description: string;
}

const getDefaultSkills = (t: TFunction): DefaultSkill[] => [
  { id: 'opencode', name: t('defaultSkills.opencode.name'), description: t('defaultSkills.opencode.description') },
  { id: 'python-env', name: t('defaultSkills.python-env.name'), description: t('defaultSkills.python-env.description') },
  { id: 'code-assist', name: t('defaultSkills.code-assist.name'), description: t('defaultSkills.code-assist.description') },
  { id: 'file-tools', name: t('defaultSkills.file-tools.name'), description: t('defaultSkills.file-tools.description') },
  { id: 'terminal', name: t('defaultSkills.terminal.name'), description: t('defaultSkills.terminal.description') },
];

const uniq = (values: string[]) => [...new Set(values)];
const findProviderReviewStepIndex = (steps: SetupStep[]) => (
  steps.findIndex((candidate) => candidate.id === STEP_ID.PROVIDER_REVIEW)
);

import {
  SETUP_PROVIDERS,
  type ProviderAccount,
  type ProviderType,
  type ProviderTypeInfo,
  getProviderDocsUrl,
  getProviderIconUrl,
  resolveProviderApiKeyForSave,
  resolveProviderModelForSave,
  shouldInvertInDark,
  shouldShowProviderModelId,
} from '@/lib/providers';
import {
  buildProviderAccountId,
  fetchProviderSnapshot,
  hasConfiguredCredentials,
  pickPreferredAccount,
} from '@/lib/provider-accounts';
import XClawIcon from '@/assets/logo.svg';

// Use the shared provider registry for setup providers
const providers = SETUP_PROVIDERS;

function getProtocolBaseUrlPlaceholder(
  apiProtocol: ProviderAccount['apiProtocol'],
): string {
  if (apiProtocol === 'anthropic-messages') {
    return 'https://api.example.com/anthropic';
  }
  return 'https://api.example.com/v1';
}

// NOTE: Channel types moved to Settings > Channels page
// NOTE: Skill bundles moved to Settings > Skills page - auto-install essential skills during setup

export function Setup() {
  const { t } = useTranslation(['setup', 'channels']);
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
  const [setupMode, setSetupMode] = useState<SetupMode>('fresh');
  const [setupStateLoading, setSetupStateLoading] = useState(true);
  const [setupStateError, setSetupStateError] = useState<string | null>(null);
  const [setupInspection, setSetupInspection] = useState<SetupInspectionSummary | null>(null);
  const [setupPlans, setSetupPlans] = useState<{
    fresh: SetupPlanSummary | null;
    takeover: SetupPlanSummary | null;
  }>({
    fresh: null,
    takeover: null,
  });
  const [takeoverSubmitting, setTakeoverSubmitting] = useState(false);
  const [takeoverStatus, setTakeoverStatus] = useState<TakeoverImportSummary | null>(null);
  const takeoverActionLockRef = useRef(false);
  const [freshWorkspacePath, setFreshWorkspacePath] = useState('');
  const [freshGatewayPortInput, setFreshGatewayPortInput] = useState('');
  const [freshPlanLoading, setFreshPlanLoading] = useState(false);

  // Setup state
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [providerConfigured, setProviderConfigured] = useState(false);
  const [apiKey, setApiKey] = useState('');
  // Installation state for the Installing step
  const [installedSkills, setInstalledSkills] = useState<string[]>([]);
  // Runtime check status
  const [runtimeChecksPassed, setRuntimeChecksPassed] = useState(false);
  const takeoverRequiresProviderReview = setupMode === 'takeover'
    && Boolean(setupPlans.takeover?.providerImport?.requiresReview);

  const steps = getSteps(t, {
    includeTakeover: setupInspection?.hasExistingOpenClaw ?? false,
    mode: setupMode,
    requiresProviderReview: takeoverRequiresProviderReview,
  });
  const safeStepIndex = Number.isInteger(currentStep)
    ? Math.min(Math.max(currentStep, 0), steps.length - 1)
    : 0;
  const step = steps[safeStepIndex] ?? steps[0];
  const isFirstStep = safeStepIndex === 0;
  const isLastStep = safeStepIndex === steps.length - 1;
  const activeSetupPlan = setupMode === 'takeover'
    ? setupPlans.takeover
    : setupPlans.fresh;
  const stepTitle = step.id === STEP_ID.TAKEOVER
    ? (setupMode === 'takeover' ? t('takeover.mode.takeoverTitle') : t('takeover.mode.freshTitle'))
    : t(`steps.${step.id}.title`);
  const stepDescription = step.id === STEP_ID.TAKEOVER
    ? (setupMode === 'takeover' ? t('takeover.mode.takeoverDescription') : t('takeover.mode.freshDescription'))
    : t(`steps.${step.id}.description`);
  const settingsGatewayPort = useSettingsStore((state) => state.gatewayPort) ?? 18789;

  const markSetupComplete = useSettingsStore((state) => state.markSetupComplete);
  const parsedFreshGatewayPort = /^\d+$/.test(freshGatewayPortInput.trim())
    ? Number.parseInt(freshGatewayPortInput.trim(), 10)
    : null;
  const freshGatewayPortError = (() => {
    if (setupMode !== 'fresh') {
      return null;
    }
    if (!freshGatewayPortInput.trim()) {
      return t('runtime.setup.portRequired');
    }
    if (parsedFreshGatewayPort === null || parsedFreshGatewayPort < 1 || parsedFreshGatewayPort > 65535) {
      return t('runtime.setup.portInvalid');
    }
    return null;
  })();
  const freshWorkspaceError = setupMode === 'fresh' && !freshWorkspacePath.trim()
    ? t('runtime.setup.workspaceRequired')
    : null;

  const completeSetupSession = useCallback(async () => {
    await activateSetupSession(
      setupMode === 'fresh' && parsedFreshGatewayPort !== null
        ? {
          mode: 'fresh',
          gatewayPort: parsedFreshGatewayPort,
          workspacePath: freshWorkspacePath.trim(),
        }
        : { mode: setupMode },
    );
    await markSetupComplete({ persist: false });
    toast.success(t('complete.title'));
    navigate('/');
  }, [freshWorkspacePath, markSetupComplete, navigate, parsedFreshGatewayPort, setupMode, t]);

  const loadSetupState = useCallback(async () => {
    setSetupStateLoading(true);
    setSetupStateError(null);
    try {
      const [state, takeoverStatusSnapshot] = await Promise.all([
        loadSetupTakeoverState(),
        loadTakeoverImportStatus().catch(() => null),
      ]);
      const nextSetupMode = state.inspection.hasExistingOpenClaw
        ? (state.inspection.suggestedMode ?? 'takeover')
        : 'fresh';
      const nextTakeoverRequiresProviderReview = nextSetupMode === 'takeover'
        && Boolean(state.plans.takeover?.providerImport?.requiresReview);

      setSetupInspection(state.inspection);
      setSetupPlans(state.plans);
      setSetupMode(nextSetupMode);
      setFreshWorkspacePath(state.plans.fresh?.workspace?.defaultPath ?? state.inspection.defaultWorkspacePath ?? '');
      setFreshGatewayPortInput(String(state.plans.fresh?.runtime?.gatewayPort ?? state.inspection.gatewayPort ?? settingsGatewayPort));
      if (takeoverStatusSnapshot) {
        setTakeoverStatus(takeoverStatusSnapshot);
        const snapshotRunning = takeoverStatusSnapshot.state === 'running';
        setTakeoverSubmitting(snapshotRunning);
        if (takeoverStatusSnapshot.state === 'complete' && nextTakeoverRequiresProviderReview) {
          setCurrentStep(state.inspection.hasExistingOpenClaw ? 1 : 0);
        }
        if (snapshotRunning) {
          void loadTakeoverImportStatus().then((latestStatus) => {
            setTakeoverStatus(latestStatus);
            if (latestStatus.state === 'complete' && nextTakeoverRequiresProviderReview) {
              setCurrentStep(state.inspection.hasExistingOpenClaw ? 1 : 0);
            }
            if (latestStatus.state !== 'running' && latestStatus.state !== 'idle') {
              setTakeoverSubmitting(false);
            }
          }).catch(() => {
          });
        }
      }
    } catch (error) {
      setSetupStateError(String(error));
    } finally {
      setSetupStateLoading(false);
    }
  }, [settingsGatewayPort]);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      await loadSetupState();
      if (cancelled) {
        return;
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [loadSetupState]);

  useEffect(() => {
    if (!takeoverSubmitting) {
      return;
    }

    let disposed = false;
    let timer: number | null = null;

    const poll = async () => {
      try {
        const status = await loadTakeoverImportStatus();
        if (!disposed) {
          setTakeoverStatus(status);
          if (status.state === 'complete' && takeoverRequiresProviderReview) {
            const nextStepIndex = findProviderReviewStepIndex(steps);
            if (nextStepIndex >= 0) {
              setCurrentStep(nextStepIndex);
            }
          }
          if (status.state !== 'running' && status.state !== 'idle') {
            setTakeoverSubmitting(false);
            return;
          }
        }
      } catch (error) {
        if (!disposed) {
          console.error('Failed to load takeover status:', error);
        }
      } finally {
        if (!disposed) {
          timer = window.setTimeout(() => {
            void poll();
          }, 400);
        }
      }
    };

    void poll();

    return () => {
      disposed = true;
      if (timer !== null) {
        window.clearTimeout(timer);
      }
    };
  }, [steps, takeoverRequiresProviderReview, takeoverSubmitting]);

  useEffect(() => {
    if (setupStateLoading || setupMode !== 'fresh') {
      return;
    }

    if (freshGatewayPortError || freshWorkspaceError || parsedFreshGatewayPort === null) {
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(() => {
      setFreshPlanLoading(true);
      void loadSetupPlan('fresh', {
        gatewayPort: parsedFreshGatewayPort,
        workspacePath: freshWorkspacePath.trim(),
      }).then((plan) => {
        if (!cancelled) {
          setSetupPlans((current) => ({
            ...current,
            fresh: plan,
          }));
        }
      }).catch(() => {
        // Keep the last valid fresh plan instead of resetting the form state.
      }).finally(() => {
        if (!cancelled) {
          setFreshPlanLoading(false);
        }
      });
    }, 150);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [
    freshGatewayPortError,
    freshWorkspaceError,
    freshWorkspacePath,
    parsedFreshGatewayPort,
    setupMode,
    setupStateLoading,
  ]);

  // Derive canProceed based on current step - computed directly to avoid useEffect
  const canProceed = useMemo(() => {
    switch (step.id) {
      case STEP_ID.TAKEOVER:
        return !takeoverSubmitting && Boolean(activeSetupPlan?.canApply);
      case STEP_ID.WELCOME:
        return true;
      case STEP_ID.RUNTIME:
        return runtimeChecksPassed
          && Boolean(activeSetupPlan?.canApply)
          && !freshPlanLoading
          && (setupMode !== 'fresh' || (!freshGatewayPortError && !freshWorkspaceError));
      case STEP_ID.PROVIDER:
        return providerConfigured;
      case STEP_ID.PROVIDER_REVIEW:
        return true;
      case STEP_ID.INSTALLING:
        return false; // Cannot manually proceed, auto-proceeds when done
      case STEP_ID.COMPLETE:
        return true;
      default:
        return true;
    }
  }, [
    activeSetupPlan?.canApply,
    freshGatewayPortError,
    freshPlanLoading,
    freshWorkspaceError,
    providerConfigured,
    runtimeChecksPassed,
    setupMode,
    step.id,
    takeoverSubmitting,
  ]);

  const handleNext = async () => {
    if (step.id === STEP_ID.TAKEOVER) {
      if (setupMode === 'takeover') {
        if (takeoverActionLockRef.current) {
          return;
        }

        if (takeoverStatus?.state === 'complete') {
          if (takeoverRequiresProviderReview) {
            const nextStepIndex = findProviderReviewStepIndex(steps);
            if (nextStepIndex >= 0) {
              setCurrentStep(nextStepIndex);
            }
            return;
          }

          takeoverActionLockRef.current = true;
          setTakeoverSubmitting(true);
          try {
            await completeSetupSession();
          } catch (error) {
            const message = String(error);
            setTakeoverStatus((current) => current
              ? { ...current, error: message }
              : current);
            toast.error(message);
          } finally {
            takeoverActionLockRef.current = false;
            setTakeoverSubmitting(false);
          }
          return;
        }

        takeoverActionLockRef.current = true;
        setTakeoverSubmitting(true);
        try {
          const result = await startTakeoverImport();
          setTakeoverStatus(result);
          if (result.state === 'complete') {
            if (takeoverRequiresProviderReview) {
              const nextStepIndex = steps.findIndex((candidate) => candidate.id === STEP_ID.PROVIDER_REVIEW);
              if (nextStepIndex >= 0) {
                setCurrentStep(nextStepIndex);
                return;
              }
            }
            try {
              await completeSetupSession();
              return;
            } catch (error) {
              const message = String(error);
              setTakeoverStatus({ ...result, error: message });
              toast.error(message);
              return;
            }
          }

          toast.error(result.error || result.blockingIssues[0] || t('takeover.importFailed'));
        } catch (error) {
          toast.error(String(error));
        } finally {
          takeoverActionLockRef.current = false;
          setTakeoverSubmitting(false);
        }
        return;
      }

      setCurrentStep((i) => i + 1);
      return;
    }

    if (!isLastStep) {
      setCurrentStep((i) => i + 1);
      return;
    }

    try {
      await completeSetupSession();
    } catch (error) {
      toast.error(String(error));
    }
  };

  const handleBack = () => {
    setCurrentStep((i) => Math.max(i - 1, 0));
  };

  const handleSkip = async () => {
    try {
      await completeSetupSession();
    } catch (error) {
      toast.error(String(error));
    }
  };

  // Auto-proceed when installation is complete
  const handleInstallationComplete = useCallback((skills: string[]) => {
    setInstalledSkills(skills);
    // Auto-proceed to next step after a short delay
    setTimeout(() => {
      setCurrentStep((i) => i + 1);
    }, 1000);
  }, []);
  const isTakeoverCompletionAction = step.id === STEP_ID.TAKEOVER
    && takeoverStatus?.state === 'complete'
    && !takeoverRequiresProviderReview;

  if (setupStateLoading) {
    return (
      <div className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
        <TitleBar />
        <div className="flex flex-1 items-center justify-center p-8">
          <div className="rounded-xl border bg-card p-8 text-center shadow-sm">
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
            <p className="mt-4 text-sm text-muted-foreground">正在检查本地 OpenClaw 环境...</p>
          </div>
        </div>
      </div>
    );
  }

  if (setupStateError) {
    return (
      <div className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
        <TitleBar />
        <div className="flex flex-1 items-center justify-center p-8">
          <div className="max-w-lg rounded-xl border bg-card p-8 shadow-sm">
            <h1 className="text-xl font-semibold">无法完成安装环境检测</h1>
            <p className="mt-3 break-all text-sm text-muted-foreground">{setupStateError}</p>
            <div className="mt-6 flex justify-end">
              <Button onClick={() => { void loadSetupState(); }}>
                <RefreshCw className="mr-2 h-4 w-4" />
                重新检测
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }


  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
      <TitleBar />
      <div className="flex-1 overflow-auto">
        {/* Progress Indicator */}
        <div className="flex justify-center pt-8">
          <div className="flex items-center gap-2">
            {steps.map((s, i) => (
              <div key={s.id} className="flex items-center">
                <div
                  className={cn(
                    'flex h-8 w-8 items-center justify-center rounded-full border-2 transition-colors',
                    i < safeStepIndex
                      ? 'border-primary bg-primary text-primary-foreground'
                      : i === safeStepIndex
                        ? 'border-primary bg-primary/5 text-primary'
                        : 'border-black/10 text-muted-foreground dark:border-white/10'
                  )}
                >
                  {i < safeStepIndex ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <span className="text-sm">{i + 1}</span>
                  )}
                </div>
                {i < steps.length - 1 && (
                  <div
                    className={cn(
                      'h-0.5 w-8 transition-colors',
                      i < safeStepIndex ? 'bg-primary' : 'bg-black/10 dark:bg-white/10'
                    )}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Step Content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={step.id}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="mx-auto max-w-3xl p-8"
          >
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold mb-2">{stepTitle}</h1>
              <p className="text-muted-foreground">{stepDescription}</p>
            </div>

            {/* Step-specific content */}
            <div className="mb-8 rounded-3xl border border-black/10 bg-[#f3f1e9] p-8 text-card-foreground shadow-[0_20px_60px_rgba(0,0,0,0.08)] dark:border-white/10 dark:bg-card">
              {step.id === STEP_ID.TAKEOVER && (
                <TakeoverContent
                  inspection={setupInspection}
                  activePlan={activeSetupPlan}
                  mode={setupMode}
                  onModeChange={setSetupMode}
                  status={takeoverStatus}
                  submitting={takeoverSubmitting}
                />
              )}
              {step.id === STEP_ID.PROVIDER_REVIEW && (
                <ProviderReviewContent
                  plan={setupPlans.takeover}
                  status={takeoverStatus}
                />
              )}
              {step.id === STEP_ID.WELCOME && <WelcomeContent />}
              {step.id === STEP_ID.RUNTIME && (
                <RuntimeContent
                  onStatusChange={setRuntimeChecksPassed}
                  setupMode={setupMode}
                  workspacePath={freshWorkspacePath}
                  gatewayPortInput={freshGatewayPortInput}
                  onWorkspacePathChange={setFreshWorkspacePath}
                  onGatewayPortInputChange={setFreshGatewayPortInput}
                  workspaceError={freshWorkspaceError}
                  gatewayPortError={freshGatewayPortError}
                  plan={setupPlans.fresh}
                  planLoading={freshPlanLoading}
                />
              )}
              {step.id === STEP_ID.PROVIDER && (
                <ProviderContent
                  providers={providers}
                  selectedProvider={selectedProvider}
                  onSelectProvider={setSelectedProvider}
                  apiKey={apiKey}
                  onApiKeyChange={setApiKey}
                  onConfiguredChange={setProviderConfigured}
                />
              )}
              {step.id === STEP_ID.INSTALLING && (
                <InstallingContent
                  skills={getDefaultSkills(t)}
                  onComplete={handleInstallationComplete}
                  onSkip={() => setCurrentStep((i) => i + 1)}
                />
              )}
              {step.id === STEP_ID.COMPLETE && (
                <CompleteContent
                  selectedProvider={selectedProvider}
                  installedSkills={installedSkills}
                />
              )}
            </div>

            {/* Navigation - hidden during installation step */}
            {step.id !== STEP_ID.INSTALLING && (
              <div className="flex justify-between">
                <div>
                  {!isFirstStep && (
                    <Button variant="ghost" onClick={handleBack}>
                      <ChevronLeft className="h-4 w-4 mr-2" />
                      {t('nav.back')}
                    </Button>
                  )}
                </div>
                <div className="flex gap-2">
                  {!isLastStep && step.id !== STEP_ID.RUNTIME && step.id !== STEP_ID.TAKEOVER && step.id !== STEP_ID.PROVIDER_REVIEW && (
                    <Button variant="ghost" onClick={handleSkip}>
                      {t('nav.skipSetup')}
                    </Button>
                  )}
                  <Button onClick={handleNext} disabled={!canProceed}>
                    {step.id === STEP_ID.TAKEOVER ? (
                      isTakeoverCompletionAction ? (
                        t('nav.getStarted')
                      ) : (
                        <>
                          {t('nav.next')}
                          <ChevronRight className="h-4 w-4 ml-2" />
                        </>
                      )
                    ) : isLastStep ? (
                      t('nav.getStarted')
                    ) : (
                      <>
                        {t('nav.next')}
                        <ChevronRight className="h-4 w-4 ml-2" />
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

interface ProviderReviewContentProps {
  plan: SetupPlanSummary | null;
  status: TakeoverImportSummary | null;
}

function ProviderReviewContent({ plan, status }: ProviderReviewContentProps) {
  const { t } = useTranslation('setup');
  const summary = plan?.providerImport;
  const defaultAccount = status?.defaultAccountId || summary?.defaultRuntimeProviderKey;

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-xl font-semibold">{t('providerReview.title')}</h2>
        <p className="text-muted-foreground">{t('providerReview.description')}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg bg-muted/50 p-4">
          <div className="text-sm text-muted-foreground">{t('providerReview.summary.imported')}</div>
          <div className="mt-1 text-2xl font-semibold">{status?.importedAccountCount ?? summary?.importableCount ?? 0}</div>
        </div>
        <div className="rounded-lg bg-muted/50 p-4">
          <div className="text-sm text-muted-foreground">{t('providerReview.summary.default')}</div>
          <div className="mt-1 break-all text-sm font-medium">{defaultAccount || t('providerReview.defaultMissing')}</div>
        </div>
        <div className="rounded-lg bg-muted/50 p-4">
          <div className="text-sm text-muted-foreground">{t('providerReview.summary.conflicts')}</div>
          <div className="mt-1 text-2xl font-semibold">{status?.conflicts.length ?? summary?.conflictCount ?? 0}</div>
        </div>
        <div className="rounded-lg bg-muted/50 p-4">
          <div className="text-sm text-muted-foreground">{t('providerReview.summary.unsupported')}</div>
          <div className="mt-1 text-2xl font-semibold">{summary?.unsupportedCount ?? 0}</div>
        </div>
      </div>

      {status?.conflicts.length || summary?.unsupportedCount || plan?.warnings.length ? (
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-4">
          <div className="font-medium text-amber-200">{t('providerReview.conflictsTitle')}</div>
          <ul className="mt-2 space-y-1 text-sm text-amber-50/90">
            {status?.conflicts.map((conflict) => (
              <li key={conflict}>{conflict}</li>
            ))}
            {(summary?.unsupportedCount ?? 0) > 0 ? (
              <li>{t('providerReview.summary.unsupported')} {summary?.unsupportedCount}</li>
            ) : null}
            {plan?.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <p className="text-sm text-muted-foreground">{t('providerReview.nextHint')}</p>
    </div>
  );
}

interface TakeoverContentProps {
  inspection: SetupInspectionSummary | null;
  activePlan: SetupPlanSummary | null;
  mode: SetupMode;
  onModeChange: (mode: SetupMode) => void;
  status: TakeoverImportSummary | null;
  submitting: boolean;
}

function TakeoverContent({
  inspection,
  activePlan,
  mode,
  onModeChange,
  status,
  submitting,
}: TakeoverContentProps) {
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
      <div className="space-y-2">
        <h2 className="text-xl font-semibold">{t('takeover.title')}</h2>
        <p className="text-muted-foreground">{t('takeover.description')}</p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <button
          type="button"
          onClick={() => onModeChange('takeover')}
          className={cn(
            'rounded-2xl border px-5 py-4 text-left transition-all',
            mode === 'takeover'
              ? 'border-primary/40 bg-[#eeece3] shadow-sm dark:bg-muted'
              : 'border-black/10 bg-transparent hover:border-primary/30 hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/5',
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
            'rounded-2xl border px-5 py-4 text-left transition-all',
            mode === 'fresh'
              ? 'border-primary/40 bg-[#eeece3] shadow-sm dark:bg-muted'
              : 'border-black/10 bg-transparent hover:border-primary/30 hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/5',
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

      <div className="rounded-3xl border border-black/10 bg-[#f3f1e9] p-5 shadow-sm dark:border-white/10 dark:bg-card">
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
            <div className="rounded-2xl border border-black/5 bg-[#eeece3] p-4 dark:border-white/5 dark:bg-muted">
              <div className="text-sm text-muted-foreground">{t('takeover.summary.providers')}</div>
              <div className="mt-1 text-2xl font-semibold">{inspection?.counts?.runtimeProviders ?? 0}</div>
            </div>
            <div className="rounded-2xl border border-black/5 bg-[#eeece3] p-4 dark:border-white/5 dark:bg-muted">
              <div className="text-sm text-muted-foreground">{t('takeover.summary.skills')}</div>
              <div className="mt-1 text-2xl font-semibold">{inspection?.counts?.skills ?? 0}</div>
            </div>
            <div className="rounded-2xl border border-black/5 bg-[#eeece3] p-4 dark:border-white/5 dark:bg-muted">
              <div className="text-sm text-muted-foreground">{t('takeover.summary.extensions')}</div>
              <div className="mt-1 text-2xl font-semibold">{inspection?.counts?.extensions ?? 0}</div>
            </div>
            <div className="rounded-2xl border border-black/5 bg-[#eeece3] p-4 dark:border-white/5 dark:bg-muted">
              <div className="text-sm text-muted-foreground">{t('takeover.summary.workspace')}</div>
              <div className="mt-1 break-all text-sm font-medium">{currentWorkspace}</div>
            </div>
          </div>
        ) : (
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-black/5 bg-[#eeece3] p-4 dark:border-white/5 dark:bg-muted">
              <div className="text-sm text-muted-foreground">{t('takeover.mode.currentWorkspace')}</div>
              <div className="mt-2 break-all text-sm font-medium">{currentWorkspace}</div>
            </div>
            <div className="rounded-2xl border border-black/5 bg-[#eeece3] p-4 dark:border-white/5 dark:bg-muted">
              <div className="text-sm text-muted-foreground">{t('takeover.mode.recommendedWorkspace')}</div>
              <div className="mt-2 break-all text-sm font-medium">{recommendedWorkspace}</div>
              <p className="mt-3 text-xs leading-5 text-muted-foreground">{t('takeover.mode.workspaceHint')}</p>
            </div>
            <div className="rounded-2xl border border-black/5 bg-[#eeece3] p-4 dark:border-white/5 dark:bg-muted">
              <div className="text-sm text-muted-foreground">{t('takeover.mode.currentPort')}</div>
              <div className="mt-2 text-2xl font-semibold">{currentPort}</div>
            </div>
            <div className="rounded-2xl border border-black/5 bg-[#eeece3] p-4 dark:border-white/5 dark:bg-muted">
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
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4">
          <div className="font-medium text-red-700 dark:text-red-200">
            {mode === 'takeover' ? t('takeover.blockingTitle') : t('takeover.mode.freshBlockingTitle')}
          </div>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-red-800 dark:text-red-100">
            {activePlan.blockingIssues.map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {warnings.length ? (
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4">
          <div className="font-medium text-amber-800 dark:text-amber-100">
            {mode === 'takeover' ? t('takeover.warningsTitle') : t('takeover.mode.freshWarningsTitle')}
          </div>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-amber-900 dark:text-amber-50">
            {warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {status?.error ? (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm leading-6 text-red-800 dark:text-red-100">
          {status.error}
        </div>
      ) : null}

      {submitting ? (
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
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

// ==================== Step Content Components ====================

function WelcomeContent() {
  const { t } = useTranslation(['setup', 'settings']);
  const { language, setLanguage } = useSettingsStore();

  return (
    <div className="text-center space-y-4">
      <div className="mb-4 flex justify-center">
        <img src={XClawIcon} alt="XClaw" className="h-16 w-16" />
      </div>
      <h2 className="text-xl font-semibold">{t('welcome.title')}</h2>
      <p className="text-muted-foreground">
        {t('welcome.description')}
      </p>

      {/* Language Selector */}
      <div className="flex justify-center gap-2 py-2">
        {SUPPORTED_LANGUAGES.map((lang) => (
          <Button
            key={lang.code}
            variant={language === lang.code ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setLanguage(lang.code)}
            className="h-7 text-xs"
          >
            {lang.label}
          </Button>
        ))}
      </div>

      <ul className="text-left space-y-2 text-muted-foreground pt-2">
        <li className="flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-green-400" />
          {t('welcome.features.noCommand')}
        </li>
        <li className="flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-green-400" />
          {t('welcome.features.modernUI')}
        </li>
        <li className="flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-green-400" />
          {t('welcome.features.bundles')}
        </li>
        <li className="flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-green-400" />
          {t('welcome.features.crossPlatform')}
        </li>
      </ul>
    </div>
  );
}

interface RuntimeContentProps {
  onStatusChange: (canProceed: boolean) => void;
  setupMode: SetupMode;
  workspacePath: string;
  gatewayPortInput: string;
  onWorkspacePathChange: (value: string) => void;
  onGatewayPortInputChange: (value: string) => void;
  workspaceError: string | null;
  gatewayPortError: string | null;
  plan: SetupPlanSummary | null;
  planLoading: boolean;
}

function RuntimeContent({
  onStatusChange,
  setupMode,
  workspacePath,
  gatewayPortInput,
  onWorkspacePathChange,
  onGatewayPortInputChange,
  workspaceError,
  gatewayPortError,
  plan,
  planLoading,
}: RuntimeContentProps) {
  const { t } = useTranslation('setup');
  const gatewayStatus = useGatewayStore((state) => state.status);
  const startGateway = useGatewayStore((state) => state.start);

  const [checks, setChecks] = useState({
    nodejs: { status: 'checking' as 'checking' | 'success' | 'error', message: '' },
    openclaw: { status: 'checking' as 'checking' | 'success' | 'error', message: '' },
    gateway: { status: 'checking' as 'checking' | 'success' | 'error', message: '' },
  });
  const [showLogs, setShowLogs] = useState(false);
  const [logContent, setLogContent] = useState('');
  const [openclawDir, setOpenclawDir] = useState('');
  const gatewayTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const runChecks = useCallback(async () => {
    // Reset checks
    setChecks({
      nodejs: { status: 'checking', message: '' },
      openclaw: { status: 'checking', message: '' },
      gateway: { status: 'checking', message: '' },
    });

    // Check Node.js — always available in Electron
    setChecks((prev) => ({
      ...prev,
      nodejs: { status: 'success', message: t('runtime.status.success') },
    }));

    // Check OpenClaw package status
    try {
      const openclawStatus = await invokeIpc('openclaw:status') as {
        packageExists: boolean;
        isBuilt: boolean;
        dir: string;
        version?: string;
      };

      setOpenclawDir(openclawStatus.dir);

      if (!openclawStatus.packageExists) {
        setChecks((prev) => ({
          ...prev,
          openclaw: {
            status: 'error',
            message: `OpenClaw package not found at: ${openclawStatus.dir}`
          },
        }));
      } else if (!openclawStatus.isBuilt) {
        setChecks((prev) => ({
          ...prev,
          openclaw: {
            status: 'error',
            message: 'OpenClaw package found but dist is missing'
          },
        }));
      } else {
        const versionLabel = openclawStatus.version ? ` v${openclawStatus.version}` : '';
        setChecks((prev) => ({
          ...prev,
          openclaw: {
            status: 'success',
            message: `OpenClaw package ready${versionLabel}`
          },
        }));
      }
    } catch (error) {
      setChecks((prev) => ({
        ...prev,
        openclaw: { status: 'error', message: `Check failed: ${error}` },
      }));
    }

    // Check Gateway — read directly from store to avoid stale closure
    // Don't immediately report error; gateway may still be initializing
    const currentGateway = useGatewayStore.getState().status;
    if (currentGateway.state === 'running') {
      setChecks((prev) => ({
        ...prev,
        gateway: { status: 'success', message: `Running on port ${currentGateway.port}` },
      }));
    } else if (currentGateway.state === 'error') {
      setChecks((prev) => ({
        ...prev,
        gateway: { status: 'error', message: currentGateway.error || t('runtime.status.error') },
      }));
    } else {
      // Gateway is 'stopped', 'starting', or 'reconnecting'
      // Keep as 'checking' — the dedicated useEffect will update when status changes
      setChecks((prev) => ({
        ...prev,
        gateway: {
          status: 'checking',
          message: currentGateway.state === 'starting' ? t('runtime.status.checking') : 'Waiting for gateway...'
        },
      }));
    }
  }, [t]);

  useEffect(() => {
    runChecks();
  }, [runChecks]);

  // Update canProceed when gateway status changes
  useEffect(() => {
    const allPassed = checks.nodejs.status === 'success'
      && checks.openclaw.status === 'success'
      && (checks.gateway.status === 'success' || gatewayStatus.state === 'running');
    onStatusChange(allPassed);
  }, [checks, gatewayStatus, onStatusChange]);

  // Update gateway check when gateway status changes
  useEffect(() => {
    if (gatewayStatus.state === 'running') {
      setChecks((prev) => ({
        ...prev,
        gateway: { status: 'success', message: t('runtime.status.gatewayRunning', { port: gatewayStatus.port }) },
      }));
    } else if (gatewayStatus.state === 'error') {
      setChecks((prev) => ({
        ...prev,
        gateway: { status: 'error', message: gatewayStatus.error || 'Failed to start' },
      }));
    } else if (gatewayStatus.state === 'starting' || gatewayStatus.state === 'reconnecting') {
      setChecks((prev) => ({
        ...prev,
        gateway: { status: 'checking', message: 'Starting...' },
      }));
    }
    // 'stopped' state: keep current check status (likely 'checking') to allow startup time
  }, [gatewayStatus, t]);

  // Gateway startup timeout — show error only after giving enough time to initialize
  useEffect(() => {
    if (gatewayTimeoutRef.current) {
      clearTimeout(gatewayTimeoutRef.current);
      gatewayTimeoutRef.current = null;
    }

    // If gateway is already in a terminal state, no timeout needed
    if (gatewayStatus.state === 'running' || gatewayStatus.state === 'error') {
      return;
    }

    // Set timeout for non-terminal states (stopped, starting, reconnecting)
    gatewayTimeoutRef.current = setTimeout(() => {
      setChecks((prev) => {
        if (prev.gateway.status === 'checking') {
          return {
            ...prev,
            gateway: { status: 'error', message: 'Gateway startup timed out' },
          };
        }
        return prev;
      });
    }, 600 * 1000); // 600 seconds — enough for gateway to fully initialize

    return () => {
      if (gatewayTimeoutRef.current) {
        clearTimeout(gatewayTimeoutRef.current);
        gatewayTimeoutRef.current = null;
      }
    };
  }, [gatewayStatus.state]);

  const handleStartGateway = async () => {
    setChecks((prev) => ({
      ...prev,
      gateway: { status: 'checking', message: 'Starting...' },
    }));
    await startGateway();
  };

  const handleShowLogs = async () => {
    try {
      const logs = await hostApiFetch<{ content: string }>('/api/logs?tailLines=100');
      setLogContent(logs.content);
      setShowLogs(true);
    } catch {
      setLogContent('(Failed to load logs)');
      setShowLogs(true);
    }
  };

  const handleOpenLogDir = async () => {
    try {
      const { dir: logDir } = await hostApiFetch<{ dir: string | null }>('/api/logs/dir');
      if (logDir) {
        await invokeIpc('shell:showItemInFolder', logDir);
      }
    } catch {
      // ignore
    }
  };

  const ERROR_TRUNCATE_LEN = 30;

  const renderStatus = (status: 'checking' | 'success' | 'error', message: string) => {
    if (status === 'checking') {
      return (
        <span className="flex items-center gap-2 text-yellow-400 whitespace-nowrap">
          <Loader2 className="h-5 w-5 flex-shrink-0 animate-spin" />
          {message || 'Checking...'}
        </span>
      );
    }
    if (status === 'success') {
      return (
        <span className="flex items-center gap-2 text-green-400 whitespace-nowrap">
          <CheckCircle2 className="h-5 w-5 flex-shrink-0" />
          {message}
        </span>
      );
    }

    const isLong = message.length > ERROR_TRUNCATE_LEN;
    const displayMsg = isLong ? message.slice(0, ERROR_TRUNCATE_LEN) : message;

    return (
      <span className="flex items-center gap-2 text-red-400 whitespace-nowrap">
        <XCircle className="h-5 w-5 flex-shrink-0" />
        <span>{displayMsg}</span>
        {isLong && (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="cursor-pointer text-red-300 hover:text-red-200 font-medium">...</span>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-sm whitespace-normal break-words text-xs">
              {message}
            </TooltipContent>
          </Tooltip>
        )}
      </span>
    );
  };

  return (
    <div className="space-y-4">
      {setupMode === 'fresh' && (
        <div className="space-y-4 rounded-3xl border border-black/10 bg-[#f3f1e9] p-5 shadow-sm dark:border-white/10 dark:bg-card">
          <div className="space-y-1">
            <h3 className="font-medium">{t('runtime.setup.title')}</h3>
            <p className="text-sm text-muted-foreground">{t('runtime.setup.description')}</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="setup-workspace-path">{t('runtime.setup.workspaceLabel')}</Label>
            <Input
              id="setup-workspace-path"
              value={workspacePath}
              onChange={(event) => onWorkspacePathChange(event.target.value)}
              placeholder={t('runtime.setup.workspacePlaceholder')}
            />
            <p className="text-xs text-muted-foreground">{t('runtime.setup.workspaceHint')}</p>
            {workspaceError ? (
              <p className="text-xs text-red-400">{workspaceError}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="setup-gateway-port">{t('runtime.setup.portLabel')}</Label>
            <Input
              id="setup-gateway-port"
              inputMode="numeric"
              value={gatewayPortInput}
              onChange={(event) => onGatewayPortInputChange(event.target.value)}
              placeholder="18789"
            />
            <p className="text-xs text-muted-foreground">{t('runtime.setup.portHint')}</p>
            {gatewayPortError ? (
              <p className="text-xs text-red-400">{gatewayPortError}</p>
            ) : null}
          </div>

          {planLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t('runtime.setup.planChecking')}
            </div>
          ) : null}

          {plan?.blockingIssues.length ? (
            <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4">
              <div className="font-medium text-red-700 dark:text-red-200">{t('runtime.setup.blockingTitle')}</div>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-red-800 dark:text-red-100">
                {plan.blockingIssues.map((issue) => (
                  <li key={issue}>{issue}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {plan?.warnings.length ? (
            <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4">
              <div className="font-medium text-amber-800 dark:text-amber-100">{t('runtime.setup.warningsTitle')}</div>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-amber-900 dark:text-amber-50">
                {plan.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      )}

      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">{t('runtime.title')}</h2>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={handleShowLogs}>
            {t('runtime.viewLogs')}
          </Button>
          <Button variant="ghost" size="sm" onClick={runChecks}>
            <RefreshCw className="h-4 w-4 mr-2" />
            {t('runtime.recheck')}
          </Button>
        </div>
      </div>
      <div className="space-y-3">
        <div className="grid grid-cols-[1fr_auto] items-center gap-4 rounded-2xl border border-black/5 bg-[#eeece3] p-3 dark:border-white/5 dark:bg-muted">
          <span className="text-left">{t('runtime.nodejs')}</span>
          <div className="flex justify-end">
            {renderStatus(checks.nodejs.status, checks.nodejs.message)}
          </div>
        </div>
        <div className="grid grid-cols-[1fr_auto] items-center gap-4 rounded-2xl border border-black/5 bg-[#eeece3] p-3 dark:border-white/5 dark:bg-muted">
          <div className="text-left min-w-0">
            <span>{t('runtime.openclaw')}</span>
            {openclawDir && (
              <p className="text-xs text-muted-foreground mt-0.5 font-mono break-all">
                {openclawDir}
              </p>
            )}
          </div>
          <div className="flex justify-end self-start mt-0.5">
            {renderStatus(checks.openclaw.status, checks.openclaw.message)}
          </div>
        </div>
        <div className="grid grid-cols-[1fr_auto] items-center gap-4 rounded-2xl border border-black/5 bg-[#eeece3] p-3 dark:border-white/5 dark:bg-muted">
          <div className="flex items-center gap-2 text-left">
            <span>{t('runtime.gateway')}</span>
            {checks.gateway.status === 'error' && (
              <Button variant="outline" size="sm" onClick={handleStartGateway}>
                {t('runtime.startGateway')}
              </Button>
            )}
          </div>
          <div className="flex justify-end">
            {renderStatus(checks.gateway.status, checks.gateway.message)}
          </div>
        </div>
      </div>

      {(checks.nodejs.status === 'error' || checks.openclaw.status === 'error') && (
        <div className="mt-4 rounded-2xl border border-red-500/20 bg-red-500/10 p-4">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-5 w-5 text-red-400 mt-0.5" />
            <div>
              <p className="font-medium text-red-700 dark:text-red-200">{t('runtime.issue.title')}</p>
              <p className="mt-1 text-sm leading-6 text-red-800 dark:text-red-100">
                {t('runtime.issue.desc')}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Log viewer panel */}
      {showLogs && (
        <div className="mt-4 p-4 rounded-lg bg-black/40 border border-border">
          <div className="flex items-center justify-between mb-2">
            <p className="font-medium text-foreground text-sm">{t('runtime.logs.title')}</p>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={handleOpenLogDir}>
                <ExternalLink className="h-3 w-3 mr-1" />
                {t('runtime.logs.openFolder')}
              </Button>
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setShowLogs(false)}>
                {t('runtime.logs.close')}
              </Button>
            </div>
          </div>
          <pre className="text-xs text-slate-300 bg-black/50 p-3 rounded max-h-60 overflow-auto whitespace-pre-wrap font-mono">
            {logContent || t('runtime.logs.noLogs')}
          </pre>
        </div>
      )}
    </div>
  );
}

interface ProviderContentProps {
  providers: ProviderTypeInfo[];
  selectedProvider: string | null;
  onSelectProvider: (id: string | null) => void;
  apiKey: string;
  onApiKeyChange: (key: string) => void;
  onConfiguredChange: (configured: boolean) => void;
}

function ProviderContent({
  providers,
  selectedProvider,
  onSelectProvider,
  apiKey,
  onApiKeyChange,
  onConfiguredChange,
}: ProviderContentProps) {
  const { t, i18n } = useTranslation(['setup', 'settings']);
  const devModeUnlocked = useSettingsStore((state) => state.devModeUnlocked);
  const [showKey, setShowKey] = useState(false);
  const [validating, setValidating] = useState(false);
  const [keyValid, setKeyValid] = useState<boolean | null>(null);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [baseUrl, setBaseUrl] = useState('');
  const [modelId, setModelId] = useState('');
  const [apiProtocol, setApiProtocol] = useState<ProviderAccount['apiProtocol']>('openai-completions');
  const [providerMenuOpen, setProviderMenuOpen] = useState(false);
  const providerMenuRef = useRef<HTMLDivElement | null>(null);

  const [authMode, setAuthMode] = useState<'oauth' | 'apikey'>('oauth');

  // OAuth Flow State
  const [oauthFlowing, setOauthFlowing] = useState(false);
  const [oauthData, setOauthData] = useState<{
    mode: 'device';
    verificationUri: string;
    userCode: string;
    expiresIn: number;
  } | {
    mode: 'manual';
    authorizationUrl: string;
    message?: string;
  } | null>(null);
  const [manualCodeInput, setManualCodeInput] = useState('');
  const [oauthError, setOauthError] = useState<string | null>(null);
  const pendingOAuthRef = useRef<{ accountId: string; label: string } | null>(null);

  // Manage OAuth events
  useEffect(() => {
    const handleCode = (data: unknown) => {
      const payload = data as Record<string, unknown>;
      if (payload?.mode === 'manual') {
        setOauthData({
          mode: 'manual',
          authorizationUrl: String(payload.authorizationUrl || ''),
          message: typeof payload.message === 'string' ? payload.message : undefined,
        });
      } else {
        setOauthData({
          mode: 'device',
          verificationUri: String(payload.verificationUri || ''),
          userCode: String(payload.userCode || ''),
          expiresIn: Number(payload.expiresIn || 300),
        });
      }
      setOauthError(null);
    };

    const handleSuccess = async (data: unknown) => {
      setOauthFlowing(false);
      setOauthData(null);
      setManualCodeInput('');
      setKeyValid(true);

      const payload = (data as { accountId?: string } | undefined) || undefined;
      const accountId = payload?.accountId || pendingOAuthRef.current?.accountId;

      if (accountId) {
        try {
          await hostApiFetch('/api/provider-accounts/default', {
            method: 'PUT',
            body: JSON.stringify({ accountId }),
          });
          setSelectedAccountId(accountId);
        } catch (error) {
          console.error('Failed to set default provider account:', error);
        }
      }

      pendingOAuthRef.current = null;
      onConfiguredChange(true);
      toast.success(t('provider.valid'));
    };

    const handleError = (data: unknown) => {
      setOauthError((data as { message: string }).message);
      setOauthData(null);
      pendingOAuthRef.current = null;
    };

    const offCode = subscribeHostEvent('oauth:code', handleCode);
    const offSuccess = subscribeHostEvent('oauth:success', handleSuccess);
    const offError = subscribeHostEvent('oauth:error', handleError);

    return () => {
      offCode();
      offSuccess();
      offError();
    };
  }, [onConfiguredChange, t]);

  const handleStartOAuth = async () => {
    if (!selectedProvider) return;

    try {
      const snapshot = await fetchProviderSnapshot();
      const existingVendorIds = new Set(snapshot.accounts.map((account) => account.vendorId));
      if (selectedProvider === 'minimax-portal' && existingVendorIds.has('minimax-portal-cn')) {
        toast.error(t('settings:aiProviders.toast.minimaxConflict'));
        return;
      }
      if (selectedProvider === 'minimax-portal-cn' && existingVendorIds.has('minimax-portal')) {
        toast.error(t('settings:aiProviders.toast.minimaxConflict'));
        return;
      }
    } catch {
      // ignore check failure
    }

    setOauthFlowing(true);
    setOauthData(null);
    setManualCodeInput('');
    setOauthError(null);

    try {
      const snapshot = await fetchProviderSnapshot();
      const accountId = buildProviderAccountId(
        selectedProvider as ProviderType,
        selectedAccountId,
        snapshot.vendors,
      );
      const label = selectedProviderData?.name || selectedProvider;
      pendingOAuthRef.current = { accountId, label };
      await hostApiFetch('/api/providers/oauth/start', {
        method: 'POST',
        body: JSON.stringify({ provider: selectedProvider, accountId, label }),
      });
    } catch (e) {
      setOauthError(String(e));
      setOauthFlowing(false);
      pendingOAuthRef.current = null;
    }
  };

  const handleCancelOAuth = async () => {
    setOauthFlowing(false);
    setOauthData(null);
    setManualCodeInput('');
    setOauthError(null);
    pendingOAuthRef.current = null;
    await hostApiFetch('/api/providers/oauth/cancel', { method: 'POST' });
  };

  const handleSubmitManualOAuthCode = async () => {
    const value = manualCodeInput.trim();
    if (!value) return;
    try {
      await hostApiFetch('/api/providers/oauth/submit', {
        method: 'POST',
        body: JSON.stringify({ code: value }),
      });
      setOauthError(null);
    } catch (error) {
      setOauthError(String(error));
    }
  };

  // On mount, try to restore previously configured provider
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const snapshot = await fetchProviderSnapshot();
        const statusMap = new Map(snapshot.statuses.map((status) => [status.id, status]));
        const setupProviderTypes = new Set<string>(providers.map((p) => p.id));
        const setupCandidates = snapshot.accounts.filter((account) => setupProviderTypes.has(account.vendorId));
        const preferred =
          (snapshot.defaultAccountId
            && setupCandidates.find((account) => account.id === snapshot.defaultAccountId))
          || setupCandidates.find((account) => hasConfiguredCredentials(account, statusMap.get(account.id)))
          || setupCandidates[0];
        if (preferred && !cancelled) {
          onSelectProvider(preferred.vendorId);
          setSelectedAccountId(preferred.id);
          const typeInfo = providers.find((p) => p.id === preferred.vendorId);
          const requiresKey = typeInfo?.requiresApiKey ?? false;
          onConfiguredChange(!requiresKey || hasConfiguredCredentials(preferred, statusMap.get(preferred.id)));
          const storedKey = (await hostApiFetch<{ apiKey: string | null }>(
            `/api/providers/${encodeURIComponent(preferred.id)}/api-key`,
          )).apiKey;
          onApiKeyChange(storedKey || '');
        } else if (!cancelled) {
          onConfiguredChange(false);
          onApiKeyChange('');
        }
      } catch (error) {
        if (!cancelled) {
          console.error('Failed to load provider list:', error);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [onApiKeyChange, onConfiguredChange, onSelectProvider, providers]);

  // When provider changes, load stored key + reset base URL
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!selectedProvider) return;
      setApiProtocol('openai-completions');
      try {
        const snapshot = await fetchProviderSnapshot();
        const statusMap = new Map(snapshot.statuses.map((status) => [status.id, status]));
        const preferredAccount = pickPreferredAccount(
          snapshot.accounts,
          snapshot.defaultAccountId,
          selectedProvider,
          statusMap,
        );
        const accountIdForLoad = preferredAccount?.id || selectedProvider;
        setSelectedAccountId(preferredAccount?.id || null);

        const savedProvider = await hostApiFetch<{ baseUrl?: string; model?: string; apiProtocol?: ProviderAccount['apiProtocol'] } | null>(
          `/api/providers/${encodeURIComponent(accountIdForLoad)}`,
        );
        const storedKey = (await hostApiFetch<{ apiKey: string | null }>(
          `/api/providers/${encodeURIComponent(accountIdForLoad)}/api-key`,
        )).apiKey;
        if (!cancelled) {
          onApiKeyChange(storedKey || '');

          const info = providers.find((p) => p.id === selectedProvider);
          setBaseUrl(savedProvider?.baseUrl || info?.defaultBaseUrl || '');
          setModelId(savedProvider?.model || info?.defaultModelId || '');
          setApiProtocol(savedProvider?.apiProtocol || 'openai-completions');
        }
      } catch (error) {
        if (!cancelled) {
          console.error('Failed to load provider key:', error);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [onApiKeyChange, selectedProvider, providers]);

  useEffect(() => {
    if (!providerMenuOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (providerMenuRef.current && !providerMenuRef.current.contains(event.target as Node)) {
        setProviderMenuOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setProviderMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [providerMenuOpen]);

  const selectedProviderData = providers.find((p) => p.id === selectedProvider);
  const providerDocsUrl = getProviderDocsUrl(selectedProviderData, i18n.language);
  const selectedProviderIconUrl = selectedProviderData
    ? getProviderIconUrl(selectedProviderData.id)
    : undefined;
  const showBaseUrlField = selectedProviderData?.showBaseUrl ?? false;
  const showModelIdField = shouldShowProviderModelId(selectedProviderData, devModeUnlocked);
  const requiresKey = selectedProviderData?.requiresApiKey ?? false;
  const isOAuth = selectedProviderData?.isOAuth ?? false;
  const supportsApiKey = selectedProviderData?.supportsApiKey ?? false;
  const useOAuthFlow = isOAuth && (!supportsApiKey || authMode === 'oauth');

  const handleValidateAndSave = async () => {
    if (!selectedProvider) return;

    try {
      const snapshot = await fetchProviderSnapshot();
      const existingVendorIds = new Set(snapshot.accounts.map((account) => account.vendorId));
      if (selectedProvider === 'minimax-portal' && existingVendorIds.has('minimax-portal-cn')) {
        toast.error(t('settings:aiProviders.toast.minimaxConflict'));
        return;
      }
      if (selectedProvider === 'minimax-portal-cn' && existingVendorIds.has('minimax-portal')) {
        toast.error(t('settings:aiProviders.toast.minimaxConflict'));
        return;
      }
    } catch {
      // ignore check failure
    }

    setValidating(true);
    setKeyValid(null);

    try {
      // Validate key if the provider requires one and a key was entered
      const isApiKeyRequired = requiresKey || (supportsApiKey && authMode === 'apikey');
      if (isApiKeyRequired && apiKey) {
        const result = await invokeIpc(
          'provider:validateKey',
          selectedAccountId || selectedProvider,
          apiKey,
          {
            baseUrl: baseUrl.trim() || undefined,
            apiProtocol: (selectedProvider === 'custom' || selectedProvider === 'ollama')
              ? apiProtocol
              : undefined,
          }
        ) as { valid: boolean; error?: string };

        setKeyValid(result.valid);

        if (!result.valid) {
          toast.error(result.error || t('provider.invalid'));
          setValidating(false);
          return;
        }
      } else {
        setKeyValid(true);
      }

      const effectiveModelId = resolveProviderModelForSave(
        selectedProviderData,
        modelId,
        devModeUnlocked
      );
      const snapshot = await fetchProviderSnapshot();
      const accountIdForSave = buildProviderAccountId(
        selectedProvider as ProviderType,
        selectedAccountId,
        snapshot.vendors,
      );

      const effectiveApiKey = resolveProviderApiKeyForSave(selectedProvider, apiKey);
      const accountPayload: ProviderAccount = {
        id: accountIdForSave,
        vendorId: selectedProvider as ProviderType,
        label: selectedProvider === 'custom'
          ? t('settings:aiProviders.custom')
          : (selectedProviderData?.name || selectedProvider),
        authMode: selectedProvider === 'ollama'
          ? 'local'
          : 'api_key',
        baseUrl: baseUrl.trim() || undefined,
        apiProtocol: (selectedProvider === 'custom' || selectedProvider === 'ollama')
          ? apiProtocol
          : undefined,
        model: effectiveModelId,
        enabled: true,
        isDefault: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const saveResult = selectedAccountId
        ? await hostApiFetch<{ success: boolean; error?: string }>(
          `/api/provider-accounts/${encodeURIComponent(accountIdForSave)}`,
          {
            method: 'PUT',
            body: JSON.stringify({
              updates: {
                label: accountPayload.label,
                authMode: accountPayload.authMode,
                baseUrl: accountPayload.baseUrl,
                apiProtocol: accountPayload.apiProtocol,
                model: accountPayload.model,
                enabled: accountPayload.enabled,
              },
              apiKey: effectiveApiKey,
            }),
          },
        )
        : await hostApiFetch<{ success: boolean; error?: string }>('/api/provider-accounts', {
          method: 'POST',
          body: JSON.stringify({ account: accountPayload, apiKey: effectiveApiKey }),
        });

      if (!saveResult.success) {
        throw new Error(saveResult.error || 'Failed to save provider config');
      }

      const defaultResult = await hostApiFetch<{ success: boolean; error?: string }>(
        '/api/provider-accounts/default',
        {
          method: 'PUT',
          body: JSON.stringify({ accountId: accountIdForSave }),
        },
      );

      if (!defaultResult.success) {
        throw new Error(defaultResult.error || 'Failed to set default provider');
      }

      setSelectedAccountId(accountIdForSave);
      onConfiguredChange(true);
      toast.success(t('provider.valid'));
    } catch (error) {
      setKeyValid(false);
      onConfiguredChange(false);
      toast.error('Configuration failed: ' + String(error));
    } finally {
      setValidating(false);
    }
  };

  // Can the user submit?
  const isApiKeyRequired = requiresKey || (supportsApiKey && authMode === 'apikey');
  const canSubmit =
    selectedProvider
    && (isApiKeyRequired ? apiKey.length > 0 : true)
    && (showModelIdField ? modelId.trim().length > 0 : true)
    && !useOAuthFlow;

  const handleSelectProvider = (providerId: string) => {
    onSelectProvider(providerId);
    setSelectedAccountId(null);
    onConfiguredChange(false);
    onApiKeyChange('');
    setKeyValid(null);
    setProviderMenuOpen(false);
    setAuthMode('oauth');
  };

  return (
    <div className="space-y-6">
      {/* Provider selector — dropdown */}
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <Label>{t('provider.label')}</Label>
          {selectedProvider && providerDocsUrl && (
            <a
              href={providerDocsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[13px] text-blue-500 hover:text-blue-600 font-medium inline-flex items-center gap-1"
            >
              {t('settings:aiProviders.dialog.customDoc')}
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
        <div className="relative" ref={providerMenuRef}>
          <button
            type="button"
            aria-haspopup="listbox"
            aria-expanded={providerMenuOpen}
            onClick={() => setProviderMenuOpen((open) => !open)}
            className={cn(
              'w-full rounded-md border border-input bg-background px-3 py-2 text-sm',
              'flex items-center justify-between gap-2',
              'focus:outline-none focus:ring-2 focus:ring-ring'
            )}
          >
            <div className="flex items-center gap-2 min-w-0">
              {selectedProvider && selectedProviderData ? (
                selectedProviderIconUrl ? (
                  <img
                    src={selectedProviderIconUrl}
                    alt={selectedProviderData.name}
                    className={cn('h-4 w-4 shrink-0', shouldInvertInDark(selectedProviderData.id) && 'dark:invert')}
                  />
                ) : (
                  <span className="text-sm leading-none shrink-0">{selectedProviderData.icon}</span>
                )
              ) : (
                <span className="text-xs text-muted-foreground shrink-0">—</span>
              )}
              <span className={cn('truncate text-left', !selectedProvider && 'text-muted-foreground')}>
                {selectedProviderData
                  ? `${selectedProviderData.id === 'custom' ? t('settings:aiProviders.custom') : selectedProviderData.name}${selectedProviderData.model ? ` — ${selectedProviderData.model}` : ''}`
                  : t('provider.selectPlaceholder')}
              </span>
            </div>
            <ChevronDown className={cn('h-3.5 w-3.5 text-muted-foreground shrink-0 transition-transform', providerMenuOpen && 'rotate-180')} />
          </button>

          {providerMenuOpen && (
            <div
              role="listbox"
              className="absolute z-20 mt-1 w-full rounded-md border border-border bg-popover shadow-md max-h-64 overflow-auto"
            >
              {providers.map((p) => {
                const iconUrl = getProviderIconUrl(p.id);
                const isSelected = selectedProvider === p.id;

                return (
                  <button
                    key={p.id}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => handleSelectProvider(p.id)}
                    className={cn(
                      'w-full px-3 py-2 text-left text-sm flex items-center justify-between gap-2',
                      'hover:bg-accent transition-colors',
                      isSelected && 'bg-accent/60'
                    )}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {iconUrl ? (
                        <img
                          src={iconUrl}
                          alt={p.name}
                          className={cn('h-4 w-4 shrink-0', shouldInvertInDark(p.id) && 'dark:invert')}
                        />
                      ) : (
                        <span className="text-sm leading-none shrink-0">{p.icon}</span>
                      )}
                      <span className="truncate">{p.id === 'custom' ? t('settings:aiProviders.custom') : p.name}{p.model ? ` — ${p.model}` : ''}</span>
                    </div>
                    {isSelected && <Check className="h-4 w-4 text-primary shrink-0" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Dynamic config fields based on selected provider */}
      {selectedProvider && (
        <motion.div
          key={selectedProvider}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          {/* Base URL field (for siliconflow, ollama, custom) */}
          {showBaseUrlField && (
            <div className="space-y-2">
              <Label htmlFor="baseUrl">{t('provider.baseUrl')}</Label>
              <Input
                id="baseUrl"
                type="text"
                placeholder={getProtocolBaseUrlPlaceholder(apiProtocol)}
                value={baseUrl}
                onChange={(e) => {
                  setBaseUrl(e.target.value);
                  onConfiguredChange(false);
                }}
                autoComplete="off"
                className="bg-background border-input"
              />
            </div>
          )}

          {/* Model ID field (for siliconflow etc.) */}
          {showModelIdField && (
            <div className="space-y-2">
              <Label htmlFor="modelId">{t('provider.modelId')}</Label>
              <Input
                id="modelId"
                type="text"
                placeholder={selectedProviderData?.modelIdPlaceholder || 'e.g. deepseek-ai/DeepSeek-V3'}
                value={modelId}
                onChange={(e) => {
                  setModelId(e.target.value);
                  onConfiguredChange(false);
                }}
                autoComplete="off"
                className="bg-background border-input"
              />
              <p className="text-xs text-muted-foreground">
                {t('provider.modelIdDesc')}
              </p>
            </div>
          )}

          {selectedProvider === 'custom' && (
            <div className="space-y-2">
              <Label>{t('provider.protocol')}</Label>
              <div className="flex gap-2 text-sm">
                <button
                  type="button"
                  onClick={() => {
                    setApiProtocol('openai-completions');
                    onConfiguredChange(false);
                  }}
                  className={cn(
                    'flex-1 py-2 px-3 rounded-lg border transition-colors',
                    apiProtocol === 'openai-completions'
                      ? 'bg-primary/10 border-primary/30 font-medium'
                      : 'border-border bg-muted/40 text-muted-foreground hover:bg-muted'
                  )}
                >
                  {t('provider.protocols.openaiCompletions')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setApiProtocol('openai-responses');
                    onConfiguredChange(false);
                  }}
                  className={cn(
                    'flex-1 py-2 px-3 rounded-lg border transition-colors',
                    apiProtocol === 'openai-responses'
                      ? 'bg-primary/10 border-primary/30 font-medium'
                      : 'border-border bg-muted/40 text-muted-foreground hover:bg-muted'
                  )}
                >
                  {t('provider.protocols.openaiResponses')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setApiProtocol('anthropic-messages');
                    onConfiguredChange(false);
                  }}
                  className={cn(
                    'flex-1 py-2 px-3 rounded-lg border transition-colors',
                    apiProtocol === 'anthropic-messages'
                      ? 'bg-primary/10 border-primary/30 font-medium'
                      : 'border-border bg-muted/40 text-muted-foreground hover:bg-muted'
                  )}
                >
                  {t('provider.protocols.anthropic')}
                </button>
              </div>
            </div>
          )}

          {/* Auth mode toggle for providers supporting both */}
          {isOAuth && supportsApiKey && (
            <div className="flex rounded-lg border overflow-hidden text-sm">
              <button
                onClick={() => setAuthMode('oauth')}
                className={cn(
                  'flex-1 py-2 px-3 transition-colors',
                  authMode === 'oauth' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted text-muted-foreground'
                )}
              >
                {t('settings:aiProviders.oauth.loginMode')}
              </button>
              <button
                onClick={() => setAuthMode('apikey')}
                className={cn(
                  'flex-1 py-2 px-3 transition-colors',
                  authMode === 'apikey' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted text-muted-foreground'
                )}
              >
                {t('settings:aiProviders.oauth.apikeyMode')}
              </button>
            </div>
          )}

          {/* API Key field (hidden for ollama) */}
          {(!isOAuth || (supportsApiKey && authMode === 'apikey')) && (
            <div className="space-y-2">
              <Label htmlFor="apiKey">{t('provider.apiKey')}</Label>
              <div className="relative">
                <Input
                  id="apiKey"
                  type={showKey ? 'text' : 'password'}
                  placeholder={selectedProviderData?.placeholder}
                  value={apiKey}
                  onChange={(e) => {
                    onApiKeyChange(e.target.value);
                    onConfiguredChange(false);
                    setKeyValid(null);
                  }}
                  autoComplete="off"
                  className="pr-10 bg-background border-input"
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          )}

          {/* Device OAuth Trigger */}
          {useOAuthFlow && (
            <div className="space-y-4 pt-2">
              <div className="rounded-lg bg-blue-500/10 border border-blue-500/20 p-4 text-center">
                <p className="text-sm text-blue-200 mb-3 block">
                  This provider requires signing in via your browser.
                </p>
                <Button
                  onClick={handleStartOAuth}
                  disabled={oauthFlowing}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {oauthFlowing ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Waiting...</>
                  ) : (
                    'Login with Browser'
                  )}
                </Button>
              </div>

              {/* OAuth Active State Modal / Inline View */}
              {oauthFlowing && (
                <div className="mt-4 p-4 border rounded-xl bg-card relative overflow-hidden">
                  {/* Background pulse effect */}
                  <div className="absolute inset-0 bg-primary/5 animate-pulse" />

                  <div className="relative z-10 flex flex-col items-center justify-center text-center space-y-4">
                    {oauthError ? (
                      <div className="text-red-400 space-y-2">
                        <XCircle className="h-8 w-8 mx-auto" />
                        <p className="font-medium">Authentication Failed</p>
                        <p className="text-sm opacity-80">{oauthError}</p>
                        <Button variant="outline" size="sm" onClick={handleCancelOAuth} className="mt-2">
                          Try Again
                        </Button>
                      </div>
                    ) : !oauthData ? (
                      <div className="space-y-3 py-4">
                        <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
                        <p className="text-sm text-muted-foreground animate-pulse">Requesting secure login code...</p>
                      </div>
                    ) : oauthData.mode === 'manual' ? (
                      <div className="space-y-4 w-full">
                        <div className="space-y-1">
                          <h3 className="font-medium text-lg">Complete OpenAI Login</h3>
                          <p className="text-sm text-muted-foreground text-left mt-2">
                            {oauthData.message || 'Open the authorization page, complete login, then paste the callback URL or code below.'}
                          </p>
                        </div>

                        <Button
                          variant="secondary"
                          className="w-full"
                          onClick={() => invokeIpc('shell:openExternal', oauthData.authorizationUrl)}
                        >
                          <ExternalLink className="h-4 w-4 mr-2" />
                          Open Authorization Page
                        </Button>

                        <Input
                          placeholder="Paste callback URL or code"
                          value={manualCodeInput}
                          onChange={(e) => setManualCodeInput(e.target.value)}
                        />

                        <Button
                          className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                          onClick={handleSubmitManualOAuthCode}
                          disabled={!manualCodeInput.trim()}
                        >
                          Submit Code
                        </Button>

                        <Button variant="ghost" size="sm" className="w-full mt-2" onClick={handleCancelOAuth}>
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-4 w-full">
                        <div className="space-y-1">
                          <h3 className="font-medium text-lg">Approve Login</h3>
                          <div className="text-sm text-muted-foreground text-left mt-2 space-y-1">
                            <p>1. Copy the authorization code below.</p>
                            <p>2. Open the login page in your browser.</p>
                            <p>3. Paste the code to approve access.</p>
                          </div>
                        </div>

                        <div className="flex items-center justify-center gap-2 p-3 bg-background border rounded-lg">
                          <code className="text-2xl font-mono tracking-widest font-bold text-primary">
                            {oauthData.userCode}
                          </code>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              navigator.clipboard.writeText(oauthData.userCode);
                              toast.success('Code copied to clipboard');
                            }}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        </div>

                        <Button
                          variant="secondary"
                          className="w-full"
                          onClick={() => invokeIpc('shell:openExternal', oauthData.verificationUri)}
                        >
                          <ExternalLink className="h-4 w-4 mr-2" />
                          Open Login Page
                        </Button>

                        <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground pt-2">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          <span>Waiting for approval in browser...</span>
                        </div>

                        <Button variant="ghost" size="sm" className="w-full mt-2" onClick={handleCancelOAuth}>
                          Cancel
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Validate & Save */}
          <Button
            onClick={handleValidateAndSave}
            disabled={!canSubmit || validating}
            className={cn("w-full", useOAuthFlow && "hidden")}
          >
            {validating ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : null}
            {requiresKey ? t('provider.validateSave') : t('provider.save')}
          </Button>

          {keyValid !== null && (
            <p className={cn('text-sm text-center', keyValid ? 'text-green-400' : 'text-red-400')}>
              {keyValid ? `✓ ${t('provider.valid')}` : `✗ ${t('provider.invalid')}`}
            </p>
          )}

          <p className="text-sm text-muted-foreground text-center">
            {t('provider.storedLocally')}
          </p>
        </motion.div>
      )}
    </div>
  );
}

// NOTE: SkillsContent component removed - auto-install essential skills

// Installation status for each skill
type InstallStatus = 'pending' | 'installing' | 'completed' | 'failed';

interface SkillInstallState {
  id: string;
  name: string;
  description: string;
  status: InstallStatus;
}

interface InstallingContentProps {
  skills: DefaultSkill[];
  onComplete: (installedSkills: string[]) => void;
  onSkip: () => void;
}

function InstallingContent({ skills, onComplete, onSkip }: InstallingContentProps) {
  const { t } = useTranslation('setup');
  const [skillStates, setSkillStates] = useState<SkillInstallState[]>(
    skills.map((s) => ({ ...s, status: 'pending' as InstallStatus }))
  );
  const [overallProgress, setOverallProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const installStarted = useRef(false);

  // Real installation process
  useEffect(() => {
    if (installStarted.current) return;
    installStarted.current = true;

    const runRealInstall = async () => {
      try {
        // Step 1: Initialize all skills to 'installing' state for UI
        setSkillStates(prev => prev.map(s => ({ ...s, status: 'installing' })));
        setOverallProgress(10);

        // Step 2: Call the backend to install uv and setup Python
        const result = await invokeIpc('uv:install-all') as {
          success: boolean;
          error?: string
        };

        if (result.success) {
          setSkillStates(prev => prev.map(s => ({ ...s, status: 'completed' })));
          setOverallProgress(100);

          await new Promise((resolve) => setTimeout(resolve, 800));
          onComplete(skills.map(s => s.id));
        } else {
          setSkillStates(prev => prev.map(s => ({ ...s, status: 'failed' })));
          setErrorMessage(result.error || 'Unknown error during installation');
          toast.error('Environment setup failed');
        }
      } catch (err) {
        setSkillStates(prev => prev.map(s => ({ ...s, status: 'failed' })));
        setErrorMessage(String(err));
        toast.error('Installation error');
      }
    };

    runRealInstall();
  }, [skills, onComplete]);

  const getStatusIcon = (status: InstallStatus) => {
    switch (status) {
      case 'pending':
        return <div className="h-5 w-5 rounded-full border-2 border-slate-500" />;
      case 'installing':
        return <Loader2 className="h-5 w-5 text-primary animate-spin" />;
      case 'completed':
        return <CheckCircle2 className="h-5 w-5 text-green-400" />;
      case 'failed':
        return <XCircle className="h-5 w-5 text-red-400" />;
    }
  };

  const getStatusText = (skill: SkillInstallState) => {
    switch (skill.status) {
      case 'pending':
        return <span className="text-muted-foreground">{t('installing.status.pending')}</span>;
      case 'installing':
        return <span className="text-primary">{t('installing.status.installing')}</span>;
      case 'completed':
        return <span className="text-green-400">{t('installing.status.installed')}</span>;
      case 'failed':
        return <span className="text-red-400">{t('installing.status.failed')}</span>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="text-4xl mb-4">⚙️</div>
        <h2 className="text-xl font-semibold mb-2">{t('installing.title')}</h2>
        <p className="text-muted-foreground">
          {t('installing.subtitle')}
        </p>
      </div>

      {/* Progress bar */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">{t('installing.progress')}</span>
          <span className="text-primary">{overallProgress}%</span>
        </div>
        <div className="h-2 bg-secondary rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-primary"
            initial={{ width: 0 }}
            animate={{ width: `${overallProgress}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
      </div>

      {/* Skill list */}
      <div className="space-y-2 max-h-48 overflow-y-auto">
        {skillStates.map((skill) => (
          <motion.div
            key={skill.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn(
              'flex items-center justify-between p-3 rounded-lg',
              skill.status === 'installing' ? 'bg-muted' : 'bg-muted/50'
            )}
          >
            <div className="flex items-center gap-3">
              {getStatusIcon(skill.status)}
              <div>
                <p className="font-medium">{skill.name}</p>
                <p className="text-xs text-muted-foreground">{skill.description}</p>
              </div>
            </div>
            {getStatusText(skill)}
          </motion.div>
        ))}
      </div>

      {/* Error Message Display */}
      {errorMessage && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="p-4 rounded-lg bg-red-900/30 border border-red-500/50 text-red-200 text-sm"
        >
          <div className="flex items-start gap-2">
            <AlertCircle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold">{t('installing.error')}</p>
              <pre className="text-xs bg-black/30 p-2 rounded overflow-x-auto whitespace-pre-wrap font-monospace">
                {errorMessage}
              </pre>
              <Button
                variant="link"
                className="text-red-400 p-0 h-auto text-xs underline"
                onClick={() => window.location.reload()}
              >
                {t('installing.restart')}
              </Button>
            </div>
          </div>
        </motion.div>
      )}

      {!errorMessage && (
        <p className="text-sm text-slate-400 text-center">
          {t('installing.wait')}
        </p>
      )}
      <div className="flex justify-end">
        <Button
          variant="ghost"
          className="text-muted-foreground"
          onClick={onSkip}
        >
          {t('installing.skip')}
        </Button>
      </div>
    </div>
  );
}
interface CompleteContentProps {
  selectedProvider: string | null;
  installedSkills: string[];
}

function CompleteContent({ selectedProvider, installedSkills }: CompleteContentProps) {
  const { t } = useTranslation(['setup', 'settings']);
  const gatewayStatus = useGatewayStore((state) => state.status);

  const providerData = providers.find((p) => p.id === selectedProvider);
  const installedSkillNames = getDefaultSkills(t)
    .filter((s: DefaultSkill) => installedSkills.includes(s.id))
    .map((s: DefaultSkill) => s.name)
    .join(', ');

  return (
    <div className="text-center space-y-6">
      <div className="text-6xl mb-4">🎉</div>
      <h2 className="text-xl font-semibold">{t('complete.title')}</h2>
      <p className="text-muted-foreground">
        {t('complete.subtitle')}
      </p>

      <div className="space-y-3 text-left max-w-md mx-auto">
        <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
          <span>{t('complete.provider')}</span>
          <span className="text-green-400">
            {providerData ? <span className="flex items-center gap-1.5">{getProviderIconUrl(providerData.id) ? <img src={getProviderIconUrl(providerData.id)} alt={providerData.name} className={`h-4 w-4 inline-block ${shouldInvertInDark(providerData.id) ? 'dark:invert' : ''}`} /> : providerData.icon} {providerData.id === 'custom' ? t('settings:aiProviders.custom') : providerData.name}</span> : '—'}
          </span>
        </div>
        <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
          <span>{t('complete.components')}</span>
          <span className="text-green-400">
            {installedSkillNames || `${installedSkills.length} ${t('installing.status.installed')}`}
          </span>
        </div>
        <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
          <span>{t('complete.gateway')}</span>
          <span className={gatewayStatus.state === 'running' ? 'text-green-400' : 'text-yellow-400'}>
            {gatewayStatus.state === 'running' ? `✓ ${t('complete.running')}` : gatewayStatus.state}
          </span>
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        {t('complete.footer')}
      </p>
    </div>
  );
}

export default Setup;
