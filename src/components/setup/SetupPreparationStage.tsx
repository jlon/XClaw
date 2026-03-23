import { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { AlertCircle, CheckCircle2, ExternalLink, Loader2, RefreshCw, XCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { hostApiFetch } from '@/lib/host-api';
import { invokeIpc } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { useGatewayStore } from '@/stores/gateway';
import type { SetupInspectionSummary, SetupMode, SetupPlanSummary, TakeoverImportSummary } from '@/lib/setup-takeover';
import { setupStageContainerVariants, setupStageItemVariants } from './setup-motion';

interface SetupPreparationStageProps {
  mode: SetupMode;
  onStatusChange: (canProceed: boolean) => void;
  workspacePath: string;
  gatewayPortInput: string;
  onWorkspacePathChange: (value: string) => void;
  onGatewayPortInputChange: (value: string) => void;
  workspaceError: string | null;
  gatewayPortError: string | null;
  plan: SetupPlanSummary | null;
  planLoading: boolean;
  inspection: SetupInspectionSummary | null;
  status: TakeoverImportSummary | null;
  submitting: boolean;
}

const uniq = (values: string[]) => [...new Set(values)];

export function SetupPreparationStage({
  mode,
  onStatusChange,
  workspacePath,
  gatewayPortInput,
  onWorkspacePathChange,
  onGatewayPortInputChange,
  workspaceError,
  gatewayPortError,
  plan,
  planLoading,
  inspection,
  status,
  submitting,
}: SetupPreparationStageProps) {
  return mode === 'fresh' ? (
    <RuntimePreparationContent
      onStatusChange={onStatusChange}
      setupMode={mode}
      workspacePath={workspacePath}
      gatewayPortInput={gatewayPortInput}
      onWorkspacePathChange={onWorkspacePathChange}
      onGatewayPortInputChange={onGatewayPortInputChange}
      workspaceError={workspaceError}
      gatewayPortError={gatewayPortError}
      plan={plan}
      planLoading={planLoading}
    />
  ) : (
    <TakeoverPreparationContent
      inspection={inspection}
      plan={plan}
      status={status}
      submitting={submitting}
    />
  );
}

interface TakeoverPreparationContentProps {
  inspection: SetupInspectionSummary | null;
  plan: SetupPlanSummary | null;
  status: TakeoverImportSummary | null;
  submitting: boolean;
}

function TakeoverPreparationContent({
  inspection,
  plan,
  status,
  submitting,
}: TakeoverPreparationContentProps) {
  const { t } = useTranslation('setup');
  const warnings = uniq([...(plan?.warnings ?? []), ...(inspection?.warnings ?? [])]);
  const blockingIssues = uniq([...(plan?.blockingIssues ?? []), ...(status?.blockingIssues ?? [])]);
  const requiresProviderReview = Boolean(plan?.providerImport?.requiresReview);
  const summaryItems = [
    {
      label: t('takeover.summary.providers'),
      value: String(inspection?.counts?.runtimeProviders ?? 0),
    },
    {
      label: t('takeover.summary.skills'),
      value: String(inspection?.counts?.skills ?? 0),
    },
    {
      label: t('takeover.summary.extensions'),
      value: String(inspection?.counts?.extensions ?? 0),
    },
    {
      label: t('takeover.summary.workspace'),
      value: inspection?.defaultWorkspacePath || inspection?.openClawDir || '-',
      multiline: true,
    },
  ];
  const workspaceSummary = summaryItems.find((item) => item.label === t('takeover.summary.workspace'));
  const factItems = summaryItems.filter((item) => item.label !== t('takeover.summary.workspace'));

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={setupStageContainerVariants}
      className="space-y-5"
    >
      <motion.div variants={setupStageItemVariants} className="space-y-2">
        <h2 className="text-xl font-semibold">{t('takeover.preparation.title')}</h2>
        <p className="text-muted-foreground">{t('takeover.preparation.description')}</p>
      </motion.div>

      <motion.div variants={setupStageItemVariants} className="app-pane-surface rounded-[1.55rem] p-5 xl:p-6">
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
            <div className="app-insight-surface rounded-[1.2rem] p-4">
              <div className="text-xs uppercase tracking-[0.14em] text-muted-foreground/70">{workspaceSummary?.label}</div>
              <div className="mt-2 break-all text-sm font-medium leading-6 text-foreground">
                {workspaceSummary?.value ?? '-'}
              </div>
            </div>
            <div className="grid gap-3 grid-cols-3">
              {factItems.map((item) => (
                <div key={item.label} className="app-insight-surface rounded-[1.2rem] px-4 py-3">
                  <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground/70">{item.label}</div>
                  <div className="mt-2 text-xl font-semibold tracking-[-0.03em] text-foreground">{item.value}</div>
                </div>
              ))}
            </div>
          </div>

          {!submitting ? (
            <div className="text-sm leading-6 text-muted-foreground">
              {t('takeover.preparation.pendingHint')}
            </div>
          ) : null}

          {!submitting && requiresProviderReview ? (
            <div className="rounded-[1.1rem] border border-primary/14 bg-[hsl(var(--surface-base)/0.84)] px-4 py-3 text-sm leading-6 text-muted-foreground">
              {t('takeover.preparation.providerReviewHint')}
            </div>
          ) : null}
        </div>
      </motion.div>

      {blockingIssues.length ? (
        <motion.div variants={setupStageItemVariants} className="rounded-[18px] border border-red-500/20 bg-[hsl(var(--danger)/0.08)] p-4">
          <div className="font-medium text-destructive">{t('takeover.blockingTitle')}</div>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-destructive">
            {blockingIssues.map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
        </motion.div>
      ) : null}

      {warnings.length ? (
        <motion.div variants={setupStageItemVariants} className="app-pane-surface rounded-[1.3rem] p-4">
          <div className="font-medium text-foreground">{t('takeover.warningsTitle')}</div>
          <ul className="mt-2 space-y-1 text-sm leading-6 text-muted-foreground">
            {warnings.map((warning) => (
              <li key={warning}>• {warning}</li>
            ))}
          </ul>
        </motion.div>
      ) : null}

      {status?.error ? (
        <motion.div variants={setupStageItemVariants} className="rounded-[18px] border border-red-500/20 bg-[hsl(var(--danger)/0.08)] p-4 text-sm leading-6 text-destructive">
          {status.error}
        </motion.div>
      ) : null}

      {submitting ? (
        <motion.div variants={setupStageItemVariants} className="rounded-[18px] border border-primary/18 app-insight-surface p-4">
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
        </motion.div>
      ) : null}
    </motion.div>
  );
}

interface RuntimePreparationContentProps {
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

function RuntimePreparationContent({
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
}: RuntimePreparationContentProps) {
  const { t } = useTranslation('setup');
  const gatewayStatus = useGatewayStore((state) => state.status);
  const startGateway = useGatewayStore((state) => state.start);
  const [checks, setChecks] = useState({
    nodejs: { status: 'checking' as 'checking' | 'success' | 'error', message: '' },
    openclaw: { status: 'checking' as 'checking' | 'success' | 'error', message: '' },
    gateway: { status: 'checking' as 'checking' | 'success' | 'error', message: '' },
  });
  const [showLogs, setShowLogs] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [logContent, setLogContent] = useState('');
  const [openclawDir, setOpenclawDir] = useState('');
  const gatewayTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const gatewayAutoStartAttemptedRef = useRef(false);

  const runChecks = useCallback(async () => {
    setChecks({
      nodejs: { status: 'checking', message: '' },
      openclaw: { status: 'checking', message: '' },
      gateway: { status: 'checking', message: '' },
    });

    setChecks((prev) => ({
      ...prev,
      nodejs: { status: 'success', message: t('runtime.status.success') },
    }));

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
            message: t('runtime.status.packageMissingAt', { dir: openclawStatus.dir }),
          },
        }));
      } else if (!openclawStatus.isBuilt) {
        setChecks((prev) => ({
          ...prev,
          openclaw: {
            status: 'error',
            message: t('runtime.status.packageDistMissing'),
          },
        }));
      } else {
        setChecks((prev) => ({
          ...prev,
          openclaw: {
            status: 'success',
            message: openclawStatus.version
              ? t('runtime.status.packageReadyWithVersion', { version: openclawStatus.version })
              : t('runtime.status.packageReady'),
          },
        }));
      }
    } catch (error) {
      setChecks((prev) => ({
        ...prev,
        openclaw: { status: 'error', message: t('runtime.status.checkFailed', { message: String(error) }) },
      }));
    }

    const currentGateway = useGatewayStore.getState().status;
    if (currentGateway.state === 'running') {
      setChecks((prev) => ({
        ...prev,
        gateway: { status: 'success', message: t('runtime.status.gatewayRunning', { port: currentGateway.port }) },
      }));
    } else if (currentGateway.state === 'stopped') {
      setChecks((prev) => ({
        ...prev,
        gateway: { status: 'error', message: t('runtime.status.gatewayStopped') },
      }));
    } else if (currentGateway.state === 'error') {
      setChecks((prev) => ({
        ...prev,
        gateway: { status: 'error', message: currentGateway.error || t('runtime.status.error') },
      }));
    } else {
      setChecks((prev) => ({
        ...prev,
        gateway: {
          status: 'checking',
          message: currentGateway.state === 'starting' ? t('runtime.status.gatewayStarting') : t('runtime.status.gatewayWaiting'),
        },
      }));
    }
  }, [t]);

  useEffect(() => {
    void runChecks();
  }, [runChecks]);

  useEffect(() => {
    const allPassed = checks.nodejs.status === 'success'
      && checks.openclaw.status === 'success'
      && (checks.gateway.status === 'success' || gatewayStatus.state === 'running');
    onStatusChange(allPassed);
  }, [checks, gatewayStatus, onStatusChange]);

  useEffect(() => {
    if (gatewayStatus.state === 'running') {
      setChecks((prev) => ({
        ...prev,
        gateway: { status: 'success', message: t('runtime.status.gatewayRunning', { port: gatewayStatus.port }) },
      }));
    } else if (gatewayStatus.state === 'stopped') {
      setChecks((prev) => ({
        ...prev,
        gateway: { status: 'error', message: t('runtime.status.gatewayStopped') },
      }));
    } else if (gatewayStatus.state === 'error') {
      setChecks((prev) => ({
        ...prev,
        gateway: { status: 'error', message: gatewayStatus.error || t('runtime.status.gatewayStartFailed') },
      }));
    } else if (gatewayStatus.state === 'starting' || gatewayStatus.state === 'reconnecting') {
      setChecks((prev) => ({
        ...prev,
        gateway: { status: 'checking', message: t('runtime.status.gatewayStarting') },
      }));
    }
  }, [gatewayStatus, t]);

  useEffect(() => {
    if (gatewayTimeoutRef.current) {
      clearTimeout(gatewayTimeoutRef.current);
      gatewayTimeoutRef.current = null;
    }

    if (gatewayStatus.state === 'running' || gatewayStatus.state === 'error') {
      return;
    }

    if (gatewayStatus.state !== 'starting' && gatewayStatus.state !== 'reconnecting') {
      return;
    }

    gatewayTimeoutRef.current = setTimeout(() => {
      setChecks((prev) => {
        if (prev.gateway.status === 'checking') {
          return {
            ...prev,
            gateway: { status: 'error', message: t('runtime.status.gatewayStartTimedOut') },
          };
        }
        return prev;
      });
    }, 600 * 1000);

    return () => {
      if (gatewayTimeoutRef.current) {
        clearTimeout(gatewayTimeoutRef.current);
        gatewayTimeoutRef.current = null;
      }
    };
  }, [gatewayStatus.state, t]);

  const handleStartGateway = useCallback(async () => {
    setChecks((prev) => ({
      ...prev,
      gateway: { status: 'checking', message: t('runtime.status.gatewayStarting') },
    }));
    await startGateway();
  }, [startGateway, t]);

  useEffect(() => {
    if (gatewayStatus.state === 'running' || gatewayStatus.state === 'starting' || gatewayStatus.state === 'reconnecting') {
      gatewayAutoStartAttemptedRef.current = true;
      return;
    }

    if (gatewayStatus.state !== 'stopped') {
      return;
    }

    if (gatewayAutoStartAttemptedRef.current) {
      return;
    }

    if (checks.nodejs.status !== 'success' || checks.openclaw.status !== 'success') {
      return;
    }

    gatewayAutoStartAttemptedRef.current = true;
    void handleStartGateway();
  }, [checks.nodejs.status, checks.openclaw.status, gatewayStatus.state, handleStartGateway]);

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
      return;
    }
  };

  const renderStatus = (status: 'checking' | 'success' | 'error', message: string) => {
    if (status === 'checking') {
      return (
        <span className="flex items-center gap-2 whitespace-nowrap text-yellow-400">
          <Loader2 className="h-5 w-5 flex-shrink-0 animate-spin" />
          {message || 'Checking...'}
        </span>
      );
    }
    if (status === 'success') {
      return (
        <span className="flex items-center gap-2 whitespace-nowrap text-green-400">
          <CheckCircle2 className="h-5 w-5 flex-shrink-0" />
          {message}
        </span>
      );
    }

    const isLong = message.length > 30;
    const displayMsg = isLong ? message.slice(0, 30) : message;

    return (
      <span className="flex items-center gap-2 whitespace-nowrap text-red-400">
        <XCircle className="h-5 w-5 flex-shrink-0" />
        <span>{displayMsg}</span>
        {isLong ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="cursor-pointer font-medium text-red-300 hover:text-red-200">...</span>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-sm whitespace-normal break-words text-xs">
              {message}
            </TooltipContent>
          </Tooltip>
        ) : null}
      </span>
    );
  };

  const readinessToneClass = (status: 'checking' | 'success' | 'error') => {
    if (status === 'success') {
      return 'text-emerald-300';
    }
    if (status === 'error') {
      return 'text-rose-300';
    }
    return 'text-amber-200';
  };

  const readinessLabel = (
    key: 'nodejs' | 'openclaw' | 'gateway',
    status: 'checking' | 'success' | 'error',
  ) => {
    if (status === 'success') {
      return t('runtime.summary.ready');
    }
    if (status === 'error') {
      if (key === 'gateway' && gatewayStatus.state === 'stopped') {
        return t('runtime.summary.gatewayStopped');
      }
      return t('runtime.summary.attention');
    }
    return t('runtime.status.checking');
  };

  const readinessSummary = [
    {
      key: 'nodejs',
      label: t('runtime.nodejs'),
      status: checks.nodejs.status,
      message: checks.nodejs.message,
    },
    {
      key: 'openclaw',
      label: t('runtime.openclaw'),
      status: checks.openclaw.status,
      message: checks.openclaw.message,
    },
    {
      key: 'gateway',
      label: t('runtime.gateway'),
      status: checks.gateway.status,
      message: checks.gateway.message,
    },
  ] as const;

  return (
    <div className="space-y-5">
      {setupMode === 'fresh' ? (
        <div className="app-pane-surface space-y-4 rounded-[1.55rem] p-5 xl:p-6">
          <div className="space-y-1">
            <h3 className="font-medium">{t('runtime.setup.title')}</h3>
            <p className="text-sm text-muted-foreground">{t('runtime.setup.description')}</p>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="setup-workspace-path">{t('runtime.setup.workspaceLabel')}</Label>
              <Input
                id="setup-workspace-path"
                value={workspacePath}
                onChange={(event) => onWorkspacePathChange(event.target.value)}
                placeholder={t('runtime.setup.workspacePlaceholder')}
              />
              <p className="text-xs text-muted-foreground">{t('runtime.setup.workspaceHint')}</p>
              {workspaceError ? <p className="text-xs text-red-400">{workspaceError}</p> : null}
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
              {gatewayPortError ? <p className="text-xs text-red-400">{gatewayPortError}</p> : null}
            </div>
          </div>

          {planLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t('runtime.setup.planChecking')}
            </div>
          ) : null}

          {plan?.blockingIssues.length ? (
            <div className="app-pane-surface rounded-[1.3rem] border-red-500/18 p-4">
              <div className="font-medium text-foreground">{t('runtime.setup.blockingTitle')}</div>
              <ul className="mt-2 space-y-1 text-sm leading-6 text-muted-foreground">
                {plan.blockingIssues.map((issue) => (
                  <li key={issue}>• {issue}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {plan?.warnings.length ? (
            <div className="app-pane-surface rounded-[1.3rem] p-4">
              <div className="font-medium text-foreground">{t('runtime.setup.warningsTitle')}</div>
              <ul className="mt-2 space-y-1 text-sm leading-6 text-muted-foreground">
                {plan.warnings.map((warning) => (
                  <li key={warning}>• {warning}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="app-pane-surface space-y-4 rounded-[1.55rem] p-5 xl:p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <h2 className="text-xl font-semibold">{t('runtime.title')}</h2>
            <p className="text-sm leading-6 text-muted-foreground">{t('runtime.summary.description')}</p>
          </div>
          <div className="rounded-[12px] border border-border/70 bg-background/70 px-3 py-1 text-xs font-medium text-muted-foreground">
            {checks.nodejs.status === 'success' && checks.openclaw.status === 'success' && (checks.gateway.status === 'success' || gatewayStatus.state === 'running')
              ? t('runtime.summary.ready')
              : gatewayStatus.state === 'stopped'
                ? t('runtime.summary.gatewayStopped')
                : t('runtime.summary.attention')}
          </div>
        </div>
        <div className="grid gap-3">
          {readinessSummary.map((item) => (
            <div key={item.key} className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 rounded-[1.15rem] app-insight-surface px-4 py-3">
              <div className="min-w-0">
                <div className="text-sm font-medium text-foreground">{item.label}</div>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">{item.message}</p>
              </div>
              <div className={cn('mt-0.5 rounded-full border px-2.5 py-1 text-xs font-medium', readinessToneClass(item.status))}>
                {readinessLabel(item.key, item.status)}
              </div>
            </div>
          ))}
        </div>
      </div>

      {checks.nodejs.status === 'error' || checks.openclaw.status === 'error' ? (
        <div className="mt-4 rounded-[18px] border border-red-500/20 bg-[hsl(var(--danger))/0.08] p-4">
          <div className="flex items-start gap-2">
            <AlertCircle className="mt-0.5 h-5 w-5 text-red-400" />
            <div>
              <p className="font-medium text-red-700 dark:text-red-200">{t('runtime.issue.title')}</p>
              <p className="mt-1 text-sm leading-6 text-red-800 dark:text-red-100">
                {t('runtime.issue.desc')}
              </p>
            </div>
          </div>
        </div>
      ) : null}

      <div className="rounded-[18px] app-insight-surface p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <div className="text-sm font-medium text-foreground">{t('runtime.advanced.title')}</div>
            <p className="text-sm leading-6 text-muted-foreground">
              {advancedOpen ? t('runtime.advanced.descriptionOpen') : t('runtime.advanced.description')}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setAdvancedOpen((value) => !value)}
          >
            {advancedOpen ? t('runtime.advanced.hide') : t('runtime.advanced.toggle')}
          </Button>
        </div>

        {advancedOpen ? (
          <div className="mt-4 space-y-4">
            <div className="flex flex-wrap gap-2">
              <Button variant="ghost" size="sm" onClick={handleShowLogs}>
                {t('runtime.viewLogs')}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => { void runChecks(); }}>
                <RefreshCw className="mr-2 h-4 w-4" />
                {t('runtime.recheck')}
              </Button>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-[1fr_auto] items-center gap-4 rounded-2xl border border-border/70 app-field-surface p-3">
                <span className="text-left">{t('runtime.nodejs')}</span>
                <div className="flex justify-end">
                  {renderStatus(checks.nodejs.status, checks.nodejs.message)}
                </div>
              </div>
              <div className="grid grid-cols-[1fr_auto] items-center gap-4 rounded-2xl border border-border/70 app-field-surface p-3">
                <div className="min-w-0 text-left">
                  <span>{t('runtime.openclaw')}</span>
                  {openclawDir ? (
                    <p className="mt-0.5 break-all font-mono text-xs text-muted-foreground">
                      {openclawDir}
                    </p>
                  ) : null}
                </div>
                <div className="mt-0.5 flex justify-end self-start">
                  {renderStatus(checks.openclaw.status, checks.openclaw.message)}
                </div>
              </div>
              <div className="grid grid-cols-[1fr_auto] items-center gap-4 rounded-2xl border border-border/70 app-field-surface p-3">
                <div className="flex items-center gap-2 text-left">
                  <span>{t('runtime.gateway')}</span>
                  {checks.gateway.status === 'error' ? (
                    <Button variant="outline" size="sm" onClick={handleStartGateway}>
                      {t('runtime.startGateway')}
                    </Button>
                  ) : null}
                </div>
                <div className="flex justify-end">
                  {renderStatus(checks.gateway.status, checks.gateway.message)}
                </div>
              </div>
            </div>

            {showLogs ? (
              <div className="rounded-2xl border border-border/70 app-panel-surface-elevated p-4">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-sm font-medium text-foreground">{t('runtime.logs.title')}</p>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={handleOpenLogDir}>
                      <ExternalLink className="mr-1 h-3 w-3" />
                      {t('runtime.logs.openFolder')}
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setShowLogs(false)}>
                      {t('runtime.logs.close')}
                    </Button>
                  </div>
                </div>
                <pre className="max-h-60 overflow-auto whitespace-pre-wrap rounded-2xl border border-border/70 app-field-surface p-3 font-mono text-xs text-foreground/80">
                  {logContent || t('runtime.logs.noLogs')}
                </pre>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
