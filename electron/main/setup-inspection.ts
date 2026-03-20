import { access, readFile, readdir, stat } from 'fs/promises';
import { constants } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import { createServer } from 'node:net';
import { PORTS } from '../utils/config';
import { normalizeWorkspacePath, validateWorkspacePathInput } from '../utils/workspace-path';
import { probeGatewayReady } from '../gateway/ws-client';
import {
  detectLegacySetupFootprint,
  resolveSetupBootstrapState,
  type SetupBootstrapState,
} from './setup-bootstrap';
import { getProviderDefinition } from '../shared/providers/registry';

const OPENCLAW_DIR = join(homedir(), '.openclaw');
const OPENCLAW_CONFIG_PATH = join(OPENCLAW_DIR, 'openclaw.json');
const OPENCLAW_SKILLS_DIR = join(OPENCLAW_DIR, 'skills');
const OPENCLAW_EXTENSIONS_DIR = join(OPENCLAW_DIR, 'extensions');
const OPENCLAW_AGENTS_DIR = join(OPENCLAW_DIR, 'agents');
const CONFIG_STABILITY_SAMPLE_MS = 120;
const PORT_SCAN_WINDOW = 10;
const LOCALHOST_HOSTS = ['127.0.0.1', '::1'] as const;

type SetupMode = 'fresh' | 'takeover';
type ProviderImportSource = 'supported' | 'custom' | 'unsupported';
type ProviderAuthMode = 'api_key' | 'oauth' | 'local';

interface SetupSettingsSnapshot {
  gatewayPort?: number;
}

interface AuthProfileEntryApiKey {
  type: 'api_key';
  provider: string;
  key: string;
}

interface AuthProfileEntryOAuth {
  type: 'oauth';
  provider: string;
  access: string;
  refresh: string;
  expires: number;
  email?: string;
  projectId?: string;
}

type AuthProfileEntry = AuthProfileEntryApiKey | AuthProfileEntryOAuth;

interface AuthProfilesStore {
  version?: number;
  profiles?: Record<string, AuthProfileEntry>;
}

export interface SetupInspectionProviderAccount {
  runtimeProviderKey: string;
  clawxProviderType: string;
  importSource: ProviderImportSource;
  authModes: ProviderAuthMode[];
  agentIds: string[];
  hasCredentials: boolean;
  conflict: boolean;
}

export interface SetupProviderImportSummary {
  defaultRuntimeProviderKey: string | null;
  importableCount: number;
  conflictCount: number;
  unsupportedCount: number;
  requiresReview: boolean;
  accounts: SetupInspectionProviderAccount[];
}

export interface SetupInspectionResult {
  generatedAt: string;
  bootstrap: SetupBootstrapState;
  hasExistingOpenClaw: boolean;
  openClawDir: string;
  hasLegacyClawXFootprint: boolean;
  defaultWorkspacePath: string;
  configuredWorkspacePaths: string[];
  gatewayPort: number;
  runtime: {
    portAvailable: boolean;
    suggestedGatewayPort: number;
    externalGatewayDetected: boolean;
    configChanging: boolean;
  };
  counts: {
    agents: number;
    channels: number;
    skills: number;
    extensions: number;
    runtimeProviders: number;
    providerAccounts: number;
  };
  providerImport: SetupProviderImportSummary;
  warnings: string[];
  errors: string[];
  suggestedMode: SetupMode;
}

export interface SetupPlanRequest {
  mode?: SetupMode;
  gatewayPort?: number;
  workspacePath?: string;
}

export interface SetupPlanResult {
  mode: SetupMode;
  canApply: boolean;
  blockingIssues: string[];
  warnings: string[];
  runtime: {
    gatewayPort: number;
    portAvailable: boolean;
    suggestedGatewayPort: number;
    externalGatewayDetected: boolean;
    configChanging: boolean;
  };
  workspace: {
    defaultPath: string;
    configuredPaths: string[];
  };
  providerImport: {
    defaultRuntimeProviderKey: string | null;
    importableCount: number;
    conflictCount: number;
    unsupportedCount: number;
    requiresReview: boolean;
  };
  reuse: {
    openClawDir: string;
    workspacePaths: string[];
    skillDir: string;
    extensionDir: string;
  };
  writes: {
    immediateTargets: string[];
    deferredTargets: string[];
  };
}

export interface SetupInspectionDependencies {
  requestedGatewayPort?: number;
  requestedWorkspacePath?: string;
  now?: () => Date;
  resolveBootstrapState?: () => Promise<SetupBootstrapState>;
  detectLegacyFootprint?: () => Promise<boolean>;
  getSettings?: () => Promise<SetupSettingsSnapshot>;
  fileExists?: (path: string) => Promise<boolean>;
  readFile?: (path: string) => Promise<string>;
  readdirNames?: (path: string) => Promise<string[]>;
  listConfiguredAgentIds?: () => Promise<string[]>;
  listConfiguredChannels?: () => Promise<string[]>;
  checkPortAvailability?: (port: number) => Promise<boolean>;
  findSuggestedPort?: (preferredPort: number) => Promise<number>;
  detectExternalGateway?: (port: number) => Promise<boolean>;
  detectConfigChanging?: (paths: string[]) => Promise<boolean>;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function getConfiguredWorkspacePaths(config: unknown): string[] {
  const configRecord = asRecord(config);
  const agents = asRecord(configRecord?.agents);
  const defaults = asRecord(agents?.defaults);
  const paths = new Set<string>();

  const defaultWorkspace = typeof defaults?.workspace === 'string' ? defaults.workspace.trim() : '';
  if (defaultWorkspace) {
    paths.add(normalizeWorkspacePath(defaultWorkspace));
  }

  const entries = Array.isArray(agents?.list) ? agents.list : [];
  for (const entry of entries) {
    const agent = asRecord(entry);
    const workspace = typeof agent?.workspace === 'string' ? agent.workspace.trim() : '';
    if (workspace) {
      paths.add(normalizeWorkspacePath(workspace));
    }
  }

  if (paths.size === 0) {
    paths.add(normalizeWorkspacePath(join(OPENCLAW_DIR, 'workspace')));
  }

  return [...paths];
}

function getDefaultModelRef(config: unknown): string | null {
  const configRecord = asRecord(config);
  const agents = asRecord(configRecord?.agents);
  const defaults = asRecord(agents?.defaults);
  const defaultsModel = defaults?.model;

  if (typeof defaultsModel === 'string' && defaultsModel.trim()) {
    return defaultsModel.trim();
  }

  const defaultsModelRecord = asRecord(defaultsModel);
  if (typeof defaultsModelRecord?.primary === 'string' && defaultsModelRecord.primary.trim()) {
    return defaultsModelRecord.primary.trim();
  }

  const models = asRecord(configRecord?.models);
  if (typeof models?.default === 'string' && models.default.trim()) {
    return models.default.trim();
  }

  return null;
}

function getDefaultRuntimeProviderKey(config: unknown): string | null {
  const defaultModelRef = getDefaultModelRef(config);
  if (!defaultModelRef) {
    return null;
  }

  const slashIndex = defaultModelRef.indexOf('/');
  if (slashIndex <= 0) {
    return null;
  }

  return defaultModelRef.slice(0, slashIndex);
}

function classifyProviderImportSource(
  runtimeProviderKey: string,
  providerConfig: unknown,
): ProviderImportSource {
  if (getProviderDefinition(runtimeProviderKey)) {
    return 'supported';
  }

  const providerRecord = asRecord(providerConfig);
  if (
    typeof providerRecord?.baseUrl === 'string' &&
    providerRecord.baseUrl.trim() &&
    typeof providerRecord.api === 'string' &&
    providerRecord.api.trim()
  ) {
    return 'custom';
  }

  return 'unsupported';
}

function inferClawXProviderType(runtimeProviderKey: string, importSource: ProviderImportSource): string {
  if (importSource === 'supported' && getProviderDefinition(runtimeProviderKey)) {
    return runtimeProviderKey;
  }

  if (importSource === 'custom') {
    return 'custom';
  }

  return 'unknown';
}

function buildAuthFingerprint(entry: AuthProfileEntry): string {
  if (entry.type === 'api_key') {
    return `api_key:${entry.key}`;
  }

  return `oauth:${entry.refresh}:${entry.email ?? ''}:${entry.projectId ?? ''}`;
}

function extractRuntimeProviderConfigs(config: unknown): Record<string, unknown> {
  const configRecord = asRecord(config);
  const models = asRecord(configRecord?.models);
  const providers = asRecord(models?.providers);
  return providers ?? {};
}

export function summarizeProviderImport(options: {
  config: unknown;
  authProfilesByAgent: Record<string, AuthProfilesStore>;
}): SetupProviderImportSummary {
  const runtimeProviderConfigs = extractRuntimeProviderConfigs(options.config);
  const runtimeProviderKeys = new Set<string>(Object.keys(runtimeProviderConfigs));

  const configRecord = asRecord(options.config);
  const plugins = asRecord(configRecord?.plugins);
  const pluginEntries = asRecord(plugins?.entries);
  for (const [pluginId, meta] of Object.entries(pluginEntries ?? {})) {
    const entry = asRecord(meta);
    if (pluginId.endsWith('-auth') && entry?.enabled !== false) {
      runtimeProviderKeys.add(pluginId.slice(0, -'-auth'.length));
    }
  }

  const authState = new Map<string, {
    authModes: Set<ProviderAuthMode>;
    agentIds: Set<string>;
    fingerprints: Set<string>;
    hasCredentials: boolean;
  }>();

  for (const [agentId, store] of Object.entries(options.authProfilesByAgent)) {
    const profiles = store.profiles ?? {};
    for (const entry of Object.values(profiles)) {
      if (!entry?.provider || !entry.type) {
        continue;
      }

      runtimeProviderKeys.add(entry.provider);
      const existing = authState.get(entry.provider) ?? {
        authModes: new Set<ProviderAuthMode>(),
        agentIds: new Set<string>(),
        fingerprints: new Set<string>(),
        hasCredentials: false,
      };

      existing.agentIds.add(agentId);
      existing.hasCredentials = true;
      existing.fingerprints.add(buildAuthFingerprint(entry));
      existing.authModes.add(entry.type === 'oauth' ? 'oauth' : 'api_key');
      authState.set(entry.provider, existing);
    }
  }

  const accounts = [...runtimeProviderKeys].sort().map((runtimeProviderKey) => {
    const providerConfig = runtimeProviderConfigs[runtimeProviderKey];
    const importSource = classifyProviderImportSource(runtimeProviderKey, providerConfig);
    const auth = authState.get(runtimeProviderKey);
    const definition = getProviderDefinition(runtimeProviderKey);
    const authModes = auth?.authModes.size
      ? [...auth.authModes]
      : (definition?.defaultAuthMode === 'local' ? ['local'] as ProviderAuthMode[] : []);
    const conflict = Boolean(auth && auth.fingerprints.size > 1);

    return {
      runtimeProviderKey,
      clawxProviderType: inferClawXProviderType(runtimeProviderKey, importSource),
      importSource,
      authModes,
      agentIds: [...(auth?.agentIds ?? new Set<string>())].sort(),
      hasCredentials: auth?.hasCredentials ?? authModes.includes('local'),
      conflict,
    } satisfies SetupInspectionProviderAccount;
  });

  const importableCount = accounts.filter((account) => account.importSource !== 'unsupported').length;
  const conflictCount = accounts.filter((account) => account.conflict).length;
  const unsupportedCount = accounts.filter((account) => account.importSource === 'unsupported').length;

  return {
    defaultRuntimeProviderKey: getDefaultRuntimeProviderKey(options.config),
    importableCount,
    conflictCount,
    unsupportedCount,
    requiresReview: conflictCount > 0 || unsupportedCount > 0,
    accounts,
  };
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function defaultFileExists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function defaultReadFile(path: string): Promise<string> {
  return readFile(path, 'utf-8');
}

async function defaultReaddirNames(path: string): Promise<string[]> {
  return readdir(path);
}

export async function isLocalGatewayPortAvailable(port: number): Promise<boolean> {
  for (const host of LOCALHOST_HOSTS) {
    const available = await new Promise<boolean>((resolve) => {
      const server = createServer();
      const cleanup = (): void => {
        server.removeAllListeners();
      };

      server.once('error', (error: NodeJS.ErrnoException) => {
        cleanup();
        if (host === '::1' && (error.code === 'EAFNOSUPPORT' || error.code === 'EADDRNOTAVAIL')) {
          resolve(true);
          return;
        }
        resolve(false);
      });

      server.once('listening', () => {
        server.close(() => {
          cleanup();
          resolve(true);
        });
      });

      server.listen(port, host);
    });

    if (!available) {
      return false;
    }
  }

  return true;
}

async function defaultFindSuggestedPort(preferredPort: number): Promise<number> {
  for (let offset = 0; offset < PORT_SCAN_WINDOW; offset += 1) {
    const candidate = preferredPort + offset;
    if (await isLocalGatewayPortAvailable(candidate)) {
      return candidate;
    }
  }

  return preferredPort;
}

async function defaultDetectExternalGateway(port: number): Promise<boolean> {
  if (await isLocalGatewayPortAvailable(port)) {
    return false;
  }
  return await probeGatewayReady(port, 1500);
}

async function defaultDetectConfigChanging(paths: string[]): Promise<boolean> {
  const snapshot = async (): Promise<string> => {
    const parts = await Promise.all(paths.map(async (path) => {
      try {
        const result = await stat(path);
        return `${path}:${result.size}:${result.mtimeMs}`;
      } catch {
        return `${path}:missing`;
      }
    }));
    return parts.join('|');
  };

  const initial = await snapshot();
  await delay(CONFIG_STABILITY_SAMPLE_MS);
  const next = await snapshot();
  return initial !== next;
}

async function safeReadJson(
  path: string,
  deps: Required<Pick<SetupInspectionDependencies, 'fileExists' | 'readFile'>>,
): Promise<{ exists: boolean; data: unknown; error: string | null }> {
  if (!(await deps.fileExists(path))) {
    return { exists: false, data: null, error: null };
  }

  try {
    return {
      exists: true,
      data: JSON.parse(await deps.readFile(path)),
      error: null,
    };
  } catch (error) {
    return {
      exists: true,
      data: null,
      error: `读取 ${path} 失败: ${String(error)}`,
    };
  }
}

function extractGatewayPort(config: unknown, settingsGatewayPort: number | undefined): number {
  const configRecord = asRecord(config);
  const gateway = asRecord(configRecord?.gateway);
  if (typeof gateway?.port === 'number' && Number.isInteger(gateway.port) && gateway.port > 0) {
    return gateway.port;
  }

  if (typeof settingsGatewayPort === 'number' && Number.isInteger(settingsGatewayPort) && settingsGatewayPort > 0) {
    return settingsGatewayPort;
  }

  return PORTS.OPENCLAW_GATEWAY;
}

function parseRequestedGatewayPort(value: unknown): number | null {
  return typeof value === 'number'
    && Number.isInteger(value)
    && value >= 1
    && value <= 65535
    ? value
    : null;
}

function buildSuggestedFreshWorkspacePath(
  configuredWorkspacePaths: string[],
  defaultWorkspacePath: string,
): string {
  const normalizedDefault = normalizeWorkspacePath(defaultWorkspacePath);
  const existing = new Set(configuredWorkspacePaths.map((value) => normalizeWorkspacePath(value)));

  if (!existing.has(normalizedDefault)) {
    return normalizedDefault;
  }

  for (let index = 1; index <= 20; index += 1) {
    const suffix = index === 1 ? '-xclaw' : `-xclaw-${index}`;
    const candidate = normalizeWorkspacePath(`${normalizedDefault}${suffix}`);
    if (!existing.has(candidate)) {
      return candidate;
    }
  }

  return normalizeWorkspacePath(`${normalizedDefault}-${Date.now()}`);
}

async function countManagedEntries(
  path: string,
  deps: Required<Pick<SetupInspectionDependencies, 'fileExists' | 'readdirNames'>>,
): Promise<number> {
  if (!(await deps.fileExists(path))) {
    return 0;
  }

  try {
    const names = await deps.readdirNames(path);
    return names.filter((name) => !name.startsWith('.')).length;
  } catch {
    return 0;
  }
}

async function readAuthProfilesByAgent(
  agentIds: string[],
  deps: Required<Pick<SetupInspectionDependencies, 'fileExists' | 'readFile'>>,
  errors: string[],
): Promise<Record<string, AuthProfilesStore>> {
  const result: Record<string, AuthProfilesStore> = {};

  for (const agentId of agentIds) {
    const authPath = join(OPENCLAW_AGENTS_DIR, agentId, 'agent', 'auth-profiles.json');
    const authProfiles = await safeReadJson(authPath, deps);
    if (authProfiles.error) {
      errors.push(authProfiles.error);
      continue;
    }
    if (authProfiles.exists && authProfiles.data) {
      result[agentId] = authProfiles.data as AuthProfilesStore;
    }
  }

  return result;
}

function uniq(values: string[]): string[] {
  return [...new Set(values)];
}

export async function inspectLocalOpenClawSetup(
  dependencies: SetupInspectionDependencies = {},
): Promise<SetupInspectionResult> {
  const deps = {
    now: dependencies.now ?? (() => new Date()),
    resolveBootstrapState: dependencies.resolveBootstrapState ?? resolveSetupBootstrapState,
    detectLegacyFootprint: dependencies.detectLegacyFootprint ?? detectLegacySetupFootprint,
    getSettings: dependencies.getSettings ?? (async () => {
      const { getAllSettings } = await import('../utils/store');
      const settings = await getAllSettings();
      return { gatewayPort: settings.gatewayPort };
    }),
    fileExists: dependencies.fileExists ?? defaultFileExists,
    readFile: dependencies.readFile ?? defaultReadFile,
    readdirNames: dependencies.readdirNames ?? defaultReaddirNames,
    listConfiguredAgentIds: dependencies.listConfiguredAgentIds ?? (async () => {
      const { listConfiguredAgentIds } = await import('../utils/agent-config');
      return listConfiguredAgentIds();
    }),
    listConfiguredChannels: dependencies.listConfiguredChannels ?? (async () => {
      const { listConfiguredChannels } = await import('../utils/channel-config');
      return listConfiguredChannels();
    }),
    checkPortAvailability: dependencies.checkPortAvailability ?? isLocalGatewayPortAvailable,
    findSuggestedPort: dependencies.findSuggestedPort ?? defaultFindSuggestedPort,
    detectExternalGateway: dependencies.detectExternalGateway ?? defaultDetectExternalGateway,
    detectConfigChanging: dependencies.detectConfigChanging ?? defaultDetectConfigChanging,
  };

  const warnings: string[] = [];
  const errors: string[] = [];

  const [bootstrap, hasLegacyClawXFootprint, settings, configFile] = await Promise.all([
    deps.resolveBootstrapState(),
    deps.detectLegacyFootprint(),
    deps.getSettings(),
    safeReadJson(OPENCLAW_CONFIG_PATH, deps),
  ]);

  if (configFile.error) {
    errors.push(configFile.error);
  }

  const config = configFile.data;
  const baseWorkspacePaths = getConfiguredWorkspacePaths(config);
  const requestedWorkspaceValidation = typeof dependencies.requestedWorkspacePath === 'string'
    ? validateWorkspacePathInput(dependencies.requestedWorkspacePath)
    : { normalizedPath: null, error: null };
  const configuredWorkspacePaths = requestedWorkspaceValidation.normalizedPath
    ? uniq([requestedWorkspaceValidation.normalizedPath, ...baseWorkspacePaths])
    : baseWorkspacePaths;
  const defaultWorkspacePath = requestedWorkspaceValidation.normalizedPath
    ?? configuredWorkspacePaths[0]
    ?? join(OPENCLAW_DIR, 'workspace');
  const gatewayPort = parseRequestedGatewayPort(dependencies.requestedGatewayPort)
    ?? extractGatewayPort(config, settings.gatewayPort);

  const [agentIds, channels, skillsCount, extensionsCount, portAvailable, suggestedGatewayPort, externalGatewayDetected] = await Promise.all([
    deps.listConfiguredAgentIds().catch(() => []),
    deps.listConfiguredChannels().catch(() => []),
    countManagedEntries(OPENCLAW_SKILLS_DIR, deps),
    countManagedEntries(OPENCLAW_EXTENSIONS_DIR, deps),
    deps.checkPortAvailability(gatewayPort),
    deps.findSuggestedPort(gatewayPort),
    deps.detectExternalGateway(gatewayPort),
  ]);

  const authProfilesByAgent = await readAuthProfilesByAgent(agentIds, deps, errors);
  const providerImport = summarizeProviderImport({ config, authProfilesByAgent });
  const configChanging = await deps.detectConfigChanging([
    OPENCLAW_CONFIG_PATH,
    ...agentIds.map((agentId) => join(OPENCLAW_AGENTS_DIR, agentId, 'agent', 'auth-profiles.json')),
  ]);

  const openClawDirExists = await deps.fileExists(OPENCLAW_DIR);
  const hasExistingOpenClaw = Boolean(
    configFile.exists ||
    openClawDirExists ||
    skillsCount > 0 ||
    extensionsCount > 0 ||
    agentIds.length > 0 ||
    channels.length > 0
  );

  if (providerImport.requiresReview) {
    warnings.push('检测到需要人工确认的 provider 导入项');
  }
  if (!portAvailable) {
    warnings.push(
      externalGatewayDetected
        ? `检测到现有 Gateway 正在使用端口 ${gatewayPort}，接管时将尝试直接复用当前实例`
        : `网关端口 ${gatewayPort} 已被占用，建议使用 ${suggestedGatewayPort}`,
    );
  }

  return {
    generatedAt: deps.now().toISOString(),
    bootstrap,
    hasExistingOpenClaw,
    openClawDir: OPENCLAW_DIR,
    hasLegacyClawXFootprint,
    defaultWorkspacePath,
    configuredWorkspacePaths,
    gatewayPort,
    runtime: {
      portAvailable,
      suggestedGatewayPort,
      externalGatewayDetected,
      configChanging,
    },
    counts: {
      agents: hasExistingOpenClaw ? agentIds.length : 0,
      channels: channels.length,
      skills: skillsCount,
      extensions: extensionsCount,
      runtimeProviders: providerImport.accounts.length,
      providerAccounts: providerImport.accounts.length,
    },
    providerImport,
    warnings: uniq(warnings),
    errors: uniq(errors),
    suggestedMode: hasExistingOpenClaw ? 'takeover' : 'fresh',
  };
}

export function buildSetupPlan(
  inspection: SetupInspectionResult,
  request: SetupPlanRequest = {},
): SetupPlanResult {
  const mode = request.mode ?? inspection.suggestedMode;
  const blockingIssues: string[] = [];
  const requestedWorkspaceValidation = typeof request.workspacePath === 'string'
    ? validateWorkspacePathInput(request.workspacePath)
    : { normalizedPath: inspection.defaultWorkspacePath, error: null };
  const requestedGatewayPort = request.gatewayPort === undefined
    ? inspection.gatewayPort
    : parseRequestedGatewayPort(request.gatewayPort);
  const canReuseExistingGateway = !inspection.runtime.portAvailable
    && inspection.runtime.externalGatewayDetected
    && !inspection.runtime.configChanging;
  const suggestedFreshWorkspacePath = buildSuggestedFreshWorkspacePath(
    inspection.configuredWorkspacePaths,
    inspection.defaultWorkspacePath,
  );
  const freshGatewayPort = request.gatewayPort !== undefined
    ? requestedGatewayPort
    : (inspection.runtime.portAvailable ? inspection.gatewayPort : inspection.runtime.suggestedGatewayPort);
  const freshWorkspacePath = request.workspacePath !== undefined
    ? requestedWorkspaceValidation.normalizedPath
    : suggestedFreshWorkspacePath;
  const warnings = mode === 'takeover' ? [...inspection.warnings] : [];

  if (mode === 'takeover') {
    if (!inspection.hasExistingOpenClaw) {
      blockingIssues.push('未检测到可接管的 OpenClaw 安装');
    }
    if (!inspection.runtime.portAvailable && !canReuseExistingGateway) {
      blockingIssues.push(`检测到目标网关端口 ${inspection.gatewayPort} 已被占用，请先释放或改用 ${inspection.runtime.suggestedGatewayPort} 后再继续接管`);
    }
    if (inspection.runtime.externalGatewayDetected && !canReuseExistingGateway) {
      blockingIssues.push('检测到外部 Gateway 仍在运行，请先停止后再继续接管');
    }
    if (inspection.runtime.configChanging) {
      blockingIssues.push('检测到配置仍在变化，请先停止外部写入后再继续接管');
    }
    if (inspection.errors.length > 0) {
      blockingIssues.push('本地 OpenClaw 配置存在读取错误，请先处理后再继续接管');
    }
    if (canReuseExistingGateway) {
      warnings.push(`检测到现有 Gateway 正在使用端口 ${inspection.gatewayPort}，接管完成后 XClaw 将直接复用当前实例`);
    }
  } else {
    if (request.gatewayPort !== undefined && requestedGatewayPort === null) {
      blockingIssues.push('网关端口必须是 1-65535 的整数');
    }
    if (request.workspacePath !== undefined && requestedWorkspaceValidation.error) {
      blockingIssues.push(requestedWorkspaceValidation.error);
    }
    if (request.gatewayPort !== undefined && !inspection.runtime.portAvailable) {
      blockingIssues.push(`网关端口 ${inspection.gatewayPort} 已被占用，请改用 ${inspection.runtime.suggestedGatewayPort}`);
    }
  }

  if (mode === 'takeover' && inspection.providerImport.requiresReview) {
    warnings.push('Provider 导入存在冲突或不支持项，后续需要用户复核');
  }

  return {
    mode,
    canApply: blockingIssues.length === 0,
    blockingIssues,
    warnings: uniq(warnings),
    runtime: {
      gatewayPort: mode === 'takeover'
        ? inspection.gatewayPort
        : (freshGatewayPort ?? inspection.runtime.suggestedGatewayPort),
      portAvailable: mode === 'takeover'
        ? inspection.runtime.portAvailable
        : freshGatewayPort !== inspection.gatewayPort || inspection.runtime.portAvailable,
      suggestedGatewayPort: mode === 'takeover'
        ? inspection.runtime.suggestedGatewayPort
        : inspection.runtime.suggestedGatewayPort,
      externalGatewayDetected: mode === 'takeover'
        ? inspection.runtime.externalGatewayDetected
        : false,
      configChanging: inspection.runtime.configChanging,
    },
    workspace: {
      defaultPath: mode === 'takeover'
        ? (requestedWorkspaceValidation.normalizedPath ?? inspection.defaultWorkspacePath)
        : (freshWorkspacePath ?? suggestedFreshWorkspacePath),
      configuredPaths: inspection.configuredWorkspacePaths,
    },
    providerImport: {
      defaultRuntimeProviderKey: inspection.providerImport.defaultRuntimeProviderKey,
      importableCount: inspection.providerImport.importableCount,
      conflictCount: inspection.providerImport.conflictCount,
      unsupportedCount: inspection.providerImport.unsupportedCount,
      requiresReview: inspection.providerImport.requiresReview,
    },
    reuse: {
      openClawDir: inspection.openClawDir,
      workspacePaths: inspection.configuredWorkspacePaths,
      skillDir: OPENCLAW_SKILLS_DIR,
      extensionDir: OPENCLAW_EXTENSIONS_DIR,
    },
    writes: {
      immediateTargets: mode === 'takeover'
        ? ['主进程 settings.setupComplete', 'XClaw provider 派生状态']
        : ['主进程 settings.setupComplete', '~/.openclaw/openclaw.json'],
      deferredTargets: ['~/.openclaw/skills', '~/.openclaw/extensions', 'workspace bootstrap context'],
    },
  };
}
