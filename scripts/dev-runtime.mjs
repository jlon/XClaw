import process from 'node:process';

const truthyEnvPattern = /^(1|true|yes|on)$/i;

export function isTruthyEnvFlag(value) {
  if (typeof value === 'boolean') {
    return value;
  }

  return typeof value === 'string' && truthyEnvPattern.test(value.trim());
}

export function shouldLaunchElectronDev({ platform, display, waylandDisplay, forceElectronDev }) {
  if (forceElectronDev) {
    return true;
  }

  if (platform !== 'linux') {
    return true;
  }

  return Boolean(display || waylandDisplay);
}

export function shouldReloadElectronDev({ hasElectronApp, ...runtime }) {
  return hasElectronApp || shouldLaunchElectronDev(runtime);
}

export function getElectronDevRuntime(overrides = {}) {
  const runtime = {
    platform: overrides.platform ?? process.platform,
    display: overrides.display ?? process.env.DISPLAY ?? '',
    waylandDisplay: overrides.waylandDisplay ?? process.env.WAYLAND_DISPLAY ?? '',
    forceElectronDev: overrides.forceElectronDev ?? isTruthyEnvFlag(process.env.XCLAW_FORCE_ELECTRON_DEV),
  };

  return {
    ...runtime,
    shouldLaunch: shouldLaunchElectronDev(runtime),
  };
}

export function getElectronDevSkipMessage() {
  return '[dev] Electron launch skipped on headless Linux because neither DISPLAY nor WAYLAND_DISPLAY is set. Vite stays available. Set XCLAW_FORCE_ELECTRON_DEV=1 after preparing Xvfb, VNC, or another display server if you still want Electron to launch.';
}
