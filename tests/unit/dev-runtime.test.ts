import { describe, expect, it } from 'vitest';

import { shouldLaunchElectronDev, shouldReloadElectronDev } from '../../scripts/dev-runtime.mjs';

describe('dev runtime', () => {
  it('skips electron startup on headless linux hosts by default', () => {
    expect(shouldLaunchElectronDev({
      platform: 'linux',
      display: '',
      waylandDisplay: '',
      forceElectronDev: false,
    })).toBe(false);
  });

  it('keeps electron startup enabled when a display server is available', () => {
    expect(shouldLaunchElectronDev({
      platform: 'linux',
      display: ':1',
      waylandDisplay: '',
      forceElectronDev: false,
    })).toBe(true);

    expect(shouldLaunchElectronDev({
      platform: 'linux',
      display: '',
      waylandDisplay: 'wayland-0',
      forceElectronDev: false,
    })).toBe(true);
  });

  it('allows forcing electron startup in headless environments', () => {
    expect(shouldLaunchElectronDev({
      platform: 'linux',
      display: '',
      waylandDisplay: '',
      forceElectronDev: true,
    })).toBe(true);
  });

  it('skips preload-triggered startup on headless linux hosts until an electron app exists', () => {
    expect(shouldReloadElectronDev({
      platform: 'linux',
      display: '',
      waylandDisplay: '',
      forceElectronDev: false,
      hasElectronApp: false,
    })).toBe(false);

    expect(shouldReloadElectronDev({
      platform: 'linux',
      display: '',
      waylandDisplay: '',
      forceElectronDev: false,
      hasElectronApp: true,
    })).toBe(true);
  });
});
