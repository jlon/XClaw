/**
 * Zustand Stores Tests
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useSettingsStore } from '@/stores/settings';
import { useGatewayStore } from '@/stores/gateway';

describe('Settings Store', () => {
  beforeEach(() => {
    // Reset store to default state
    useSettingsStore.setState({
      theme: 'system',
      language: 'en',
      sidebarCollapsed: false,
      sidebarWidth: 250,
      devModeUnlocked: false,
      gatewayAutoStart: true,
      gatewayDesiredState: 'running',
      gatewayManagedMode: 'unmanaged',
      gatewayPort: 18789,
      autoCheckUpdate: true,
      autoDownloadUpdate: false,
      startMinimized: false,
      launchAtStartup: false,
      updateChannel: 'stable',
    });
  });
  
  it('should have default values', () => {
    const state = useSettingsStore.getState();
    expect(state.theme).toBe('system');
    expect(state.sidebarCollapsed).toBe(false);
    expect(state.sidebarWidth).toBe(250);
    expect(state.gatewayAutoStart).toBe(true);
    expect(state.gatewayDesiredState).toBe('running');
    expect(state.gatewayManagedMode).toBe('unmanaged');
  });
  
  it('should update theme', () => {
    const { setTheme } = useSettingsStore.getState();
    setTheme('dark');
    expect(useSettingsStore.getState().theme).toBe('dark');
  });
  
  it('should toggle sidebar collapsed state', () => {
    const { setSidebarCollapsed } = useSettingsStore.getState();
    setSidebarCollapsed(true);
    expect(useSettingsStore.getState().sidebarCollapsed).toBe(true);
  });

  it('should clamp sidebar width updates', () => {
    const { setSidebarWidth } = useSettingsStore.getState();

    setSidebarWidth(999);
    expect(useSettingsStore.getState().sidebarWidth).toBe(360);

    setSidebarWidth(120);
    expect(useSettingsStore.getState().sidebarWidth).toBe(200);
  });
  
  it('should unlock dev mode', () => {
    const invoke = vi.mocked(window.electron.ipcRenderer.invoke);
    invoke.mockResolvedValueOnce({
      ok: true,
      data: {
        status: 200,
        ok: true,
        json: { success: true },
      },
    });

    const { setDevModeUnlocked } = useSettingsStore.getState();
    setDevModeUnlocked(true);

    expect(useSettingsStore.getState().devModeUnlocked).toBe(true);
    expect(invoke).toHaveBeenCalledWith(
      'hostapi:fetch',
      expect.objectContaining({
        path: '/api/settings/devModeUnlocked',
        method: 'PUT',
      }),
    );
  });

  it('should persist launch-at-startup setting through host api', () => {
    const invoke = vi.mocked(window.electron.ipcRenderer.invoke);
    invoke.mockResolvedValueOnce({
      ok: true,
      data: {
        status: 200,
        ok: true,
        json: { success: true },
      },
    });

    const { setLaunchAtStartup } = useSettingsStore.getState();
    setLaunchAtStartup(true);

    expect(useSettingsStore.getState().launchAtStartup).toBe(true);
    expect(invoke).toHaveBeenCalledWith(
      'hostapi:fetch',
      expect.objectContaining({
        path: '/api/settings/launchAtStartup',
        method: 'PUT',
      }),
    );
  });

  it('should persist setup completion through host api', () => {
    const invoke = vi.mocked(window.electron.ipcRenderer.invoke);
    invoke.mockResolvedValueOnce({
      ok: true,
      data: {
        status: 200,
        ok: true,
        json: { success: true },
      },
    });

    const { markSetupComplete } = useSettingsStore.getState();
    markSetupComplete();

    expect(useSettingsStore.getState().setupComplete).toBe(true);
    expect(invoke).toHaveBeenCalledWith(
      'hostapi:fetch',
      expect.objectContaining({
        path: '/api/settings/setupComplete',
        method: 'PUT',
        body: JSON.stringify({ value: true }),
      }),
    );
  });

  it('should persist gateway port updates through host api', () => {
    const invoke = vi.mocked(window.electron.ipcRenderer.invoke);
    invoke.mockResolvedValueOnce({
      ok: true,
      data: {
        status: 200,
        ok: true,
        json: { success: true },
      },
    });

    const { setGatewayPort } = useSettingsStore.getState();
    setGatewayPort(19001);

    expect(useSettingsStore.getState().gatewayPort).toBe(19001);
    expect(invoke).toHaveBeenCalledWith(
      'hostapi:fetch',
      expect.objectContaining({
        path: '/api/settings/gatewayPort',
        method: 'PUT',
        body: JSON.stringify({ value: 19001 }),
      }),
    );
  });

  it('should sync gateway desired state when gateway auto-start changes', () => {
    const invoke = vi.mocked(window.electron.ipcRenderer.invoke);
    invoke.mockResolvedValueOnce({
      ok: true,
      data: {
        status: 200,
        ok: true,
        json: { success: true },
      },
    });

    const { setGatewayAutoStart } = useSettingsStore.getState();
    setGatewayAutoStart(false);

    const state = useSettingsStore.getState();
    expect(state.gatewayAutoStart).toBe(false);
    expect(state.gatewayDesiredState).toBe('stopped');
    expect(invoke).toHaveBeenCalledWith(
      'hostapi:fetch',
      expect.objectContaining({
        path: '/api/settings/gatewayAutoStart',
        method: 'PUT',
        body: JSON.stringify({ value: false }),
      }),
    );
  });

  it('should allow local-only setup completion updates without a host api write', () => {
    const invoke = vi.mocked(window.electron.ipcRenderer.invoke);

    const { markSetupComplete } = useSettingsStore.getState();
    markSetupComplete({ persist: false });

    expect(useSettingsStore.getState().setupComplete).toBe(true);
    expect(invoke).not.toHaveBeenCalledWith(
      'hostapi:fetch',
      expect.objectContaining({
        path: '/api/settings/setupComplete',
      }),
    );
  });

  it('should persist update preferences through host api', () => {
    const invoke = vi.mocked(window.electron.ipcRenderer.invoke);
    invoke.mockResolvedValue({
      ok: true,
      data: {
        status: 200,
        ok: true,
        json: { success: true },
      },
    });

    const {
      setUpdateChannel,
      setAutoCheckUpdate,
      setAutoDownloadUpdate,
    } = useSettingsStore.getState();

    setUpdateChannel('beta');
    setAutoCheckUpdate(false);
    setAutoDownloadUpdate(true);

    expect(invoke).toHaveBeenCalledWith(
      'hostapi:fetch',
      expect.objectContaining({
        path: '/api/settings/updateChannel',
        method: 'PUT',
        body: JSON.stringify({ value: 'beta' }),
      }),
    );
    expect(invoke).toHaveBeenCalledWith(
      'hostapi:fetch',
      expect.objectContaining({
        path: '/api/settings/autoCheckUpdate',
        method: 'PUT',
        body: JSON.stringify({ value: false }),
      }),
    );
    expect(invoke).toHaveBeenCalledWith(
      'hostapi:fetch',
      expect.objectContaining({
        path: '/api/settings/autoDownloadUpdate',
        method: 'PUT',
        body: JSON.stringify({ value: true }),
      }),
    );
  });
});

describe('Electron settings store migration', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('derives managed gateway fields from legacy persisted settings and keeps compatibility fields synced', async () => {
    const legacyKeys = new Set(['gatewayAutoStart', 'setupComplete']);
    const persistedSnapshot: Record<string, unknown> = {
      gatewayAutoStart: false,
      setupComplete: true,
    };

    class StoreMock<T extends Record<string, unknown>> {
      store: T;

      constructor(options: { defaults: T }) {
        this.store = {
          ...options.defaults,
          ...persistedSnapshot,
        };
      }

      get<K extends keyof T>(key: K): T[K] {
        return this.store[key];
      }

      has(key: keyof T): boolean {
        return legacyKeys.has(String(key));
      }

      set<K extends keyof T>(key: K | Partial<T>, value?: T[K]): void {
        if (typeof key === 'object') {
          this.store = {
            ...this.store,
            ...key,
          };
          return;
        }
        this.store = {
          ...this.store,
          [key]: value,
        };
      }

      clear(): void {
        this.store = {} as T;
      }
    }

    vi.doMock('electron', () => ({
      app: {
        getPreferredSystemLanguages: () => ['en-US'],
        getLocale: () => 'en-US',
      },
    }));

    vi.doMock('electron-store', () => ({
      default: StoreMock,
    }));

    const storeModule = await import('@electron/utils/store');
    const migratedSettings = await storeModule.getAllSettings();

    expect(migratedSettings.gatewayAutoStart).toBe(false);
    expect(migratedSettings.gatewayDesiredState).toBe('stopped');
    expect(migratedSettings.gatewayManagedMode).toBe('managed');

    await storeModule.setSetting('gatewayDesiredState', 'running');

    const syncedSettings = await storeModule.getAllSettings();
    expect(syncedSettings.gatewayDesiredState).toBe('running');
    expect(syncedSettings.gatewayAutoStart).toBe(true);
  });
});

describe('Gateway Store', () => {
  beforeEach(() => {
    // Reset store
    useGatewayStore.setState({
      status: { state: 'stopped', port: 18789 },
      isInitialized: false,
    });
  });
  
  it('should have default status', () => {
    const state = useGatewayStore.getState();
    expect(state.status.state).toBe('stopped');
    expect(state.status.port).toBe(18789);
  });
  
  it('should update status', () => {
    const { setStatus } = useGatewayStore.getState();
    setStatus({ state: 'running', port: 18789, pid: 12345 });
    
    const state = useGatewayStore.getState();
    expect(state.status.state).toBe('running');
    expect(state.status.pid).toBe(12345);
  });

  it('should proxy gateway rpc through ipc', async () => {
    const invoke = vi.mocked(window.electron.ipcRenderer.invoke);
    invoke.mockResolvedValueOnce({
      ok: true,
      data: {
        status: 200,
        ok: true,
        json: { success: true, result: { ok: true } },
      },
    });

    const result = await useGatewayStore.getState().rpc<{ ok: boolean }>('chat.history', { limit: 10 }, 5000);

    expect(result.ok).toBe(true);
    expect(invoke).toHaveBeenCalledWith(
      'hostapi:fetch',
      expect.objectContaining({
        path: '/api/gateway/rpc',
        method: 'POST',
        body: JSON.stringify({
          method: 'chat.history',
          params: { limit: 10 },
          timeoutMs: 5000,
        }),
      }),
    );
  });

  it('should use browser host api fallback for gateway rpc when Electron IPC is unavailable', async () => {
    const previousElectron = window.electron;
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true, result: { ok: true } }),
    });

    // @ts-expect-error test explicitly simulates browser-only runtime
    window.electron = undefined;
    window.localStorage.setItem('XClaw:allow-localhost-fallback', '1');
    vi.stubGlobal('fetch', fetchMock);

    try {
      const result = await useGatewayStore.getState().rpc<{ ok: boolean }>('chat.history', { limit: 5 }, 3000);

      expect(result.ok).toBe(true);
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/gateway/rpc',
        expect.objectContaining({
          method: 'POST',
        }),
      );
    } finally {
      window.electron = previousElectron;
      vi.unstubAllGlobals();
    }
  });
});
