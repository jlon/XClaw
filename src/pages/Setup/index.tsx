/**
 * Setup Wizard Page
 * First-time setup experience for new users
 */
import { useState, useEffect, useCallback, useRef, useMemo, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Check,
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
  const initGateway = useGatewayStore((state) => state.init);
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
  // Runtime check status
  const [runtimeChecksPassed, setRuntimeChecksPassed] = useState(false);
  const takeoverRequiresProviderReview = Boolean(setupPlans.takeover?.providerImport?.requiresReview);
  const takeoverTaskRunning = takeoverSubmitting || takeoverStatus?.state === 'running';
  const takeoverModeLocked = takeoverTaskRunning || takeoverStatus?.state === 'complete';
  const inspectionRequiresTakeover = Boolean(
    setupInspection && (
      setupInspection.bootstrap?.source === 'legacy-footprint'
      || setupInspection.hasExistingOpenClaw
    ),
  );
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

  const handleSetupModeChange = useCallback((nextMode: SetupMode) => {
    if (takeoverModeLocked) {
      return;
    }
    setSetupMode(nextMode);
  }, [takeoverModeLocked]);

  const loadSetupState = useCallback(async () => {
    setSetupStateLoading(true);
    setSetupStateError(null);
    try {
      const state = await loadSetupTakeoverState();
      const entryRequiresTakeover = Boolean(
        state.inspection.bootstrap?.source === 'legacy-footprint'
        || state.inspection.hasExistingOpenClaw,
      );
      const takeoverStatusSnapshot = entryRequiresTakeover
        ? await loadTakeoverImportStatus().catch(() => null)
        : null;
      const nextSetupMode = entryRequiresTakeover
        ? (state.inspection.suggestedMode ?? 'takeover')
        : 'fresh';
      const nextTakeoverRequiresProviderReview = Boolean(state.plans.takeover?.providerImport?.requiresReview);
      const takeoverFlowActive = takeoverStatusSnapshot?.state === 'running' || takeoverStatusSnapshot?.state === 'complete';

      setSetupInspection(state.inspection);
      setSetupPlans(state.plans);
      setSetupMode(takeoverFlowActive ? 'takeover' : nextSetupMode);
      setFreshWorkspacePath(state.plans.fresh?.workspace?.defaultPath ?? state.inspection.defaultWorkspacePath ?? '');
      setFreshGatewayPortInput(String(state.plans.fresh?.runtime?.gatewayPort ?? state.inspection.gatewayPort ?? settingsGatewayPort));
      goToStage('start');
      setTakeoverStatus(takeoverStatusSnapshot);
      const snapshotRunning = takeoverStatusSnapshot?.state === 'running';
      setTakeoverSubmitting(snapshotRunning);
      if (snapshotRunning) {
        goToStage('preparation');
      }
      if (takeoverStatusSnapshot?.state === 'complete' && nextTakeoverRequiresProviderReview) {
        goToStage('provider');
      }
      if (takeoverStatusSnapshot?.state === 'complete' && !nextTakeoverRequiresProviderReview) {
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
    void initGateway();
  }, [initGateway]);

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
        return inspectionRequiresTakeover
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
    inspectionRequiresTakeover,
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

        goToStage('complete', 'summary');
      }
      return;
    }

    if (currentStage === 'complete' && completePhase === 'summary') {
      try {
        setCompletePhase('applying');
        await completeSetupSession();
      } catch (error) {
        setCompletePhase('summary');
        toast.error(String(error));
      }
    }
  };

  const handleBack = () => {
    if (setupMode === 'takeover' && takeoverTaskRunning) {
      return;
    }

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
      complete: t('wizard.stages.complete.description'),
    };
    const activeIndex = setupStageOrder.indexOf(currentStage);

    return setupStageOrder.map((stage, index) => ({
      id: stage,
      label: labels[stage],
      description: descriptions[stage],
      status: index < activeIndex ? 'complete' : index === activeIndex ? 'current' : 'upcoming',
    }));
  }, [currentStage, setupStageOrder, t]);

  const footerPrimaryAction = useMemo(() => resolveSetupPrimaryAction({
    stage: currentStage,
    phase: completePhase,
    mode: setupMode,
    providerConfigured,
    providerCanSubmit: providerPrimaryCanSubmit,
    takeoverImportComplete: takeoverStatus?.state === 'complete',
    takeoverNeedsProviderReview: takeoverRequiresProviderReview,
    labels: {
      activate: t('nav.getStarted'),
      takeoverImport: t('wizard.actions.takeoverImport'),
      takeoverImportAndReview: t('wizard.actions.takeoverImportAndReview'),
      reviewSummary: t('wizard.actions.reviewSummary'),
      providerReview: t('wizard.actions.providerReview'),
      providerSubmit: t('wizard.actions.providerSubmit'),
      advance: t('nav.next'),
    },
  }), [
    completePhase,
    currentStage,
    providerConfigured,
    providerPrimaryCanSubmit,
    setupMode,
    takeoverRequiresProviderReview,
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
          onModeChange={handleSetupModeChange}
          status={takeoverStatus}
          submitting={takeoverSubmitting}
          modeLocked={takeoverModeLocked}
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

    return (
      <CompleteContent
        completePhase={completePhase}
        selectedProvider={selectedProvider}
      />
    );
  };

  const renderShell = (content: ReactNode) => (
    <SetupExitGuard
      enabled={!canActivateSetup({ stage: currentStage, phase: completePhase })}
      onExitRequest={handleExitRequest}
    >
      <div className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
        <TitleBar pathname="/setup" />
        <SetupShell
          rail={<SetupStepRail stages={railItems} />}
          footer={(
            <SetupFooter
              stage={currentStage}
              completePhase={completePhase}
              canProceed={canProceed}
              primaryLabel={footerPrimaryAction.label}
              onBack={
                currentStage === 'start'
                || (currentStage === 'preparation' && setupMode === 'takeover' && takeoverTaskRunning)
                  ? undefined
                  : handleBack
              }
              onPrimary={() => { void handleNext(); }}
              onExit={currentStage === 'start' ? handleExitRequest : undefined}
            />
          )}
        >
          {content}
        </SetupShell>
        <ConfirmDialog
          open={exitDialogOpen}
          title={t('wizard.exitDialog.title')}
          message={t('wizard.exitDialog.message')}
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
    <div className="p-6 xl:p-8">
      <div className="mx-auto flex w-full max-w-5xl flex-col">
        <AnimatePresence mode="wait">
          <motion.div
            key={`${currentStage}-${completePhase}-${setupMode}`}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className={cn(
              'w-full text-card-foreground',
              currentStage === 'start'
                ? 'min-h-full p-0'
                : 'rounded-[2rem] border border-border/70 app-panel-surface-elevated p-6 xl:p-8',
            )}
          >
            {renderStageContent()}
          </motion.div>
        </AnimatePresence>
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
    setAuthMode('oauth');
  };

  return (
    <SetupProviderStage
      variant="configure"
      title={t('provider.title')}
      className="space-y-5"
    >
      <div className="space-y-4">
        <section className="rounded-[1.5rem] border border-border/70 app-insight-surface p-3">
          <div className="space-y-1 px-2 pb-2">
            <div className="text-sm font-medium text-foreground">{t('provider.selectionTitle')}</div>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {providers.map((provider) => {
              const iconUrl = getProviderIconUrl(provider.id);
              const isSelected = selectedProvider === provider.id;
              const meta = provider.model || (provider.supportsApiKey ? 'API Key' : 'OAuth');
              return (
                <button
                  key={provider.id}
                  type="button"
                  onClick={() => handleSelectProvider(provider.id)}
                  className={cn(
                    'flex min-h-[74px] items-start gap-3 rounded-[14px] border px-3 py-3 text-left transition-[border-color,background-color,box-shadow,transform] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/15',
                    isSelected
                      ? 'border-[hsl(var(--border-strong)/0.42)] bg-[hsl(var(--surface-elevated)/1)] shadow-[0_10px_20px_rgba(15,23,42,0.045)]'
                      : 'border-[hsl(var(--border-subtle)/0.82)] bg-[hsl(var(--surface-elevated)/0.985)] hover:-translate-y-px hover:border-[hsl(var(--border-strong)/0.28)] hover:bg-[hsl(var(--surface-elevated)/1)] hover:shadow-[0_8px_18px_rgba(15,23,42,0.035)]',
                  )}
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-[10px] border border-[hsl(var(--border-subtle)/0.76)] bg-[hsl(var(--surface-base)/0.92)]">
                    {iconUrl ? (
                      <img
                        src={iconUrl}
                        alt={provider.name}
                        className={cn('h-4 w-4', shouldInvertInDark(provider.id) && 'dark:invert')}
                      />
                    ) : (
                      <span className="text-[15px] leading-none">{provider.icon}</span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <div className="truncate text-[12.5px] font-semibold leading-none text-foreground">
                      {provider.id === 'custom' ? t('settings:aiProviders.custom') : provider.name}
                    </div>
                    <div className="line-clamp-1 text-[10.5px] leading-4 text-muted-foreground/72">{meta}</div>
                  </div>
                  {isSelected ? <Check className="h-4 w-4 shrink-0 text-primary" /> : null}
                </button>
              );
            })}
          </div>
        </section>

        <motion.div
          key={selectedProvider || 'idle-provider'}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-[1.5rem] border border-border/70 app-panel-surface-elevated p-5"
        >
          {selectedProvider && selectedProviderData ? (
            <div className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-[1rem] border border-border/65 bg-[hsl(var(--surface-elevated)/0.82)]">
                    {selectedProviderIconUrl ? (
                      <img
                        src={selectedProviderIconUrl}
                        alt={selectedProviderData.name}
                        className={cn('h-5 w-5', shouldInvertInDark(selectedProviderData.id) && 'dark:invert')}
                      />
                    ) : (
                      <span className="text-base leading-none">{selectedProviderData.icon}</span>
                    )}
                  </div>
                  <div className="space-y-0.5">
                    <div className="text-lg font-semibold text-foreground">
                      {selectedProviderData.id === 'custom' ? t('settings:aiProviders.custom') : selectedProviderData.name}
                    </div>
                  </div>
                </div>
                {providerDocsUrl ? (
                  <a
                    href={providerDocsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 rounded-full border border-border/65 bg-background/80 px-3 py-1.5 text-[13px] font-medium text-foreground/70 transition-colors hover:text-foreground"
                  >
                    {t('provider.docsLink')}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                ) : null}
              </div>

              {isOAuth && supportsApiKey ? (
                <div className="space-y-2">
                  <Label>{t('provider.authModeLabel')}</Label>
                  <div className="grid grid-cols-2 overflow-hidden rounded-[14px] border border-border/70 bg-[hsl(var(--surface-elevated)/0.75)] p-1 text-sm">
                    <button
                      type="button"
                      onClick={() => setAuthMode('oauth')}
                      className={cn(
                        'min-w-0 whitespace-nowrap rounded-[10px] px-3 py-2.5 text-center transition-colors',
                        authMode === 'oauth'
                          ? 'bg-background text-foreground shadow-sm'
                          : 'text-muted-foreground hover:bg-[hsl(var(--foreground)/0.04)] hover:text-foreground',
                      )}
                    >
                      {t('settings:aiProviders.oauth.loginMode')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setAuthMode('apikey')}
                      className={cn(
                        'min-w-0 whitespace-nowrap rounded-[10px] px-3 py-2.5 text-center transition-colors',
                        authMode === 'apikey'
                          ? 'bg-background text-foreground shadow-sm'
                          : 'text-muted-foreground hover:bg-[hsl(var(--foreground)/0.04)] hover:text-foreground',
                      )}
                    >
                      {t('settings:aiProviders.oauth.apikeyMode')}
                    </button>
                  </div>
                </div>
              ) : null}

              {useOAuthFlow ? (
                <div className="rounded-[1.2rem] border border-border/70 app-insight-surface p-4">
                  <div className="space-y-1">
                    <div className="text-sm font-medium text-foreground">{t('provider.oauthCardTitle')}</div>
                    <p className="text-sm leading-6 text-muted-foreground">{t('provider.oauthCardDescription')}</p>
                  </div>

                  <div className="mt-4">
                    {!oauthFlowing ? (
                      <Button onClick={handleStartOAuth} disabled={oauthFlowing} className="w-full">
                        {t('provider.oauthStart')}
                      </Button>
                    ) : oauthError ? (
                      <div className="space-y-3 text-destructive">
                        <div className="flex items-center gap-2">
                          <XCircle className="h-4 w-4" />
                          <span className="font-medium">{t('provider.oauthErrorTitle')}</span>
                        </div>
                        <p className="text-sm opacity-90">{oauthError}</p>
                        <Button variant="outline" size="sm" onClick={handleCancelOAuth}>
                          {t('provider.oauthRetry')}
                        </Button>
                      </div>
                    ) : !oauthData ? (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        {t('provider.oauthRequesting')}
                      </div>
                    ) : oauthData.mode === 'manual' ? (
                      <div className="space-y-4">
                        <Button
                          variant="secondary"
                          className="w-full"
                          onClick={() => invokeIpc('shell:openExternal', oauthData.authorizationUrl)}
                        >
                          <ExternalLink className="mr-2 h-4 w-4" />
                          {t('provider.oauthOpenAuthPage')}
                        </Button>

                        <Input
                          placeholder={t('provider.oauthManualPlaceholder')}
                          value={manualCodeInput}
                          onChange={(e) => setManualCodeInput(e.target.value)}
                        />

                        <div className="flex gap-2">
                          <Button
                            className="flex-1"
                            onClick={handleSubmitManualOAuthCode}
                            disabled={!manualCodeInput.trim()}
                          >
                            {t('provider.oauthSubmit')}
                          </Button>
                          <Button variant="ghost" onClick={handleCancelOAuth}>
                            {t('provider.oauthCancel')}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="flex items-center justify-center gap-2 rounded-[12px] border border-border/65 app-field-surface p-3">
                          <code className="text-2xl font-mono font-bold tracking-widest text-primary">
                            {oauthData.userCode}
                          </code>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              navigator.clipboard.writeText(oauthData.userCode);
                              toast.success(t('provider.oauthCodeCopied'));
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
                          <ExternalLink className="mr-2 h-4 w-4" />
                          {t('provider.oauthOpenLoginPage')}
                        </Button>

                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          <span>{t('provider.oauthWaitingApproval')}</span>
                        </div>

                        <Button variant="ghost" size="sm" onClick={handleCancelOAuth}>
                          {t('provider.oauthCancel')}
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className={cn('grid gap-4', showBaseUrlField && showModelIdField && 'sm:grid-cols-2')}>
                    {showBaseUrlField ? (
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
                    ) : null}

                    {showModelIdField ? (
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
                      </div>
                    ) : null}
                  </div>

                  {selectedProvider === 'custom' ? (
                    <div className="space-y-2">
                      <Label>{t('provider.protocol')}</Label>
                      <div className="grid gap-2 rounded-[14px] border border-border/70 bg-[hsl(var(--surface-elevated)/0.75)] p-1 sm:grid-cols-3">
                        <button
                          type="button"
                          onClick={() => {
                            setApiProtocol('openai-completions');
                            onConfiguredChange(false);
                          }}
                          className={cn(
                            'rounded-[10px] px-3 py-2 transition-colors',
                            apiProtocol === 'openai-completions'
                              ? 'bg-background font-medium text-foreground shadow-sm'
                              : 'bg-transparent text-muted-foreground hover:bg-[hsl(var(--foreground)/0.04)] hover:text-foreground',
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
                            'rounded-[10px] px-3 py-2 transition-colors',
                            apiProtocol === 'openai-responses'
                              ? 'bg-background font-medium text-foreground shadow-sm'
                              : 'bg-transparent text-muted-foreground hover:bg-[hsl(var(--foreground)/0.04)] hover:text-foreground',
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
                            'rounded-[10px] px-3 py-2 transition-colors',
                            apiProtocol === 'anthropic-messages'
                              ? 'bg-background font-medium text-foreground shadow-sm'
                              : 'bg-transparent text-muted-foreground hover:bg-[hsl(var(--foreground)/0.04)] hover:text-foreground',
                          )}
                        >
                          {t('provider.protocols.anthropic')}
                        </button>
                      </div>
                    </div>
                  ) : null}

                  {!isOAuth || (supportsApiKey && authMode === 'apikey') ? (
                    <div className="space-y-2">
                      <Label htmlFor="apiKey">{t('provider.apikeyCardTitle')}</Label>
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
                  ) : null}
                </div>
              )}

              {keyValid !== null ? (
                <div className={cn('rounded-[1rem] border px-4 py-3 text-sm', keyValid ? 'border-emerald-500/20 bg-emerald-500/5 text-emerald-700 dark:text-emerald-300' : 'border-red-500/20 bg-red-500/5 text-red-700 dark:text-red-300')}>
                  {keyValid ? `✓ ${t('provider.valid')}` : `✗ ${t('provider.invalid')}`}
                </div>
              ) : null}

              {!useOAuthFlow && (requiresKey || supportsApiKey) ? (
                <p className="text-sm text-muted-foreground">{t('provider.storedLocally')}</p>
              ) : null}
            </div>
          ) : (
            <div className="flex min-h-[14rem] items-center justify-center rounded-[1.2rem] border border-dashed border-border/70 bg-[hsl(var(--surface-elevated)/0.55)] p-6 text-sm text-muted-foreground">
              {t('provider.connectionIdle')}
            </div>
          )}
        </motion.div>
      </div>
    </SetupProviderStage>
  );
}

interface CompleteContentProps {
  completePhase: SetupCompletePhase;
  selectedProvider: string | null;
}

function CompleteContent({ completePhase, selectedProvider }: CompleteContentProps) {
  const { t } = useTranslation(['setup', 'settings']);
  const gatewayStatus = useGatewayStore((state) => state.status);
  const providerData = providers.find((p) => p.id === selectedProvider);

  return (
    <SetupCompleteStage
      phase={completePhase}
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
          label: t('complete.gateway'),
          value: gatewayStatus.state === 'running' ? `✓ ${t('complete.running')}` : gatewayStatus.state,
          hint: gatewayStatus.state === 'running' ? undefined : t('complete.gatewayPendingHint'),
        },
      ]}
      footerNote={t('complete.footer')}
    >
      {completePhase === 'summary' ? <OptionalEnhancementPanel /> : null}
    </SetupCompleteStage>
  );
}

function OptionalEnhancementPanel() {
  const { t } = useTranslation('setup');
  const [status, setStatus] = useState<{
    loading: boolean;
    uvInstalled: boolean;
    pythonReady: boolean;
    preparing: boolean;
    error: string | null;
  }>({
    loading: true,
    uvInstalled: false,
    pythonReady: false,
    preparing: false,
    error: null,
  });

  const refreshStatus = useCallback(async () => {
    setStatus((current) => ({
      ...current,
      loading: true,
      error: null,
    }));
    try {
      const next = await invokeIpc('uv:status') as {
        uvInstalled: boolean;
        pythonReady: boolean;
      };
      setStatus((current) => ({
        ...current,
        loading: false,
        uvInstalled: next.uvInstalled,
        pythonReady: next.pythonReady,
      }));
    } catch (error) {
      setStatus((current) => ({
        ...current,
        loading: false,
        error: String(error),
      }));
    }
  }, []);

  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus]);

  const handlePrepare = useCallback(async () => {
    setStatus((current) => ({
      ...current,
      preparing: true,
      error: null,
    }));
    try {
      const result = await invokeIpc('uv:install-all') as {
        success: boolean;
        error?: string;
      };
      if (!result.success) {
        throw new Error(result.error || t('complete.enhancements.prepareFailed'));
      }
      await refreshStatus();
      toast.success(t('complete.enhancements.readyTitle'));
    } catch (error) {
      setStatus((current) => ({
        ...current,
        error: String(error),
      }));
      toast.error(t('complete.enhancements.prepareFailed'));
    } finally {
      setStatus((current) => ({
        ...current,
        preparing: false,
      }));
    }
  }, [refreshStatus, t]);

  const environmentReady = status.uvInstalled && status.pythonReady;

  return (
    <div className="rounded-[1.5rem] border border-border/70 app-insight-surface p-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="space-y-2">
          <div className="text-base font-semibold text-foreground">{t('complete.enhancements.title')}</div>
          <div className="text-sm leading-6 text-muted-foreground">
            {environmentReady
              ? t('complete.enhancements.readyBody')
              : t('complete.enhancements.optionalBody')}
          </div>
        </div>
        {!environmentReady ? (
          <Button
            variant="outline"
            onClick={() => { void handlePrepare(); }}
            disabled={status.loading || status.preparing}
          >
            {status.preparing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t('complete.enhancements.preparing')}
              </>
            ) : (
              t('complete.enhancements.prepareNow')
            )}
          </Button>
        ) : null}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-border/70 app-field-surface p-4">
          <div className="text-sm text-muted-foreground">{t('complete.enhancements.uvLabel')}</div>
          <div className="mt-2 text-sm font-medium text-foreground">
            {status.loading
              ? t('complete.enhancements.checking')
              : status.uvInstalled
                ? t('complete.enhancements.reused')
                : t('complete.enhancements.notReady')}
          </div>
        </div>
        <div className="rounded-2xl border border-border/70 app-field-surface p-4">
          <div className="text-sm text-muted-foreground">{t('complete.enhancements.pythonLabel')}</div>
          <div className="mt-2 text-sm font-medium text-foreground">
            {status.loading
              ? t('complete.enhancements.checking')
              : status.pythonReady
                ? t('complete.enhancements.reused')
                : t('complete.enhancements.notReady')}
          </div>
        </div>
      </div>

      {status.error ? (
        <div className="mt-4 rounded-[18px] border border-red-500/20 bg-[hsl(var(--danger)/0.08)] px-4 py-3 text-sm leading-6 text-destructive">
          {status.error}
        </div>
      ) : null}
    </div>
  );
}

export default Setup;
