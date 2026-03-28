import { logger } from '../utils/logger';
import { LifecycleSupersededError } from './lifecycle-controller';
import { getGatewayStartupRecoveryAction } from './startup-recovery';

export interface ExistingGatewayInfo {
  port: number;
  pid?: number;
  owned?: boolean;
  externalToken?: string;
}

export type ExistingGatewayConnectFailureResolution =
  | { action: 'fail' }
  | { action: 'replace-existing' }
  | { action: 'switch-port'; port: number };

type StartupHooks = {
  port: number;
  ownedPid?: number;
  shouldWaitForPortFree: boolean;
  maxStartAttempts?: number;
  resetStartupStderrLines: () => void;
  getStartupStderrLines: () => string[];
  assertLifecycle: (phase: string) => void;
  findExistingGateway: (port: number, ownedPid?: number) => Promise<ExistingGatewayInfo | null>;
  isPortAvailable: (port: number) => Promise<boolean>;
  findSuggestedPort: (preferredPort: number) => Promise<number>;
  onPortConflict: (currentPort: number, suggestedPort: number, reason: 'occupied' | 'external-auth-mismatch') => Promise<void>;
  connect: (port: number, externalToken?: string) => Promise<void>;
  onExistingGatewayConnectFailure?: (
    existing: ExistingGatewayInfo,
    error: unknown,
  ) => Promise<ExistingGatewayConnectFailureResolution>;
  onConnectedToExistingGateway: (existing: ExistingGatewayInfo) => void;
  waitForPortFree: (port: number) => Promise<void>;
  startProcess: () => Promise<void>;
  waitForReady: (port: number) => Promise<void>;
  onConnectedToManagedGateway: () => void;
  runDoctorRepair: () => Promise<boolean>;
  onDoctorRepairSuccess: () => void;
  delay: (ms: number) => Promise<void>;
};

export async function runGatewayStartupSequence(hooks: StartupHooks): Promise<void> {
  let configRepairAttempted = false;
  let startAttempts = 0;
  const maxStartAttempts = hooks.maxStartAttempts ?? 3;
  let port = hooks.port;

  while (true) {
    startAttempts++;
    hooks.assertLifecycle('start');
    hooks.resetStartupStderrLines();

    try {
      let shouldWaitForPortFree = hooks.shouldWaitForPortFree;

      logger.debug('Checking for existing Gateway...');
      const existing = await hooks.findExistingGateway(port, hooks.ownedPid);
      hooks.assertLifecycle('start/find-existing');
      if (existing) {
        logger.debug(`Found existing Gateway on port ${existing.port}`);
        try {
          await hooks.connect(existing.port, existing.externalToken);
          hooks.assertLifecycle('start/connect-existing');
          hooks.onConnectedToExistingGateway(existing);
          return;
        } catch (error) {
          const resolution = hooks.onExistingGatewayConnectFailure
            ? await hooks.onExistingGatewayConnectFailure(existing, error)
            : { action: 'fail' as const };
          if (resolution.action === 'switch-port') {
            port = resolution.port;
            continue;
          }
          if (resolution.action !== 'replace-existing') {
            throw error;
          }
          shouldWaitForPortFree = true;
        }
      }

      logger.debug('No existing Gateway found, starting new process...');

      if (!(await hooks.isPortAvailable(port))) {
        const suggestedPort = await hooks.findSuggestedPort(port);
        if (suggestedPort !== port) {
          await hooks.onPortConflict(port, suggestedPort, 'occupied');
          port = suggestedPort;
          continue;
        }
      }

      if (shouldWaitForPortFree) {
        await hooks.waitForPortFree(port);
        hooks.assertLifecycle('start/wait-port');
      }

      await hooks.startProcess();
      hooks.assertLifecycle('start/start-process');

      await hooks.waitForReady(port);
      hooks.assertLifecycle('start/wait-ready');

      await hooks.connect(port);
      hooks.assertLifecycle('start/connect');

      hooks.onConnectedToManagedGateway();
      return;
    } catch (error) {
      if (error instanceof LifecycleSupersededError) {
        throw error;
      }

      const recoveryAction = getGatewayStartupRecoveryAction({
        startupError: error,
        startupStderrLines: hooks.getStartupStderrLines(),
        configRepairAttempted,
        attempt: startAttempts,
        maxAttempts: maxStartAttempts,
      });

      if (recoveryAction === 'repair') {
        configRepairAttempted = true;
        logger.warn(
          'Detected invalid OpenClaw config during Gateway startup; running doctor repair before retry',
        );
        const repaired = await hooks.runDoctorRepair();
        if (repaired) {
          logger.info('OpenClaw doctor repair completed; retrying Gateway startup');
          hooks.onDoctorRepairSuccess();
          continue;
        }
        logger.error('OpenClaw doctor repair failed; not retrying Gateway startup');
      }

      if (recoveryAction === 'retry') {
        logger.warn(`Transient start error: ${String(error)}. Retrying... (${startAttempts}/${maxStartAttempts})`);
        await hooks.delay(1000);
        continue;
      }

      throw error;
    }
  }
}
