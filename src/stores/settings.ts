/**
 * Settings State Store
 * Manages application settings
 */
import { createWithEqualityFn } from 'zustand/traditional';
import { shallow } from 'zustand/shallow';
import { persist } from 'zustand/middleware';
import i18n from '@/i18n';
import { hostApiFetch } from '@/lib/host-api';
import { resolveSupportedLanguage } from '../../shared/language';

type Theme = 'light' | 'dark' | 'system';
type UpdateChannel = 'stable' | 'beta' | 'dev';
type GatewayDesiredState = 'running' | 'stopped';
type GatewayManagedMode = 'managed' | 'unmanaged';
type GlobalWallpaperStatePayload = {
  globalWallpaperEnabled?: boolean;
  globalWallpaperOpacity?: number;
  globalWallpaperAssetKey?: string;
  globalWallpaperAssetPath?: string;
};
type SettingsPayload = Partial<typeof defaultSettings> & {
  gatewayDesiredState?: GatewayDesiredState;
  gatewayManagedMode?: GatewayManagedMode;
  globalWallpaperAssetPath?: string;
};
const GLOBAL_WALLPAPER_OPACITY_MIN = 0.12;
const GLOBAL_WALLPAPER_OPACITY_MAX = 0.88;

export const SIDEBAR_RAIL_WIDTH = 44;
export const SIDEBAR_WIDTH_MIN = 200;
export const SIDEBAR_WIDTH_MAX = 360;
export const SIDEBAR_WIDTH_DEFAULT = 250;

function clampSidebarWidth(value: number) {
  if (!Number.isFinite(value)) {
    return SIDEBAR_WIDTH_DEFAULT;
  }

  return Math.min(SIDEBAR_WIDTH_MAX, Math.max(SIDEBAR_WIDTH_MIN, Math.round(value)));
}

function resolveSidebarWidth(value: unknown) {
  if (typeof value === 'number') {
    return clampSidebarWidth(value);
  }

  return SIDEBAR_WIDTH_DEFAULT;
}

function resolveGatewayDesiredState(
  gatewayDesiredState: unknown,
  gatewayAutoStart: unknown,
): GatewayDesiredState {
  if (gatewayDesiredState === 'running' || gatewayDesiredState === 'stopped') {
    return gatewayDesiredState;
  }
  return gatewayAutoStart === false ? 'stopped' : 'running';
}

function resolveGatewayManagedMode(
  gatewayManagedMode: unknown,
  setupComplete: unknown,
): GatewayManagedMode {
  if (gatewayManagedMode === 'managed' || gatewayManagedMode === 'unmanaged') {
    return gatewayManagedMode;
  }
  return setupComplete === true ? 'managed' : 'unmanaged';
}

function clampGlobalWallpaperOpacity(value: number) {
  if (!Number.isFinite(value)) {
    return 0.36;
  }
  return Math.min(GLOBAL_WALLPAPER_OPACITY_MAX, Math.max(GLOBAL_WALLPAPER_OPACITY_MIN, Math.round(value * 100) / 100));
}

function resolveGlobalWallpaperOpacity(value: unknown) {
  return typeof value === 'number' ? clampGlobalWallpaperOpacity(value) : 0.36;
}

function resolveGlobalWallpaperAssetKey(value: unknown) {
  return typeof value === 'string'
    ? value.trim().split(/[\\/]/).filter(Boolean).pop() ?? ''
    : '';
}

function resolveGlobalWallpaperAssetInputKey(payload: {
  globalWallpaperAssetKey?: unknown;
  globalWallpaperAssetPath?: unknown;
}) {
  return resolveGlobalWallpaperAssetKey(
    typeof payload.globalWallpaperAssetKey === 'string' && payload.globalWallpaperAssetKey.trim().length > 0
      ? payload.globalWallpaperAssetKey
      : payload.globalWallpaperAssetPath,
  );
}

interface SettingsState {
  // General
  theme: Theme;
  language: string;
  startMinimized: boolean;
  launchAtStartup: boolean;
  telemetryEnabled: boolean;
  globalWallpaperEnabled: boolean;
  globalWallpaperOpacity: number;
  globalWallpaperAssetKey: string;

  // Gateway
  gatewayAutoStart: boolean;
  gatewayDesiredState: GatewayDesiredState;
  gatewayManagedMode: GatewayManagedMode;
  gatewayPort: number;
  proxyEnabled: boolean;
  proxyServer: string;
  proxyHttpServer: string;
  proxyHttpsServer: string;
  proxyAllServer: string;
  proxyBypassRules: string;

  // Update
  updateChannel: UpdateChannel;
  autoCheckUpdate: boolean;
  autoDownloadUpdate: boolean;

  // UI State
  sidebarCollapsed: boolean;
  sidebarWidth: number;
  chatFocusMode: boolean;
  devModeUnlocked: boolean;

  // Setup
  setupComplete: boolean;
  initialized: boolean;

  // Actions
  init: () => Promise<void>;
  setTheme: (theme: Theme) => void;
  setLanguage: (language: string) => void;
  setStartMinimized: (value: boolean) => void;
  setLaunchAtStartup: (value: boolean) => void;
  setTelemetryEnabled: (value: boolean) => void;
  setGlobalWallpaperEnabled: (value: boolean) => void;
  setGlobalWallpaperOpacity: (value: number) => void;
  syncGlobalWallpaperState: (value: GlobalWallpaperStatePayload) => void;
  setGatewayAutoStart: (value: boolean) => void;
  setGatewayPort: (port: number) => void;
  setProxyEnabled: (value: boolean) => void;
  setProxyServer: (value: string) => void;
  setProxyHttpServer: (value: string) => void;
  setProxyHttpsServer: (value: string) => void;
  setProxyAllServer: (value: string) => void;
  setProxyBypassRules: (value: string) => void;
  setUpdateChannel: (channel: UpdateChannel) => void;
  setAutoCheckUpdate: (value: boolean) => void;
  setAutoDownloadUpdate: (value: boolean) => void;
  setSidebarCollapsed: (value: boolean) => void;
  setSidebarWidth: (value: number) => void;
  setChatFocusMode: (value: boolean) => void;
  setDevModeUnlocked: (value: boolean) => void;
  markSetupComplete: (options?: { persist?: boolean }) => void;
  resetSettings: () => void;
}

const defaultSettings = {
  theme: 'light' as Theme,
  language: resolveSupportedLanguage(typeof navigator !== 'undefined' ? navigator.language : undefined),
  startMinimized: false,
  launchAtStartup: false,
  telemetryEnabled: true,
  globalWallpaperEnabled: false,
  globalWallpaperOpacity: 0.36,
  globalWallpaperAssetKey: '',
  gatewayAutoStart: true,
  gatewayDesiredState: 'running' as GatewayDesiredState,
  gatewayManagedMode: 'unmanaged' as GatewayManagedMode,
  gatewayPort: 18789,
  proxyEnabled: false,
  proxyServer: '',
  proxyHttpServer: '',
  proxyHttpsServer: '',
  proxyAllServer: '',
  proxyBypassRules: '<local>;localhost;127.0.0.1;::1',
  updateChannel: 'beta' as UpdateChannel,
  autoCheckUpdate: true,
  autoDownloadUpdate: false,
  sidebarCollapsed: false,
  sidebarWidth: SIDEBAR_WIDTH_DEFAULT,
  chatFocusMode: false,
  devModeUnlocked: false,
  setupComplete: false,
  initialized: false,
};

export const useSettingsStore = createWithEqualityFn<SettingsState>()(
  persist(
    (set) => ({
      ...defaultSettings,

      init: async () => {
        try {
          const settings = await hostApiFetch<SettingsPayload>('/api/settings');
          const resolvedLanguage = settings.language
            ? resolveSupportedLanguage(settings.language)
            : undefined;
          const setupComplete = settings.setupComplete === true;
          const globalWallpaperAssetKey = resolveGlobalWallpaperAssetInputKey(settings);
          const gatewayDesiredState = resolveGatewayDesiredState(
            settings.gatewayDesiredState,
            settings.gatewayAutoStart,
          );
          const gatewayManagedMode = resolveGatewayManagedMode(
            settings.gatewayManagedMode,
            setupComplete,
          );
          set((state) => ({
            ...state,
            ...settings,
            globalWallpaperAssetKey,
            globalWallpaperOpacity: resolveGlobalWallpaperOpacity(settings.globalWallpaperOpacity),
            globalWallpaperEnabled: settings.globalWallpaperEnabled === true
              && globalWallpaperAssetKey.length > 0,
            sidebarWidth: resolveSidebarWidth(settings.sidebarWidth ?? state.sidebarWidth),
            setupComplete,
            initialized: true,
            gatewayDesiredState,
            gatewayManagedMode,
            gatewayAutoStart: gatewayDesiredState === 'running',
            ...(resolvedLanguage ? { language: resolvedLanguage } : {}),
          }));
          if (resolvedLanguage) {
            i18n.changeLanguage(resolvedLanguage);
          }
        } catch {
          set({ initialized: true });
          // Keep renderer-persisted settings as a fallback when the main
          // process store is not reachable.
        }
      },

      setTheme: (theme) => {
        set({ theme });
        void hostApiFetch('/api/settings/theme', {
          method: 'PUT',
          body: JSON.stringify({ value: theme }),
        }).catch(() => { });
      },
      setLanguage: (language) => {
        const resolvedLanguage = resolveSupportedLanguage(language);
        i18n.changeLanguage(resolvedLanguage);
        set({ language: resolvedLanguage });
        void hostApiFetch('/api/settings/language', {
          method: 'PUT',
          body: JSON.stringify({ value: resolvedLanguage }),
        }).catch(() => { });
      },
      setStartMinimized: (startMinimized) => set({ startMinimized }),
      setLaunchAtStartup: (launchAtStartup) => {
        set({ launchAtStartup });
        void hostApiFetch('/api/settings/launchAtStartup', {
          method: 'PUT',
          body: JSON.stringify({ value: launchAtStartup }),
        }).catch(() => { });
      },
      setTelemetryEnabled: (telemetryEnabled) => {
        set({ telemetryEnabled });
        void hostApiFetch('/api/settings/telemetryEnabled', {
          method: 'PUT',
          body: JSON.stringify({ value: telemetryEnabled }),
        }).catch(() => { });
      },
      setGlobalWallpaperEnabled: (globalWallpaperEnabled) => {
        set((state) => ({
          globalWallpaperEnabled: globalWallpaperEnabled && state.globalWallpaperAssetKey.length > 0,
        }));
        void hostApiFetch('/api/settings/globalWallpaperEnabled', {
          method: 'PUT',
          body: JSON.stringify({ value: globalWallpaperEnabled }),
        }).catch(() => { });
      },
      setGlobalWallpaperOpacity: (globalWallpaperOpacity) => {
        const nextOpacity = clampGlobalWallpaperOpacity(globalWallpaperOpacity);
        set({ globalWallpaperOpacity: nextOpacity });
        void hostApiFetch('/api/settings/globalWallpaperOpacity', {
          method: 'PUT',
          body: JSON.stringify({ value: nextOpacity }),
        }).catch(() => { });
      },
      syncGlobalWallpaperState: (value) => set((state) => {
        const globalWallpaperAssetKey = value.globalWallpaperAssetKey === undefined && value.globalWallpaperAssetPath === undefined
          ? state.globalWallpaperAssetKey
          : resolveGlobalWallpaperAssetInputKey(value);
        const globalWallpaperOpacity = value.globalWallpaperOpacity === undefined
          ? state.globalWallpaperOpacity
          : resolveGlobalWallpaperOpacity(value.globalWallpaperOpacity);
        return {
          globalWallpaperAssetKey,
          globalWallpaperOpacity,
          globalWallpaperEnabled: value.globalWallpaperEnabled === undefined
            ? state.globalWallpaperEnabled && globalWallpaperAssetKey.length > 0
            : value.globalWallpaperEnabled === true && globalWallpaperAssetKey.length > 0,
        };
      }),
      setGatewayAutoStart: (gatewayAutoStart) => {
        set({
          gatewayAutoStart,
          gatewayDesiredState: gatewayAutoStart ? 'running' : 'stopped',
        });
        void hostApiFetch('/api/settings/gatewayAutoStart', {
          method: 'PUT',
          body: JSON.stringify({ value: gatewayAutoStart }),
        }).catch(() => { });
      },
      setGatewayPort: (gatewayPort) => {
        set({ gatewayPort });
        void hostApiFetch('/api/settings/gatewayPort', {
          method: 'PUT',
          body: JSON.stringify({ value: gatewayPort }),
        }).catch(() => { });
      },
      setProxyEnabled: (proxyEnabled) => set({ proxyEnabled }),
      setProxyServer: (proxyServer) => set({ proxyServer }),
      setProxyHttpServer: (proxyHttpServer) => set({ proxyHttpServer }),
      setProxyHttpsServer: (proxyHttpsServer) => set({ proxyHttpsServer }),
      setProxyAllServer: (proxyAllServer) => set({ proxyAllServer }),
      setProxyBypassRules: (proxyBypassRules) => set({ proxyBypassRules }),
      setUpdateChannel: (updateChannel) => {
        set({ updateChannel });
        void hostApiFetch('/api/settings/updateChannel', {
          method: 'PUT',
          body: JSON.stringify({ value: updateChannel }),
        }).catch(() => { });
      },
      setAutoCheckUpdate: (autoCheckUpdate) => {
        set({ autoCheckUpdate });
        void hostApiFetch('/api/settings/autoCheckUpdate', {
          method: 'PUT',
          body: JSON.stringify({ value: autoCheckUpdate }),
        }).catch(() => { });
      },
      setAutoDownloadUpdate: (autoDownloadUpdate) => {
        set({ autoDownloadUpdate });
        void hostApiFetch('/api/settings/autoDownloadUpdate', {
          method: 'PUT',
          body: JSON.stringify({ value: autoDownloadUpdate }),
        }).catch(() => { });
      },
      setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),
      setSidebarWidth: (sidebarWidth) => set({ sidebarWidth: clampSidebarWidth(sidebarWidth) }),
      setChatFocusMode: (chatFocusMode) => set({ chatFocusMode }),
      setDevModeUnlocked: (devModeUnlocked) => {
        set({ devModeUnlocked });
        void hostApiFetch('/api/settings/devModeUnlocked', {
          method: 'PUT',
          body: JSON.stringify({ value: devModeUnlocked }),
        }).catch(() => { });
      },
      markSetupComplete: (options) => {
        set({ setupComplete: true });
        if (options?.persist === false) {
          return;
        }
        void hostApiFetch('/api/settings/setupComplete', {
          method: 'PUT',
          body: JSON.stringify({ value: true }),
        }).catch(() => { });
      },
      resetSettings: () => set(defaultSettings),
    }),
    {
      name: 'XClaw-settings',
      partialize: (state) => {
        const { setupComplete, initialized, ...rest } = state;
        void setupComplete;
        void initialized;
        return rest;
      },
      migrate: (persistedState) => {
        if (!persistedState || typeof persistedState !== 'object') {
          return persistedState;
        }
        const nextState = { ...(persistedState as Record<string, unknown>) };
        delete nextState.setupComplete;
        delete nextState.initialized;
        nextState.sidebarWidth = resolveSidebarWidth(nextState.sidebarWidth);
        return nextState;
      },
    }
  ),
  shallow,
);
