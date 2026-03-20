import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { app } from 'electron';
import { logger } from '../utils/logger';

export type GatewayHandoffMarker = {
  port: number;
  waitForPid: number;
  createdAt: number;
  expiresAt: number;
};

const MARKER_FILE_NAME = 'gateway-handoff.json';

export function getGatewayHandoffMarkerPath(): string {
  return path.join(app.getPath('userData'), MARKER_FILE_NAME);
}

export function isGatewayHandoffPending(
  marker: GatewayHandoffMarker | null,
  port: number,
  now = Date.now(),
): boolean {
  return Boolean(marker && marker.port === port && marker.expiresAt > now);
}

export async function writeGatewayHandoffMarker(marker: GatewayHandoffMarker): Promise<void> {
  const markerPath = getGatewayHandoffMarkerPath();
  await mkdir(path.dirname(markerPath), { recursive: true });
  await writeFile(markerPath, `${JSON.stringify(marker)}\n`, 'utf8');
}

export async function readGatewayHandoffMarker(): Promise<GatewayHandoffMarker | null> {
  try {
    const raw = await readFile(getGatewayHandoffMarkerPath(), 'utf8');
    const parsed = JSON.parse(raw) as Partial<GatewayHandoffMarker>;
    if (
      typeof parsed.port !== 'number'
      || typeof parsed.waitForPid !== 'number'
      || typeof parsed.createdAt !== 'number'
      || typeof parsed.expiresAt !== 'number'
    ) {
      await clearGatewayHandoffMarker();
      return null;
    }
    return {
      port: parsed.port,
      waitForPid: parsed.waitForPid,
      createdAt: parsed.createdAt,
      expiresAt: parsed.expiresAt,
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code !== 'ENOENT') {
      logger.warn('Failed to read Gateway handoff marker:', error);
    }
    return null;
  }
}

export async function clearGatewayHandoffMarker(): Promise<void> {
  try {
    await unlink(getGatewayHandoffMarkerPath());
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code !== 'ENOENT') {
      logger.warn('Failed to clear Gateway handoff marker:', error);
    }
  }
}
