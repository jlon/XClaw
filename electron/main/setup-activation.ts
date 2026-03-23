import { constants } from 'fs';
import { access, mkdir, readFile, rm, writeFile } from 'fs/promises';
import { dirname, join } from 'path';
import { homedir } from 'os';
import type { BrowserWindow } from 'electron';
import type { GatewayManager } from '../gateway/manager';
import type { GatewayRuntimeController } from '../gateway/runtime-controller';
import { ensureBuiltinSkillsInstalled, ensurePreinstalledSkillsInstalled } from '../utils/skill-config';
import { ensureAllBundledPluginsInstalled } from '../utils/plugin-install';
import { ensureXClawContext, repairXClawOnlyBootstrapFiles } from '../utils/openclaw-workspace';
import { autoInstallCliIfNeeded, generateCompletionCache, installCompletionToProfile } from '../utils/openclaw-cli';
import { getAllSettings, getSetting, replaceAllSettings, setSetting, type AppSettings, type GatewayDesiredState } from '../utils/store';
import { logger } from '../utils/logger';
import { syncAllProviderAuthToRuntime } from '../services/providers/provider-runtime-sync';
import { runTakeoverReconciler } from './takeover-reconciler';
import { readOpenClawConfig, writeOpenClawConfig } from '../utils/channel-config';
import { withConfigLock } from '../utils/config-mutex';
import { validateWorkspacePathInput } from '../utils/workspace-path';

type SetupActivationOptions = {
  gatewayManager: GatewayManager;
  runtimeController: GatewayRuntimeController;
  mainWindow: BrowserWindow | null;
  awaitCriticalTasks?: boolean;
  setup?: {
    mode?: 'fresh' | 'takeover';
    gatewayPort?: unknown;
    workspacePath?: string;
  };
};

const describeError = (error: unknown): string => (
  error instanceof Error ? error.message : String(error)
);

const OPENCLAW_CONFIG_PATH = join(homedir(), '.openclaw', 'openclaw.json');

type FreshSetupRollbackSnapshot = {
  settings: AppSettings;
  configExisted: boolean;
  configRaw: string | null;
  workspacePath: string;
  workspaceExisted: boolean;
};

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function normalizeRequestedGatewayPort(value: unknown): number | null {
  return typeof value === 'number'
    && Number.isInteger(value)
    && value >= 1
    && value <= 65535
    ? value
    : null;
}

async function resolveSetupActivationDesiredState(): Promise<GatewayDesiredState> {
  const gatewayDesiredState = await getSetting('gatewayDesiredState');
  if (gatewayDesiredState === 'running' || gatewayDesiredState === 'stopped') {
    return gatewayDesiredState;
  }
  const gatewayAutoStart = await getSetting('gatewayAutoStart');
  return gatewayAutoStart === false ? 'stopped' : 'running';
}

async function applyFreshSetupSelections(
  options: Pick<SetupActivationOptions, 'gatewayManager' | 'setup'>,
): Promise<void> {
  if (options.setup?.mode !== 'fresh') {
    return;
  }

  const gatewayPort = normalizeRequestedGatewayPort(options.setup.gatewayPort);
  if (gatewayPort === null) {
    throw new Error('网关端口必须是 1-65535 的整数');
  }

  const requestedWorkspace = options.setup.workspacePath ?? join(homedir(), '.openclaw', 'workspace');
  const workspaceValidation = validateWorkspacePathInput(requestedWorkspace);
  if (!workspaceValidation.normalizedPath) {
    throw new Error(workspaceValidation.error ?? '工作区路径无效');
  }

  await setSetting('gatewayPort', gatewayPort);
  options.gatewayManager.setPort(gatewayPort);
  await mkdir(workspaceValidation.normalizedPath, { recursive: true });

  await withConfigLock(async () => {
    const config = await readOpenClawConfig();
    const agents = config.agents && typeof config.agents === 'object'
      ? { ...config.agents as Record<string, unknown> }
      : {};
    const defaults = agents.defaults && typeof agents.defaults === 'object'
      ? { ...agents.defaults as Record<string, unknown> }
      : {};
    const gateway = config.gateway && typeof config.gateway === 'object'
      ? { ...config.gateway as Record<string, unknown> }
      : {};

    defaults.workspace = workspaceValidation.normalizedPath;
    gateway.port = gatewayPort;
    config.agents = {
      ...agents,
      defaults,
    };
    config.gateway = gateway;

    await writeOpenClawConfig(config);
  });
}

async function captureFreshSetupRollbackSnapshot(
  options: Pick<SetupActivationOptions, 'setup'>,
): Promise<FreshSetupRollbackSnapshot | null> {
  if (options.setup?.mode !== 'fresh') {
    return null;
  }

  const requestedWorkspace = options.setup.workspacePath ?? join(homedir(), '.openclaw', 'workspace');
  const workspaceValidation = validateWorkspacePathInput(requestedWorkspace);
  if (!workspaceValidation.normalizedPath) {
    throw new Error(workspaceValidation.error ?? '工作区路径无效');
  }

  const [settings, configExisted, workspaceExisted] = await Promise.all([
    getAllSettings(),
    fileExists(OPENCLAW_CONFIG_PATH),
    fileExists(workspaceValidation.normalizedPath),
  ]);

  return {
    settings,
    configExisted,
    configRaw: configExisted ? await readFile(OPENCLAW_CONFIG_PATH, 'utf-8') : null,
    workspacePath: workspaceValidation.normalizedPath,
    workspaceExisted,
  };
}

async function restoreFreshSetupRollbackSnapshot(
  options: Pick<SetupActivationOptions, 'gatewayManager'>,
  snapshot: FreshSetupRollbackSnapshot | null,
): Promise<void> {
  if (!snapshot) {
    return;
  }

  await replaceAllSettings(snapshot.settings);
  options.gatewayManager.setPort(snapshot.settings.gatewayPort);

  if (snapshot.configExisted && snapshot.configRaw !== null) {
    await mkdir(dirname(OPENCLAW_CONFIG_PATH), { recursive: true });
    await writeFile(OPENCLAW_CONFIG_PATH, snapshot.configRaw, 'utf-8');
  } else {
    await rm(OPENCLAW_CONFIG_PATH, { force: true });
  }

  if (!snapshot.workspaceExisted) {
    await rm(snapshot.workspacePath, { recursive: true, force: true });
  }
}

async function applyTakeoverSetupSelections(
  options: Pick<SetupActivationOptions, 'gatewayManager' | 'setup'>,
): Promise<void> {
  if (options.setup?.mode !== 'takeover') {
    return;
  }

  const configuredGatewayPort = normalizeRequestedGatewayPort(await getSetting('gatewayPort'));
  if (configuredGatewayPort !== null) {
    options.gatewayManager.setPort(configuredGatewayPort);
  }
}

export async function runSetupActivationSideEffects(
  options: SetupActivationOptions,
): Promise<void> {
  const { runtimeController, mainWindow, awaitCriticalTasks = false } = options;
  const freshRollbackSnapshot = await captureFreshSetupRollbackSnapshot(options);

  try {
    await applyFreshSetupSelections(options);
    await applyTakeoverSetupSelections(options);
    const runBackgroundTask = (task: () => Promise<void>, errorMessage: string): void => {
      void task().catch((error) => {
        logger.warn(errorMessage, error);
      });
    };

    const gatewayDesiredState = await resolveSetupActivationDesiredState();
    if (gatewayDesiredState === 'running') {
      try {
        await syncAllProviderAuthToRuntime();
        logger.debug('Activating managed Gateway runtime...');
        await runtimeController.activateManagedMode('running');
        logger.info('Gateway auto-start succeeded');
      } catch (error) {
        logger.error('Gateway auto-start failed:', error);
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('gateway:error', String(error));
        }
        if (awaitCriticalTasks) {
          throw new Error(`网关自动启动失败：${describeError(error)}`, { cause: error });
        }
      }
    } else {
      await runtimeController.activateManagedMode('stopped');
      logger.info('Gateway desired state is stopped; managed mode activated without auto-start');
    }

    runBackgroundTask(
      repairXClawOnlyBootstrapFiles,
      'Failed to repair bootstrap files:',
    );

    runBackgroundTask(
      ensureBuiltinSkillsInstalled,
      'Failed to install built-in skills:',
    );

    runBackgroundTask(
      ensurePreinstalledSkillsInstalled,
      'Failed to install preinstalled skills:',
    );

    runBackgroundTask(
      ensureAllBundledPluginsInstalled,
      'Failed to install/upgrade bundled plugins:',
    );

    runBackgroundTask(
      ensureXClawContext,
      'Failed to merge XClaw context into workspace:',
    );

    runBackgroundTask(async () => {
      await autoInstallCliIfNeeded((installedPath) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('openclaw:cli-installed', installedPath);
        }
      });
      generateCompletionCache();
      installCompletionToProfile();
    }, 'CLI auto-install failed:');

    if (options.setup?.mode === 'takeover') {
      runBackgroundTask(
        runTakeoverReconciler,
        'Takeover reconciler failed:',
      );
    }
  } catch (error) {
    await restoreFreshSetupRollbackSnapshot(options, freshRollbackSnapshot);
    throw error;
  }
}
