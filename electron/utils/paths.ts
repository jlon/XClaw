/**
 * Path Utilities
 * Cross-platform path resolution helpers
 */
import { app } from 'electron';
import { join, normalize as normalizePath } from 'path';
import { homedir } from 'os';
import { existsSync, mkdirSync, readFileSync, realpathSync, renameSync } from 'fs';
import { logger } from './logger';

export {
  quoteForCmd,
  needsWinShell,
  prepareWinSpawn,
  normalizeNodeRequirePathForNodeOptions,
  appendNodeRequireToNodeOptions,
} from './win-shell';

export type OpenClawRootMode = 'fresh' | 'takeover';

const OPENCLAW_ROOT_MODE_ENV = 'XCLAW_OPENCLAW_ROOT_MODE';
const OPENCLAW_SETTINGS_FILE = 'settings.json';
const MANAGED_OPENCLAW_DIRNAME = '.openclaw';

/**
 * Expand ~ to home directory
 */
export function expandPath(value: string): string {
  return normalizePath(value.startsWith('~') ? value.replace('~', homedir()) : value);
}

/**
 * Get the legacy OpenClaw config directory
 */
export function getLegacyOpenClawConfigDir(): string {
  return join(homedir(), '.openclaw');
}

/**
 * Get the XClaw-managed OpenClaw home directory
 */
export function getManagedOpenClawHomeDir(): string {
  return app.getPath('userData');
}

function getLegacyManagedOpenClawConfigDir(): string {
  return join(getManagedOpenClawHomeDir(), 'openclaw');
}

function migrateLegacyManagedOpenClawConfigDir(): void {
  const nextDir = join(getManagedOpenClawHomeDir(), MANAGED_OPENCLAW_DIRNAME);
  const legacyDir = getLegacyManagedOpenClawConfigDir();
  if (!existsSync(legacyDir) || existsSync(nextDir)) {
    return;
  }
  try {
    renameSync(legacyDir, nextDir);
  } catch (error) {
    logger.warn('Failed to migrate legacy managed OpenClaw directory:', error);
  }
}

/**
 * Get the XClaw-managed OpenClaw config directory
 */
export function getManagedOpenClawConfigDir(): string {
  migrateLegacyManagedOpenClawConfigDir();
  return join(getManagedOpenClawHomeDir(), MANAGED_OPENCLAW_DIRNAME);
}

export function getOpenClawRuntimeEnv(mode: OpenClawRootMode = getOpenClawRootMode()): Record<string, string> {
  const configDir = resolveOpenClawConfigDirForMode(mode);
  const configPath = join(configDir, 'openclaw.json');
  const runtimeEnv: Record<string, string> = {
    OPENCLAW_STATE_DIR: configDir,
    CLAWDBOT_STATE_DIR: configDir,
    OPENCLAW_CONFIG_PATH: configPath,
    CLAWDBOT_CONFIG_PATH: configPath,
  };
  if (mode === 'fresh') {
    runtimeEnv.OPENCLAW_HOME = getManagedOpenClawHomeDir();
  }
  return runtimeEnv;
}

function readStoredOpenClawRootMode(): OpenClawRootMode | null {
  try {
    const raw = readFileSync(join(app.getPath('userData'), OPENCLAW_SETTINGS_FILE), 'utf-8');
    const parsed = JSON.parse(raw) as { openClawRootMode?: unknown };
    return parsed.openClawRootMode === 'fresh' || parsed.openClawRootMode === 'takeover'
      ? parsed.openClawRootMode
      : null;
  } catch {
    return null;
  }
}

function resolveOpenClawConfigDirForMode(mode: OpenClawRootMode): string {
  return mode === 'fresh' ? getManagedOpenClawConfigDir() : getLegacyOpenClawConfigDir();
}

export function getOpenClawRootMode(): OpenClawRootMode {
  const envMode = process.env[OPENCLAW_ROOT_MODE_ENV];
  if (envMode === 'fresh' || envMode === 'takeover') {
    return envMode;
  }
  return readStoredOpenClawRootMode() ?? 'takeover';
}

export function setOpenClawRootMode(mode: OpenClawRootMode): void {
  const runtimeEnv = getOpenClawRuntimeEnv(mode);
  process.env[OPENCLAW_ROOT_MODE_ENV] = mode;
  process.env.OPENCLAW_STATE_DIR = runtimeEnv.OPENCLAW_STATE_DIR;
  process.env.CLAWDBOT_STATE_DIR = runtimeEnv.CLAWDBOT_STATE_DIR;
  process.env.OPENCLAW_CONFIG_PATH = runtimeEnv.OPENCLAW_CONFIG_PATH;
  process.env.CLAWDBOT_CONFIG_PATH = runtimeEnv.CLAWDBOT_CONFIG_PATH;
  if (runtimeEnv.OPENCLAW_HOME) {
    process.env.OPENCLAW_HOME = runtimeEnv.OPENCLAW_HOME;
  } else {
    delete process.env.OPENCLAW_HOME;
  }
}

export function primeOpenClawRootMode(): OpenClawRootMode {
  const mode = getOpenClawRootMode();
  setOpenClawRootMode(mode);
  return mode;
}

/**
 * Get OpenClaw config directory
 */
export function getOpenClawConfigDir(): string {
  return resolveOpenClawConfigDirForMode(getOpenClawRootMode());
}

export function getOpenClawConfigPath(): string {
  return join(getOpenClawConfigDir(), 'openclaw.json');
}

export function getOpenClawSkillsDir(): string {
  return join(getOpenClawConfigDir(), 'skills');
}

export function getOpenClawExtensionsDir(): string {
  return join(getOpenClawConfigDir(), 'extensions');
}

export function getOpenClawCredentialsDir(): string {
  return join(getOpenClawConfigDir(), 'credentials');
}

export function getOpenClawAgentsDir(): string {
  return join(getOpenClawConfigDir(), 'agents');
}

export function getOpenClawMediaDir(): string {
  return join(getOpenClawConfigDir(), 'media');
}

export function getOpenClawDefaultWorkspaceDir(): string {
  return join(getOpenClawConfigDir(), 'workspace');
}

/**
 * Get XClaw config directory
 */
export function getXClawConfigDir(): string {
  return join(homedir(), '.XClaw');
}

/**
 * Get XClaw logs directory
 */
export function getLogsDir(): string {
  return join(app.getPath('userData'), 'logs');
}

/**
 * Get XClaw data directory
 */
export function getDataDir(): string {
  return app.getPath('userData');
}

/**
 * Ensure directory exists
 */
export function ensureDir(dir: string): void {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

/**
 * Get resources directory (for bundled assets)
 */
export function getResourcesDir(): string {
  if (app.isPackaged) {
    return join(process.resourcesPath, 'resources');
  }
  return join(__dirname, '../../resources');
}

/**
 * Get preload script path
 */
export function getPreloadPath(): string {
  return join(__dirname, '../preload/index.js');
}

/**
 * Get OpenClaw package directory
 * - Production (packaged): from resources/openclaw (copied by electron-builder extraResources)
 * - Development: from node_modules/openclaw
 */
export function getOpenClawDir(): string {
  if (app.isPackaged) {
    return join(process.resourcesPath, 'openclaw');
  }
  return join(__dirname, '../../node_modules/openclaw');
}

/**
 * Get OpenClaw package directory resolved to a real path.
 * Useful when consumers need deterministic module resolution under pnpm symlinks.
 */
export function getOpenClawResolvedDir(): string {
  const dir = getOpenClawDir();
  if (!existsSync(dir)) {
    return dir;
  }
  try {
    return realpathSync(dir);
  } catch {
    return dir;
  }
}

/**
 * Get OpenClaw entry script path (openclaw.mjs)
 */
export function getOpenClawEntryPath(): string {
  return join(getOpenClawDir(), 'openclaw.mjs');
}

/**
 * Get ClawHub CLI entry script path (clawdhub.js)
 */
export function getClawHubCliEntryPath(): string {
  return join(app.getAppPath(), 'node_modules', 'clawhub', 'bin', 'clawdhub.js');
}

/**
 * Get ClawHub CLI binary path (node_modules/.bin)
 */
export function getClawHubCliBinPath(): string {
  const binName = process.platform === 'win32' ? 'clawhub.cmd' : 'clawhub';
  return join(app.getAppPath(), 'node_modules', '.bin', binName);
}

/**
 * Check if OpenClaw package exists
 */
export function isOpenClawPresent(): boolean {
  const dir = getOpenClawDir();
  const pkgJsonPath = join(dir, 'package.json');
  return existsSync(dir) && existsSync(pkgJsonPath);
}

/**
 * Check if OpenClaw is built (has dist folder)
 * For the npm package, this should always be true since npm publishes the built dist.
 */
export function isOpenClawBuilt(): boolean {
  const dir = getOpenClawDir();
  const distDir = join(dir, 'dist');
  const hasDist = existsSync(distDir);
  return hasDist;
}

/**
 * Get OpenClaw status for environment check
 */
export interface OpenClawStatus {
  packageExists: boolean;
  isBuilt: boolean;
  entryPath: string;
  dir: string;
  version?: string;
}

export function getOpenClawStatus(): OpenClawStatus {
  const dir = getOpenClawDir();
  let version: string | undefined;

  // Try to read version from package.json
  try {
    const pkgPath = join(dir, 'package.json');
    if (existsSync(pkgPath)) {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
      version = pkg.version;
    }
  } catch {
    // Ignore version read errors
  }

  const status: OpenClawStatus = {
    packageExists: isOpenClawPresent(),
    isBuilt: isOpenClawBuilt(),
    entryPath: getOpenClawEntryPath(),
    dir,
    version,
  };

  logger.info('OpenClaw status:', status);
  return status;
}
