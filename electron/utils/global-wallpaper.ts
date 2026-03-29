import { app } from 'electron';
import { copyFile, mkdir, readFile, rm, stat } from 'node:fs/promises';
import { basename, extname, isAbsolute, join, relative, resolve } from 'node:path';

const WALLPAPER_DIR_NAME = 'wallpaper';
const ALLOWED_EXTENSIONS = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
  '.gif',
  '.bmp',
  '.avif',
]);

function getWallpaperDir() {
  return join(app.getPath('userData'), WALLPAPER_DIR_NAME);
}

function normalizeExtension(filePath: string) {
  return extname(filePath).toLowerCase();
}

function assertSupportedImagePath(filePath: string) {
  const extension = normalizeExtension(filePath);
  if (!ALLOWED_EXTENSIONS.has(extension)) {
    throw new Error('仅支持 png、jpg、jpeg、webp、gif、bmp、avif 图片');
  }
  return extension;
}

export function isManagedGlobalWallpaperPath(filePath: string) {
  const wallpaperDir = resolve(getWallpaperDir());
  const absolutePath = resolve(filePath);
  const relativePath = relative(wallpaperDir, absolutePath);
  return relativePath === '' || (!relativePath.startsWith('..') && !isAbsolute(relativePath));
}

export function getGlobalWallpaperMimeType(filePath: string) {
  const extension = normalizeExtension(filePath);
  switch (extension) {
    case '.png':
      return 'image/png';
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.webp':
      return 'image/webp';
    case '.gif':
      return 'image/gif';
    case '.bmp':
      return 'image/bmp';
    case '.avif':
      return 'image/avif';
    default:
      return 'application/octet-stream';
  }
}

export function getGlobalWallpaperAssetKey(filePath: string) {
  return isManagedGlobalWallpaperPath(filePath) ? basename(filePath) : '';
}

export async function importGlobalWallpaperAsset(
  sourcePath: string,
  previousAssetPath?: string | null,
) {
  const nextSourcePath = sourcePath.trim();
  if (!nextSourcePath) {
    throw new Error('请选择壁纸图片');
  }

  const extension = assertSupportedImagePath(nextSourcePath);
  const sourceStat = await stat(nextSourcePath);
  if (!sourceStat.isFile()) {
    throw new Error('壁纸路径不是可读取的文件');
  }

  const wallpaperDir = getWallpaperDir();
  await mkdir(wallpaperDir, { recursive: true });
  const targetPath = join(wallpaperDir, `wallpaper-${Date.now()}${extension}`);
  await copyFile(nextSourcePath, targetPath);

  if (previousAssetPath && previousAssetPath !== targetPath) {
    await clearGlobalWallpaperAsset(previousAssetPath).catch(() => {});
  }

  return targetPath;
}

export async function clearGlobalWallpaperAsset(assetPath?: string | null) {
  const nextAssetPath = assetPath?.trim();
  if (!nextAssetPath || !isManagedGlobalWallpaperPath(nextAssetPath)) {
    return;
  }
  await rm(nextAssetPath, { force: true });
}

export async function readGlobalWallpaperAsset(assetPath: string) {
  const nextAssetPath = assetPath.trim();
  if (!nextAssetPath || !isManagedGlobalWallpaperPath(nextAssetPath)) {
    return null;
  }
  const assetStat = await stat(nextAssetPath);
  if (!assetStat.isFile()) {
    return null;
  }
  return {
    buffer: await readFile(nextAssetPath),
    mimeType: getGlobalWallpaperMimeType(nextAssetPath),
  };
}
