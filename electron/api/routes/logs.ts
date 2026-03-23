import type { IncomingMessage, ServerResponse } from 'http';
import { app, dialog } from 'electron';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { logger } from '../../utils/logger';
import type { HostApiContext } from '../context';
import { sendJson } from '../route-utils';

const LOG_EXPORT_LIMIT = 10;

function buildDefaultLogArchiveName(): string {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, '0');
  return `xclaw-logs-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}.zip`;
}

async function exportLogArchive() {
  const logDir = logger.getLogDir();
  if (!logDir) {
    return { success: false as const, error: 'No log directory available' };
  }

  const files = await logger.listLogFiles();
  const selectedFiles = files.slice(0, LOG_EXPORT_LIMIT);
  if (selectedFiles.length === 0) {
    return { success: false as const, error: 'No log files available' };
  }

  const result = await dialog.showSaveDialog({
    defaultPath: join(homedir(), 'Downloads', buildDefaultLogArchiveName()),
    filters: [
      { name: 'ZIP Archive', extensions: ['zip'] },
      { name: 'All Files', extensions: ['*'] },
    ],
  });

  if (result.canceled || !result.filePath) {
    return { success: false as const, canceled: true };
  }

  const { default: JSZip } = await import('jszip');
  const archive = new JSZip();
  const logsFolder = archive.folder('logs');

  for (const file of selectedFiles) {
    const content = await readFile(file.path, 'utf8');
    logsFolder?.file(file.name, content);
  }

  archive.file('manifest.json', JSON.stringify({
    exportedAt: new Date().toISOString(),
    appVersion: app.getVersion(),
    platform: process.platform,
    arch: process.arch,
    logDir,
    fileCount: selectedFiles.length,
    files: selectedFiles.map(({ name, size, modified }) => ({ name, size, modified })),
  }, null, 2));

  const buffer = await archive.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });

  await writeFile(result.filePath, buffer);
  return {
    success: true as const,
    savedPath: result.filePath,
    fileCount: selectedFiles.length,
  };
}

export async function handleLogRoutes(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
  _ctx: HostApiContext,
): Promise<boolean> {
  if (url.pathname === '/api/logs' && req.method === 'GET') {
    const tailLines = Number(url.searchParams.get('tailLines') || '100');
    sendJson(res, 200, { content: await logger.readLogFile(Number.isFinite(tailLines) ? tailLines : 100) });
    return true;
  }

  if (url.pathname === '/api/logs/dir' && req.method === 'GET') {
    sendJson(res, 200, { dir: logger.getLogDir() });
    return true;
  }

  if (url.pathname === '/api/logs/files' && req.method === 'GET') {
    sendJson(res, 200, { files: await logger.listLogFiles() });
    return true;
  }

  if (url.pathname === '/api/logs/export' && req.method === 'POST') {
    try {
      const result = await exportLogArchive();
      if ('canceled' in result) {
        sendJson(res, 200, { success: false, canceled: true });
        return true;
      }
      if (!result.success) {
        sendJson(res, 404, { success: false, error: result.error });
        return true;
      }
      sendJson(res, 200, result);
    } catch (error) {
      sendJson(res, 500, { success: false, error: String(error) });
    }
    return true;
  }

  return false;
}
