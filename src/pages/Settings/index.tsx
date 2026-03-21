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
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { useSettingsStore } from '@/stores/settings';
import { useGatewayStore } from '@/stores/gateway';
import { useUpdateStore } from '@/stores/update';
import { WorkspacePageFrame, WorkspacePageScrollArea, WorkspacePageShell } from '@/components/layout/WorkspacePage';
import { UpdateSettings } from '@/components/settings/UpdateSettings';
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

const settingsPageHeaderClass =
  'mb-6 flex flex-col gap-2 md:flex-row md:items-end md:justify-between';
const settingsPageTitleClass =
  'text-[24px] leading-tight md:text-[28px] font-semibold tracking-tight text-foreground';
const settingsPageSubtitleClass =
  'max-w-[64ch] text-[13px] md:text-[14px] text-muted-foreground';
const settingsSectionClass =
  'space-y-4 rounded-[18px] border border-border/65 bg-[hsl(var(--surface-elevated)/0.98)] p-4 md:p-5';
const settingsSubPanelClass =
  'rounded-[14px] border border-border/60 bg-[hsl(var(--surface-panel)/0.96)] p-4';
const settingsHeadingClass = 'text-[12px] font-semibold uppercase tracking-[0.18em] text-foreground/64';
const settingsLabelClass = 'text-[13px] font-medium text-foreground/84';
const settingsHintClass = 'text-[12px] text-muted-foreground';
const settingsPillClass =
  'inline-flex h-9 items-center gap-2 rounded-[11px] border border-border/70 bg-[hsl(var(--surface-panel)/0.96)] px-4 text-[12px] font-medium shadow-none';
const settingsPillActiveClass =
  'bg-[hsl(var(--foreground)/0.05)] text-foreground border-border/80';
const settingsPillIdleClass =
  'bg-transparent text-muted-foreground hover:bg-[hsl(var(--foreground)/0.04)] hover:text-foreground';
const settingsInputClass =
  'h-9 rounded-[11px] border-border/70 bg-[hsl(var(--surface-panel)/0.98)] font-mono text-[13px] text-foreground shadow-none placeholder:text-muted-foreground';
const settingsGhostButtonClass =
  'rounded-[10px] border-border/70 bg-transparent hover:bg-[hsl(var(--foreground)/0.04)]';

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
    autoCheckUpdate,
    setAutoCheckUpdate,
    autoDownloadUpdate,
    setAutoDownloadUpdate,
    devModeUnlocked,
    setDevModeUnlocked,
    telemetryEnabled,
    setTelemetryEnabled,
  } = useSettingsStore();

  const { status: gatewayStatus, restart: restartGateway } = useGatewayStore();
  const currentVersion = useUpdateStore((state) => state.currentVersion);
  const updateSetAutoDownload = useUpdateStore((state) => state.setAutoDownload);
  const [controlUiInfo, setControlUiInfo] = useState<ControlUiInfo | null>(null);
  const [openclawCliCommand, setOpenclawCliCommand] = useState('');
  const [openclawCliError, setOpenclawCliError] = useState<string | null>(null);
  const [proxyServerDraft, setProxyServerDraft] = useState('');
  const [proxyHttpServerDraft, setProxyHttpServerDraft] = useState('');
  const [proxyHttpsServerDraft, setProxyHttpsServerDraft] = useState('');
  const [proxyAllServerDraft, setProxyAllServerDraft] = useState('');
  const [proxyBypassRulesDraft, setProxyBypassRulesDraft] = useState('');
  const [proxyEnabledDraft, setProxyEnabledDraft] = useState(false);
  const [savingProxy, setSavingProxy] = useState(false);
  const [wsDiagnosticEnabled, setWsDiagnosticEnabled] = useState(false);
  const [showTelemetryViewer, setShowTelemetryViewer] = useState(false);
  const [telemetryEntries, setTelemetryEntries] = useState<UiTelemetryEntry[]>([]);

  const isWindows = window.electron.platform === 'win32';
  const showCliTools = true;
  const [showLogs, setShowLogs] = useState(false);
  const [logContent, setLogContent] = useState('');
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



  const refreshControlUiInfo = async () => {
    try {
      const result = await hostApiFetch<{
        success: boolean;
        url?: string;
        token?: string;
        port?: number;
      }>('/api/gateway/control-ui');
      if (result.success && result.url && result.token && typeof result.port === 'number') {
        setControlUiInfo({ url: result.url, token: result.token, port: result.port });
      }
    } catch {
      // Ignore refresh errors
    }
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

  return (
    <WorkspacePageFrame>
      <WorkspacePageShell>

        {/* Header */}
        <div className={settingsPageHeaderClass}>
          <div className="max-w-[820px]">
            <h1 className={settingsPageTitleClass}>
              {t('title')}
            </h1>
            <p className={settingsPageSubtitleClass}>
              {t('subtitle')}
            </p>
          </div>
        </div>

        {/* Content Area */}
        <WorkspacePageScrollArea className="space-y-6" platform={isWindows ? 'win32' : 'darwin'}>

          {/* Appearance */}
          <div className={settingsSectionClass}>
            <h2 className={settingsHeadingClass}>
              {t('appearance.title')}
            </h2>
            <div className="space-y-5">
              <div className="space-y-3">
                <Label className={settingsLabelClass}>{t('appearance.theme')}</Label>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant={theme === 'light' ? 'secondary' : 'outline'}
                    className={cn(settingsPillClass, theme === 'light' ? settingsPillActiveClass : settingsPillIdleClass)}
                    onClick={() => setTheme('light')}
                  >
                    <Sun className="h-4 w-4 mr-2" />
                    {t('appearance.light')}
                  </Button>
                  <Button
                    variant={theme === 'dark' ? 'secondary' : 'outline'}
                    className={cn(settingsPillClass, theme === 'dark' ? settingsPillActiveClass : settingsPillIdleClass)}
                    onClick={() => setTheme('dark')}
                  >
                    <Moon className="h-4 w-4 mr-2" />
                    {t('appearance.dark')}
                  </Button>
                  <Button
                    variant={theme === 'system' ? 'secondary' : 'outline'}
                    className={cn(settingsPillClass, theme === 'system' ? settingsPillActiveClass : settingsPillIdleClass)}
                    onClick={() => setTheme('system')}
                  >
                    <Monitor className="h-4 w-4 mr-2" />
                    {t('appearance.system')}
                  </Button>
                </div>
              </div>
              <div className="space-y-3">
                <Label className={settingsLabelClass}>{t('appearance.language')}</Label>
                <div className="flex flex-wrap gap-2">
                  {SUPPORTED_LANGUAGES.map((lang) => (
                    <Button
                      key={lang.code}
                      variant={language === lang.code ? 'secondary' : 'outline'}
                      className={cn(settingsPillClass, language === lang.code ? settingsPillActiveClass : settingsPillIdleClass)}
                      onClick={() => setLanguage(lang.code)}
                    >
                      {lang.label}
                    </Button>
                  ))}
                </div>
              </div>
              <div className={settingsSubPanelClass}>
                <div>
                  <Label className={settingsLabelClass}>{t('appearance.launchAtStartup')}</Label>
                  <p className="mt-1 text-[13px] text-muted-foreground">
                    {t('appearance.launchAtStartupDesc')}
                  </p>
                </div>
                <Switch checked={launchAtStartup} onCheckedChange={setLaunchAtStartup} />
              </div>
            </div>
          </div>

          <Separator className="bg-border/60" />

          {/* Gateway */}
          <div className={settingsSectionClass}>
            <h2 className={settingsHeadingClass}>
              {t('gateway.title')}
            </h2>
            <div className="space-y-5">
              <div className="flex flex-col gap-4 rounded-[14px] border border-border/70 bg-[hsl(var(--surface-base)/0.82)] p-4 shadow-none sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <Label className={settingsLabelClass}>{t('gateway.status')}</Label>
                  <p className="mt-1 text-[13px] text-muted-foreground">
                    {t('gateway.port')}: {gatewayStatus.port}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className={cn(
                    'flex items-center gap-1.5 rounded-[10px] border px-3 py-1.5 text-[13px] font-medium shadow-none',
                    gatewayStatus.state === 'running' ? 'border-emerald-500/20 bg-emerald-500/12 text-emerald-600 dark:text-emerald-400' :
                      gatewayStatus.state === 'error' ? 'border-red-500/20 bg-red-500/12 text-red-600 dark:text-red-400' :
                        'border-border/60 bg-[hsl(var(--surface-hover)/0.62)] text-muted-foreground'
                  )}>
                    <div className={cn("h-1.5 w-1.5 rounded-[4px]",
                      gatewayStatus.state === 'running' ? "bg-emerald-500" :
                        gatewayStatus.state === 'error' ? "bg-red-500" : "bg-muted-foreground"
                    )} />
                    {gatewayStatus.state}
                  </div>
                  <Button variant="outline" size="sm" onClick={restartGateway} className={cn('h-8 px-4', settingsGhostButtonClass)}>
                    <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                    {t('common:actions.restart')}
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleShowLogs} className={cn('h-8 px-4', settingsGhostButtonClass)}>
                    <FileText className="h-3.5 w-3.5 mr-1.5" />
                    {t('gateway.logs')}
                  </Button>
                </div>
              </div>

              {showLogs && (
                <div className={settingsSubPanelClass}>
                  <div className="flex items-center justify-between mb-3">
                    <p className="font-medium text-[14px] text-foreground">{t('gateway.appLogs')}</p>
                    <div className="flex gap-2">
                    <Button variant="ghost" size="sm" className="h-7 rounded-[10px] px-3 text-[12px] hover:bg-[hsl(var(--surface-hover)/0.78)]" onClick={handleOpenLogDir}>
                        <ExternalLink className="h-3 w-3 mr-1.5" />
                        {t('gateway.openFolder')}
                      </Button>
                    <Button variant="ghost" size="sm" className="h-7 rounded-[10px] px-3 text-[12px] hover:bg-[hsl(var(--surface-hover)/0.78)]" onClick={() => setShowLogs(false)}>
                        {t('common:actions.close')}
                      </Button>
                    </div>
                  </div>
                  <pre className="max-h-60 overflow-auto rounded-[10px] border border-border/60 bg-[hsl(var(--surface-base)/0.9)] p-4 font-mono text-[12px] whitespace-pre-wrap text-muted-foreground shadow-none">
                    {logContent || t('chat:noLogs')}
                  </pre>
                </div>
              )}

              <div className={settingsSubPanelClass}>
                <div>
                  <Label className={settingsLabelClass}>{t('gateway.autoStart')}</Label>
                  <p className="mt-1 text-[13px] text-muted-foreground">
                    {t('gateway.autoStartDesc')}
                  </p>
                </div>
                <Switch checked={gatewayAutoStart} onCheckedChange={setGatewayAutoStart} />
              </div>

              <div className={settingsSubPanelClass}>
                <div>
                  <Label className={settingsLabelClass}>{t('advanced.devMode')}</Label>
                  <p className="mt-1 text-[13px] text-muted-foreground">
                    {t('advanced.devModeDesc')}
                  </p>
                </div>
                <Switch checked={devModeUnlocked} onCheckedChange={setDevModeUnlocked} />
              </div>

              <div className={settingsSubPanelClass}>
                <div>
                  <Label className={settingsLabelClass}>{t('advanced.telemetry')}</Label>
                  <p className="mt-1 text-[13px] text-muted-foreground">
                    {t('advanced.telemetryDesc')}
                  </p>
                </div>
                <Switch checked={telemetryEnabled} onCheckedChange={setTelemetryEnabled} />
              </div>

            </div>
          </div>


          {/* Developer */}
          {devModeUnlocked && (
            <>
              <Separator className="bg-border/60" />
              <div className={settingsSectionClass}>
                <h2 className={settingsHeadingClass}>
                  {t('developer.title')}
                </h2>
                <div className="space-y-6">
                  {/* Gateway Proxy */}
                  <div className={settingsSubPanelClass}>
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <Label className={settingsLabelClass}>Gateway Proxy</Label>
                        <p className={settingsHintClass}>
                          {t('gateway.proxyDesc')}
                        </p>
                      </div>
                      <Switch checked={proxyEnabledDraft} onCheckedChange={setProxyEnabledDraft} />
                    </div>

                    {proxyEnabledDraft && (
                      <div className="space-y-4 pt-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="proxy-server" className="text-[13px] font-medium text-foreground/85">{t('gateway.proxyServer')}</Label>
                            <Input
                              id="proxy-server"
                              value={proxyServerDraft}
                              onChange={(event) => setProxyServerDraft(event.target.value)}
                              placeholder="http://127.0.0.1:7890"
                              className={settingsInputClass}
                            />
                            <p className="text-[11px] text-muted-foreground">
                              {t('gateway.proxyServerHelp')}
                            </p>
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="proxy-http-server" className="text-[13px] font-medium text-foreground/85">{t('gateway.proxyHttpServer')}</Label>
                            <Input
                              id="proxy-http-server"
                              value={proxyHttpServerDraft}
                              onChange={(event) => setProxyHttpServerDraft(event.target.value)}
                              placeholder={proxyServerDraft || 'http://127.0.0.1:7890'}
                              className={settingsInputClass}
                            />
                            <p className="text-[11px] text-muted-foreground">
                              {t('gateway.proxyHttpServerHelp')}
                            </p>
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="proxy-https-server" className="text-[13px] font-medium text-foreground/85">{t('gateway.proxyHttpsServer')}</Label>
                            <Input
                              id="proxy-https-server"
                              value={proxyHttpsServerDraft}
                              onChange={(event) => setProxyHttpsServerDraft(event.target.value)}
                              placeholder={proxyServerDraft || 'http://127.0.0.1:7890'}
                              className={settingsInputClass}
                            />
                            <p className="text-[11px] text-muted-foreground">
                              {t('gateway.proxyHttpsServerHelp')}
                            </p>
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="proxy-all-server" className="text-[13px] font-medium text-foreground/85">{t('gateway.proxyAllServer')}</Label>
                            <Input
                              id="proxy-all-server"
                              value={proxyAllServerDraft}
                              onChange={(event) => setProxyAllServerDraft(event.target.value)}
                              placeholder={proxyServerDraft || 'socks5://127.0.0.1:7891'}
                              className={settingsInputClass}
                            />
                            <p className="text-[11px] text-muted-foreground">
                              {t('gateway.proxyAllServerHelp')}
                            </p>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="proxy-bypass" className="text-[13px] font-medium text-foreground/85">{t('gateway.proxyBypass')}</Label>
                          <Input
                            id="proxy-bypass"
                            value={proxyBypassRulesDraft}
                            onChange={(event) => setProxyBypassRulesDraft(event.target.value)}
                            placeholder="<local>;localhost;127.0.0.1;::1"
                            className={settingsInputClass}
                          />
                          <p className="text-[11px] text-muted-foreground">
                            {t('gateway.proxyBypassHelp')}
                          </p>
                        </div>

                        <div className="flex items-center gap-4 pt-2">
                          <Button
                            variant="outline"
                            onClick={handleSaveProxySettings}
                            disabled={savingProxy}
                            className={cn('h-10 px-5', settingsGhostButtonClass)}
                          >
                            <RefreshCw className={`h-4 w-4 mr-2${savingProxy ? ' animate-spin' : ''}`} />
                            {savingProxy ? t('common:status.saving') : t('common:actions.save')}
                          </Button>
                          <p className="text-[12px] text-muted-foreground">
                            {t('gateway.proxyRestartNote')}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="space-y-4 pt-4">
                    <Label className={settingsLabelClass}>{t('developer.gatewayToken')}</Label>
                    <p className={settingsHintClass}>
                      {t('developer.gatewayTokenDesc')}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Input
                        readOnly
                        value={controlUiInfo?.token || ''}
                        placeholder={t('developer.tokenUnavailable')}
                        className={cn(settingsInputClass, 'flex-1 min-w-[200px]')}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={refreshControlUiInfo}
                        disabled={!devModeUnlocked}
                        className={cn('h-10 px-4', settingsGhostButtonClass)}
                      >
                        <RefreshCw className="h-4 w-4 mr-2" />
                        {t('common:actions.load')}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleCopyGatewayToken}
                        disabled={!controlUiInfo?.token}
                        className={cn('h-10 px-4', settingsGhostButtonClass)}
                      >
                        <Copy className="h-4 w-4 mr-2" />
                        {t('common:actions.copy')}
                      </Button>
                    </div>
                  </div>

                  {showCliTools && (
                    <div className="space-y-3">
                      <Label className={settingsLabelClass}>{t('developer.cli')}</Label>
                      <p className={settingsHintClass}>
                        {t('developer.cliDesc')}
                      </p>
                      {isWindows && (
                        <p className="text-[12px] text-muted-foreground">
                          {t('developer.cliPowershell')}
                        </p>
                      )}
                      <div className="flex flex-wrap gap-2">
                        <Input
                          readOnly
                          value={openclawCliCommand}
                          placeholder={openclawCliError || t('developer.cmdUnavailable')}
                          className={cn(settingsInputClass, 'flex-1 min-w-[200px]')}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          onClick={handleCopyCliCommand}
                          disabled={!openclawCliCommand}
                          className={cn('h-10 px-4', settingsGhostButtonClass)}
                        >
                          <Copy className="h-4 w-4 mr-2" />
                          {t('common:actions.copy')}
                        </Button>
                      </div>
                    </div>
                  )}

                  <div className="space-y-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <Label className={settingsLabelClass}>{t('developer.doctor')}</Label>
                        <p className="mt-1 text-[13px] text-muted-foreground">
                          {t('developer.doctorDesc')}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => void handleRunOpenClawDoctor('diagnose')}
                          disabled={doctorRunningMode !== null}
                          className={cn('h-10 px-4', settingsGhostButtonClass)}
                        >
                          <RefreshCw className={`h-4 w-4 mr-2${doctorRunningMode === 'diagnose' ? ' animate-spin' : ''}`} />
                          {doctorRunningMode === 'diagnose' ? t('common:status.running') : t('developer.runDoctor')}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => void handleRunOpenClawDoctor('fix')}
                          disabled={doctorRunningMode !== null}
                          className={cn('h-10 px-4', settingsGhostButtonClass)}
                        >
                          <RefreshCw className={`h-4 w-4 mr-2${doctorRunningMode === 'fix' ? ' animate-spin' : ''}`} />
                          {doctorRunningMode === 'fix' ? t('common:status.running') : t('developer.runDoctorFix')}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={handleCopyDoctorOutput}
                          disabled={!doctorResult}
                          className={cn('h-10 px-4', settingsGhostButtonClass)}
                        >
                          <Copy className="h-4 w-4 mr-2" />
                          {t('common:actions.copy')}
                        </Button>
                      </div>
                    </div>

                    {doctorResult && (
                      <div className={cn(settingsSubPanelClass, 'space-y-3')}>
                        <div className="flex flex-wrap gap-2 text-[12px]">
                          <Badge variant={doctorResult.success ? 'secondary' : 'destructive'} className="rounded-[10px] px-3 py-1">
                            {doctorResult.mode === 'fix'
                              ? (doctorResult.success ? t('developer.doctorFixOk') : t('developer.doctorFixIssue'))
                              : (doctorResult.success ? t('developer.doctorOk') : t('developer.doctorIssue'))}
                          </Badge>
                          <Badge variant="outline" className="rounded-[10px] px-3 py-1">
                            {t('developer.doctorExitCode')}: {doctorResult.exitCode ?? 'null'}
                          </Badge>
                          <Badge variant="outline" className="rounded-[10px] px-3 py-1">
                            {t('developer.doctorDuration')}: {Math.round(doctorResult.durationMs)}ms
                          </Badge>
                        </div>
                        <div className="space-y-1 text-[12px] text-muted-foreground font-mono break-all">
                          <p>{t('developer.doctorCommand')}: {doctorResult.command}</p>
                          <p>{t('developer.doctorWorkingDir')}: {doctorResult.cwd || '-'}</p>
                          {doctorResult.error && <p>{t('developer.doctorError')}: {doctorResult.error}</p>}
                        </div>
                        <div className="grid gap-3 md:grid-cols-2">
                          <div className="space-y-2">
                            <p className="text-[12px] font-semibold text-foreground/85">{t('developer.doctorStdout')}</p>
                            <pre className="max-h-72 overflow-auto rounded-[10px] border border-border/60 bg-[hsl(var(--surface-base)/0.9)] p-3 text-[11px] font-mono whitespace-pre-wrap break-words text-foreground">
                              {doctorResult.stdout.trim() || t('developer.doctorOutputEmpty')}
                            </pre>
                          </div>
                          <div className="space-y-2">
                            <p className="text-[12px] font-semibold text-foreground/85">{t('developer.doctorStderr')}</p>
                            <pre className="max-h-72 overflow-auto rounded-[10px] border border-border/60 bg-[hsl(var(--surface-base)/0.9)] p-3 text-[11px] font-mono whitespace-pre-wrap break-words text-foreground">
                              {doctorResult.stderr.trim() || t('developer.doctorOutputEmpty')}
                            </pre>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="space-y-4">
                    <div className={cn(settingsSubPanelClass, 'flex items-center justify-between gap-4')}>
                      <div>
                        <Label className={settingsLabelClass}>{t('developer.wsDiagnostic')}</Label>
                        <p className="mt-1 text-[13px] text-muted-foreground">
                          {t('developer.wsDiagnosticDesc')}
                        </p>
                      </div>
                      <Switch
                        checked={wsDiagnosticEnabled}
                        onCheckedChange={handleWsDiagnosticToggle}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-[14px] font-medium text-foreground">{t('developer.telemetryViewer')}</Label>
                        <p className="text-[13px] text-muted-foreground mt-1">
                          {t('developer.telemetryViewerDesc')}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setShowTelemetryViewer((prev) => !prev)}
                        className={cn('h-9 px-5', settingsGhostButtonClass)}
                      >
                        {showTelemetryViewer
                          ? t('common:actions.hide')
                          : t('common:actions.show')}
                      </Button>
                    </div>

                    {showTelemetryViewer && (
                      <div className={cn(settingsSubPanelClass, 'space-y-4')}>
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="secondary" className="rounded-[10px] px-3 py-1 bg-background/60 border border-border/60">{t('developer.telemetryTotal')}: {telemetryStats.total}</Badge>
                          <Badge variant={telemetryStats.errorCount > 0 ? 'destructive' : 'secondary'} className={cn('rounded-[10px] px-3 py-1', telemetryStats.errorCount === 0 && 'bg-background/60 border border-border/60')}>
                            {t('developer.telemetryErrors')}: {telemetryStats.errorCount}
                          </Badge>
                          <Badge variant={telemetryStats.slowCount > 0 ? 'secondary' : 'outline'} className={cn('rounded-[10px] px-3 py-1', telemetryStats.slowCount === 0 && 'bg-background/60 border border-border/60')}>
                            {t('developer.telemetrySlow')}: {telemetryStats.slowCount}
                          </Badge>
                          <div className="ml-auto flex gap-2">
                            <Button type="button" variant="outline" size="sm" onClick={handleCopyTelemetry} className={cn('h-8 px-4', settingsGhostButtonClass)}>
                              <Copy className="h-3.5 w-3.5 mr-1.5" />
                              {t('common:actions.copy')}
                            </Button>
                            <Button type="button" variant="outline" size="sm" onClick={handleClearTelemetry} className={cn('h-8 px-4', settingsGhostButtonClass)}>
                              {t('common:actions.clear')}
                            </Button>
                          </div>
                        </div>

                        <div className="max-h-80 overflow-auto rounded-xl border border-border/60 bg-[hsl(var(--surface-base)/0.9)] shadow-inner">
                          {telemetryByEvent.length > 0 && (
                            <div className="border-b border-border/60 bg-[hsl(var(--surface-hover)/0.7)] p-3">
                              <p className="mb-3 text-[12px] font-semibold text-muted-foreground">
                                {t('developer.telemetryAggregated')}
                              </p>
                              <div className="space-y-1.5 text-[12px]">
                                {telemetryByEvent.map((item) => (
                                  <div
                                    key={item.event}
                                    className="grid grid-cols-[minmax(0,1.6fr)_0.7fr_0.9fr_0.8fr_1fr] gap-2 rounded-lg border border-border/60 bg-background/70 px-3 py-2"
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
                          <div className="space-y-2 p-3 font-mono text-[12px]">
                            {telemetryEntries.length === 0 ? (
                              <div className="text-muted-foreground text-center py-4">{t('developer.telemetryEmpty')}</div>
                            ) : (
                              telemetryEntries
                                .slice()
                                .reverse()
                                .map((entry) => (
                                  <div key={entry.id} className="rounded-lg border border-border/60 bg-[hsl(var(--surface-hover)/0.65)] p-3">
                                    <div className="flex items-center justify-between gap-3 mb-2">
                                      <span className="font-semibold text-foreground">{entry.event}</span>
                                      <span className="text-muted-foreground text-[11px]">{entry.ts}</span>
                                    </div>
                                    <pre className="whitespace-pre-wrap text-[11px] text-muted-foreground overflow-x-auto">
                                      {JSON.stringify({ count: entry.count, ...entry.payload }, null, 2)}
                                    </pre>
                                  </div>
                                ))
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}

          <Separator className="bg-border/60" />

          {/* Updates */}
          <div className={settingsSectionClass}>
            <h2 className={settingsHeadingClass}>
              {t('updates.title')}
            </h2>
            <div className="space-y-5">
              <UpdateSettings />

              <div className={settingsSubPanelClass}>
                <div>
                  <Label className={settingsLabelClass}>{t('updates.autoCheck')}</Label>
                  <p className="mt-1 text-[13px] text-muted-foreground">
                    {t('updates.autoCheckDesc')}
                  </p>
                </div>
                <Switch checked={autoCheckUpdate} onCheckedChange={setAutoCheckUpdate} />
              </div>

              <div className={settingsSubPanelClass}>
                <div>
                  <Label className={settingsLabelClass}>{t('updates.autoDownload')}</Label>
                  <p className="mt-1 text-[13px] text-muted-foreground">
                    {t('updates.autoDownloadDesc')}
                  </p>
                </div>
                <Switch
                  checked={autoDownloadUpdate}
                  onCheckedChange={(value) => {
                    setAutoDownloadUpdate(value);
                    updateSetAutoDownload(value);
                  }}
                />
              </div>
            </div>
          </div>

          <Separator className="bg-border/60" />

          {/* About */}
          <div className={settingsSectionClass}>
            <h2 className={settingsHeadingClass}>
              {t('about.title')}
            </h2>
            <div className="space-y-3 text-[14px] text-muted-foreground">
              <p>
                <strong className="text-foreground font-semibold">{t('about.appName')}</strong> - {t('about.tagline')}
              </p>
              <p>{t('about.basedOn')}</p>
              <p>{t('about.version', { version: currentVersion })}</p>
              <div className="flex gap-4 pt-3">
                <Button
                  variant="link"
                  className="h-auto p-0 text-[14px] text-primary hover:text-primary/80 font-medium"
                  onClick={() => window.electron.openExternal('https://claw-x.com')}
                >
                  {t('about.docs')}
                </Button>
                <Button
                  variant="link"
                  className="h-auto p-0 text-[14px] text-primary hover:text-primary/80 font-medium"
                  onClick={() => window.electron.openExternal('https://github.com/jlon/XClaw')}
                >
                  {t('about.github')}
                </Button>
                <Button
                  variant="link"
                  className="h-auto p-0 text-[14px] text-primary hover:text-primary/80 font-medium"
                  onClick={() => window.electron.openExternal('https://icnnp7d0dymg.feishu.cn/wiki/UyfOwQ2cAiJIP6kqUW8cte5Bnlc')}
                >
                  {t('about.faq')}
                </Button>
              </div>
            </div>
          </div>

        </WorkspacePageScrollArea>
      </WorkspacePageShell>
    </WorkspacePageFrame>
  );
}

export default Settings;
