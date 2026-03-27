/**
 * Settings Page
 * Application configuration
 */
import { useEffect, useMemo, useState } from 'react';
import {
  Sun,
  Moon,
  Monitor,
  RefreshCw,
  ExternalLink,
  Copy,
  FileText,
  Download,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { useSettingsStore } from '@/stores/settings';
import { useGatewayStore } from '@/stores/gateway';
import { WorkspacePageFrame, WorkspacePageScrollArea, WorkspacePageShell } from '@/components/layout/WorkspacePage';
import { UpdateSettings } from '@/components/settings/UpdateSettings';
import { WorkbenchSummaryStrip } from '@/components/layout/WorkbenchSummaryStrip';
import {
  getGatewayWsDiagnosticEnabled,
  invokeIpc,
  setGatewayWsDiagnosticEnabled,
  toUserMessage,
} from '@/lib/api-client';
import {
  clearUiTelemetry,
  getUiTelemetrySnapshot,
  subscribeUiTelemetry,
  trackUiEvent,
  type UiTelemetryEntry,
} from '@/lib/telemetry';
import { useTranslation } from 'react-i18next';
import { SUPPORTED_LANGUAGES } from '@/i18n';
import { hostApiFetch } from '@/lib/host-api';
import { cn } from '@/lib/utils';
type ControlUiInfo = {
  url: string;
  token: string;
  port: number;
};

const settingsPaneClass =
  'space-y-3 rounded-xl border border-[hsl(var(--chrome-divider))] bg-[hsl(var(--surface-base))] p-4 shadow-sm';
const settingsLabelClass = 'text-[13px] font-medium text-foreground/84 select-none';
const settingsChoiceButtonBaseClass =
  'workbench-motion-button h-[32px] flex-1 items-center justify-center gap-1.5 rounded-[6px] border px-3 text-[13px] font-medium shadow-none transition-colors duration-[var(--motion-fast)] md:flex-none select-none cursor-default';
const settingsChoiceButtonActiveClass =
  'border-transparent bg-[hsl(var(--surface-active))] text-foreground shadow-none';
const settingsChoiceButtonIdleClass =
  'border-transparent bg-transparent text-muted-foreground hover:bg-[hsl(var(--surface-hover))] hover:text-foreground';
const settingsInputClass =
  'h-[32px] rounded-[6px] border border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface-base))] px-3 py-1 text-[13px] text-foreground shadow-none placeholder:text-muted-foreground focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(var(--glow-brand),0.25)] focus-visible:border-[hsl(var(--border-subtle))] transition-[border-color,box-shadow,background-color] duration-[var(--motion-fast)] ease-out';
const settingsCodeInputClass =
  'h-[32px] rounded-[6px] border border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface-base))] px-3 py-1 font-mono text-[13px] text-foreground shadow-none placeholder:text-muted-foreground focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(var(--glow-brand),0.25)] focus-visible:border-[hsl(var(--border-subtle))] transition-[border-color,box-shadow,background-color] duration-[var(--motion-fast)] ease-out tabular-nums';
const settingsSegmentedShellClass =
  'inline-flex w-full flex-wrap gap-[2px] md:w-fit rounded-[8px] bg-[hsl(var(--surface-panel))] p-[2px] border border-[hsl(var(--border-subtle))]';
const settingsCompactControlRowClass =
  'grid gap-3 py-1.5 md:grid-cols-[minmax(0,160px)_minmax(0,1fr)] md:items-center';
const settingsCompactRowTextClass = 'min-w-0 max-w-[220px] space-y-0 md:pr-2 select-none';
const settingsCompactRowLabelClass = 'text-[13px] font-medium text-foreground/86 select-none';
const settingsCompactToggleRowClass =
  'grid gap-3 py-1.5 md:grid-cols-[minmax(0,160px)_minmax(0,1fr)] md:items-center';
const settingsGhostButtonClass =
  'workbench-motion-button h-[32px] rounded-[6px] border border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface-base))] px-4 text-[13px] font-medium text-foreground shadow-none hover:bg-[hsl(var(--surface-hover))] select-none cursor-default transition-colors duration-[var(--motion-fast)]';
const settingsFactsStripClass =
  'border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface-panel)/0.82)] select-none rounded-[6px]';
const settingsTabsSurfaceClass =
  'select-none';
const settingsTabsListClass =
  'inline-flex h-auto w-auto flex-wrap items-center rounded-[8px] border border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface-panel))] p-[2px] select-none';
const settingsTabsTriggerClass =
  'workbench-motion-button h-[30px] rounded-[6px] border border-transparent bg-transparent px-4 text-[13px] font-semibold text-muted-foreground shadow-none hover:text-foreground data-[state=active]:border-transparent data-[state=active]:bg-[hsl(var(--surface-base))] data-[state=active]:text-foreground data-[state=active]:shadow-sm select-none cursor-default transition-[color,background-color,box-shadow,border-color] duration-[var(--motion-base)] ease-out';
const settingsPaneDividerClass = 'border-t border-[hsl(var(--border-subtle))] pt-4';
const settingsControlDockClass = 'flex w-full items-center justify-start md:justify-end';
const settingsControlTrackClass = 'w-full md:max-w-[320px]';

type SettingsSectionId = 'appearance' | 'runtime' | 'updates' | 'developer';

export function Settings() {
  const { t } = useTranslation('settings');
  const {
    theme,
    setTheme,
    language,
    setLanguage,
    launchAtStartup,
    setLaunchAtStartup,
    gatewayAutoStart,
    setGatewayAutoStart,
    proxyEnabled,
    proxyServer,
    proxyHttpServer,
    proxyHttpsServer,
    proxyAllServer,
    proxyBypassRules,
    setProxyEnabled,
    setProxyServer,
    setProxyHttpServer,
    setProxyHttpsServer,
    setProxyAllServer,
    setProxyBypassRules,
    devModeUnlocked,
    setDevModeUnlocked,
    telemetryEnabled,
    setTelemetryEnabled,
  } = useSettingsStore();

  const { status: gatewayStatus, restart: restartGateway } = useGatewayStore();
  const [controlUiInfo, setControlUiInfo] = useState<ControlUiInfo | null>(null);
  const [openclawCliCommand, setOpenclawCliCommand] = useState('');
  const [openclawCliError, setOpenclawCliError] = useState<string | null>(null);
  const [proxyServerDraft, setProxyServerDraft] = useState('');
  const [proxyHttpServerDraft, setProxyHttpServerDraft] = useState('');
  const [proxyHttpsServerDraft, setProxyHttpsServerDraft] = useState('');
  const [proxyAllServerDraft, setProxyAllServerDraft] = useState('');
  const [proxyBypassRulesDraft, setProxyBypassRulesDraft] = useState('');
  const [proxyEnabledDraft, setProxyEnabledDraft] = useState(false);
  const [showAdvancedProxyFields, setShowAdvancedProxyFields] = useState(
    () => Boolean(proxyHttpServer || proxyHttpsServer || proxyAllServer || proxyBypassRules),
  );
  const [savingProxy, setSavingProxy] = useState(false);
  const [wsDiagnosticEnabled, setWsDiagnosticEnabled] = useState(false);
  const [showTelemetryViewer, setShowTelemetryViewer] = useState(false);
  const [telemetryEntries, setTelemetryEntries] = useState<UiTelemetryEntry[]>([]);

  const isWindows =
    (window.electron?.platform ??
      (navigator.userAgent.includes('Windows') ? 'win32' : navigator.platform.toLowerCase())) ===
    'win32';
  const showCliTools = true;
  const [showLogs, setShowLogs] = useState(false);
  const [logContent, setLogContent] = useState('');
  const [exportingLogBundle, setExportingLogBundle] = useState(false);
  const [showDoctorRawOutput, setShowDoctorRawOutput] = useState(false);
  const [showTelemetryRawEvents, setShowTelemetryRawEvents] = useState(false);
  const [doctorRunningMode, setDoctorRunningMode] = useState<'diagnose' | 'fix' | null>(null);
  const [doctorResult, setDoctorResult] = useState<{
    mode: 'diagnose' | 'fix';
    success: boolean;
    exitCode: number | null;
    stdout: string;
    stderr: string;
    command: string;
    cwd: string;
    durationMs: number;
    timedOut?: boolean;
    error?: string;
  } | null>(null);
  const [activeSection, setActiveSection] = useState<SettingsSectionId>('appearance');

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

  const handleCopyLogContent = async () => {
    if (!logContent) return;
    try {
      await navigator.clipboard.writeText(logContent);
      toast.success(t('gateway.logsCopied'));
    } catch (error) {
      toast.error(`${t('common:status.error')}: ${String(error)}`);
    }
  };

  const handleExportLogBundle = async () => {
    setExportingLogBundle(true);
    try {
      const result = await hostApiFetch<{
        success: boolean;
        canceled?: boolean;
        savedPath?: string;
        fileCount?: number;
      }>('/api/logs/export', {
        method: 'POST',
        body: JSON.stringify({}),
      });
      if (!result.success) {
        return;
      }
      toast.success(t('gateway.logsExported', { count: result.fileCount ?? 0 }));
    } catch (error) {
      const message = toUserMessage(error) || t('gateway.logsExportFailed');
      toast.error(message);
    } finally {
      setExportingLogBundle(false);
    }
  };

  const handleRunOpenClawDoctor = async (mode: 'diagnose' | 'fix') => {
    setDoctorRunningMode(mode);
    try {
      const result = await hostApiFetch<{
        mode: 'diagnose' | 'fix';
        success: boolean;
        exitCode: number | null;
        stdout: string;
        stderr: string;
        command: string;
        cwd: string;
        durationMs: number;
        timedOut?: boolean;
        error?: string;
      }>('/api/app/openclaw-doctor', {
        method: 'POST',
        body: JSON.stringify({ mode }),
      });
      setDoctorResult(result);
      setShowDoctorRawOutput(false);
      if (result.success) {
        toast.success(mode === 'fix' ? t('developer.doctorFixSucceeded') : t('developer.doctorSucceeded'));
      } else {
        toast.error(result.error || (mode === 'fix' ? t('developer.doctorFixFailed') : t('developer.doctorFailed')));
      }
    } catch (error) {
      const message = toUserMessage(error) || (mode === 'fix' ? t('developer.doctorFixRunFailed') : t('developer.doctorRunFailed'));
      toast.error(message);
      setDoctorResult({
        mode,
        success: false,
        exitCode: null,
        stdout: '',
        stderr: '',
        command: 'openclaw doctor',
        cwd: '',
        durationMs: 0,
        error: message,
      });
    } finally {
      setDoctorRunningMode(null);
    }
  };

  const handleCopyDoctorOutput = async () => {
    if (!doctorResult) return;
    const payload = [
      `command: ${doctorResult.command}`,
      `cwd: ${doctorResult.cwd}`,
      `exitCode: ${doctorResult.exitCode ?? 'null'}`,
      `durationMs: ${doctorResult.durationMs}`,
      '',
      '[stdout]',
      doctorResult.stdout.trim() || '(empty)',
      '',
      '[stderr]',
      doctorResult.stderr.trim() || '(empty)',
    ].join('\n');

    try {
      await navigator.clipboard.writeText(payload);
      toast.success(t('developer.doctorCopied'));
    } catch (error) {
      toast.error(`Failed to copy doctor output: ${String(error)}`);
    }
  };



  const refreshControlUiInfo = async (): Promise<ControlUiInfo | null> => {
    try {
      const result = await hostApiFetch<{
        success: boolean;
        url?: string;
        token?: string;
        port?: number;
      }>('/api/gateway/control-ui');
      if (result.success && result.url && result.token && typeof result.port === 'number') {
        const nextInfo = { url: result.url, token: result.token, port: result.port };
        setControlUiInfo(nextInfo);
        return nextInfo;
      }
    } catch {
      return null;
    }
    return null;
  };

  const handleCopyGatewayToken = async () => {
    if (!controlUiInfo?.token) return;
    try {
      await navigator.clipboard.writeText(controlUiInfo.token);
      toast.success(t('developer.tokenCopied'));
    } catch (error) {
      toast.error(`Failed to copy token: ${String(error)}`);
    }
  };

  useEffect(() => {
    if (!showCliTools) return;
    let cancelled = false;

    (async () => {
      try {
        const result = await invokeIpc<{
          success: boolean;
          command?: string;
          error?: string;
        }>('openclaw:getCliCommand');
        if (cancelled) return;
        if (result.success && result.command) {
          setOpenclawCliCommand(result.command);
          setOpenclawCliError(null);
        } else {
          setOpenclawCliCommand('');
          setOpenclawCliError(result.error || 'OpenClaw CLI unavailable');
        }
      } catch (error) {
        if (cancelled) return;
        setOpenclawCliCommand('');
        setOpenclawCliError(String(error));
      }
    })();

    return () => { cancelled = true; };
  }, [devModeUnlocked, showCliTools]);

  const handleCopyCliCommand = async () => {
    if (!openclawCliCommand) return;
    try {
      await navigator.clipboard.writeText(openclawCliCommand);
      toast.success(t('developer.cmdCopied'));
    } catch (error) {
      toast.error(`Failed to copy command: ${String(error)}`);
    }
  };

  useEffect(() => {
    const unsubscribe = window.electron?.ipcRenderer?.on(
      'openclaw:cli-installed',
      (...args: unknown[]) => {
        const installedPath = typeof args[0] === 'string' ? args[0] : '';
        toast.success(`openclaw CLI installed at ${installedPath}`);
      },
    );
    return () => { unsubscribe?.(); };
  }, []);

  useEffect(() => {
    setWsDiagnosticEnabled(getGatewayWsDiagnosticEnabled());
  }, []);

  useEffect(() => {
    if (!devModeUnlocked) return;
    setTelemetryEntries(getUiTelemetrySnapshot(200));
    const unsubscribe = subscribeUiTelemetry((entry) => {
      setTelemetryEntries((prev) => {
        const next = [...prev, entry];
        if (next.length > 200) {
          next.splice(0, next.length - 200);
        }
        return next;
      });
    });
    return unsubscribe;
  }, [devModeUnlocked]);

  useEffect(() => {
    if (!devModeUnlocked) return;
    void refreshControlUiInfo();
  }, [devModeUnlocked]);

  useEffect(() => {
    setProxyEnabledDraft(proxyEnabled);
  }, [proxyEnabled]);

  useEffect(() => {
    setProxyServerDraft(proxyServer);
  }, [proxyServer]);

  useEffect(() => {
    setProxyHttpServerDraft(proxyHttpServer);
  }, [proxyHttpServer]);

  useEffect(() => {
    setProxyHttpsServerDraft(proxyHttpsServer);
  }, [proxyHttpsServer]);

  useEffect(() => {
    setProxyAllServerDraft(proxyAllServer);
  }, [proxyAllServer]);

  useEffect(() => {
    setProxyBypassRulesDraft(proxyBypassRules);
  }, [proxyBypassRules]);

  const handleSaveProxySettings = async () => {
    setSavingProxy(true);
    try {
      const normalizedProxyServer = proxyServerDraft.trim();
      const normalizedHttpServer = proxyHttpServerDraft.trim();
      const normalizedHttpsServer = proxyHttpsServerDraft.trim();
      const normalizedAllServer = proxyAllServerDraft.trim();
      const normalizedBypassRules = proxyBypassRulesDraft.trim();
      await invokeIpc('settings:setMany', {
        proxyEnabled: proxyEnabledDraft,
        proxyServer: normalizedProxyServer,
        proxyHttpServer: normalizedHttpServer,
        proxyHttpsServer: normalizedHttpsServer,
        proxyAllServer: normalizedAllServer,
        proxyBypassRules: normalizedBypassRules,
      });

      setProxyServer(normalizedProxyServer);
      setProxyHttpServer(normalizedHttpServer);
      setProxyHttpsServer(normalizedHttpsServer);
      setProxyAllServer(normalizedAllServer);
      setProxyBypassRules(normalizedBypassRules);
      setProxyEnabled(proxyEnabledDraft);

      toast.success(t('gateway.proxySaved'));
      trackUiEvent('settings.proxy_saved', { enabled: proxyEnabledDraft });
    } catch (error) {
      toast.error(`${t('gateway.proxySaveFailed')}: ${toUserMessage(error)}`);
    } finally {
      setSavingProxy(false);
    }
  };

  const telemetryStats = useMemo(() => {
    let errorCount = 0;
    let slowCount = 0;
    for (const entry of telemetryEntries) {
      if (entry.event.endsWith('_error') || entry.event.includes('request_error')) {
        errorCount += 1;
      }
      const durationMs = typeof entry.payload.durationMs === 'number'
        ? entry.payload.durationMs
        : Number.NaN;
      if (Number.isFinite(durationMs) && durationMs >= 800) {
        slowCount += 1;
      }
    }
    return { total: telemetryEntries.length, errorCount, slowCount };
  }, [telemetryEntries]);

  const telemetryByEvent = useMemo(() => {
    const map = new Map<string, {
      event: string;
      count: number;
      errorCount: number;
      slowCount: number;
      totalDuration: number;
      timedCount: number;
      lastTs: string;
    }>();

    for (const entry of telemetryEntries) {
      const current = map.get(entry.event) ?? {
        event: entry.event,
        count: 0,
        errorCount: 0,
        slowCount: 0,
        totalDuration: 0,
        timedCount: 0,
        lastTs: entry.ts,
      };

      current.count += 1;
      current.lastTs = entry.ts;

      if (entry.event.endsWith('_error') || entry.event.includes('request_error')) {
        current.errorCount += 1;
      }

      const durationMs = typeof entry.payload.durationMs === 'number'
        ? entry.payload.durationMs
        : Number.NaN;
      if (Number.isFinite(durationMs)) {
        current.totalDuration += durationMs;
        current.timedCount += 1;
        if (durationMs >= 800) {
          current.slowCount += 1;
        }
      }

      map.set(entry.event, current);
    }

    return [...map.values()]
      .sort((a, b) => b.count - a.count)
      .slice(0, 12);
  }, [telemetryEntries]);

  const handleCopyTelemetry = async () => {
    try {
      const serialized = telemetryEntries.map((entry) => JSON.stringify(entry)).join('\n');
      await navigator.clipboard.writeText(serialized);
      toast.success(t('developer.telemetryCopied'));
    } catch (error) {
      toast.error(`${t('common:status.error')}: ${String(error)}`);
    }
  };

  const handleClearTelemetry = () => {
    clearUiTelemetry();
    setTelemetryEntries([]);
    setShowTelemetryRawEvents(false);
    toast.success(t('developer.telemetryCleared'));
  };

  const handleWsDiagnosticToggle = (enabled: boolean) => {
    setGatewayWsDiagnosticEnabled(enabled);
    setWsDiagnosticEnabled(enabled);
    toast.success(
      enabled
        ? t('developer.wsDiagnosticEnabled')
        : t('developer.wsDiagnosticDisabled'),
    );
  };

  const handleOpenControlConsole = async () => {
    const nextInfo = controlUiInfo ?? await refreshControlUiInfo();
    if (!nextInfo?.url) {
      return;
    }
    window.electron.openExternal(nextInfo.url);
  };

  const settingsSections = useMemo(() => (
    [
      { id: 'appearance' as const, label: t('appearance.title') },
      { id: 'runtime' as const, label: t('gateway.title') },
      { id: 'updates' as const, label: t('updates.title') },
      ...(devModeUnlocked ? [{ id: 'developer' as const, label: t('developer.title') }] : []),
    ]
  ), [devModeUnlocked, t]);

  useEffect(() => {
    if (settingsSections.some((section) => section.id === activeSection)) return;
    setActiveSection(settingsSections[0]?.id ?? 'appearance');
  }, [activeSection, settingsSections]);

  const gatewayStateLabel = gatewayStatus.state === 'running'
    ? t('common:status.running')
    : gatewayStatus.state === 'error'
      ? t('common:status.error')
      : t('common:status.stopped');
  const gatewayAutoStartLabel = gatewayAutoStart ? t('common:status.enabled') : t('common:status.disabled');
  const runtimeSummaryItems = useMemo(() => {
    const stateTone = gatewayStatus.state === 'running'
      ? 'success'
      : gatewayStatus.state === 'error'
        ? 'danger'
        : 'warning';
    const autoStartTone = gatewayAutoStart ? 'success' : 'warning';

    return [
      {
        id: 'status',
        icon: <span className="h-2.5 w-2.5 rounded-full bg-current" aria-hidden="true" />,
        label: t('gateway.status'),
        value: gatewayStateLabel,
        tone: stateTone as 'success' | 'warning' | 'danger',
      },
      {
        id: 'port',
        icon: <span className="text-[10px] font-semibold leading-none">#</span>,
        label: t('gateway.port'),
        value: gatewayStatus.port,
        tone: 'neutral' as const,
      },
      {
        id: 'auto-start',
        icon: <span className="text-[10px] font-semibold leading-none">A</span>,
        label: t('gateway.autoStart'),
        value: gatewayAutoStartLabel,
        tone: autoStartTone as 'success' | 'warning',
      },
    ];
  }, [gatewayAutoStart, gatewayAutoStartLabel, gatewayStateLabel, gatewayStatus.port, gatewayStatus.state, t]);
  const doctorSummaryItems = useMemo(() => {
    if (!doctorResult) {
      return [];
    }

    return [
      {
        id: 'doctor-status',
        icon: <span className="h-2.5 w-2.5 rounded-full bg-current" aria-hidden="true" />,
        label: doctorResult.mode === 'fix' ? t('developer.runDoctorFix') : t('developer.runDoctor'),
        value: doctorResult.success
          ? (doctorResult.mode === 'fix' ? t('developer.doctorFixOk') : t('developer.doctorOk'))
          : (doctorResult.mode === 'fix' ? t('developer.doctorFixIssue') : t('developer.doctorIssue')),
        tone: doctorResult.success ? 'success' as const : 'danger' as const,
      },
      {
        id: 'doctor-exit',
        icon: <span className="text-[10px] font-semibold leading-none">#</span>,
        label: t('developer.doctorExitCode'),
        value: doctorResult.exitCode ?? 'null',
        tone: 'neutral' as const,
      },
      {
        id: 'doctor-duration',
        icon: <span className="text-[10px] font-semibold leading-none">T</span>,
        label: t('developer.doctorDuration'),
        value: `${Math.round(doctorResult.durationMs)}ms`,
        tone: 'neutral' as const,
      },
    ];
  }, [doctorResult, t]);
  const telemetrySummaryItems = useMemo(() => [
    {
      id: 'telemetry-total',
      icon: <span className="text-[10px] font-semibold leading-none">N</span>,
      label: t('developer.telemetryTotal'),
      value: telemetryStats.total,
      tone: 'neutral' as const,
    },
    {
      id: 'telemetry-errors',
      icon: <span className="h-2.5 w-2.5 rounded-full bg-current" aria-hidden="true" />,
      label: t('developer.telemetryErrors'),
      value: telemetryStats.errorCount,
      tone: telemetryStats.errorCount > 0 ? 'danger' as const : 'success' as const,
    },
    {
      id: 'telemetry-slow',
      icon: <span className="text-[10px] font-semibold leading-none">S</span>,
      label: t('developer.telemetrySlow'),
      value: telemetryStats.slowCount,
      tone: telemetryStats.slowCount > 0 ? 'warning' as const : 'neutral' as const,
    },
  ], [t, telemetryStats.errorCount, telemetryStats.slowCount, telemetryStats.total]);
  return (
    <WorkspacePageFrame>
      <WorkspacePageShell>
        <WorkspacePageScrollArea
          className="space-y-6"
          platform={isWindows ? 'win32' : 'darwin'}
        >
          <div className="space-y-4">
            <Tabs
              value={activeSection}
              onValueChange={(value) => setActiveSection(value as SettingsSectionId)}
              className="space-y-4"
            >
              <div className={settingsTabsSurfaceClass}>
                <TabsList className={settingsTabsListClass}>
                  {settingsSections.map((section) => (
                    <TabsTrigger
                      key={section.id}
                      value={section.id}
                      className={settingsTabsTriggerClass}
                    >
                      {section.label}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </div>

              <TabsContent value="appearance" className="mt-0">
                <section className={settingsPaneClass}>
                  <div className="space-y-3">
                    <div className={settingsCompactControlRowClass}>
                      <div className={settingsCompactRowTextClass}>
                        <Label className={settingsCompactRowLabelClass}>{t('appearance.theme')}</Label>
                      </div>
                      <div className={settingsControlDockClass}>
                        <div className={cn(settingsSegmentedShellClass, settingsControlTrackClass)}>
                          <Button
                            variant="ghost"
                            className={cn(
                              settingsChoiceButtonBaseClass,
                              theme === 'light' ? settingsChoiceButtonActiveClass : settingsChoiceButtonIdleClass,
                            )}
                            onClick={() => setTheme('light')}
                          >
                            <Sun className="mr-1.5 h-3.5 w-3.5" />
                            {t('appearance.light')}
                          </Button>
                          <Button
                            variant="ghost"
                            className={cn(
                              settingsChoiceButtonBaseClass,
                              theme === 'dark' ? settingsChoiceButtonActiveClass : settingsChoiceButtonIdleClass,
                            )}
                            onClick={() => setTheme('dark')}
                          >
                            <Moon className="mr-1.5 h-3.5 w-3.5" />
                            {t('appearance.dark')}
                          </Button>
                          <Button
                            variant="ghost"
                            className={cn(
                              settingsChoiceButtonBaseClass,
                              theme === 'system' ? settingsChoiceButtonActiveClass : settingsChoiceButtonIdleClass,
                            )}
                            onClick={() => setTheme('system')}
                          >
                            <Monitor className="mr-1.5 h-3.5 w-3.5" />
                            {t('appearance.system')}
                          </Button>
                        </div>
                      </div>
                    </div>
                    <div className="h-px bg-border/50" />
                    <div className={settingsCompactControlRowClass}>
                      <div className={settingsCompactRowTextClass}>
                        <Label className={settingsCompactRowLabelClass}>{t('appearance.language')}</Label>
                      </div>
                      <div className={settingsControlDockClass}>
                        <div className={cn(settingsSegmentedShellClass, settingsControlTrackClass)}>
                          {SUPPORTED_LANGUAGES.map((lang) => (
                            <Button
                              key={lang.code}
                              variant="ghost"
                              className={cn(
                                settingsChoiceButtonBaseClass,
                                language === lang.code ? settingsChoiceButtonActiveClass : settingsChoiceButtonIdleClass,
                              )}
                              onClick={() => setLanguage(lang.code)}
                            >
                              {lang.label}
                            </Button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className={settingsPaneDividerClass}>
                    <div className="space-y-3">
                      <div className={settingsCompactToggleRowClass}>
                        <div className={settingsCompactRowTextClass}>
                          <Label className={settingsCompactRowLabelClass}>{t('appearance.launchAtStartup')}</Label>
                        </div>
                        <div className={settingsControlDockClass}>
                          <div className="flex w-full md:max-w-[320px] md:justify-end">
                            <Switch checked={launchAtStartup} onCheckedChange={setLaunchAtStartup} />
                          </div>
                        </div>
                      </div>
                      <div className="h-px bg-border/50" />
                      <div className={settingsCompactToggleRowClass}>
                        <div className={settingsCompactRowTextClass}>
                          <Label className={settingsCompactRowLabelClass}>{t('advanced.telemetry')}</Label>
                        </div>
                        <div className={settingsControlDockClass}>
                          <div className="flex w-full md:max-w-[320px] md:justify-end">
                            <Switch checked={telemetryEnabled} onCheckedChange={setTelemetryEnabled} />
                          </div>
                        </div>
                      </div>
                      <div className="h-px bg-border/50" />
                      <div className={settingsCompactToggleRowClass}>
                        <div className={settingsCompactRowTextClass}>
                          <Label className={settingsCompactRowLabelClass}>{t('advanced.devMode')}</Label>
                        </div>
                        <div className={settingsControlDockClass}>
                          <div className="flex w-full md:max-w-[320px] md:justify-end">
                            <Switch checked={devModeUnlocked} onCheckedChange={setDevModeUnlocked} />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </section>
              </TabsContent>

              <TabsContent value="runtime" className="mt-0">
                <section className={settingsPaneClass}>
                  <WorkbenchSummaryStrip
                    items={runtimeSummaryItems}
                    className={settingsFactsStripClass}
                  />

                  <div className={settingsPaneDividerClass}>
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div className="flex flex-wrap items-center gap-2">
                        <Button variant="outline" size="sm" onClick={restartGateway} className={cn('h-8 px-4', settingsGhostButtonClass)}>
                          <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                          {t('common:actions.restart')}
                        </Button>
                        <Button variant="outline" size="sm" onClick={handleShowLogs} className={cn('h-8 px-4', settingsGhostButtonClass)}>
                          <FileText className="mr-1.5 h-3.5 w-3.5" />
                          {t('gateway.logs')}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleExportLogBundle}
                          disabled={exportingLogBundle}
                          aria-busy={exportingLogBundle}
                          className={cn('h-8 px-4', settingsGhostButtonClass)}
                        >
                          {exportingLogBundle
                            ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                            : <Download className="mr-1.5 h-3.5 w-3.5" />}
                          {exportingLogBundle ? t('gateway.logsExporting') : t('gateway.exportLogs')}
                        </Button>
                        <Button variant="outline" size="sm" onClick={handleOpenLogDir} className={cn('h-8 px-4', settingsGhostButtonClass)}>
                          <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                          {t('gateway.openFolder')}
                        </Button>
                      </div>
                      <div className="inline-flex w-fit items-center gap-3 rounded-full border border-border/60 bg-[hsl(var(--surface-base)/0.88)] px-3 py-1.5">
                        <p className="text-[12px] font-medium text-foreground/82">{t('gateway.autoStart')}</p>
                        <Switch checked={gatewayAutoStart} onCheckedChange={setGatewayAutoStart} />
                      </div>
                    </div>
                  </div>

                  <div className={settingsPaneDividerClass}>
                    <div className="space-y-3">
                      <div className="space-y-3 rounded-lg border border-border/60 bg-[hsl(var(--surface-panel)/0.72)] px-4 py-3">
                        <div className="flex items-center justify-between gap-4">
                          <div className="min-w-0">
                            <Label className={settingsCompactRowLabelClass}>{t('gateway.proxyTitle')}</Label>
                          </div>
                          <Switch checked={proxyEnabledDraft} onCheckedChange={setProxyEnabledDraft} />
                        </div>
                        <div className="h-px bg-border/50" />
                        <div className="grid gap-3 md:grid-cols-[minmax(0,160px)_minmax(0,1fr)] md:items-center">
                          <div className={settingsCompactRowTextClass}>
                            <Label htmlFor="proxy-server" className={settingsCompactRowLabelClass}>{t('gateway.proxyServer')}</Label>
                          </div>
                          <div className="space-y-2">
                            <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_auto_auto] md:items-center">
                              <Input
                                id="proxy-server"
                                value={proxyServerDraft}
                                onChange={(event) => setProxyServerDraft(event.target.value)}
                                placeholder="http://127.0.0.1:7890"
                                className={settingsInputClass}
                              />
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() => setShowAdvancedProxyFields((current) => !current)}
                                className={cn('h-9 px-4', settingsGhostButtonClass)}
                              >
                                {showAdvancedProxyFields ? t('gateway.hideAdvancedProxy') : t('gateway.showAdvancedProxy')}
                              </Button>
                              <Button
                                variant="outline"
                                onClick={handleSaveProxySettings}
                                disabled={savingProxy}
                                className={cn('h-9 px-4', settingsGhostButtonClass)}
                              >
                                <RefreshCw className={`mr-2 h-4 w-4${savingProxy ? ' animate-spin' : ''}`} />
                                {savingProxy ? t('common:status.saving') : t('common:actions.save')}
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>

                      {showAdvancedProxyFields && (
                        <div className="grid grid-cols-1 gap-4 rounded-md border border-border/60 bg-[hsl(var(--surface-base)/0.88)] p-4 sm:grid-cols-2">
                          <div className="space-y-2">
                            <Label htmlFor="proxy-http-server" className={settingsLabelClass}>{t('gateway.proxyHttpServer')}</Label>
                            <Input
                              id="proxy-http-server"
                              value={proxyHttpServerDraft}
                              onChange={(event) => setProxyHttpServerDraft(event.target.value)}
                              placeholder={proxyServerDraft || 'http://127.0.0.1:7890'}
                              className={settingsInputClass}
                            />
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="proxy-https-server" className={settingsLabelClass}>{t('gateway.proxyHttpsServer')}</Label>
                            <Input
                              id="proxy-https-server"
                              value={proxyHttpsServerDraft}
                              onChange={(event) => setProxyHttpsServerDraft(event.target.value)}
                              placeholder={proxyServerDraft || 'http://127.0.0.1:7890'}
                              className={settingsInputClass}
                            />
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="proxy-all-server" className={settingsLabelClass}>{t('gateway.proxyAllServer')}</Label>
                            <Input
                              id="proxy-all-server"
                              value={proxyAllServerDraft}
                              onChange={(event) => setProxyAllServerDraft(event.target.value)}
                              placeholder={proxyServerDraft || 'socks5://127.0.0.1:7891'}
                              className={settingsInputClass}
                            />
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="proxy-bypass" className={settingsLabelClass}>{t('gateway.proxyBypass')}</Label>
                            <Input
                              id="proxy-bypass"
                              value={proxyBypassRulesDraft}
                              onChange={(event) => setProxyBypassRulesDraft(event.target.value)}
                              placeholder="<local>;localhost;127.0.0.1;::1"
                              className={settingsInputClass}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </section>
              </TabsContent>


              {devModeUnlocked && (
                <TabsContent value="developer" className="mt-0">
                  <section className={settingsPaneClass}>
                    <div className="space-y-3">
                      <div className={settingsCompactControlRowClass}>
                        <div className={settingsCompactRowTextClass}>
                          <Label className={settingsCompactRowLabelClass}>{t('developer.console')}</Label>
                        </div>
                        <div className={settingsControlDockClass}>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => void handleOpenControlConsole()}
                            className={cn('h-9 px-4', settingsGhostButtonClass, 'w-full md:w-auto')}
                          >
                            <ExternalLink className="mr-2 h-4 w-4" />
                            {controlUiInfo?.url ? t('developer.openConsole') : t('common:actions.load')}
                          </Button>
                        </div>
                      </div>
                      <div className="h-px bg-border/50" />
                      <div className={settingsCompactControlRowClass}>
                        <div className={settingsCompactRowTextClass}>
                          <Label className={settingsCompactRowLabelClass}>{t('developer.gatewayToken')}</Label>
                        </div>
                        <div className="space-y-2">
                          <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_auto_auto] md:items-center">
                            <Input
                              readOnly
                              value={controlUiInfo?.token || ''}
                              placeholder={t('developer.tokenUnavailable')}
                              className={cn(settingsCodeInputClass, 'min-w-0')}
                            />
                            <Button
                              type="button"
                              variant="outline"
                              onClick={refreshControlUiInfo}
                              disabled={!devModeUnlocked}
                              className={cn('h-9 px-4', settingsGhostButtonClass)}
                            >
                              <RefreshCw className="mr-2 h-4 w-4" />
                              {t('common:actions.load')}
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              onClick={handleCopyGatewayToken}
                              disabled={!controlUiInfo?.token}
                              className={cn('h-9 px-4', settingsGhostButtonClass)}
                            >
                              <Copy className="mr-2 h-4 w-4" />
                              {t('common:actions.copy')}
                            </Button>
                          </div>
                        </div>
                      </div>

                      {showCliTools && (
                        <>
                          <div className="h-px bg-border/50" />
                          <div className={settingsCompactControlRowClass}>
                            <div className={settingsCompactRowTextClass}>
                              <Label className={settingsCompactRowLabelClass}>{t('developer.cli')}</Label>
                            </div>
                            <div className="space-y-2">
                              <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
                                <Input
                                  readOnly
                                  value={openclawCliCommand}
                                  placeholder={openclawCliError || t('developer.cmdUnavailable')}
                                  className={cn(settingsCodeInputClass, 'min-w-0')}
                                />
                                <Button
                                  type="button"
                                  variant="outline"
                                  onClick={handleCopyCliCommand}
                                  disabled={!openclawCliCommand}
                                  className={cn('h-9 px-4', settingsGhostButtonClass)}
                                >
                                  <Copy className="mr-2 h-4 w-4" />
                                  {t('common:actions.copy')}
                                </Button>
                              </div>
                              {isWindows ? (
                                <p className="text-[12px] leading-5 text-muted-foreground">{t('developer.cliPowershell')}</p>
                              ) : null}
                            </div>
                          </div>
                        </>
                      )}
                    </div>

                    <div className={settingsPaneDividerClass}>
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <Label className={settingsCompactRowLabelClass}>{t('developer.doctor')}</Label>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => void handleRunOpenClawDoctor('diagnose')}
                            disabled={doctorRunningMode !== null}
                            className={cn('h-9 px-4', settingsGhostButtonClass)}
                          >
                            <RefreshCw className={`mr-2 h-4 w-4${doctorRunningMode === 'diagnose' ? ' animate-spin' : ''}`} />
                            {doctorRunningMode === 'diagnose' ? t('common:status.running') : t('developer.runDoctor')}
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => void handleRunOpenClawDoctor('fix')}
                            disabled={doctorRunningMode !== null}
                            className={cn('h-9 px-4', settingsGhostButtonClass)}
                          >
                            <RefreshCw className={`mr-2 h-4 w-4${doctorRunningMode === 'fix' ? ' animate-spin' : ''}`} />
                            {doctorRunningMode === 'fix' ? t('common:status.running') : t('developer.runDoctorFix')}
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={handleCopyDoctorOutput}
                            disabled={!doctorResult}
                            className={cn('h-9 px-4', settingsGhostButtonClass)}
                          >
                            <Copy className="mr-2 h-4 w-4" />
                            {t('common:actions.copy')}
                          </Button>
                        </div>
                      </div>

                      {doctorResult && (
                        <div className="mt-4 space-y-3 rounded-md border border-border/60 bg-[hsl(var(--surface-base)/0.92)] p-4">
                        <WorkbenchSummaryStrip
                          items={doctorSummaryItems}
                          className={settingsFactsStripClass}
                        />
                        <div className="space-y-1 text-[12px] font-mono text-muted-foreground break-all">
                          <p>{t('developer.doctorCommand')}: {doctorResult.command}</p>
                          <p>{t('developer.doctorWorkingDir')}: {doctorResult.cwd || '-'}</p>
                          {doctorResult.error && <p>{t('developer.doctorError')}: {doctorResult.error}</p>}
                        </div>
                        <div className="flex justify-end">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setShowDoctorRawOutput((prev) => !prev)}
                            className={cn('h-8 px-4', settingsGhostButtonClass)}
                          >
                            {showDoctorRawOutput ? t('common:actions.hide') : t('common:actions.show')} {t('developer.rawDoctorOutput')}
                          </Button>
                        </div>
                        {showDoctorRawOutput && (
                          <div className="grid gap-3 md:grid-cols-2">
                            <div className="space-y-2">
                              <p className="text-[12px] font-semibold text-foreground/85">{t('developer.doctorStdout')}</p>
                              <pre className="max-h-72 overflow-auto rounded-md border border-border/60 bg-[hsl(var(--surface-panel)/0.94)] p-3 text-[11px] font-mono whitespace-pre-wrap break-words text-foreground">
                                {doctorResult.stdout.trim() || t('developer.doctorOutputEmpty')}
                              </pre>
                            </div>
                            <div className="space-y-2">
                              <p className="text-[12px] font-semibold text-foreground/85">{t('developer.doctorStderr')}</p>
                              <pre className="max-h-72 overflow-auto rounded-md border border-border/60 bg-[hsl(var(--surface-panel)/0.94)] p-3 text-[11px] font-mono whitespace-pre-wrap break-words text-foreground">
                                {doctorResult.stderr.trim() || t('developer.doctorOutputEmpty')}
                              </pre>
                            </div>
                          </div>
                        )}
                        </div>
                      )}
                    </div>

                    <div className={settingsPaneDividerClass}>
                      <div className={settingsCompactToggleRowClass}>
                        <div className={settingsCompactRowTextClass}>
                          <Label className={settingsCompactRowLabelClass}>{t('developer.wsDiagnostic')}</Label>
                        </div>
                        <div className={settingsControlDockClass}>
                          <div className="flex w-full md:max-w-[320px] md:justify-start">
                            <Switch
                              checked={wsDiagnosticEnabled}
                              onCheckedChange={handleWsDiagnosticToggle}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className={settingsPaneDividerClass}>
                      <div className={settingsCompactControlRowClass}>
                        <div className={settingsCompactRowTextClass}>
                          <Label className={settingsCompactRowLabelClass}>{t('developer.telemetryViewer')}</Label>
                        </div>
                        <div className={settingsControlDockClass}>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setShowTelemetryViewer((prev) => !prev)}
                            className={cn('h-8 px-4', settingsGhostButtonClass)}
                          >
                            {showTelemetryViewer ? t('common:actions.hide') : t('common:actions.show')}
                          </Button>
                        </div>
                      </div>

                      {showTelemetryViewer && (
                        <div className="mt-4 space-y-4 rounded-md border border-border/60 bg-[hsl(var(--surface-base)/0.92)] p-4">
                          <div className="flex flex-col gap-3">
                            <div className="flex justify-end gap-2">
                              <Button type="button" variant="outline" size="sm" onClick={handleCopyTelemetry} className={cn('h-8 px-4', settingsGhostButtonClass)}>
                                <Copy className="mr-1.5 h-3.5 w-3.5" />
                                {t('common:actions.copy')}
                              </Button>
                              <Button type="button" variant="outline" size="sm" onClick={handleClearTelemetry} className={cn('h-8 px-4', settingsGhostButtonClass)}>
                                {t('common:actions.clear')}
                              </Button>
                            </div>
                            <WorkbenchSummaryStrip
                              items={telemetrySummaryItems}
                              className={settingsFactsStripClass}
                            />
                            <div className="flex justify-end">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => setShowTelemetryRawEvents((prev) => !prev)}
                                className={cn('h-8 px-4', settingsGhostButtonClass)}
                              >
                                {showTelemetryRawEvents ? t('common:actions.hide') : t('common:actions.show')} {t('developer.rawTelemetryEvents')}
                              </Button>
                            </div>
                          </div>

                          <div className="max-h-80 overflow-auto rounded-xl border border-border/60 bg-[hsl(var(--surface-panel)/0.94)] shadow-inner">
                            {telemetryByEvent.length > 0 && (
                              <div className="border-b border-border/60 bg-[hsl(var(--surface-hover)/0.7)] p-3">
                                <p className="mb-3 text-[12px] font-semibold text-muted-foreground">
                                  {t('developer.telemetryAggregated')}
                                </p>
                                <div className="space-y-1.5 text-[12px]">
                                  {telemetryByEvent.map((item) => (
                                    <div
                                      key={item.event}
                                      className="grid grid-cols-[minmax(0,1.6fr)_0.7fr_0.9fr_0.8fr_1fr] gap-2 rounded-lg border border-border/60 bg-[hsl(var(--surface-panel)/0.88)] px-3 py-2 dark:bg-[hsl(var(--surface-elevated)/0.8)]"
                                    >
                                      <span className="truncate font-medium" title={item.event}>{item.event}</span>
                                      <span className="text-muted-foreground">n={item.count}</span>
                                      <span className="text-muted-foreground">
                                        avg={item.timedCount > 0 ? Math.round(item.totalDuration / item.timedCount) : 0}ms
                                      </span>
                                      <span className="text-muted-foreground">slow={item.slowCount}</span>
                                      <span className="text-muted-foreground">err={item.errorCount}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                            {showTelemetryRawEvents && (
                              <div className="space-y-2 border-t border-border/60 p-3 font-mono text-[12px]">
                                {telemetryEntries.length === 0 ? (
                                  <div className="py-4 text-center text-muted-foreground">{t('developer.telemetryEmpty')}</div>
                                ) : (
                                  telemetryEntries
                                    .slice()
                                    .reverse()
                                    .map((entry) => (
                                      <div key={entry.id} className="rounded-lg border border-border/60 bg-[hsl(var(--surface-hover)/0.65)] p-3">
                                        <div className="mb-2 flex items-center justify-between gap-3">
                                          <span className="font-semibold text-foreground">{entry.event}</span>
                                          <span className="text-[11px] text-muted-foreground">{entry.ts}</span>
                                        </div>
                                        <pre className="overflow-x-auto whitespace-pre-wrap text-[11px] text-muted-foreground">
                                          {JSON.stringify({ count: entry.count, ...entry.payload }, null, 2)}
                                        </pre>
                                      </div>
                                    ))
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </section>
                </TabsContent>
              )}

              <TabsContent value="updates" className="mt-0">
                <section className={settingsPaneClass}>
                  <UpdateSettings />
                </section>
              </TabsContent>
            </Tabs>

          <Dialog open={showLogs} onOpenChange={setShowLogs}>
            <DialogContent className="flex h-[min(74vh,700px)] max-h-[min(74vh,700px)] max-w-[920px] flex-col gap-0 overflow-hidden rounded-xl border border-border/70 bg-[hsl(var(--surface-elevated))] p-0 shadow-lg">
              <DialogHeader className="border-b border-border/60 px-5 py-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <DialogTitle className="text-[18px] font-semibold tracking-tight text-foreground">
                    {t('gateway.appLogs')}
                  </DialogTitle>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" className={cn('h-8 px-4', settingsGhostButtonClass)} onClick={handleCopyLogContent}>
                      <Copy className="mr-1.5 h-3.5 w-3.5" />
                      {t('common:actions.copy')}
                    </Button>
                    <Button variant="outline" size="sm" className={cn('h-8 px-4', settingsGhostButtonClass)} onClick={handleOpenLogDir}>
                      <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                      {t('gateway.openFolder')}
                    </Button>
                  </div>
                </div>
              </DialogHeader>
              <div className="min-h-0 flex-1 p-5">
                <pre className="h-full overflow-auto rounded-md border border-border/60 bg-[hsl(var(--surface-base))] px-4 py-3 font-mono text-[12px] whitespace-pre-wrap text-muted-foreground shadow-inner">
                  {logContent || t('chat:noLogs')}
                </pre>
              </div>
            </DialogContent>
          </Dialog>
          </div>
        </WorkspacePageScrollArea>
      </WorkspacePageShell>
    </WorkspacePageFrame>
  );
}

export default Settings;
