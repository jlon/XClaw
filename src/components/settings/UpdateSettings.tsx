/**
 * Update Settings Component
 * Displays update status and allows manual update checking/installation
 */
import { useEffect, useCallback } from 'react';
import { Download, RefreshCw, Loader2, Rocket, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useUpdateStore } from '@/stores/update';
import { useTranslation } from 'react-i18next';

const updatePanelClass = 'space-y-3';
const summaryPanelClass =
  'rounded-[14px] border border-border/60 bg-[hsl(var(--surface-panel)/0.96)] p-4';
const statusRowClass =
  'flex flex-col gap-3 rounded-[14px] border border-border/60 bg-[hsl(var(--surface-base)/0.92)] px-4 py-4 sm:flex-row sm:items-center sm:justify-between';
const infoPanelClass =
  'rounded-[14px] border border-border/60 bg-[hsl(var(--surface-base)/0.92)] p-4';
const errorPanelClass =
  'rounded-[14px] border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive';
const infoSectionTitleClass = 'text-[12px] font-semibold uppercase tracking-[0.16em] text-foreground/56';

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export function UpdateSettings() {
  const { t } = useTranslation('settings');
  const {
    status,
    currentVersion,
    updateInfo,
    progress,
    error,
    isInitialized,
    autoInstallCountdown,
    init,
    checkForUpdates,
    downloadUpdate,
    installUpdate,
    cancelAutoInstall,
    clearError,
  } = useUpdateStore();

  // Initialize on mount
  useEffect(() => {
    init();
  }, [init]);

  const handleCheckForUpdates = useCallback(async () => {
    clearError();
    await checkForUpdates();
  }, [checkForUpdates, clearError]);

  const renderStatusIcon = () => {
    switch (status) {
      case 'checking':
      case 'downloading':
        return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />;
      case 'available':
        return <Download className="h-4 w-4 text-primary" />;
      case 'downloaded':
        return <Rocket className="h-4 w-4 text-primary" />;
      case 'error':
        return <RefreshCw className="h-4 w-4 text-destructive" />;
      default:
        return <RefreshCw className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const renderStatusText = () => {
    if (status === 'downloaded' && autoInstallCountdown != null && autoInstallCountdown >= 0) {
      return t('updates.status.autoInstalling', { seconds: autoInstallCountdown });
    }
    switch (status) {
      case 'checking':
        return t('updates.status.checking');
      case 'downloading':
        return t('updates.status.downloading');
      case 'available':
        return t('updates.status.available', { version: updateInfo?.version });
      case 'downloaded':
        return t('updates.status.downloaded', { version: updateInfo?.version });
      case 'error':
        return error || t('updates.status.failed');
      case 'not-available':
        return t('updates.status.latest');
      default:
        return t('updates.status.check');
    }
  };

  const renderAction = () => {
    switch (status) {
      case 'checking':
        return (
          <Button disabled variant="outline" size="sm">
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            {t('updates.action.checking')}
          </Button>
        );
      case 'downloading':
        return (
          <Button disabled variant="outline" size="sm">
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            {t('updates.action.downloading')}
          </Button>
        );
      case 'available':
        return (
          <Button onClick={downloadUpdate} size="sm">
            <Download className="h-4 w-4 mr-2" />
            {t('updates.action.download')}
          </Button>
        );
      case 'downloaded':
        if (autoInstallCountdown != null && autoInstallCountdown >= 0) {
          return (
            <Button onClick={cancelAutoInstall} size="sm" variant="outline">
              <XCircle className="h-4 w-4 mr-2" />
              {t('updates.action.cancelAutoInstall')}
            </Button>
          );
        }
        return (
          <Button onClick={installUpdate} size="sm" variant="default">
            <Rocket className="h-4 w-4 mr-2" />
            {t('updates.action.install')}
          </Button>
        );
      case 'error':
        return (
          <Button onClick={handleCheckForUpdates} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            {t('updates.action.retry')}
          </Button>
        );
      default:
        return (
          <Button onClick={handleCheckForUpdates} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            {t('updates.action.check')}
          </Button>
        );
    }
  };

  if (!isInitialized) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>{t('common:status.loading')}</span>
      </div>
    );
  }

  return (
    <div className={updatePanelClass}>
      <div className={summaryPanelClass}>
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-foreground/56">
              {t('updates.currentVersion')}
            </p>
            <p className="text-[26px] font-semibold tracking-tight text-foreground">v{currentVersion}</p>
          </div>
          <div className="mt-1">{renderStatusIcon()}</div>
        </div>
      </div>

      <div className={statusRowClass}>
        <p className="text-sm text-muted-foreground">{renderStatusText()}</p>
        {renderAction()}
      </div>

      {status === 'downloading' && progress && (
        <div className={infoPanelClass}>
          <div className="space-y-2">
            <p className={infoSectionTitleClass}>{t('updates.action.downloading')}</p>
            <div className="flex justify-between text-sm">
              <span>
                {formatBytes(progress.transferred)} / {formatBytes(progress.total)}
              </span>
              <span>{formatBytes(progress.bytesPerSecond)}/s</span>
            </div>
            <Progress value={progress.percent} className="h-2" />
            <p className="text-xs text-muted-foreground text-center">
              {t('updates.progressComplete', { percent: Math.round(progress.percent) })}
            </p>
          </div>
        </div>
      )}

      {updateInfo && (status === 'available' || status === 'downloaded') && (
        <div className={infoPanelClass}>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className={infoSectionTitleClass}>{t('updates.whatsNew')}</p>
              <p className="text-[15px] font-semibold text-foreground">
                {t('updates.releaseVersion', { version: updateInfo.version })}
              </p>
            </div>
            {updateInfo.releaseDate && (
              <p className="text-sm text-muted-foreground">
                {new Date(updateInfo.releaseDate).toLocaleDateString()}
              </p>
            )}
          </div>
          {updateInfo.releaseNotes && (
            <div className="mt-4 rounded-[12px] border border-border/60 bg-[hsl(var(--surface-panel)/0.94)] p-4 text-[13px] leading-6 text-muted-foreground">
              <p className="whitespace-pre-wrap">{updateInfo.releaseNotes}</p>
            </div>
          )}
        </div>
      )}

      {status === 'error' && error && (
        <div className={errorPanelClass}>
          <p className="mb-1 text-[12px] font-semibold uppercase tracking-[0.16em]">{t('updates.errorDetails')}</p>
          <p className="text-[13px] leading-6">{error}</p>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        {t('updates.help')}
      </p>
    </div>
  );
}

export default UpdateSettings;
