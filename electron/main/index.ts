/**
 * Electron Main Process Entry
 * Manages window creation, system tray, and IPC handlers
 */
import { app, BrowserWindow, session, shell } from 'electron';
import type { Server } from 'node:http';
import { join } from 'path';
import { GatewayManager } from '../gateway/manager';
import { GatewayRuntimeController } from '../gateway/runtime-controller';
import { registerIpcHandlers } from './ipc-handlers';
import { createTray } from './tray';
import { createMenu } from './menu';
import {
  DEFAULT_MAIN_WINDOW_HEIGHT,
  DEFAULT_MAIN_WINDOW_MIN_HEIGHT,
  DEFAULT_MAIN_WINDOW_MIN_WIDTH,
  DEFAULT_MAIN_WINDOW_WIDTH,
} from './window';

import { appUpdater, registerUpdateHandlers } from './updater';
import { logger } from '../utils/logger';
import { warmupNetworkOptimization } from '../utils/uv-env';
import { initTelemetry } from '../utils/telemetry';
import { applyPlatformAppIcon, getWindowIcon } from './app-icon';

import { ClawHubService } from '../gateway/clawhub';
import { ensureXClawContext } from '../utils/openclaw-workspace';
import { isQuitting, setQuitting } from './app-state';
import { applyProxySettings } from './proxy';
import { syncLaunchAtStartupSettingFromStore } from './launch-at-startup';
import { resolveSetupBootstrapState } from './setup-bootstrap';
import {
  clearPendingSecondInstanceFocus,
  consumeMainWindowReady,
  createMainWindowFocusState,
  requestSecondInstanceFocus,
} from './main-window-focus';
import { getSetting } from '../utils/store';
import { startHostApiServer } from '../api/server';
import { HostEventBus } from '../api/event-bus';
import { deviceOAuthManager } from '../utils/device-oauth';
import { browserOAuthManager } from '../utils/browser-oauth';
import { whatsAppLoginManager } from '../utils/whatsapp-login';
import { weixinGuardianService } from '../utils/weixin-guardian';
import { runSetupActivationSideEffects } from './setup-activation';
import { applyUserDataDirOverride } from './user-data-override';
import { createBeforeQuitHandler } from './quit-handoff';
import { StudioService } from '../studio/service';

const WINDOWS_APP_USER_MODEL_ID = 'app.XClaw.desktop';

// Disable GPU hardware acceleration globally for maximum stability across
// all GPU configurations (no GPU, integrated, discrete).
//
// Rationale (following VS Code's philosophy):
// - Page/file loading is async data fetching — zero GPU dependency.
// - The original per-platform GPU branching was added to avoid CPU rendering
//   competing with sync I/O on Windows, but all file I/O is now async
//   (fs/promises), so that concern no longer applies.
// - Software rendering is deterministic across all hardware; GPU compositing
//   behaviour varies between vendors (Intel, AMD, NVIDIA, Apple Silicon) and
//   driver versions, making it the #1 source of rendering bugs in Electron.
//
// Users who want GPU acceleration can pass `--enable-gpu` on the CLI or
// set `"disable-hardware-acceleration": false` in the app config (future).
app.disableHardwareAcceleration();

// On Linux, set CHROME_DESKTOP so Chromium can find the correct .desktop file.
// On Wayland this maps the running window to XClaw.desktop (→ icon + app grouping);
// on X11 it supplements the StartupWMClass matching.
// Must be called before app.whenReady() / before any window is created.
if (process.platform === 'linux') {
  app.setDesktopName('XClaw.desktop');
}

// Prevent multiple instances of the app from running simultaneously.
// Without this, two instances each spawn their own gateway process on the
// same port, then each treats the other's gateway as "orphaned" and kills
// it — creating an infinite kill/restart loop on Windows.
// The losing process must exit immediately so it never reaches Gateway startup.
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.exit(0);
}

applyUserDataDirOverride({
  app,
  logger,
});

// Global references
let mainWindow: BrowserWindow | null = null;
let gatewayManager!: GatewayManager;
let gatewayRuntimeController!: GatewayRuntimeController;
let clawHubService!: ClawHubService;
let hostEventBus!: HostEventBus;
let studioService!: StudioService;
let hostApiServer: Server | null = null;
const mainWindowFocusState = createMainWindowFocusState();
const handleBeforeQuit = createBeforeQuitHandler({
  app,
  setQuitting: () => {
    setQuitting();
  },
  closeAll: () => {
    hostEventBus.closeAll();
  },
  closeHostApiServer: () => {
    hostApiServer?.close();
  },
  handoffGateway: async () => {
    await gatewayManager.handoffForQuit();
  },
  logger,
});

/**
 * Create the main application window
 */
function createWindow(): BrowserWindow {
  const isMac = process.platform === 'darwin';

  const win = new BrowserWindow({
    width: DEFAULT_MAIN_WINDOW_WIDTH,
    height: DEFAULT_MAIN_WINDOW_HEIGHT,
    minWidth: DEFAULT_MAIN_WINDOW_MIN_WIDTH,
    minHeight: DEFAULT_MAIN_WINDOW_MIN_HEIGHT,
    icon: getWindowIcon(),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      webviewTag: true, // Enable <webview> for embedding OpenClaw Control UI
    },
    titleBarStyle: isMac ? 'hiddenInset' : 'hidden',
    trafficLightPosition: isMac ? { x: 16, y: 16 } : undefined,
    frame: isMac,
    show: false,
    backgroundColor: '#f8f8f9',
  });

  win.webContents.on('did-start-loading', () => {
    logger.debug(`Main window started loading: ${win.webContents.getURL() || '(pending url)'}`);
  });

  win.webContents.on('dom-ready', () => {
    logger.debug(`Main window DOM ready: ${win.webContents.getURL() || '(unknown url)'}`);
  });

  win.webContents.on('did-finish-load', () => {
    logger.debug(`Main window finished loading: ${win.webContents.getURL() || '(unknown url)'}`);
  });

  win.webContents.on('did-fail-load', (_event, code, description, validatedURL, isMainFrame) => {
    logger.error(
      `Main window failed to load: code=${code} description=${description} url=${validatedURL} mainFrame=${String(isMainFrame)}`,
    );
  });

  win.webContents.on('render-process-gone', (_event, details) => {
    logger.error(`Main window renderer process gone: reason=${details.reason} exitCode=${details.exitCode}`);
  });

  win.webContents.on('console-message', (_event, level, message, line, sourceId) => {
    if (level >= 2) {
      logger.warn(`Renderer console[level=${level}] ${sourceId}:${line} ${message}`);
    }
  });

  // Handle external links
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Load the app
  if (process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL);
    if (process.env.XCLAW_OPEN_DEVTOOLS === '1') {
      win.webContents.openDevTools({ mode: 'detach' });
    }
  } else {
    win.loadFile(join(__dirname, '../../dist/index.html'));
  }

  return win;
}

function focusWindow(win: BrowserWindow): void {
  if (win.isDestroyed()) {
    return;
  }

  if (win.isMinimized()) {
    win.restore();
  }

  win.show();
  win.focus();
}

function focusMainWindow(): void {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  clearPendingSecondInstanceFocus(mainWindowFocusState);
  focusWindow(mainWindow);
}

function isAllowedStudioWebviewUrl(url: string): boolean {
  try {
    const resolvedUrl = studioService.getRuntimeSnapshot().resolvedUrl;
    if (!resolvedUrl) {
      return false;
    }
    const candidate = new URL(url);
    const allowed = new URL(resolvedUrl);
    const sameHost = candidate.hostname === allowed.hostname
      || (
        (candidate.hostname === '127.0.0.1' || candidate.hostname === 'localhost')
        && (allowed.hostname === '127.0.0.1' || allowed.hostname === 'localhost')
      );
    return candidate.protocol === allowed.protocol && sameHost && candidate.port === allowed.port;
  } catch {
    return false;
  }
}

function createMainWindow(): BrowserWindow {
  const win = createWindow();

  win.once('ready-to-show', () => {
    if (mainWindow !== win) {
      return;
    }

    const action = consumeMainWindowReady(mainWindowFocusState);
    if (action === 'focus') {
      focusWindow(win);
      return;
    }

    win.show();
  });

  win.on('close', (event) => {
    if (!isQuitting()) {
      event.preventDefault();
      win.hide();
    }
  });

  win.on('closed', () => {
    if (mainWindow === win) {
      mainWindow = null;
    }
  });

  mainWindow = win;
  return win;
}

/**
 * Initialize the application
 */
async function initialize(): Promise<void> {
  // Initialize logger first
  logger.init();
  logger.info('=== XClaw Application Starting ===');
  logger.debug(
    `Runtime: platform=${process.platform}/${process.arch}, electron=${process.versions.electron}, node=${process.versions.node}, packaged=${app.isPackaged}`
  );

  // Warm up network optimization (non-blocking)
  void warmupNetworkOptimization();

  // Initialize Telemetry early
  await initTelemetry();

  // Apply persisted proxy settings before creating windows or network requests.
  await applyProxySettings();
  await syncLaunchAtStartupSettingFromStore();
  const configuredGatewayPort = await getSetting('gatewayPort');
  try {
    gatewayManager.setPort(configuredGatewayPort);
  } catch (error) {
    logger.warn(`Ignoring invalid persisted gateway port: ${String(error)}`);
  }
  const setupBootstrapState = await resolveSetupBootstrapState();
  logger.info(
    `Setup bootstrap resolved: source=${setupBootstrapState.source}, readonly=${setupBootstrapState.readonly}, startupSideEffects=${setupBootstrapState.shouldRunStartupSideEffects}`
  );

  // Set application menu
  createMenu();

  // Create the main window
  const window = createMainWindow();

  // Create system tray
  createTray(window);

  // Override security headers ONLY for the OpenClaw Gateway Control UI.
  // The URL filter ensures this callback only fires for gateway requests,
  // avoiding unnecessary overhead on every other HTTP response.
  let currentGatewayPort = gatewayManager.getStatus().port;
  session.defaultSession.webRequest.onHeadersReceived(
    { urls: ['http://127.0.0.1/*', 'http://localhost/*'] },
    (details, callback) => {
      try {
        const requestUrl = new URL(details.url);
        if (requestUrl.port !== String(currentGatewayPort)) {
          callback({ responseHeaders: details.responseHeaders });
          return;
        }
      } catch {
        callback({ responseHeaders: details.responseHeaders });
        return;
      }

      const headers = { ...details.responseHeaders };
      delete headers['X-Frame-Options'];
      delete headers['x-frame-options'];
      if (headers['Content-Security-Policy']) {
        headers['Content-Security-Policy'] = headers['Content-Security-Policy'].map(
          (csp) => csp.replace(/frame-ancestors\s+'none'/g, "frame-ancestors 'self' *")
        );
      }
      if (headers['content-security-policy']) {
        headers['content-security-policy'] = headers['content-security-policy'].map(
          (csp) => csp.replace(/frame-ancestors\s+'none'/g, "frame-ancestors 'self' *")
        );
      }
      callback({ responseHeaders: headers });
    },
  );

  // Register IPC handlers
  registerIpcHandlers(gatewayManager, gatewayRuntimeController, clawHubService, window);

  const hostApiContext = {
    gatewayManager,
    gatewayRuntimeController,
    clawHubService,
    studioService,
    eventBus: hostEventBus,
    mainWindow: window,
  };

  hostApiServer = startHostApiServer(hostApiContext);
  weixinGuardianService.start(hostApiContext);

  // Register update handlers
  registerUpdateHandlers(appUpdater, window);

  // Note: Auto-check for updates is driven by the renderer (update store init)
  // so it respects the user's "Auto-check for updates" setting.

  // Bridge gateway and host-side events before any auto-start logic runs, so
  // renderer subscribers observe the full startup lifecycle.
  gatewayManager.on('status', (status) => {
    if (typeof status.port === 'number') {
      currentGatewayPort = status.port;
    }
    hostEventBus.emit('gateway:status', status);
    if (status.state === 'running' && setupBootstrapState.shouldRunStartupSideEffects) {
      void ensureXClawContext().catch((error) => {
        logger.warn('Failed to re-merge XClaw context after gateway reconnect:', error);
      });
    }
    if (status.state === 'running') {
      void weixinGuardianService.runCheck();
    }
  });

  gatewayManager.on('error', (error) => {
    hostEventBus.emit('gateway:error', { message: error.message });
  });

  gatewayManager.on('notification', (notification) => {
    hostEventBus.emit('gateway:notification', notification);
  });

  gatewayManager.on('chat:message', (data) => {
    hostEventBus.emit('gateway:chat-message', data);
  });

  gatewayManager.on('channel:status', (data) => {
    void weixinGuardianService.runCheck();
    hostEventBus.emit('gateway:channel-status', data);
  });

  gatewayManager.on('exit', (code) => {
    hostEventBus.emit('gateway:exit', { code });
  });

  deviceOAuthManager.on('oauth:code', (payload) => {
    hostEventBus.emit('oauth:code', payload);
  });

  deviceOAuthManager.on('oauth:start', (payload) => {
    hostEventBus.emit('oauth:start', payload);
  });

  deviceOAuthManager.on('oauth:success', (payload) => {
    hostEventBus.emit('oauth:success', { ...payload, success: true });
  });

  deviceOAuthManager.on('oauth:error', (error) => {
    hostEventBus.emit('oauth:error', error);
  });

  studioService.on('runtime-snapshot', (snapshot) => {
    hostEventBus.emit('studioRuntimeChanged', snapshot);
    mainWindow?.webContents.send('studioRuntimeChanged', snapshot);
  });

  browserOAuthManager.on('oauth:start', (payload) => {
    hostEventBus.emit('oauth:start', payload);
  });

  browserOAuthManager.on('oauth:code', (payload) => {
    hostEventBus.emit('oauth:code', payload);
  });

  browserOAuthManager.on('oauth:success', (payload) => {
    hostEventBus.emit('oauth:success', { ...payload, success: true });
  });

  browserOAuthManager.on('oauth:error', (error) => {
    hostEventBus.emit('oauth:error', error);
  });

  whatsAppLoginManager.on('qr', (data) => {
    hostEventBus.emit('channel:whatsapp-qr', data);
  });

  whatsAppLoginManager.on('success', (data) => {
    hostEventBus.emit('channel:whatsapp-success', data);
  });

  whatsAppLoginManager.on('error', (error) => {
    hostEventBus.emit('channel:whatsapp-error', error);
  });

  if (setupBootstrapState.shouldRunStartupSideEffects) {
    await runSetupActivationSideEffects({
      gatewayManager,
      runtimeController: gatewayRuntimeController,
      mainWindow,
    });
    void studioService.start().catch((error) => {
      logger.warn('Failed to start Studio runtime:', error);
    });
  } else {
    logger.info('Setup takeover is still pending; startup side effects are suspended');
  }
}

if (gotTheLock) {
  if (process.platform === 'win32') {
    app.setAppUserModelId(WINDOWS_APP_USER_MODEL_ID);
  }

  gatewayManager = new GatewayManager();
  gatewayRuntimeController = new GatewayRuntimeController({ gatewayManager });
  gatewayManager.setRecoveryArbiter(() => gatewayRuntimeController.shouldAutoRecover());
  clawHubService = new ClawHubService();
  hostEventBus = new HostEventBus();
  studioService = new StudioService(gatewayManager);

  // When a second instance is launched, focus the existing window instead.
  app.on('second-instance', () => {
    logger.info('Second XClaw instance detected; redirecting to the existing window');

    const focusRequest = requestSecondInstanceFocus(
      mainWindowFocusState,
      Boolean(mainWindow && !mainWindow.isDestroyed()),
    );

    if (focusRequest === 'focus-now') {
      focusMainWindow();
      return;
    }

    logger.debug('Main window is not ready yet; deferring second-instance focus until ready-to-show');
  });

  // Application lifecycle
  app.on('web-contents-created', (_event, contents) => {
    contents.on('will-attach-webview', (event, webPreferences, params) => {
      webPreferences.nodeIntegration = false;
      webPreferences.contextIsolation = true;
      webPreferences.sandbox = true;
      delete webPreferences.preload;
      if (!isAllowedStudioWebviewUrl(params.src)) {
        event.preventDefault();
      }
    });

    if (contents.getType() !== 'webview') {
      return;
    }

    contents.setWindowOpenHandler(() => ({ action: 'deny' }));
    contents.on('will-navigate', (event, url) => {
      if (!isAllowedStudioWebviewUrl(url)) {
        event.preventDefault();
      }
    });
  });

  app.whenReady().then(() => {
    applyPlatformAppIcon();

    void initialize().catch((error) => {
      logger.error('Application initialization failed:', error);
    });

    // Register activate handler AFTER app is ready to prevent
    // "Cannot create BrowserWindow before app is ready" on macOS.
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createMainWindow();
      } else {
        focusMainWindow();
      }
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });

  app.on('before-quit', handleBeforeQuit);
  app.on('before-quit', () => {
    void studioService.stop();
  });
}

// Export for testing
export { mainWindow, gatewayManager, gatewayRuntimeController };
