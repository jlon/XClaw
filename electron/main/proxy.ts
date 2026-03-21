import { session } from 'electron';
import { getAllSettings, type AppSettings } from '../utils/store';
import { buildElectronProxyConfig } from '../utils/proxy';
import { logger } from '../utils/logger';

const PROXY_APPLY_TIMEOUT_MS = 1500;

async function raceWithTimeout(task: Promise<void>, label: string): Promise<boolean> {
  let completed = false;
  await Promise.race([
    task.then(() => {
      completed = true;
    }),
    new Promise<void>((resolve) => {
      setTimeout(resolve, PROXY_APPLY_TIMEOUT_MS);
    }),
  ]);
  if (!completed) {
    logger.warn(`${label} timed out after ${PROXY_APPLY_TIMEOUT_MS}ms; continuing startup.`);
  }
  return completed;
}

export async function applyProxySettings(
  partialSettings?: Pick<AppSettings, 'proxyEnabled' | 'proxyServer' | 'proxyBypassRules'>
): Promise<void> {
  const settings = partialSettings ?? await getAllSettings();
  const config = buildElectronProxyConfig(settings);

  const proxyApplied = await raceWithTimeout(
    session.defaultSession.setProxy(config),
    'Applying Electron proxy',
  );
  if (!proxyApplied) {
    return;
  }
  try {
    await raceWithTimeout(
      session.defaultSession.closeAllConnections(),
      'Closing existing Electron connections after proxy update',
    );
  } catch (error) {
    logger.debug('Failed to close existing connections after proxy update:', error);
  }

  logger.info(
    `Applied Electron proxy (${config.mode}${config.proxyRules ? `, server=${config.proxyRules}` : ''}${config.proxyBypassRules ? `, bypass=${config.proxyBypassRules}` : ''})`
  );
}
