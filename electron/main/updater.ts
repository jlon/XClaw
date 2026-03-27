import { BrowserWindow, app, ipcMain } from 'electron';
import { EventEmitter } from 'events';
import { autoUpdater } from 'electron-updater';
import { gt, valid } from 'semver';
import { getSetting } from '../utils/store';
import { logger } from '../utils/logger';
import updateFeeds from '../../config/build/update-feeds.json';

type UpdateChannel = 'beta';

type ManualFeedAsset = {
  name: string;
};

type ManualFeed = {
  version: string;
  releaseDate?: string;
  downloads?: {
    macArm64?: ManualFeedAsset;
    macX64?: ManualFeedAsset;
  };
};

export interface UpdateInfo {
  version: string;
  releaseDate?: string;
  releaseNotes?: string | null;
  downloadUrl?: string;
}

export interface ProgressInfo {
  total: number;
  delta: number;
  transferred: number;
  percent: number;
  bytesPerSecond: number;
}

export interface UpdateStatus {
  status: 'idle' | 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error' | 'unsupported';
  info?: UpdateInfo;
  progress?: ProgressInfo;
  error?: string;
}

export interface UpdaterEvents {
  'status-changed': (status: UpdateStatus) => void;
  error: (error: Error) => void;
}

const DEFAULT_UNSUPPORTED_MESSAGE = 'Automatic updates are only available in packaged builds.';
const MANUAL_MAC_UPDATE_MESSAGE = 'Manual update is required on macOS';

const STATUS_EVENT_MAP: Record<UpdateStatus['status'], string | null> = {
  idle: null,
  checking: 'update:checking',
  available: 'update:available',
  'not-available': 'update:not-available',
  downloading: 'update:progress',
  downloaded: 'update:downloaded',
  error: 'update:error',
  unsupported: 'update:error',
};

function isWindowsAutoUpdatePlatform(): boolean {
  return process.platform === 'win32';
}

function isMacManualUpdatePlatform(): boolean {
  return process.platform === 'darwin';
}

function resolveChannel(): UpdateChannel {
  return 'beta';
}

function resolveFeedUrl(): string {
  return `${updateFeeds.baseUrl}/${updateFeeds.channels.beta}`;
}

function resolveManualFeedUrl(): string {
  return `${resolveFeedUrl()}/feed.json`;
}

function resolveManualDownloadName(feed: ManualFeed): string | null {
  if (!feed.downloads) {
    return null;
  }
  if (process.arch === 'arm64') {
    return feed.downloads.macArm64?.name || feed.downloads.macX64?.name || null;
  }
  return feed.downloads.macX64?.name || feed.downloads.macArm64?.name || null;
}

function resolveManualDownloadUrl(feed: ManualFeed): string | undefined {
  const downloadName = resolveManualDownloadName(feed);
  return downloadName ? `${resolveFeedUrl()}/${downloadName}` : undefined;
}

function isNewerVersion(currentVersion: string, nextVersion: string): boolean {
  if (valid(currentVersion) && valid(nextVersion)) {
    return gt(nextVersion, currentVersion);
  }
  return currentVersion !== nextVersion;
}

function normalizeUpdateInfo(info: unknown): UpdateInfo | undefined {
  if (!info || typeof info !== 'object') {
    return undefined;
  }
  const record = info as Record<string, unknown>;
  const version = typeof record.version === 'string'
    ? record.version
    : typeof record.tag === 'string'
      ? record.tag
      : null;
  if (!version) {
    return undefined;
  }
  const downloadUrl = typeof record.downloadUrl === 'string' ? record.downloadUrl : undefined;
  return {
    version,
    releaseDate: typeof record.releaseDate === 'string' ? record.releaseDate : undefined,
    releaseNotes: typeof record.releaseNotes === 'string' || record.releaseNotes === null
      ? record.releaseNotes as string | null
      : null,
    downloadUrl,
  };
}

function normalizeProgress(progress: unknown): ProgressInfo | undefined {
  if (!progress || typeof progress !== 'object') {
    return undefined;
  }
  const record = progress as Record<string, unknown>;
  const numberOrZero = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? value : 0;
  return {
    total: numberOrZero(record.total),
    delta: numberOrZero(record.delta),
    transferred: numberOrZero(record.transferred),
    percent: numberOrZero(record.percent),
    bytesPerSecond: numberOrZero(record.bytesPerSecond),
  };
}

async function fetchManualFeed(): Promise<ManualFeed> {
  const response = await fetch(resolveManualFeedUrl(), { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`Failed to fetch beta feed metadata: ${response.status} ${response.statusText}`);
  }
  return await response.json() as ManualFeed;
}

export class AppUpdater extends EventEmitter {
  private mainWindow: BrowserWindow | null = null;
  private status: UpdateStatus;
  private channel: UpdateChannel = 'beta';
  private preferencesLoaded = false;
  private initialized = false;

  constructor() {
    super();
    this.status = app.isPackaged
      ? { status: 'idle' }
      : { status: 'unsupported', error: DEFAULT_UNSUPPORTED_MESSAGE };

    autoUpdater.logger = logger;
    autoUpdater.autoInstallOnAppQuit = false;
    autoUpdater.autoRunAppAfterInstall = true;
    autoUpdater.autoDownload = false;

    autoUpdater.on('checking-for-update', () => {
      this.updateStatus({
        status: 'checking',
        info: this.status.info,
      });
    });

    autoUpdater.on('update-available', (info) => {
      this.updateStatus({
        status: 'available',
        info: normalizeUpdateInfo(info),
      });
    });

    autoUpdater.on('update-not-available', (info) => {
      this.updateStatus({
        status: 'not-available',
        info: normalizeUpdateInfo(info),
      });
    });

    autoUpdater.on('download-progress', (progress) => {
      this.updateStatus({
        status: 'downloading',
        info: this.status.info,
        progress: normalizeProgress(progress),
      });
    });

    autoUpdater.on('update-downloaded', (info) => {
      this.updateStatus({
        status: 'downloaded',
        info: normalizeUpdateInfo(info) || this.status.info,
      });
    });

    autoUpdater.on('error', (error: Error) => {
      this.updateStatus({
        status: 'error',
        info: this.status.info,
        error: error.message || String(error),
      });
      this.emit('error', error);
    });

    this.on('error', (error: Error) => {
      logger.error('[Updater] AppUpdater emitted error:', error);
    });
  }

  setMainWindow(window: BrowserWindow): void {
    this.mainWindow = window;
    this.sendStatus(this.status);
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }
    this.initialized = true;

    await this.loadPreferences();

    const autoCheckUpdate = await getSetting('autoCheckUpdate').catch(() => true);
    if (!autoCheckUpdate || !app.isPackaged) {
      return;
    }

    await this.checkForUpdates().catch((error) => {
      logger.warn('[Updater] initial check failed:', error);
    });
  }

  getStatus(): UpdateStatus {
    return this.status;
  }

  private updateStatus(nextStatus: UpdateStatus): void {
    this.status = nextStatus;
    this.sendStatus(nextStatus);
    this.emit('status-changed', nextStatus);
  }

  private sendStatus(status: UpdateStatus): void {
    this.sendToRenderer('update:status-changed', status);
    const channel = STATUS_EVENT_MAP[status.status];
    if (channel) {
      this.sendToRenderer(channel, status);
    }
  }

  private sendToRenderer(channel: string, data: unknown): void {
    if (!this.mainWindow || this.mainWindow.isDestroyed()) {
      return;
    }
    this.mainWindow.webContents.send(channel, data);
  }

  private async loadPreferences(): Promise<void> {
    if (this.preferencesLoaded) {
      return;
    }
    this.preferencesLoaded = true;
    this.setChannel(resolveChannel());
    if (isWindowsAutoUpdatePlatform()) {
      const autoDownloadUpdate = await getSetting('autoDownloadUpdate').catch(() => false);
      this.setAutoDownload(Boolean(autoDownloadUpdate));
      return;
    }
    this.setAutoDownload(false);
  }

  private async checkForManualMacUpdates(): Promise<ManualFeed> {
    this.updateStatus({
      status: 'checking',
      info: this.status.info,
    });

    try {
      const feed = await fetchManualFeed();
      const downloadUrl = resolveManualDownloadUrl(feed);
      const info: UpdateInfo = {
        version: feed.version,
        releaseDate: feed.releaseDate,
        downloadUrl,
      };

      if (!isNewerVersion(app.getVersion(), feed.version)) {
        this.updateStatus({
          status: 'not-available',
          info,
        });
        return feed;
      }

      this.updateStatus({
        status: 'available',
        info,
      });
      return feed;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.updateStatus({
        status: 'error',
        info: this.status.info,
        error: message,
      });
      throw error;
    }
  }

  async checkForUpdates(): Promise<unknown> {
    if (!app.isPackaged) {
      this.updateStatus({ status: 'unsupported', error: DEFAULT_UNSUPPORTED_MESSAGE });
      return null;
    }
    await this.loadPreferences();
    if (isMacManualUpdatePlatform()) {
      return this.checkForManualMacUpdates();
    }
    if (!isWindowsAutoUpdatePlatform()) {
      this.updateStatus({ status: 'unsupported', error: 'Automatic updates are only supported on Windows in this build.' });
      return null;
    }
    return autoUpdater.checkForUpdates();
  }

  async downloadUpdate(): Promise<void> {
    if (!app.isPackaged) {
      this.updateStatus({ status: 'unsupported', error: DEFAULT_UNSUPPORTED_MESSAGE });
      throw new Error(DEFAULT_UNSUPPORTED_MESSAGE);
    }
    await this.loadPreferences();
    if (isMacManualUpdatePlatform()) {
      throw new Error(MANUAL_MAC_UPDATE_MESSAGE);
    }
    if (!isWindowsAutoUpdatePlatform()) {
      throw new Error('Automatic updates are only supported on Windows in this build.');
    }
    await autoUpdater.downloadUpdate();
  }

  quitAndInstall(): void {
    if (!app.isPackaged) {
      this.updateStatus({ status: 'unsupported', error: DEFAULT_UNSUPPORTED_MESSAGE });
      return;
    }
    if (isMacManualUpdatePlatform()) {
      logger.warn(`[Updater] install skipped: ${MANUAL_MAC_UPDATE_MESSAGE}`);
      return;
    }
    if (!isWindowsAutoUpdatePlatform()) {
      logger.warn('[Updater] install skipped: automatic updates are only supported on Windows in this build.');
      return;
    }
    autoUpdater.quitAndInstall();
  }

  cancelAutoInstall(): void {
    this.sendToRenderer('update:auto-install-countdown', { seconds: -1, cancelled: true });
  }

  setChannel(_channel: UpdateChannel | 'stable' | 'dev'): void {
    this.channel = 'beta';
    autoUpdater.setFeedURL({
      provider: 'generic',
      url: resolveFeedUrl(),
    });
    logger.info(`[Updater] configured channel=${this.channel} feed=${resolveFeedUrl()}`);
  }

  setAutoDownload(enable: boolean): void {
    autoUpdater.autoDownload = isWindowsAutoUpdatePlatform() && enable;
    logger.info(`[Updater] configured autoDownload=${String(autoUpdater.autoDownload)} channel=${this.channel}`);
  }

  getCurrentVersion(): string {
    return app.getVersion();
  }
}

export function registerUpdateHandlers(
  updater: AppUpdater,
  mainWindow: BrowserWindow,
): void {
  updater.setMainWindow(mainWindow);
  void updater.initialize();

  ipcMain.handle('update:status', () => updater.getStatus());

  ipcMain.handle('update:version', () => updater.getCurrentVersion());

  ipcMain.handle('update:check', async () => {
    try {
      await updater.checkForUpdates();
      return {
        success: true,
        status: updater.getStatus(),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        status: updater.getStatus(),
      };
    }
  });

  ipcMain.handle('update:download', async () => {
    try {
      await updater.downloadUpdate();
      return {
        success: true,
        status: updater.getStatus(),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        status: updater.getStatus(),
      };
    }
  });

  ipcMain.handle('update:install', () => {
    updater.quitAndInstall();
    return { success: true };
  });

  ipcMain.handle('update:setChannel', (_, channel: UpdateChannel | 'stable' | 'dev') => {
    updater.setChannel(channel);
    return { success: true, channel: 'beta', status: updater.getStatus() };
  });

  ipcMain.handle('update:setAutoDownload', (_, enable: boolean) => {
    updater.setAutoDownload(enable);
    return { success: true, enable, status: updater.getStatus() };
  });

  ipcMain.handle('update:cancelAutoInstall', () => {
    updater.cancelAutoInstall();
    return { success: true };
  });
}

export const appUpdater = new AppUpdater();
