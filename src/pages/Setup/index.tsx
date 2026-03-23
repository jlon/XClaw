/**
 * Setup Wizard Page
 * First-time setup experience for new users
 */
import { useState, useEffect, useCallback, useRef, useMemo, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Check,
  ChevronDown,
  Loader2,
  Eye,
  EyeOff,
  RefreshCw,
  XCircle,
  ExternalLink,
  Copy,
} from 'lucide-react';
import { TitleBar } from '@/components/layout/TitleBar';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { useGatewayStore } from '@/stores/gateway';
import { useSettingsStore } from '@/stores/settings';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
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
import { SetupExitGuard } from '@/components/setup/SetupExitGuard';
import { SetupFooter } from '@/components/setup/SetupFooter';
import { SetupCompleteStage } from '@/components/setup/SetupCompleteStage';
import { SetupPreparationStage } from '@/components/setup/SetupPreparationStage';
import { SetupProviderStage } from '@/components/setup/SetupProviderStage';
import { SetupShell } from '@/components/setup/SetupShell';
import { SetupStartStage } from '@/components/setup/SetupStartStage';
import { SetupStepRail, type SetupStepRailItem } from '@/components/setup/SetupStepRail';
import { canActivateSetup, getSetupStageOrder, resolveSetupPrimaryAction } from '@/components/setup/stage-utils';
import type { SetupCompletePhase, SetupStage } from '@/components/setup/types';

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
  const [currentStage, setCurrentStage] = useState<SetupStage>('start');
  const [completePhase, setCompletePhase] = useState<SetupCompletePhase>('summary');
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
  const [exitDialogOpen, setExitDialogOpen] = useState(false);
  const takeoverActionLockRef = useRef(false);
  const [freshWorkspacePath, setFreshWorkspacePath] = useState('');
  const [freshGatewayPortInput, setFreshGatewayPortInput] = useState('');
  const [freshPlanLoading, setFreshPlanLoading] = useState(false);

  // Setup state
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [providerConfigured, setProviderConfigured] = useState(false);
  const [providerPrimaryCanSubmit, setProviderPrimaryCanSubmit] = useState(false);
  const [providerPrimarySubmitting, setProviderPrimarySubmitting] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const providerPrimarySubmitRef = useRef<(() => Promise<boolean>) | null>(null);
  // Installation state for the Installing step
  const [installedSkills, setInstalledSkills] = useState<string[]>([]);
  // Runtime check status
  const [runtimeChecksPassed, setRuntimeChecksPassed] = useState(false);
  const takeoverRequiresProviderReview = setupMode === 'takeover'
    && Boolean(setupPlans.takeover?.providerImport?.requiresReview);
  const setupStageOrder = getSetupStageOrder();
  const activeSetupPlan = setupMode === 'takeover'
    ? setupPlans.takeover
    : setupPlans.fresh;
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

  const goToStage = useCallback((stage: SetupStage, phase: SetupCompletePhase = 'summary') => {
    setCurrentStage(stage);
    setCompletePhase(stage === 'complete' ? phase : 'summary');
  }, []);

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
      goToStage('start');
      if (takeoverStatusSnapshot) {
        setTakeoverStatus(takeoverStatusSnapshot);
        const snapshotRunning = takeoverStatusSnapshot.state === 'running';
        setTakeoverSubmitting(snapshotRunning);
        if (snapshotRunning) {
          goToStage('preparation');
        }
        if (takeoverStatusSnapshot.state === 'complete' && nextTakeoverRequiresProviderReview) {
          goToStage('provider');
        }
        if (takeoverStatusSnapshot.state === 'complete' && !nextTakeoverRequiresProviderReview) {
          goToStage('complete', 'summary');
        }
        if (snapshotRunning) {
          void loadTakeoverImportStatus().then((latestStatus) => {
            setTakeoverStatus(latestStatus);
            if (latestStatus.state === 'complete' && nextTakeoverRequiresProviderReview) {
              goToStage('provider');
            }
            if (latestStatus.state === 'complete' && !nextTakeoverRequiresProviderReview) {
              goToStage('complete', 'summary');
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
  }, [goToStage, settingsGatewayPort]);

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
            goToStage('provider');
          }
          if (status.state === 'complete' && !takeoverRequiresProviderReview) {
            goToStage('complete', 'summary');
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
  }, [goToStage, takeoverRequiresProviderReview, takeoverSubmitting]);

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

  const canProceed = useMemo(() => {
    switch (currentStage) {
      case 'start':
        return setupInspection?.hasExistingOpenClaw
          ? !takeoverSubmitting && Boolean(activeSetupPlan?.canApply)
          : true;
      case 'preparation':
        if (setupMode === 'takeover') {
          return !takeoverSubmitting && Boolean(activeSetupPlan?.canApply);
        }
        return runtimeChecksPassed
          && Boolean(activeSetupPlan?.canApply)
          && !freshPlanLoading
          && !freshGatewayPortError
          && !freshWorkspaceError;
      case 'provider':
        return setupMode === 'takeover'
          ? true
          : ((providerConfigured || providerPrimaryCanSubmit) && !providerPrimarySubmitting);
      case 'complete':
        return completePhase === 'summary';
      default:
        return true;
    }
  }, [
    activeSetupPlan?.canApply,
    completePhase,
    currentStage,
    freshGatewayPortError,
    freshPlanLoading,
    freshWorkspaceError,
    providerConfigured,
    providerPrimaryCanSubmit,
    providerPrimarySubmitting,
    runtimeChecksPassed,
    setupInspection?.hasExistingOpenClaw,
    setupMode,
    takeoverSubmitting,
  ]);

  const handleNext = async () => {
    if (currentStage === 'start') {
      goToStage('preparation');
      return;
    }

    if (currentStage === 'preparation') {
      if (setupMode === 'fresh') {
        goToStage('provider');
        return;
      }

      if (takeoverActionLockRef.current) {
        return;
      }

      if (takeoverStatus?.state === 'complete') {
        if (takeoverRequiresProviderReview) {
          goToStage('provider');
        } else {
          goToStage('complete', 'summary');
        }
        return;
      }

      takeoverActionLockRef.current = true;
      setTakeoverSubmitting(true);
      let keepSubmitting = false;

      try {
        const result = await startTakeoverImport();
        setTakeoverStatus(result);

        if (result.state === 'complete') {
          if (takeoverRequiresProviderReview) {
            goToStage('provider');
          } else {
            goToStage('complete', 'summary');
          }
          return;
        }

        keepSubmitting = result.state === 'running' || result.state === 'idle';
        if (!keepSubmitting) {
          toast.error(result.error || result.blockingIssues[0] || t('takeover.importFailed'));
        }
      } catch (error) {
        toast.error(String(error));
      } finally {
        takeoverActionLockRef.current = false;
        if (!keepSubmitting) {
          setTakeoverSubmitting(false);
        }
      }
      return;
    }

    if (currentStage === 'provider') {
      if (setupMode === 'takeover') {
        goToStage('complete', 'summary');
      } else {
        if (!providerConfigured) {
          const submit = providerPrimarySubmitRef.current;
          if (!submit) {
            return;
          }

          const submitted = await submit();
          if (!submitted) {
            return;
          }
        }

        goToStage('complete', 'applying');
      }
      return;
    }

    if (currentStage === 'complete' && completePhase === 'summary') {
      try {
        await completeSetupSession();
      } catch (error) {
        toast.error(String(error));
      }
    }
  };

  const handleBack = () => {
    if (currentStage === 'preparation') {
      goToStage('start');
      return;
    }

    if (currentStage === 'provider') {
      goToStage('preparation');
      return;
    }

    if (currentStage === 'complete' && completePhase === 'summary') {
      if (setupMode === 'takeover' && !takeoverRequiresProviderReview) {
        goToStage('preparation');
      } else {
        goToStage('provider');
      }
    }
  };

  const handleInstallationComplete = useCallback((skills: string[]) => {
    setInstalledSkills(skills);
    setTimeout(() => {
      setCompletePhase('summary');
    }, 1000);
  }, []);

  const railItems = useMemo<SetupStepRailItem[]>(() => {
    const labels: Record<SetupStage, string> = {
      start: t('wizard.stages.start.label'),
      preparation: t('wizard.stages.preparation.label'),
      provider: t('wizard.stages.provider.label'),
      complete: t('wizard.stages.complete.label'),
    };
    const descriptions: Record<SetupStage, string> = {
      start: t('wizard.stages.start.description'),
      preparation: t('wizard.stages.preparation.description'),
      provider: t('wizard.stages.provider.description'),
      complete: completePhase === 'applying'
        ? t('wizard.stages.complete.applyingDescription')
        : t('wizard.stages.complete.description'),
    };
    const activeIndex = setupStageOrder.indexOf(currentStage);

    return setupStageOrder.map((stage, index) => ({
      id: stage,
      label: labels[stage],
      description: descriptions[stage],
      status: index < activeIndex ? 'complete' : index === activeIndex ? 'current' : 'upcoming',
    }));
  }, [completePhase, currentStage, setupStageOrder, t]);

  const footerPrimaryAction = useMemo(() => resolveSetupPrimaryAction({
    stage: currentStage,
    phase: completePhase,
    mode: setupMode,
    providerConfigured,
    providerCanSubmit: providerPrimaryCanSubmit,
    takeoverImportComplete: takeoverStatus?.state === 'complete',
    labels: {
      activate: t('nav.getStarted'),
      takeoverImport: t('wizard.actions.takeoverImport'),
      reviewSummary: t('wizard.actions.reviewSummary'),
      providerSubmit: t('wizard.actions.providerSubmit'),
      advance: t('nav.next'),
    },
  }), [
    completePhase,
    currentStage,
    providerConfigured,
    providerPrimaryCanSubmit,
    setupMode,
    t,
    takeoverStatus?.state,
  ]);

  const handleExitRequest = useCallback(() => {
    if (canActivateSetup({ stage: currentStage, phase: completePhase })) {
      void invokeIpc('window:close');
      return;
    }

    setExitDialogOpen(true);
  }, [completePhase, currentStage]);

  const renderStageContent = () => {
    if (currentStage === 'start') {
      return (
        <SetupStartStage
          inspection={setupInspection}
          activePlan={activeSetupPlan}
          mode={setupMode}
          onModeChange={setSetupMode}
          status={takeoverStatus}
          submitting={takeoverSubmitting}
        />
      );
    }

    if (currentStage === 'preparation') {
      return (
        <SetupPreparationStage
          mode={setupMode}
          onStatusChange={setRuntimeChecksPassed}
          workspacePath={freshWorkspacePath}
          gatewayPortInput={freshGatewayPortInput}
          onWorkspacePathChange={setFreshWorkspacePath}
          onGatewayPortInputChange={setFreshGatewayPortInput}
          workspaceError={freshWorkspaceError}
          gatewayPortError={freshGatewayPortError}
          plan={setupPlans.fresh}
          planLoading={freshPlanLoading}
          inspection={setupInspection}
          status={takeoverStatus}
          submitting={takeoverSubmitting}
        />
      );
    }

    if (currentStage === 'provider') {
      return setupMode === 'takeover' ? (
        <ProviderReviewContent
          plan={setupPlans.takeover}
          status={takeoverStatus}
        />
      ) : (
        <ProviderContent
          providers={providers}
          selectedProvider={selectedProvider}
          onSelectProvider={setSelectedProvider}
          apiKey={apiKey}
          onApiKeyChange={setApiKey}
          onConfiguredChange={setProviderConfigured}
          onPrimaryActionChange={({ canSubmit, submitting, submit }) => {
            setProviderPrimaryCanSubmit(canSubmit);
            setProviderPrimarySubmitting(submitting);
            providerPrimarySubmitRef.current = submit;
          }}
        />
      );
    }

    if (completePhase === 'applying') {
      return (
        <InstallingContent
          skills={getDefaultSkills(t)}
          onComplete={handleInstallationComplete}
        />
      );
    }

    return (
      <CompleteContent
        selectedProvider={selectedProvider}
        installedSkills={installedSkills}
      />
    );
  };

  const renderShell = (content: ReactNode) => (
    <SetupExitGuard
      enabled={!canActivateSetup({ stage: currentStage, phase: completePhase })}
      onExitRequest={handleExitRequest}
    >
      <div className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
        <TitleBar />
        <SetupShell
          rail={<SetupStepRail stages={railItems} />}
          footer={(
            <SetupFooter
              stage={currentStage}
              completePhase={completePhase}
              canProceed={canProceed}
              primaryLabel={footerPrimaryAction.label}
              onBack={currentStage === 'start' || (currentStage === 'complete' && completePhase === 'applying') ? undefined : handleBack}
              onPrimary={currentStage === 'complete' && completePhase === 'applying' ? undefined : () => { void handleNext(); }}
              onExit={currentStage === 'start' ? handleExitRequest : undefined}
            />
          )}
        >
          {content}
        </SetupShell>
        <ConfirmDialog
          open={exitDialogOpen}
          title={currentStage === 'complete' && completePhase === 'applying'
            ? t('wizard.exitDialog.applyingTitle')
            : t('wizard.exitDialog.title')}
          message={currentStage === 'complete' && completePhase === 'applying'
            ? t('wizard.exitDialog.applyingMessage')
            : t('wizard.exitDialog.message')}
          confirmLabel={t('wizard.exitDialog.confirm')}
          cancelLabel={t('wizard.exitDialog.cancel')}
          variant="destructive"
          onCancel={() => setExitDialogOpen(false)}
          onConfirm={async () => {
            setExitDialogOpen(false);
            await invokeIpc('window:close');
          }}
        />
      </div>
    </SetupExitGuard>
  );

  if (setupStateLoading) {
    return renderShell(
      <div className="flex h-full items-center justify-center p-6 xl:p-8">
        <div className="w-full max-w-3xl rounded-[2rem] border border-border/70 app-panel-surface-elevated p-8 text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
          <p className="mt-4 text-sm text-muted-foreground">{t('wizard.loading.description')}</p>
        </div>
      </div>,
    );
  }

  if (setupStateError) {
    return renderShell(
      <div className="flex h-full items-center justify-center p-6 xl:p-8">
        <div className="w-full max-w-3xl rounded-[2rem] border border-border/70 app-panel-surface-elevated p-8">
          <h1 className="text-xl font-semibold">{t('wizard.errorState.title')}</h1>
          <p className="mt-3 break-all text-sm text-muted-foreground">{setupStateError}</p>
          <div className="mt-6 flex justify-end">
            <Button onClick={() => { void loadSetupState(); }}>
              <RefreshCw className="mr-2 h-4 w-4" />
              {t('wizard.errorState.retry')}
            </Button>
          </div>
        </div>
      </div>,
    );
  }

  return renderShell(
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex-1 overflow-auto p-6 xl:p-8">
        <div className="mx-auto flex w-full max-w-5xl flex-col">
          <AnimatePresence mode="wait">
            <motion.div
              key={`${currentStage}-${completePhase}-${setupMode}`}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              className="rounded-[2rem] border border-border/70 app-panel-surface-elevated p-6 text-card-foreground xl:p-8"
            >
              {renderStageContent()}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>,
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
  const warnings = [
    ...(status?.conflicts ?? []),
    ...((summary?.unsupportedCount ?? 0) > 0 ? [`${t('providerReview.summary.unsupported')} ${summary?.unsupportedCount}`] : []),
    ...(plan?.warnings ?? []),
  ];

  return (
    <SetupProviderStage
      variant="review"
      title={t('providerReview.title')}
      description={t('providerReview.description')}
      reviewCards={[
        {
          label: t('providerReview.summary.imported'),
          value: status?.importedAccountCount ?? summary?.importableCount ?? 0,
        },
        {
          label: t('providerReview.summary.default'),
          value: defaultAccount || t('providerReview.defaultMissing'),
        },
        {
          label: t('providerReview.summary.conflicts'),
          value: status?.conflicts.length ?? summary?.conflictCount ?? 0,
        },
        {
          label: t('providerReview.summary.unsupported'),
          value: summary?.unsupportedCount ?? 0,
        },
      ]}
      warnings={warnings.length ? warnings : undefined}
      warningsTitle={t('providerReview.conflictsTitle')}
      footerNote={t('providerReview.nextHint')}
    />
  );
}

interface ProviderContentProps {
  providers: ProviderTypeInfo[];
  selectedProvider: string | null;
  onSelectProvider: (id: string | null) => void;
  apiKey: string;
  onApiKeyChange: (key: string) => void;
  onConfiguredChange: (configured: boolean) => void;
  onPrimaryActionChange: (state: {
    canSubmit: boolean;
    submitting: boolean;
    submit: (() => Promise<boolean>) | null;
  }) => void;
}

function ProviderContent({
  providers,
  selectedProvider,
  onSelectProvider,
  apiKey,
  onApiKeyChange,
  onConfiguredChange,
  onPrimaryActionChange,
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

  const handleValidateAndSave = useCallback(async (): Promise<boolean> => {
    if (!selectedProvider) return false;

    try {
      const snapshot = await fetchProviderSnapshot();
      const existingVendorIds = new Set(snapshot.accounts.map((account) => account.vendorId));
      if (selectedProvider === 'minimax-portal' && existingVendorIds.has('minimax-portal-cn')) {
        toast.error(t('settings:aiProviders.toast.minimaxConflict'));
        return false;
      }
      if (selectedProvider === 'minimax-portal-cn' && existingVendorIds.has('minimax-portal')) {
        toast.error(t('settings:aiProviders.toast.minimaxConflict'));
        return false;
      }
    } catch {
      const ignoredConflictCheckFailure = true;
      void ignoredConflictCheckFailure;
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
          return false;
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
      return true;
    } catch (error) {
      setKeyValid(false);
      onConfiguredChange(false);
      toast.error('Configuration failed: ' + String(error));
      return false;
    } finally {
      setValidating(false);
    }
  }, [
    apiKey,
    apiProtocol,
    authMode,
    baseUrl,
    devModeUnlocked,
    modelId,
    onConfiguredChange,
    requiresKey,
    selectedAccountId,
    selectedProvider,
    selectedProviderData,
    supportsApiKey,
    t,
  ]);

  // Can the user submit?
  const isApiKeyRequired = requiresKey || (supportsApiKey && authMode === 'apikey');
  const canSubmit =
    selectedProvider
    && (isApiKeyRequired ? apiKey.length > 0 : true)
    && (showModelIdField ? modelId.trim().length > 0 : true)
    && !useOAuthFlow;

  useEffect(() => {
    onPrimaryActionChange({
      canSubmit: Boolean(canSubmit),
      submitting: validating,
      submit: canSubmit ? handleValidateAndSave : null,
    });

    return () => {
      onPrimaryActionChange({
        canSubmit: false,
        submitting: false,
        submit: null,
      });
    };
  }, [canSubmit, handleValidateAndSave, onPrimaryActionChange, validating]);

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
              className="inline-flex items-center gap-1 text-[13px] font-medium text-foreground/70 hover:text-foreground"
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
              'w-full rounded-[12px] border border-border/65 app-field-surface px-3 py-2 text-sm',
              'flex items-center justify-between gap-2',
              'focus:outline-none focus:ring-2 focus:ring-ring/30'
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
              className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-[12px] border border-border/65 app-panel-surface-elevated"
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
                      'hover:bg-[hsl(var(--foreground)/0.04)] transition-colors',
                      isSelected && 'bg-[hsl(var(--foreground)/0.06)]'
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
                className="app-field-surface"
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
                className="app-field-surface"
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
                    'flex-1 rounded-[10px] border border-border/65 px-3 py-2 transition-colors',
                    apiProtocol === 'openai-completions'
                      ? 'app-field-surface font-medium'
                      : 'bg-transparent text-muted-foreground hover:bg-[hsl(var(--foreground)/0.04)] hover:text-foreground'
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
                    'flex-1 rounded-[10px] border border-border/65 px-3 py-2 transition-colors',
                    apiProtocol === 'openai-responses'
                      ? 'app-field-surface font-medium'
                      : 'bg-transparent text-muted-foreground hover:bg-[hsl(var(--foreground)/0.04)] hover:text-foreground'
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
                    'flex-1 rounded-[10px] border border-border/65 px-3 py-2 transition-colors',
                    apiProtocol === 'anthropic-messages'
                      ? 'app-field-surface font-medium'
                      : 'bg-transparent text-muted-foreground hover:bg-[hsl(var(--foreground)/0.04)] hover:text-foreground'
                  )}
                >
                  {t('provider.protocols.anthropic')}
                </button>
              </div>
            </div>
          )}

          {/* Auth mode toggle for providers supporting both */}
          {isOAuth && supportsApiKey && (
            <div className="grid grid-cols-2 overflow-hidden rounded-[10px] border border-border/60 text-sm">
              <button
                onClick={() => setAuthMode('oauth')}
                className={cn(
                  'min-w-0 whitespace-nowrap px-2.5 py-2 text-center leading-none transition-colors sm:min-w-[112px]',
                  authMode === 'oauth' ? 'bg-[hsl(var(--foreground)/0.07)] text-foreground' : 'text-muted-foreground hover:bg-[hsl(var(--foreground)/0.04)] hover:text-foreground'
                )}
              >
                {t('settings:aiProviders.oauth.loginMode')}
              </button>
              <button
                onClick={() => setAuthMode('apikey')}
                className={cn(
                  'min-w-0 whitespace-nowrap px-2.5 py-2 text-center leading-none transition-colors sm:min-w-[112px]',
                  authMode === 'apikey' ? 'bg-[hsl(var(--foreground)/0.07)] text-foreground' : 'text-muted-foreground hover:bg-[hsl(var(--foreground)/0.04)] hover:text-foreground'
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
                  className="pr-10 app-field-surface"
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
              <div className="rounded-[14px] border border-border/65 app-pane-surface p-4 text-center">
                <p className="mb-3 block text-sm text-muted-foreground">
                  This provider requires signing in via your browser.
                </p>
                <Button
                  onClick={handleStartOAuth}
                  disabled={oauthFlowing}
                  className="w-full"
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
                <div className="relative mt-4 overflow-hidden rounded-[14px] border border-border/65 app-pane-surface p-4">

                  <div className="relative z-10 flex flex-col items-center justify-center text-center space-y-4">
                    {oauthError ? (
                      <div className="space-y-2 text-destructive">
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
                        <p className="animate-pulse text-sm text-muted-foreground">Requesting secure login code...</p>
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
                          className="w-full"
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

                        <div className="flex items-center justify-center gap-2 rounded-[10px] border border-border/65 app-field-surface p-3">
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
}

function InstallingContent({ skills, onComplete }: InstallingContentProps) {
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
          setErrorMessage(result.error || t('installing.unknownError'));
          toast.error(t('installing.toastFailed'));
        }
      } catch (err) {
        setSkillStates(prev => prev.map(s => ({ ...s, status: 'failed' })));
        setErrorMessage(String(err));
        toast.error(t('installing.toastError'));
      }
    };

    runRealInstall();
  }, [onComplete, skills, t]);

  return (
    <SetupCompleteStage
      phase="applying"
      title={t('installing.title')}
      subtitle={t('installing.subtitle')}
      progress={overallProgress}
      progressLabel={t('installing.progress')}
      skills={skillStates}
      warningMessage={errorMessage ? (
        <div className="space-y-2">
          <div>{t('installing.error')}</div>
          <pre className="overflow-x-auto whitespace-pre-wrap rounded-[10px] border border-border/65 app-field-surface p-2 font-mono text-xs text-foreground/80">
            {errorMessage}
          </pre>
          <Button
            variant="link"
            className="h-auto p-0 text-xs text-red-400 underline"
            onClick={() => window.location.reload()}
          >
            {t('installing.restart')}
          </Button>
        </div>
      ) : undefined}
      footerNote={!errorMessage ? t('installing.wait') : undefined}
    />
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
    <SetupCompleteStage
      phase="summary"
      title={t('complete.title')}
      subtitle={t('complete.subtitle')}
      summaryCards={[
        {
          label: t('complete.provider'),
          value: providerData ? (
            <span className="flex items-center gap-1.5">
              {getProviderIconUrl(providerData.id) ? (
                <img
                  src={getProviderIconUrl(providerData.id)}
                  alt={providerData.name}
                  className={cn('inline-block h-4 w-4', shouldInvertInDark(providerData.id) && 'dark:invert')}
                />
              ) : providerData.icon}
              {providerData.id === 'custom' ? t('settings:aiProviders.custom') : providerData.name}
            </span>
          ) : '—',
        },
        {
          label: t('complete.components'),
          value: installedSkillNames || `${installedSkills.length} ${t('installing.status.installed')}`,
        },
        {
          label: t('complete.gateway'),
          value: gatewayStatus.state === 'running' ? `✓ ${t('complete.running')}` : gatewayStatus.state,
          hint: gatewayStatus.state === 'running' ? undefined : t('complete.gatewayPendingHint'),
        },
      ]}
      footerNote={t('complete.footer')}
    />
  );
}

export default Setup;
