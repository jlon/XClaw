import { BrowserWindow, app, ipcMain } from 'electron';
import { EventEmitter } from 'events';
import { logger } from '../utils/logger';

const AUTO_UPDATE_DISABLED_MESSAGE = 'Built-in auto updates are disabled in this build.';

export interface UpdateStatus {
  status: 'disabled' | 'error';
  info?: undefined;
  progress?: undefined;
  error?: string;
}

export interface UpdaterEvents {
  'status-changed': (status: UpdateStatus) => void;
  error: (error: Error) => void;
}

export class AppUpdater extends EventEmitter {
  private mainWindow: BrowserWindow | null = null;
  private status: UpdateStatus = {
    status: 'disabled',
    error: AUTO_UPDATE_DISABLED_MESSAGE,
  };

  constructor() {
    super();
    this.on('error', (error: Error) => {
      logger.error('[Updater] AppUpdater emitted error:', error);
    });
    logger.info(`[Updater] ${AUTO_UPDATE_DISABLED_MESSAGE}`);
  }

  setMainWindow(window: BrowserWindow): void {
    this.mainWindow = window;
    this.sendToRenderer('update:status-changed', this.status);
  }

  getStatus(): UpdateStatus {
    return this.status;
  }

  private updateStatus(newStatus: UpdateStatus): void {
    this.status = newStatus;
    this.sendToRenderer('update:status-changed', this.status);
    this.emit('status-changed', this.status);
  }

  private sendToRenderer(channel: string, data: unknown): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send(channel, data);
    }
  }

  async checkForUpdates(): Promise<null> {
    this.updateStatus({
      status: 'disabled',
      error: AUTO_UPDATE_DISABLED_MESSAGE,
    });
    return null;
  }

  async downloadUpdate(): Promise<void> {
    this.updateStatus({
      status: 'disabled',
      error: AUTO_UPDATE_DISABLED_MESSAGE,
    });
    throw new Error(AUTO_UPDATE_DISABLED_MESSAGE);
  }

  quitAndInstall(): void {
    this.updateStatus({
      status: 'disabled',
      error: AUTO_UPDATE_DISABLED_MESSAGE,
    });
    logger.warn(`[Updater] install skipped: ${AUTO_UPDATE_DISABLED_MESSAGE}`);
  }

  cancelAutoInstall(): void {
    this.sendToRenderer('update:auto-install-countdown', { seconds: -1, cancelled: true });
  }

  setChannel(_channel: 'stable' | 'beta' | 'dev'): void {
    logger.info(`[Updater] setChannel ignored: ${AUTO_UPDATE_DISABLED_MESSAGE}`);
  }

  setAutoDownload(_enable: boolean): void {
    logger.info(`[Updater] setAutoDownload ignored: ${AUTO_UPDATE_DISABLED_MESSAGE}`);
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

  ipcMain.handle('update:status', () => updater.getStatus());

  ipcMain.handle('update:version', () => updater.getCurrentVersion());

  ipcMain.handle('update:check', async () => {
    await updater.checkForUpdates();
    return {
      success: false,
      error: AUTO_UPDATE_DISABLED_MESSAGE,
      status: updater.getStatus(),
    };
  });

  ipcMain.handle('update:download', async () => {
    try {
      await updater.downloadUpdate();
      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  ipcMain.handle('update:install', () => {
    updater.quitAndInstall();
    return { success: false, error: AUTO_UPDATE_DISABLED_MESSAGE };
  });

  ipcMain.handle('update:setChannel', (_, channel: 'stable' | 'beta' | 'dev') => {
    updater.setChannel(channel);
    return { success: false, error: AUTO_UPDATE_DISABLED_MESSAGE, channel };
  });

  ipcMain.handle('update:setAutoDownload', (_, enable: boolean) => {
    updater.setAutoDownload(enable);
    return { success: false, error: AUTO_UPDATE_DISABLED_MESSAGE, enable };
  });

  ipcMain.handle('update:cancelAutoInstall', () => {
    updater.cancelAutoInstall();
    return { success: false, error: AUTO_UPDATE_DISABLED_MESSAGE };
  });
}

export const appUpdater = new AppUpdater();
