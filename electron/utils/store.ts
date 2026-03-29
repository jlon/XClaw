/**
 * Persistent Storage
 * Electron-store wrapper for application settings
 */

import { randomBytes } from 'crypto';
import { app } from 'electron';
import { resolveSupportedLanguage } from '../../shared/language';
import { getGlobalWallpaperAssetKey, isManagedGlobalWallpaperPath } from './global-wallpaper';
import { setOpenClawRootMode, type OpenClawRootMode } from './paths';

// Lazy-load electron-store (ESM module)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let settingsStoreInstance: any = null;

export type GatewayDesiredState = 'running' | 'stopped';
export type GatewayManagedMode = 'managed' | 'unmanaged';
const GLOBAL_WALLPAPER_OPACITY_MIN = 0.12;
const GLOBAL_WALLPAPER_OPACITY_MAX = 0.88;

/**
 * Generate a random token for gateway authentication
 */
function generateToken(): string {
  return `XClaw-${randomBytes(16).toString('hex')}`;
}

/**
 * Application settings schema
 */
export interface AppSettings {
  // General
  theme: 'light' | 'dark' | 'system';
  language: string;
  startMinimized: boolean;
  launchAtStartup: boolean;
  telemetryEnabled: boolean;
  globalWallpaperEnabled: boolean;
  globalWallpaperOpacity: number;
  globalWallpaperAssetPath: string;
  machineId: string;
  hasReportedInstall: boolean;
  setupComplete?: boolean;
  takeoverFingerprint?: string;
  openClawRootMode: OpenClawRootMode;

  // Gateway
  gatewayAutoStart: boolean;
  gatewayDesiredState: GatewayDesiredState;
  gatewayManagedMode: GatewayManagedMode;
  gatewayPort: number;
  studioPort: number;
  gatewayToken: string;
  proxyEnabled: boolean;
  proxyServer: string;
  proxyHttpServer: string;
  proxyHttpsServer: string;
  proxyAllServer: string;
  proxyBypassRules: string;

  // Update
  updateChannel: 'stable' | 'beta' | 'dev';
  autoCheckUpdate: boolean;
  autoDownloadUpdate: boolean;
  skippedVersions: string[];

  // UI State
  sidebarCollapsed: boolean;
  devModeUnlocked: boolean;

  // Presets
  selectedBundles: string[];
  enabledSkills: string[];
  disabledSkills: string[];
}

export interface PublicAppSettings {
  theme: AppSettings['theme'];
  language: AppSettings['language'];
  startMinimized: AppSettings['startMinimized'];
  launchAtStartup: AppSettings['launchAtStartup'];
  telemetryEnabled: AppSettings['telemetryEnabled'];
  globalWallpaperEnabled: AppSettings['globalWallpaperEnabled'];
  globalWallpaperOpacity: AppSettings['globalWallpaperOpacity'];
  globalWallpaperAssetKey: string;
  setupComplete: AppSettings['setupComplete'];
  gatewayAutoStart: AppSettings['gatewayAutoStart'];
  gatewayDesiredState: AppSettings['gatewayDesiredState'];
  gatewayManagedMode: AppSettings['gatewayManagedMode'];
  gatewayPort: AppSettings['gatewayPort'];
  proxyEnabled: AppSettings['proxyEnabled'];
  proxyServer: AppSettings['proxyServer'];
  proxyHttpServer: AppSettings['proxyHttpServer'];
  proxyHttpsServer: AppSettings['proxyHttpsServer'];
  proxyAllServer: AppSettings['proxyAllServer'];
  proxyBypassRules: AppSettings['proxyBypassRules'];
  updateChannel: AppSettings['updateChannel'];
  autoCheckUpdate: AppSettings['autoCheckUpdate'];
  autoDownloadUpdate: AppSettings['autoDownloadUpdate'];
  sidebarCollapsed: AppSettings['sidebarCollapsed'];
  devModeUnlocked: AppSettings['devModeUnlocked'];
}

const rendererReadableSettingKeys = new Set<keyof PublicAppSettings>([
  'theme',
  'language',
  'startMinimized',
  'launchAtStartup',
  'telemetryEnabled',
  'globalWallpaperEnabled',
  'globalWallpaperOpacity',
  'setupComplete',
  'gatewayAutoStart',
  'gatewayDesiredState',
  'gatewayManagedMode',
  'gatewayPort',
  'proxyEnabled',
  'proxyServer',
  'proxyHttpServer',
  'proxyHttpsServer',
  'proxyAllServer',
  'proxyBypassRules',
  'updateChannel',
  'autoCheckUpdate',
  'autoDownloadUpdate',
  'sidebarCollapsed',
  'devModeUnlocked',
]);

const rendererWritableSettingKeys = new Set<keyof AppSettings>([
  'theme',
  'language',
  'startMinimized',
  'launchAtStartup',
  'telemetryEnabled',
  'globalWallpaperEnabled',
  'globalWallpaperOpacity',
  'setupComplete',
  'gatewayAutoStart',
  'gatewayPort',
  'proxyEnabled',
  'proxyServer',
  'proxyHttpServer',
  'proxyHttpsServer',
  'proxyAllServer',
  'proxyBypassRules',
  'updateChannel',
  'autoCheckUpdate',
  'autoDownloadUpdate',
  'sidebarCollapsed',
  'devModeUnlocked',
]);

export function isRendererReadableSettingKey(key: string): key is keyof PublicAppSettings {
  return rendererReadableSettingKeys.has(key as keyof PublicAppSettings);
}

export function isRendererWritableSettingKey(key: string): key is keyof AppSettings {
  return rendererWritableSettingKeys.has(key as keyof AppSettings);
}

export function toPublicAppSettings(settings: AppSettings): PublicAppSettings {
  return {
    theme: settings.theme,
    language: settings.language,
    startMinimized: settings.startMinimized,
    launchAtStartup: settings.launchAtStartup,
    telemetryEnabled: settings.telemetryEnabled,
    globalWallpaperEnabled: settings.globalWallpaperEnabled,
    globalWallpaperOpacity: settings.globalWallpaperOpacity,
    globalWallpaperAssetKey: getGlobalWallpaperAssetKey(settings.globalWallpaperAssetPath),
    setupComplete: settings.setupComplete,
    gatewayAutoStart: settings.gatewayAutoStart,
    gatewayDesiredState: settings.gatewayDesiredState,
    gatewayManagedMode: settings.gatewayManagedMode,
    gatewayPort: settings.gatewayPort,
    proxyEnabled: settings.proxyEnabled,
    proxyServer: settings.proxyServer,
    proxyHttpServer: settings.proxyHttpServer,
    proxyHttpsServer: settings.proxyHttpsServer,
    proxyAllServer: settings.proxyAllServer,
    proxyBypassRules: settings.proxyBypassRules,
    updateChannel: settings.updateChannel,
    autoCheckUpdate: settings.autoCheckUpdate,
    autoDownloadUpdate: settings.autoDownloadUpdate,
    sidebarCollapsed: settings.sidebarCollapsed,
    devModeUnlocked: settings.devModeUnlocked,
  };
}

/**
 * Default settings
 */
function getSystemLocale(): string {
  const preferredLanguages = typeof app.getPreferredSystemLanguages === 'function'
    ? app.getPreferredSystemLanguages()
    : [];
  return preferredLanguages[0]
    || (typeof app.getLocale === 'function' ? app.getLocale() : '')
    || Intl.DateTimeFormat().resolvedOptions().locale
    || 'en';
}

function createDefaultSettings(): AppSettings {
  return {
    // General
    theme: 'light',
    language: resolveSupportedLanguage(getSystemLocale()),
    startMinimized: false,
    launchAtStartup: false,
    telemetryEnabled: true,
    globalWallpaperEnabled: false,
    globalWallpaperOpacity: 0.36,
    globalWallpaperAssetPath: '',
    machineId: '',
    hasReportedInstall: false,
    openClawRootMode: 'takeover',

    // Gateway
    gatewayAutoStart: true,
    gatewayDesiredState: 'running',
    gatewayManagedMode: 'unmanaged',
    gatewayPort: 18789,
    studioPort: 3211,
    gatewayToken: generateToken(),
    proxyEnabled: false,
    proxyServer: '',
    proxyHttpServer: '',
    proxyHttpsServer: '',
    proxyAllServer: '',
    proxyBypassRules: '<local>;localhost;127.0.0.1;::1',

    // Update
    updateChannel: 'beta',
    autoCheckUpdate: true,
    autoDownloadUpdate: false,
    skippedVersions: [],

    // UI State
    sidebarCollapsed: false,
    devModeUnlocked: false,

    // Presets
    selectedBundles: ['productivity', 'developer'],
    enabledSkills: [],
    disabledSkills: [],
  };
}

function resolveGatewayDesiredState(
  value: unknown,
  gatewayAutoStart: unknown,
): GatewayDesiredState {
  if (value === 'running' || value === 'stopped') {
    return value;
  }
  return gatewayAutoStart === false ? 'stopped' : 'running';
}

function resolveGatewayManagedMode(
  value: unknown,
  setupComplete: unknown,
): GatewayManagedMode {
  if (value === 'managed' || value === 'unmanaged') {
    return value;
  }
  return setupComplete === true ? 'managed' : 'unmanaged';
}

function getStoreValue<T>(store: {
  get: (key: keyof AppSettings) => T;
}, key: keyof AppSettings): T {
  return store.get(key);
}

function storeHasKey(
  store: {
    has?: (key: keyof AppSettings) => boolean;
    store?: Partial<AppSettings>;
  },
  key: keyof AppSettings,
): boolean {
  if (typeof store.has === 'function') {
    return store.has(key);
  }
  return Object.prototype.hasOwnProperty.call(store.store ?? {}, key);
}

function syncGatewayCompatibilitySettings(
  store: {
    get: <K extends keyof AppSettings>(key: K) => AppSettings[K];
    has?: (key: keyof AppSettings) => boolean;
    set: (value: Partial<AppSettings>) => void;
    store?: Partial<AppSettings>;
  },
): void {
  const gatewayAutoStart = getStoreValue(store, 'gatewayAutoStart');
  const gatewayDesiredState = resolveGatewayDesiredState(
    storeHasKey(store, 'gatewayDesiredState') ? getStoreValue(store, 'gatewayDesiredState') : undefined,
    gatewayAutoStart,
  );
  const gatewayManagedMode = resolveGatewayManagedMode(
    storeHasKey(store, 'gatewayManagedMode') ? getStoreValue(store, 'gatewayManagedMode') : undefined,
    getStoreValue(store, 'setupComplete'),
  );
  const nextGatewayAutoStart = gatewayDesiredState === 'running';
  const patch: Partial<AppSettings> = {};

  if (getStoreValue(store, 'gatewayDesiredState') !== gatewayDesiredState) {
    patch.gatewayDesiredState = gatewayDesiredState;
  }
  if (getStoreValue(store, 'gatewayManagedMode') !== gatewayManagedMode) {
    patch.gatewayManagedMode = gatewayManagedMode;
  }
  if (gatewayAutoStart !== nextGatewayAutoStart) {
    patch.gatewayAutoStart = nextGatewayAutoStart;
  }

  if (Object.keys(patch).length > 0) {
    store.set(patch);
  }
}

function normalizeImportedSettings(settings: Partial<AppSettings>): Partial<AppSettings> {
  const gatewayDesiredState = resolveGatewayDesiredState(
    settings.gatewayDesiredState,
    settings.gatewayAutoStart,
  );
  const openClawRootMode = settings.openClawRootMode === 'fresh' || settings.openClawRootMode === 'takeover'
    ? settings.openClawRootMode
    : 'takeover';
  const globalWallpaperOpacity = typeof settings.globalWallpaperOpacity === 'number'
    ? Math.min(GLOBAL_WALLPAPER_OPACITY_MAX, Math.max(GLOBAL_WALLPAPER_OPACITY_MIN, settings.globalWallpaperOpacity))
    : createDefaultSettings().globalWallpaperOpacity;
  const globalWallpaperAssetPath = typeof settings.globalWallpaperAssetPath === 'string'
    ? settings.globalWallpaperAssetPath.trim()
    : '';
  const normalizedWallpaperAssetPath = globalWallpaperAssetPath && isManagedGlobalWallpaperPath(globalWallpaperAssetPath)
    ? globalWallpaperAssetPath
    : '';
  return {
    ...settings,
    gatewayDesiredState,
    gatewayManagedMode: resolveGatewayManagedMode(
      settings.gatewayManagedMode,
      settings.setupComplete,
    ),
    gatewayAutoStart: gatewayDesiredState === 'running',
    globalWallpaperEnabled: settings.globalWallpaperEnabled === true && normalizedWallpaperAssetPath.length > 0,
    globalWallpaperOpacity,
    globalWallpaperAssetPath: normalizedWallpaperAssetPath,
    openClawRootMode,
  };
}

/**
 * Get the settings store instance (lazy initialization)
 */
async function getSettingsStore() {
  if (!settingsStoreInstance) {
    const Store = (await import('electron-store')).default;
    settingsStoreInstance = new Store<AppSettings>({
      name: 'settings',
      defaults: createDefaultSettings(),
    });
    syncGatewayCompatibilitySettings(settingsStoreInstance);
  }
  return settingsStoreInstance;
}

/**
 * Get a setting value
 */
export async function getSetting<K extends keyof AppSettings>(key: K): Promise<AppSettings[K]> {
  const store = await getSettingsStore();
  return store.get(key);
}

/**
 * Set a setting value
 */
export async function setSetting<K extends keyof AppSettings>(
  key: K,
  value: AppSettings[K]
): Promise<void> {
  const store = await getSettingsStore();
  if (key === 'gatewayAutoStart') {
    store.set({
      gatewayAutoStart: value,
      gatewayDesiredState: value ? 'running' : 'stopped',
    });
    return;
  }
  if (key === 'gatewayDesiredState') {
    store.set({
      gatewayDesiredState: value,
      gatewayAutoStart: value === 'running',
    });
    return;
  }
  if (key === 'openClawRootMode') {
    store.set(key, value);
    setOpenClawRootMode(value);
    return;
  }
  if (key === 'globalWallpaperOpacity') {
    const nextValue = typeof value === 'number'
      ? Math.min(GLOBAL_WALLPAPER_OPACITY_MAX, Math.max(GLOBAL_WALLPAPER_OPACITY_MIN, value))
      : createDefaultSettings().globalWallpaperOpacity;
    store.set(key, nextValue as AppSettings[K]);
    return;
  }
  if (key === 'globalWallpaperAssetPath') {
    const nextValue = typeof value === 'string' ? value.trim() : '';
    store.set(key, (nextValue && isManagedGlobalWallpaperPath(nextValue) ? nextValue : '') as AppSettings[K]);
    return;
  }
  if (key === 'globalWallpaperEnabled') {
    const assetPath = (await getSetting('globalWallpaperAssetPath')).trim();
    store.set(key, Boolean(value) && assetPath.length > 0);
    return;
  }
  store.set(key, value);
}

/**
 * Get all settings
 */
export async function getAllSettings(): Promise<AppSettings> {
  const store = await getSettingsStore();
  return store.store;
}

export async function replaceAllSettings(settings: AppSettings): Promise<void> {
  const store = await getSettingsStore();
  const normalized = normalizeImportedSettings(settings);
  store.clear();
  store.set(normalized);
  setOpenClawRootMode(normalized.openClawRootMode ?? 'takeover');
}

/**
 * Reset settings to defaults
 */
export async function resetSettings(): Promise<void> {
  const store = await getSettingsStore();
  store.clear();
  setOpenClawRootMode('takeover');
}

/**
 * Export settings to JSON
 */
export async function exportSettings(): Promise<string> {
  const store = await getSettingsStore();
  return JSON.stringify(store.store, null, 2);
}

/**
 * Import settings from JSON
 */
export async function importSettings(json: string): Promise<void> {
  try {
    const settings = JSON.parse(json);
    const store = await getSettingsStore();
    const normalized = normalizeImportedSettings(settings);
    store.set(normalized);
    setOpenClawRootMode(normalized.openClawRootMode ?? 'takeover');
  } catch {
    throw new Error('Invalid settings JSON');
  }
}
