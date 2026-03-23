/**
 * Update State Store
 * Manages application update state
 */
import { create } from 'zustand';
import { invokeIpc } from '@/lib/api-client';

export interface UpdateInfo {
  version: string;
  releaseDate?: string;
  releaseNotes?: string | null;
}

export interface ProgressInfo {
  total: number;
  delta: number;
  transferred: number;
  percent: number;
  bytesPerSecond: number;
}

export type UpdateStatus = 
  | 'idle'
  | 'disabled'
  | 'error';

interface UpdateState {
  status: UpdateStatus;
  currentVersion: string;
  updateInfo: UpdateInfo | null;
  progress: ProgressInfo | null;
  error: string | null;
  isInitialized: boolean;
  /** Seconds remaining before auto-install, or null if inactive. */
  autoInstallCountdown: number | null;

  // Actions
  init: () => Promise<void>;
  checkForUpdates: () => Promise<void>;
  downloadUpdate: () => Promise<void>;
  installUpdate: () => void;
  cancelAutoInstall: () => Promise<void>;
  setChannel: (channel: 'stable' | 'beta' | 'dev') => Promise<void>;
  setAutoDownload: (enable: boolean) => Promise<void>;
  clearError: () => void;
}

export const useUpdateStore = create<UpdateState>((set, get) => ({
  status: 'idle',
  currentVersion: '0.0.0',
  updateInfo: null,
  progress: null,
  error: null,
  isInitialized: false,
  autoInstallCountdown: null,

  init: async () => {
    if (get().isInitialized) return;

    // Get current version
    try {
      const version = await invokeIpc<string>('update:version');
      set({ currentVersion: version as string });
    } catch (error) {
      console.error('Failed to get version:', error);
    }

    // Get current status
    try {
      const status = await invokeIpc<{
        status: UpdateStatus;
        info?: UpdateInfo;
        progress?: ProgressInfo;
        error?: string;
      }>('update:status');
      set({
        status: status.status,
        updateInfo: status.info || null,
        progress: status.progress || null,
        error: status.error || null,
      });
    } catch (error) {
      console.error('Failed to get update status:', error);
    }

    // Listen for update events
    // Single source of truth: listen only to update:status-changed
    // (sent by AppUpdater.updateStatus() in the main process)
    window.electron?.ipcRenderer?.on('update:status-changed', (data) => {
      const status = data as {
        status: UpdateStatus;
        info?: UpdateInfo;
        progress?: ProgressInfo;
        error?: string;
      };
      set({
        status: status.status,
        updateInfo: status.info || null,
        progress: status.progress || null,
        error: status.error || null,
      });
    });

    window.electron?.ipcRenderer?.on('update:auto-install-countdown', (data) => {
      const { seconds, cancelled } = data as { seconds: number; cancelled?: boolean };
      set({ autoInstallCountdown: cancelled ? null : seconds });
    });

    set({ isInitialized: true });

  },

  checkForUpdates: async () => {
    set({
      status: 'disabled',
      error: 'Built-in auto updates are disabled in this build.',
      updateInfo: null,
      progress: null,
      autoInstallCountdown: null,
    });
  },

  downloadUpdate: async () => {
    set({
      status: 'disabled',
      error: 'Built-in auto updates are disabled in this build.',
      updateInfo: null,
      progress: null,
      autoInstallCountdown: null,
    });
  },

  installUpdate: () => {
    set({
      status: 'disabled',
      error: 'Built-in auto updates are disabled in this build.',
      autoInstallCountdown: null,
    });
  },

  cancelAutoInstall: async () => {
    set({ autoInstallCountdown: null });
  },

  setChannel: async (channel) => {
    void channel;
  },

  setAutoDownload: async (enable) => {
    void enable;
  },

  clearError: () => set({ error: null, status: 'disabled' }),
}));
