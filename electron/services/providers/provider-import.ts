import { getProviderDefinition } from '../../shared/providers/registry';
import type {
  ProviderAccount,
  ProviderAuthMode,
  ProviderProtocol,
  ProviderSecret,
  ProviderType,
} from '../../shared/providers/types';
import { replaceImportedProviderAccounts } from './provider-store';
import { replaceImportedProviderSecrets } from '../secrets/secret-store';

type AuthProfileEntryApiKey = {
  type: 'api_key';
  provider: string;
  key: string;
};

type AuthProfileEntryOAuth = {
  type: 'oauth';
  provider: string;
  access: string;
  refresh: string;
  expires: number;
  email?: string;
  projectId?: string;
};

type AuthProfileEntry = AuthProfileEntryApiKey | AuthProfileEntryOAuth;

type AuthProfilesStore = {
  profiles?: Record<string, AuthProfileEntry>;
};

type RuntimeProviderConfig = {
  baseUrl?: string;
  api?: ProviderProtocol;
  apiProtocol?: ProviderProtocol;
};

type ImportSource = 'supported' | 'custom' | 'unsupported';

type ImportedProviderEntry = {
  runtimeProviderKey: string;
  accountId: string;
  vendorId: ProviderType;
  authMode: ProviderAuthMode;
  importSource: Exclude<ImportSource, 'unsupported'>;
  hasCredentials: boolean;
  conflict: boolean;
};

export type ImportedProviderState = {
  generatedAt: string;
  accounts: ProviderAccount[];
  secrets: ProviderSecret[];
  entries: ImportedProviderEntry[];
  defaultAccountId: string | null;
  conflicts: string[];
  warnings: string[];
};

type BuildImportedProviderStateOptions = {
  now?: () => string;
  config: unknown;
  authProfilesByAgent: Record<string, AuthProfilesStore>;
};

type CollectedProviderAuth = {
  selected: AuthProfileEntry | null;
  conflict: boolean;
};

const RUNTIME_VENDOR_ALIASES: Record<string, { vendorId: ProviderType; authMode: ProviderAuthMode }> = {
  'google-gemini-cli': { vendorId: 'google', authMode: 'oauth_browser' },
  'openai-codex': { vendorId: 'openai', authMode: 'oauth_browser' },
};

const asRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
};

const asProtocol = (value: unknown): ProviderProtocol | undefined => {
  if (
    value === 'openai-completions'
    || value === 'openai-responses'
    || value === 'anthropic-messages'
  ) {
    return value;
  }
  return undefined;
};

const extractRuntimeProviderConfigs = (config: unknown): Record<string, RuntimeProviderConfig> => {
  const configRecord = asRecord(config);
  const models = asRecord(configRecord?.models);
  const providers = asRecord(models?.providers);

  return Object.fromEntries(
    Object.entries(providers ?? {}).map(([runtimeProviderKey, entry]) => {
      const providerRecord = asRecord(entry);
      return [
        runtimeProviderKey,
        {
          baseUrl: typeof providerRecord?.baseUrl === 'string' ? providerRecord.baseUrl.trim() : undefined,
          api: asProtocol(providerRecord?.api),
          apiProtocol: asProtocol(providerRecord?.apiProtocol),
        } satisfies RuntimeProviderConfig,
      ];
    }),
  );
};

const getDefaultModelRef = (config: unknown): string | null => {
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
};

const getDefaultRuntimeProviderKey = (config: unknown): string | null => {
  const defaultModelRef = getDefaultModelRef(config);
  const slashIndex = defaultModelRef?.indexOf('/') ?? -1;
  return slashIndex > 0 && defaultModelRef ? defaultModelRef.slice(0, slashIndex) : null;
};

const getDefaultModelId = (config: unknown, runtimeProviderKey: string): string | undefined => {
  const defaultModelRef = getDefaultModelRef(config);
  if (!defaultModelRef || !defaultModelRef.startsWith(`${runtimeProviderKey}/`)) {
    return undefined;
  }
  return defaultModelRef.slice(runtimeProviderKey.length + 1) || undefined;
};

const buildFingerprint = (entry: AuthProfileEntry): string => (
  entry.type === 'api_key'
    ? `api_key:${entry.key}`
    : `oauth:${entry.refresh}:${entry.email ?? ''}:${entry.projectId ?? ''}`
);

const collectProviderAuth = (
  authProfilesByAgent: Record<string, AuthProfilesStore>,
): Map<string, CollectedProviderAuth> => {
  const state = new Map<string, { chosen: { agentId: string; entry: AuthProfileEntry } | null; fingerprints: Set<string> }>();
  const agentIds = Object.keys(authProfilesByAgent).sort((left, right) => {
    if (left === right) return 0;
    if (left === 'main') return -1;
    if (right === 'main') return 1;
    return left.localeCompare(right);
  });

  for (const agentId of agentIds) {
    const profiles = authProfilesByAgent[agentId]?.profiles ?? {};
    for (const entry of Object.values(profiles)) {
      if (!entry?.provider || !entry.type) {
        continue;
      }

      const current = state.get(entry.provider) ?? {
        chosen: null,
        fingerprints: new Set<string>(),
      };

      current.fingerprints.add(buildFingerprint(entry));
      if (!current.chosen || current.chosen.agentId !== 'main') {
        current.chosen = { agentId, entry };
      }

      state.set(entry.provider, current);
    }
  }

  return new Map(
    [...state.entries()].map(([runtimeProviderKey, value]) => [
      runtimeProviderKey,
      {
        selected: value.chosen?.entry ?? null,
        conflict: value.fingerprints.size > 1,
      } satisfies CollectedProviderAuth,
    ]),
  );
};

const resolveImportTarget = (
  runtimeProviderKey: string,
  runtimeConfig: RuntimeProviderConfig | undefined,
): {
  vendorId: ProviderType | null;
  authMode: ProviderAuthMode | null;
  importSource: ImportSource;
} => {
  const alias = RUNTIME_VENDOR_ALIASES[runtimeProviderKey];
  if (alias) {
    return {
      vendorId: alias.vendorId,
      authMode: alias.authMode,
      importSource: 'supported',
    };
  }

  const definition = getProviderDefinition(runtimeProviderKey);
  if (definition) {
    return {
      vendorId: definition.id,
      authMode: definition.defaultAuthMode,
      importSource: 'supported',
    };
  }

  if (runtimeConfig?.baseUrl && (runtimeConfig.api || runtimeConfig.apiProtocol)) {
    return {
      vendorId: 'custom',
      authMode: 'api_key',
      importSource: 'custom',
    };
  }

  return {
    vendorId: null,
    authMode: null,
    importSource: 'unsupported',
  };
};

const resolveAccountAuthMode = (
  runtimeProviderKey: string,
  vendorId: ProviderType,
  selectedAuth: AuthProfileEntry | null,
  fallbackAuthMode: ProviderAuthMode,
): ProviderAuthMode => {
  if (RUNTIME_VENDOR_ALIASES[runtimeProviderKey]) {
    return RUNTIME_VENDOR_ALIASES[runtimeProviderKey].authMode;
  }

  if (selectedAuth?.type === 'oauth') {
    const definition = getProviderDefinition(vendorId);
    if (definition?.supportedAuthModes.includes('oauth_device')) {
      return 'oauth_device';
    }
    if (definition?.supportedAuthModes.includes('oauth_browser')) {
      return 'oauth_browser';
    }
  }

  if (selectedAuth?.type === 'api_key') {
    return 'api_key';
  }

  return fallbackAuthMode;
};

const buildSecret = (
  accountId: string,
  authMode: ProviderAuthMode,
  selectedAuth: AuthProfileEntry | null,
): ProviderSecret | null => {
  if (selectedAuth?.type === 'api_key') {
    return {
      type: 'api_key',
      accountId,
      apiKey: selectedAuth.key,
    };
  }

  if (selectedAuth?.type === 'oauth') {
    return {
      type: 'oauth',
      accountId,
      accessToken: selectedAuth.access,
      refreshToken: selectedAuth.refresh,
      expiresAt: selectedAuth.expires,
      email: selectedAuth.email,
      subject: selectedAuth.projectId,
    };
  }

  if (authMode === 'local') {
    return {
      type: 'local',
      accountId,
    };
  }

  return null;
};

const buildAccount = (options: {
  now: string;
  runtimeProviderKey: string;
  runtimeConfig: RuntimeProviderConfig | undefined;
  vendorId: ProviderType;
  authMode: ProviderAuthMode;
  isDefault: boolean;
  selectedAuth: AuthProfileEntry | null;
  config: unknown;
}): ProviderAccount => {
  const definition = getProviderDefinition(options.vendorId);
  const protocol = options.runtimeConfig?.api ?? options.runtimeConfig?.apiProtocol ?? definition?.providerConfig?.api;
  const baseUrl = options.runtimeConfig?.baseUrl ?? definition?.providerConfig?.baseUrl ?? definition?.defaultBaseUrl;

  return {
    id: options.runtimeProviderKey,
    vendorId: options.vendorId,
    label: definition?.name ?? options.runtimeProviderKey,
    authMode: options.authMode,
    baseUrl,
    apiProtocol: protocol,
    model: getDefaultModelId(options.config, options.runtimeProviderKey),
    enabled: true,
    isDefault: options.isDefault,
    metadata: options.selectedAuth?.type === 'oauth'
      ? {
        email: options.selectedAuth.email,
        resourceUrl: options.runtimeProviderKey,
      }
      : undefined,
    createdAt: options.now,
    updatedAt: options.now,
  };
};

export const buildImportedProviderState = (
  options: BuildImportedProviderStateOptions,
): ImportedProviderState => {
  const now = options.now?.() ?? new Date().toISOString();
  const runtimeProviderConfigs = extractRuntimeProviderConfigs(options.config);
  const authByProvider = collectProviderAuth(options.authProfilesByAgent);
  const runtimeProviderKeys = [...new Set([
    ...Object.keys(runtimeProviderConfigs),
    ...authByProvider.keys(),
  ])].sort();

  const defaultRuntimeProviderKey = getDefaultRuntimeProviderKey(options.config);
  const conflicts: string[] = [];
  const warnings: string[] = [];
  const accounts: ProviderAccount[] = [];
  const secrets: ProviderSecret[] = [];
  const entries: ImportedProviderEntry[] = [];

  for (const runtimeProviderKey of runtimeProviderKeys) {
    const runtimeConfig = runtimeProviderConfigs[runtimeProviderKey];
    const auth = authByProvider.get(runtimeProviderKey) ?? {
      selected: null,
      conflict: false,
    };
    const target = resolveImportTarget(runtimeProviderKey, runtimeConfig);

    if (target.importSource === 'unsupported' || !target.vendorId || !target.authMode) {
      warnings.push(`Provider ${runtimeProviderKey} 暂不支持自动导入，已跳过`);
      continue;
    }

    const authMode = resolveAccountAuthMode(
      runtimeProviderKey,
      target.vendorId,
      auth.selected,
      target.authMode,
    );
    const secret = buildSecret(runtimeProviderKey, authMode, auth.selected);
    const account = buildAccount({
      now,
      runtimeProviderKey,
      runtimeConfig,
      vendorId: target.vendorId,
      authMode,
      isDefault: runtimeProviderKey === defaultRuntimeProviderKey,
      selectedAuth: auth.selected,
      config: options.config,
    });

    if (auth.conflict) {
      conflicts.push(runtimeProviderKey);
      warnings.push(`Provider ${runtimeProviderKey} 在多个 agent 中存在冲突，已优先使用 main 的凭据`);
    }

    accounts.push(account);
    if (secret) {
      secrets.push(secret);
    }
    entries.push({
      runtimeProviderKey,
      accountId: account.id,
      vendorId: account.vendorId,
      authMode: account.authMode,
      importSource: target.importSource,
      hasCredentials: Boolean(secret),
      conflict: auth.conflict,
    });
  }

  const credentialedAccountIds = new Set(secrets.map((secret) => secret.accountId));
  const resolvedDefaultAccountId = accounts.find((account) => account.id === defaultRuntimeProviderKey)?.id
    ?? (credentialedAccountIds.size === 1 ? [...credentialedAccountIds][0] : null);

  const normalizedAccounts = accounts.map((account) => ({
    ...account,
    isDefault: account.id === resolvedDefaultAccountId,
  }));

  return {
    generatedAt: now,
    accounts: normalizedAccounts,
    secrets,
    entries,
    defaultAccountId: resolvedDefaultAccountId,
    conflicts,
    warnings,
  };
};

export const applyImportedProviderState = async (
  imported: ImportedProviderState,
): Promise<void> => {
  await replaceImportedProviderAccounts(imported.accounts, imported.defaultAccountId);
  await replaceImportedProviderSecrets(imported.secrets);
};
