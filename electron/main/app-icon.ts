import { app, nativeImage } from 'electron';
import { join } from 'path';

type AppLike = {
  isPackaged: boolean;
  dock?: {
    setIcon: (icon: Electron.NativeImage) => void;
  };
};

export function getIconsDir(currentApp: AppLike = app): string {
  return currentApp.isPackaged
    ? join(process.resourcesPath, 'resources', 'icons')
    : join(__dirname, '../../resources/icons');
}

export function getWindowIcon(
  platform: NodeJS.Platform = process.platform,
  currentApp: AppLike = app,
): Electron.NativeImage | undefined {
  if (platform === 'darwin') {
    return undefined;
  }

  const iconPath =
    platform === 'win32'
      ? join(getIconsDir(currentApp), 'icon.ico')
      : join(getIconsDir(currentApp), 'icon.png');
  const icon = nativeImage.createFromPath(iconPath);
  return icon.isEmpty() ? undefined : icon;
}

export function applyPlatformAppIcon(
  platform: NodeJS.Platform = process.platform,
  currentApp: AppLike = app,
): void {
  if (platform !== 'darwin' || !currentApp.dock) {
    return;
  }

  const icon = nativeImage.createFromPath(join(getIconsDir(currentApp), 'icon.png'));
  if (!icon.isEmpty()) {
    currentApp.dock.setIcon(icon);
  }
}
