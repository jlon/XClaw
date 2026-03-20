import { access, readFile, readdir } from 'fs/promises';
import { constants } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import type { AppSettings } from '../utils/store';
import { normalizeWorkspacePath } from '../utils/workspace-path';

type SetupSettingSnapshot = Pick<Partial<AppSettings>, 'setupComplete'>;

export type SetupBootstrapSource = 'main-settings' | 'legacy-footprint' | 'pending';

export interface SetupBootstrapState {
  setupComplete: boolean;
  source: SetupBootstrapSource;
  readonly: boolean;
  shouldRunStartupSideEffects: boolean;
}

interface DeriveSetupBootstrapStateOptions {
  settings: SetupSettingSnapshot;
  legacyFootprintDetected: boolean;
}

const OPENCLAW_DIR = join(homedir(), '.openclaw');
const OPENCLAW_CONFIG_PATH = join(OPENCLAW_DIR, 'openclaw.json');
const XClaw_CONTEXT_BEGIN = '<!-- XClaw:begin -->';
const XClaw_CONTEXT_END = '<!-- XClaw:end -->';
const PREINSTALLED_MARKER_NAME = '.XClaw-preinstalled.json';

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function hasNonEmptyRecord(value: unknown): boolean {
  const record = asRecord(value);
  return Boolean(record && Object.keys(record).length > 0);
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function readJsonFile<T>(path: string): Promise<T | null> {
  try {
    if (!(await fileExists(path))) {
      return null;
    }
    const raw = await readFile(path, 'utf-8');
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function extractWorkspaceDirsFromOpenClawConfig(config: unknown): string[] {
  const dirs = new Set<string>();
  const configRecord = asRecord(config);
  const agents = asRecord(configRecord?.agents);
  const defaults = asRecord(agents?.defaults);
  const defaultWorkspace = typeof defaults?.workspace === 'string'
    ? defaults.workspace.trim()
    : '';

  if (defaultWorkspace) {
    dirs.add(normalizeWorkspacePath(defaultWorkspace));
  }

  const agentList = Array.isArray(agents?.list) ? agents.list : [];
  for (const entry of agentList) {
    const agent = asRecord(entry);
    const workspace = typeof agent?.workspace === 'string'
      ? agent.workspace.trim()
      : '';
    if (workspace) {
      dirs.add(normalizeWorkspacePath(workspace));
    }
  }

  if (dirs.size === 0) {
    dirs.add(normalizeWorkspacePath(join(OPENCLAW_DIR, 'workspace')));
  }

  return [...dirs];
}

function hasXClawContextMarker(content: string): boolean {
  return content.includes(XClaw_CONTEXT_BEGIN) && content.includes(XClaw_CONTEXT_END);
}

export function hasLegacyProviderStoreFootprint(storeData: unknown): boolean {
  const store = asRecord(storeData);
  if (!store) {
    return false;
  }

  return hasNonEmptyRecord(store.providers)
    || hasNonEmptyRecord(store.providerAccounts)
    || hasNonEmptyRecord(store.apiKeys)
    || hasNonEmptyRecord(store.providerSecrets)
    || (typeof store.defaultProvider === 'string' && store.defaultProvider.trim().length > 0)
    || (typeof store.defaultProviderAccountId === 'string' && store.defaultProviderAccountId.trim().length > 0)
    || (typeof store.schemaVersion === 'number' && store.schemaVersion > 0);
}

export function hasLegacyOpenClawConfigFootprint(configData: unknown): boolean {
  const config = asRecord(configData);
  if (!config) {
    return false;
  }

  const gateway = asRecord(config.gateway);
  const auth = asRecord(gateway?.auth);
  const token = typeof auth?.token === 'string' ? auth.token.trim() : '';
  if (token.startsWith('XClaw-')) {
    return true;
  }

  const controlUi = asRecord(gateway?.controlUi);
  const allowedOrigins = Array.isArray(controlUi?.allowedOrigins)
    ? controlUi.allowedOrigins.filter((value): value is string => typeof value === 'string')
    : [];

  return allowedOrigins.includes('file://');
}

export function deriveSetupBootstrapState(
  options: DeriveSetupBootstrapStateOptions
): SetupBootstrapState {
  if (typeof options.settings.setupComplete === 'boolean') {
    return {
      setupComplete: options.settings.setupComplete,
      source: 'main-settings',
      readonly: !options.settings.setupComplete,
      shouldRunStartupSideEffects: options.settings.setupComplete,
    };
  }

  if (options.legacyFootprintDetected) {
    return {
      setupComplete: false,
      source: 'legacy-footprint',
      readonly: true,
      shouldRunStartupSideEffects: false,
    };
  }

  return {
    setupComplete: false,
    source: 'pending',
    readonly: true,
    shouldRunStartupSideEffects: false,
  };
}

async function detectLegacyProviderStoreFootprint(): Promise<boolean> {
  const { app } = await import('electron');
  const providerStorePath = join(app.getPath('userData'), 'XClaw-providers.json');
  const store = await readJsonFile<Record<string, unknown>>(providerStorePath);
  return hasLegacyProviderStoreFootprint(store);
}

async function detectLegacyOpenClawConfigFootprint(): Promise<boolean> {
  const config = await readJsonFile<Record<string, unknown>>(OPENCLAW_CONFIG_PATH);
  return hasLegacyOpenClawConfigFootprint(config);
}

async function detectLegacyPreinstalledSkillFootprint(): Promise<boolean> {
  const skillsDir = join(OPENCLAW_DIR, 'skills');
  if (!(await fileExists(skillsDir))) {
    return false;
  }

  try {
    const entries = await readdir(skillsDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }
      if (await fileExists(join(skillsDir, entry.name, PREINSTALLED_MARKER_NAME))) {
        return true;
      }
    }
  } catch {
    return false;
  }

  return false;
}

async function detectLegacyWorkspaceFootprint(): Promise<boolean> {
  const config = await readJsonFile<Record<string, unknown>>(OPENCLAW_CONFIG_PATH);
  const workspaceDirs = extractWorkspaceDirsFromOpenClawConfig(config);

  for (const workspaceDir of workspaceDirs) {
    if (!(await fileExists(workspaceDir))) {
      continue;
    }

    try {
      const entries = await readdir(workspaceDir);
      for (const entry of entries) {
        if (!entry.endsWith('.md')) {
          continue;
        }
        const content = await readFile(join(workspaceDir, entry), 'utf-8').catch(() => null);
        if (content && hasXClawContextMarker(content)) {
          return true;
        }
      }
    } catch {
      continue;
    }
  }

  return false;
}

export async function detectLegacySetupFootprint(): Promise<boolean> {
  const detectors = [
    detectLegacyProviderStoreFootprint,
    detectLegacyOpenClawConfigFootprint,
    detectLegacyPreinstalledSkillFootprint,
    detectLegacyWorkspaceFootprint,
  ];

  for (const detector of detectors) {
    try {
      if (await detector()) {
        return true;
      }
    } catch {
      continue;
    }
  }

  return false;
}

export async function resolveSetupBootstrapState(): Promise<SetupBootstrapState> {
  const { getAllSettings } = await import('../utils/store');
  const settings = await getAllSettings();
  const legacyFootprintDetected = typeof settings.setupComplete === 'boolean'
    ? false
    : await detectLegacySetupFootprint();
  return deriveSetupBootstrapState({
    settings,
    legacyFootprintDetected,
  });
}
