import { useEffect } from 'react';
import { Download, Loader2, RefreshCw, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { invokeIpc } from '@/lib/api-client';
import { useSettingsStore } from '@/stores/settings';
import { useUpdateStore } from '@/stores/update';

const panelClass = 'rounded-[16px] border border-border/60 bg-[hsl(var(--surface-panel)/0.78)] p-4 shadow-[0_12px_28px_rgba(15,23,42,0.04)]';
const rowClass = 'flex flex-col gap-3 rounded-[14px] border border-border/50 bg-[hsl(var(--surface-base)/0.9)] px-4 py-3 md:flex-row md:items-center md:justify-between';

const statusToneClass: Record<string, string> = {
  idle: 'border-border/60 bg-[hsl(var(--surface-base)/0.92)] text-foreground/76',
  checking: 'border-primary/25 bg-primary/10 text-primary',
  available: 'border-primary/30 bg-primary/12 text-primary',
  'not-available': 'border-border/60 bg-[hsl(var(--surface-base)/0.92)] text-foreground/72',
  downloading: 'border-primary/30 bg-primary/12 text-primary',
  downloaded: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-700',
  error: 'border-destructive/25 bg-destructive/10 text-destructive',
  unsupported: 'border-border/60 bg-[hsl(var(--surface-base)/0.92)] text-foreground/70',
};

export function UpdateSettings() {
  const { t } = useTranslation('settings');
  const platform =
    window.electron?.platform
    ?? (navigator.userAgent.includes('Windows') ? 'win32' : navigator.platform.toLowerCase());
  const isManualMacUpdate = platform === 'darwin';
  const isAutoUpdatePlatform = platform === 'win32';
  const status = useUpdateStore((state) => state.status);
  const currentVersion = useUpdateStore((state) => state.currentVersion);
  const updateInfo = useUpdateStore((state) => state.updateInfo);
  const progress = useUpdateStore((state) => state.progress);
  const error = useUpdateStore((state) => state.error);
  const isInitialized = useUpdateStore((state) => state.isInitialized);
  const init = useUpdateStore((state) => state.init);
  const checkForUpdates = useUpdateStore((state) => state.checkForUpdates);
  const downloadUpdate = useUpdateStore((state) => state.downloadUpdate);
  const installUpdate = useUpdateStore((state) => state.installUpdate);
  const setAutoDownload = useUpdateStore((state) => state.setAutoDownload);
  const autoCheckUpdate = useSettingsStore((state) => state.autoCheckUpdate);
  const autoDownloadUpdate = useSettingsStore((state) => state.autoDownloadUpdate);
  const setAutoCheckUpdate = useSettingsStore((state) => state.setAutoCheckUpdate);
  const setAutoDownloadUpdate = useSettingsStore((state) => state.setAutoDownloadUpdate);

  useEffect(() => {
    void init();
  }, [init]);

  const latestVersion = updateInfo?.version || t('updates.latestUnknown');
  const isChecking = status === 'checking';
  const isDownloading = status === 'downloading';
  const canDownload = isAutoUpdatePlatform && status === 'available';
  const canInstall = isAutoUpdatePlatform && status === 'downloaded';
  const manualDownloadUrl = isManualMacUpdate ? updateInfo?.downloadUrl : undefined;
  const canManualDownload = Boolean(manualDownloadUrl);
  const statusDetail = error
    || (isManualMacUpdate && status === 'available'
      ? t('updates.manualDownloadDesc')
      : t(`updates.detail.${status}`));

  if (!isInitialized) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>{t('common:status.loading')}</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <section className={panelClass}>
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`inline-flex items-center rounded-full border px-3 py-1 text-[12px] font-medium ${statusToneClass[status] || statusToneClass.idle}`}>
                {t(`updates.status.${status}`)}
              </span>
              {updateInfo?.version ? (
                <span className="inline-flex items-center rounded-full border border-border/60 bg-[hsl(var(--surface-base)/0.92)] px-3 py-1 text-[12px] text-foreground/72">
                  {t('updates.releaseVersion', { version: updateInfo.version })}
                </span>
              ) : null}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <p className="text-[12px] uppercase tracking-[0.14em] text-muted-foreground/75">{t('updates.currentVersion')}</p>
                <p className="text-sm font-medium text-foreground">{currentVersion}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[12px] uppercase tracking-[0.14em] text-muted-foreground/75">{t('updates.latestVersion')}</p>
                <p className="text-sm font-medium text-foreground">{latestVersion}</p>
              </div>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2 md:justify-end">
            <Button
              variant="outline"
              className="h-9 px-4"
              onClick={() => void checkForUpdates()}
              disabled={isChecking || isDownloading}
              aria-busy={isChecking}
            >
              {isChecking ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
              {t('updates.actions.check')}
            </Button>
            {isManualMacUpdate ? (
              <Button
                variant="outline"
                className="h-9 px-4"
                onClick={() => {
                  if (!manualDownloadUrl) {
                    return;
                  }
                  void invokeIpc('shell:openExternal', manualDownloadUrl);
                }}
                disabled={!canManualDownload}
              >
                <Download className="mr-2 h-4 w-4" />
                {t('updates.actions.downloadLatest')}
              </Button>
            ) : (
              <>
                <Button
                  variant="outline"
                  className="h-9 px-4"
                  onClick={() => void downloadUpdate()}
                  disabled={!canDownload || isDownloading}
                  aria-busy={isDownloading}
                >
                  {isDownloading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                  {t('updates.actions.download')}
                </Button>
                <Button
                  className="h-9 px-4"
                  onClick={installUpdate}
                  disabled={!canInstall}
                >
                  <Sparkles className="mr-2 h-4 w-4" />
                  {t('updates.actions.install')}
                </Button>
              </>
            )}
          </div>
        </div>

        <div className="mt-4 rounded-[14px] border border-border/50 bg-[hsl(var(--surface-base)/0.92)] px-4 py-3">
          <p className="text-sm text-foreground/82">
            {statusDetail}
          </p>
          {isDownloading && progress ? (
            <div className="mt-3 space-y-2">
              <Progress value={progress.percent} className="h-2.5 bg-[hsl(var(--foreground)/0.08)]" />
              <p className="text-[12px] text-muted-foreground">
                {t('updates.downloadProgress', { percent: Math.round(progress.percent) })}
              </p>
            </div>
          ) : null}
          {updateInfo?.releaseNotes ? (
            <div className="mt-3 rounded-[12px] border border-border/50 bg-[hsl(var(--surface-panel)/0.74)] px-3 py-2">
              <p className="text-[12px] uppercase tracking-[0.12em] text-muted-foreground/72">{t('updates.releaseNotes')}</p>
              <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-foreground/78">{updateInfo.releaseNotes}</p>
            </div>
          ) : null}
        </div>
      </section>

      <section className={panelClass}>
        <div className="space-y-3">
          <div className={rowClass}>
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">{t('updates.autoCheck')}</p>
              <p className="text-[13px] leading-6 text-muted-foreground">{t('updates.autoCheckDesc')}</p>
            </div>
            <Switch checked={autoCheckUpdate} onCheckedChange={setAutoCheckUpdate} />
          </div>

          {isAutoUpdatePlatform ? (
            <div className={rowClass}>
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">{t('updates.autoDownload')}</p>
                <p className="text-[13px] leading-6 text-muted-foreground">{t('updates.autoDownloadDesc')}</p>
              </div>
              <Switch
                checked={autoDownloadUpdate}
                onCheckedChange={(value) => {
                  setAutoDownloadUpdate(value);
                  void setAutoDownload(value);
                }}
              />
            </div>
          ) : null}

          <div className={rowClass}>
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">{t('updates.channel')}</p>
              <p className="text-[13px] leading-6 text-muted-foreground">{t('updates.channelDesc')}</p>
            </div>
            <span className="inline-flex items-center rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
              {t('updates.channels.beta')}
            </span>
          </div>

          {isManualMacUpdate ? (
            <div className={rowClass}>
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">{t('updates.manualDownloadTitle')}</p>
                <p className="text-[13px] leading-6 text-muted-foreground">{t('updates.manualDownloadDesc')}</p>
              </div>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}

export default UpdateSettings;
