import { describe, expect, it } from 'vitest';
import { resolveMainWindowOptions } from '@electron/main/window-options';

describe('main window options', () => {
  it('uses transparent vibrancy-backed chrome on macOS', () => {
    const options = resolveMainWindowOptions({
      isMac: true,
      icon: '/tmp/icon.png',
      preloadPath: '/tmp/preload.js',
    });

    expect(options.titleBarStyle).toBe('hiddenInset');
    expect(options.trafficLightPosition).toEqual({ x: 18, y: 18 });
    expect(options.transparent).toBe(true);
    expect(options.vibrancy).toBe('sidebar');
    expect(options.visualEffectState).toBe('followWindow');
    expect(options.backgroundColor).toBe('#00000000');
    expect(options.frame).toBe(true);
  });

  it('keeps opaque hidden chrome on non-mac platforms', () => {
    const options = resolveMainWindowOptions({
      isMac: false,
      icon: '/tmp/icon.png',
      preloadPath: '/tmp/preload.js',
    });

    expect(options.titleBarStyle).toBe('hidden');
    expect(options.trafficLightPosition).toBeUndefined();
    expect(options.transparent).toBe(false);
    expect(options.vibrancy).toBeUndefined();
    expect(options.visualEffectState).toBeUndefined();
    expect(options.backgroundColor).toBe('#f8f8f9');
    expect(options.frame).toBe(false);
  });
});
