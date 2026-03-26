import { describe, expect, it } from 'vitest';

import {
  resolveElectronDevMode,
  shouldLaunchElectronDev,
  shouldReloadElectronDev,
} from '../../scripts/dev-runtime.mjs';

describe('dev runtime', () => {
  it('uses backend-only electron mode on headless linux hosts by default', () => {
    expect(resolveElectronDevMode({
      platform: 'linux',
      display: '',
      waylandDisplay: '',
      forceElectronDev: false,
    })).toBe('backend');

    expect(shouldLaunchElectronDev({
      platform: 'linux',
      display: '',
      waylandDisplay: '',
      forceElectronDev: false,
    })).toBe(false);
  });

  it('keeps electron startup enabled when a display server is available', () => {
    expect(resolveElectronDevMode({
      platform: 'linux',
      display: ':1',
      waylandDisplay: '',
      forceElectronDev: false,
    })).toBe('window');

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
    expect(resolveElectronDevMode({
      platform: 'linux',
      display: '',
      waylandDisplay: '',
      forceElectronDev: true,
    })).toBe('window');

    expect(shouldLaunchElectronDev({
      platform: 'linux',
      display: '',
      waylandDisplay: '',
      forceElectronDev: true,
    })).toBe(true);
  });

  it('keeps preload-triggered startup disabled for backend-only mode until an electron app exists', () => {
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
