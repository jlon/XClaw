import { createHash } from 'crypto';
import { readdir } from 'fs/promises';
import { homedir } from 'os';
import { join } from 'path';
import { applyImportedProviderState, buildImportedProviderState, type ImportedProviderState } from '../services/providers/provider-import';
import { inspectLocalOpenClawSetup, type SetupInspectionResult } from './setup-inspection';
import type { AppSettings } from '../utils/store';
import { loadTakeoverRuntimeState, type TakeoverRuntimeState } from './takeover-runtime';
import { normalizeWorkspacePath } from '../utils/workspace-path';

type TakeoverFingerprintParts = {
  version: 1;
  provider: string;
  environment: string;
};

type TakeoverFingerprintInput = {
  imported: ImportedProviderState;
  defaultWorkspacePath: string;
  configuredWorkspacePaths: string[];
  skillEntries: string[];
  extensionEntries: string[];
};

type TakeoverReconcilerSettings = Pick<Partial<AppSettings>, 'setupComplete' | 'takeoverFingerprint'>;

type TakeoverFingerprintCaptureRequest = {
  inspection: Pick<SetupInspectionResult, 'defaultWorkspacePath' | 'configuredWorkspacePaths'>;
  imported: ImportedProviderState;
};

type TakeoverReconcilerDependencies = {
  now?: () => string;
  getSettings?: () => Promise<TakeoverReconcilerSettings>;
  inspectSetup?: () => Promise<Pick<SetupInspectionResult, 'hasExistingOpenClaw' | 'defaultWorkspacePath' | 'configuredWorkspacePaths'>>;
  loadRuntimeState?: () => Promise<TakeoverRuntimeState>;
  readDirectoryEntries?: (path: string) => Promise<string[]>;
  applyImportedProviderState?: (imported: ImportedProviderState) => Promise<void>;
  persistFingerprint?: (fingerprint: string) => Promise<void>;
};

type TakeoverReconcilerResult = {
  status: 'skipped' | 'unchanged' | 'updated';
  reason: 'setup-incomplete' | 'missing-fingerprint' | 'missing-openclaw' | 'unchanged' | 'provider-drift' | 'environment-drift';
  fingerprint: string | null;
  providerProjectionUpdated: boolean;
};

const OPENCLAW_DIR = join(homedir(), '.openclaw');
const OPENCLAW_SKILLS_DIR = join(OPENCLAW_DIR, 'skills');
const OPENCLAW_EXTENSIONS_DIR = join(OPENCLAW_DIR, 'extensions');

const normalizePathForFingerprint = (value: string): string => normalizeWorkspacePath(value, {
  platform: /^[a-zA-Z]:[\\/]|^\\\\/.test(value) ? 'win32' : process.platform,
})
  .replace(/\\/g, '/')
  .replace(/^([A-Z]):/, (_, drive: string) => `${drive.toLowerCase()}:`);

const stableValue = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map((entry) => stableValue(entry));
  }

  if (!value || typeof value !== 'object') {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([, entry]) => entry !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, stableValue(entry)]),
  );
};

const hashValue = (value: unknown): string => createHash('sha256')
  .update(JSON.stringify(stableValue(value)))
  .digest('hex');

const toSortedUniqueList = (values: string[], mapper: (value: string) => string = (value) => value): string[] => [...new Set(
  values
    .map((value) => mapper(value))
    .filter(Boolean),
)].sort((left, right) => left.localeCompare(right));

const toProviderPayload = (imported: ImportedProviderState) => ({
  defaultAccountId: imported.defaultAccountId,
  conflicts: [...imported.conflicts].sort((left, right) => left.localeCompare(right)),
  accounts: [...imported.accounts]
    .map((account) => ({
      id: account.id,
      vendorId: account.vendorId,
      label: account.label,
      authMode: account.authMode,
      baseUrl: account.baseUrl,
      apiProtocol: account.apiProtocol,
      model: account.model,
      fallbackModels: account.fallbackModels,
      fallbackAccountIds: account.fallbackAccountIds,
      enabled: account.enabled,
      isDefault: account.isDefault,
    }))
    .sort((left, right) => left.id.localeCompare(right.id)),
  secrets: [...imported.secrets]
    .map((secret) => {
      if (secret.type === 'api_key') {
        return {
          accountId: secret.accountId,
          type: secret.type,
          apiKey: secret.apiKey,
        };
      }

      if (secret.type === 'oauth') {
        return {
          accountId: secret.accountId,
          type: secret.type,
          accessToken: secret.accessToken,
          refreshToken: secret.refreshToken,
          expiresAt: secret.expiresAt,
          email: secret.email,
          subject: secret.subject,
        };
      }

      return {
        accountId: secret.accountId,
        type: secret.type,
        apiKey: secret.apiKey,
      };
    })
    .sort((left, right) => left.accountId.localeCompare(right.accountId)),
});

const parseTakeoverFingerprint = (fingerprint: string | null | undefined): TakeoverFingerprintParts | null => {
  if (!fingerprint) {
    return null;
  }

  try {
    const parsed = JSON.parse(fingerprint) as Partial<TakeoverFingerprintParts>;
    if (
      parsed.version !== 1 ||
      typeof parsed.provider !== 'string' ||
      typeof parsed.environment !== 'string'
    ) {
      return null;
    }
    return parsed as TakeoverFingerprintParts;
  } catch {
    return null;
  }
};

const defaultReadDirectoryEntries = async (path: string): Promise<string[]> => {
  try {
    return (await readdir(path)).sort((left, right) => left.localeCompare(right));
  } catch {
    return [];
  }
};

const defaultGetSettings = async (): Promise<TakeoverReconcilerSettings> => {
  const { getAllSettings } = await import('../utils/store');
  const settings = await getAllSettings();
  return {
    setupComplete: settings.setupComplete,
    takeoverFingerprint: settings.takeoverFingerprint,
  };
};

export const buildTakeoverFingerprint = (input: TakeoverFingerprintInput): string => JSON.stringify({
  version: 1,
  provider: hashValue(toProviderPayload(input.imported)),
  environment: hashValue({
    defaultWorkspacePath: normalizePathForFingerprint(input.defaultWorkspacePath),
    configuredWorkspacePaths: toSortedUniqueList(
      input.configuredWorkspacePaths,
      normalizePathForFingerprint,
    ),
    skillEntries: toSortedUniqueList(input.skillEntries),
    extensionEntries: toSortedUniqueList(input.extensionEntries),
  }),
} satisfies TakeoverFingerprintParts);

export const captureTakeoverFingerprint = async (
  request: TakeoverFingerprintCaptureRequest,
  dependencies: Pick<TakeoverReconcilerDependencies, 'readDirectoryEntries'> = {},
): Promise<string> => {
  const readDirectoryEntries = dependencies.readDirectoryEntries ?? defaultReadDirectoryEntries;
  const [skillEntries, extensionEntries] = await Promise.all([
    readDirectoryEntries(OPENCLAW_SKILLS_DIR),
    readDirectoryEntries(OPENCLAW_EXTENSIONS_DIR),
  ]);

  return buildTakeoverFingerprint({
    imported: request.imported,
    defaultWorkspacePath: request.inspection.defaultWorkspacePath,
    configuredWorkspacePaths: request.inspection.configuredWorkspacePaths,
    skillEntries,
    extensionEntries,
  });
};

export const runTakeoverReconciler = async (
  dependencies: TakeoverReconcilerDependencies = {},
): Promise<TakeoverReconcilerResult> => {
  const now = dependencies.now ?? (() => new Date().toISOString());
  const getSettings = dependencies.getSettings ?? defaultGetSettings;
  const inspectSetup = dependencies.inspectSetup ?? inspectLocalOpenClawSetup;
  const loadRuntimeState = dependencies.loadRuntimeState ?? loadTakeoverRuntimeState;
  const applyImportedState = dependencies.applyImportedProviderState ?? applyImportedProviderState;
  const persistFingerprint = dependencies.persistFingerprint ?? (async (fingerprint) => {
    const { setSetting } = await import('../utils/store');
    await setSetting('takeoverFingerprint', fingerprint);
  });

  const settings = await getSettings();
  if (!settings.setupComplete) {
    return {
      status: 'skipped',
      reason: 'setup-incomplete',
      fingerprint: null,
      providerProjectionUpdated: false,
    };
  }

  if (!settings.takeoverFingerprint) {
    return {
      status: 'skipped',
      reason: 'missing-fingerprint',
      fingerprint: null,
      providerProjectionUpdated: false,
    };
  }

  const inspection = await inspectSetup();
  if (!inspection.hasExistingOpenClaw) {
    return {
      status: 'skipped',
      reason: 'missing-openclaw',
      fingerprint: settings.takeoverFingerprint,
      providerProjectionUpdated: false,
    };
  }

  const runtimeState = await loadRuntimeState();
  const imported = buildImportedProviderState({
    now,
    config: runtimeState.config,
    authProfilesByAgent: runtimeState.authProfilesByAgent,
  });
  const nextFingerprint = await captureTakeoverFingerprint({
    inspection,
    imported,
  }, {
    readDirectoryEntries: dependencies.readDirectoryEntries,
  });
  const previousParts = parseTakeoverFingerprint(settings.takeoverFingerprint);
  const nextParts = parseTakeoverFingerprint(nextFingerprint);

  if (
    previousParts &&
    nextParts &&
    previousParts.provider === nextParts.provider &&
    previousParts.environment === nextParts.environment
  ) {
    return {
      status: 'unchanged',
      reason: 'unchanged',
      fingerprint: nextFingerprint,
      providerProjectionUpdated: false,
    };
  }

  const providerProjectionUpdated = !previousParts || !nextParts || previousParts.provider !== nextParts.provider;
  if (providerProjectionUpdated) {
    await applyImportedState(imported);
  }
  await persistFingerprint(nextFingerprint);

  return {
    status: 'updated',
    reason: providerProjectionUpdated ? 'provider-drift' : 'environment-drift',
    fingerprint: nextFingerprint,
    providerProjectionUpdated,
  };
};
