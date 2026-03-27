import { create } from 'zustand';
import { invokeIpc } from '@/lib/api-client';

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

export type UpdateStatus = 
  | 'idle'
  | 'checking'
  | 'available'
  | 'not-available'
  | 'downloading'
  | 'downloaded'
  | 'unsupported'
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

    try {
      const version = await invokeIpc<string>('update:version');
      set({ currentVersion: version as string });
    } catch (error) {
      console.error('Failed to get version:', error);
    }

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
    const result = await invokeIpc<{
      success?: boolean;
      status?: {
        status: UpdateStatus;
        info?: UpdateInfo;
        progress?: ProgressInfo;
        error?: string;
      };
      error?: string;
    }>('update:check');
    if (result?.status) {
      set({
        status: result.status.status,
        updateInfo: result.status.info || null,
        progress: result.status.progress || null,
        error: result.status.error || null,
      });
      return;
    }
    if (result?.error) {
      set({ status: 'error', error: result.error });
    }
  },

  downloadUpdate: async () => {
    const result = await invokeIpc<{
      success?: boolean;
      status?: {
        status: UpdateStatus;
        info?: UpdateInfo;
        progress?: ProgressInfo;
        error?: string;
      };
      error?: string;
    }>('update:download');
    if (result?.status) {
      set({
        status: result.status.status,
        updateInfo: result.status.info || null,
        progress: result.status.progress || null,
        error: result.status.error || null,
      });
      return;
    }
    if (result?.error) {
      set({ status: 'error', error: result.error });
    }
  },

  installUpdate: () => {
    void invokeIpc('update:install');
  },

  cancelAutoInstall: async () => {
    await invokeIpc('update:cancelAutoInstall');
    set({ autoInstallCountdown: null });
  },

  setChannel: async (channel) => {
    await invokeIpc('update:setChannel', channel);
  },

  setAutoDownload: async (enable) => {
    await invokeIpc('update:setAutoDownload', enable);
  },

  clearError: () => set((state) => ({
    error: null,
    status: state.status === 'error' ? 'idle' : state.status,
  })),
}));
