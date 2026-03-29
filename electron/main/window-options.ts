import type { BrowserWindowConstructorOptions } from 'electron';
import {
  DEFAULT_MAIN_WINDOW_HEIGHT,
  DEFAULT_MAIN_WINDOW_MIN_HEIGHT,
  DEFAULT_MAIN_WINDOW_MIN_WIDTH,
  DEFAULT_MAIN_WINDOW_WIDTH,
} from './window';

type ResolveMainWindowOptionsInput = {
  isMac: boolean;
  icon: string;
  preloadPath: string;
};

export function resolveMainWindowOptions({
  isMac,
  icon,
  preloadPath,
}: ResolveMainWindowOptionsInput): BrowserWindowConstructorOptions {
  return {
    width: DEFAULT_MAIN_WINDOW_WIDTH,
    height: DEFAULT_MAIN_WINDOW_HEIGHT,
    minWidth: DEFAULT_MAIN_WINDOW_MIN_WIDTH,
    minHeight: DEFAULT_MAIN_WINDOW_MIN_HEIGHT,
    icon,
    webPreferences: {
      preload: preloadPath,
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      webviewTag: true,
    },
    titleBarStyle: isMac ? 'hiddenInset' : 'hidden',
    trafficLightPosition: isMac ? { x: 18, y: 18 } : undefined,
    transparent: isMac,
    vibrancy: isMac ? 'sidebar' : undefined,
    visualEffectState: isMac ? 'followWindow' : undefined,
    frame: isMac,
    show: false,
    backgroundColor: isMac ? '#00000000' : '#f8f8f9',
  };
}
