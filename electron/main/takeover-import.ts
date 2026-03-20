import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { buildImportedProviderState, applyImportedProviderState, type ImportedProviderState } from '../services/providers/provider-import';
import { buildSetupPlan, inspectLocalOpenClawSetup } from './setup-inspection';
import { getAllSettings, replaceAllSettings, setSetting, type AppSettings } from '../utils/store';
import { getXClawProviderStore } from '../services/providers/store-instance';
import { captureTakeoverFingerprint } from './takeover-reconciler';
import { loadTakeoverRuntimeState, type TakeoverRuntimeState } from './takeover-runtime';

type SetupInspectionLike = Awaited<ReturnType<typeof inspectLocalOpenClawSetup>>;
type SetupPlanLike = ReturnType<typeof buildSetupPlan>;

type TakeoverBackupPayload = {
  generatedAt: string;
  inspection: SetupInspectionLike;
  plan: SetupPlanLike;
  settings: AppSettings;
  providerStore: Record<string, unknown>;
  runtimeState: TakeoverRuntimeState;
};

export type TakeoverImportRequest = {
  mode?: 'fresh' | 'takeover';
};

export type TakeoverImportStatus = {
  state: 'idle' | 'running' | 'blocked' | 'failed' | 'complete';
  step: 'idle' | 'blocked' | 'backup' | 'import' | 'commit' | 'rollback' | 'complete';
  startedAt?: string;
  finishedAt?: string;
  backupPath?: string;
  importedAccountCount: number;
  defaultAccountId: string | null;
  conflicts: string[];
  warnings: string[];
  blockingIssues: string[];
  error?: string;
};

type TakeoverImportDependencies = {
  now?: () => string;
  inspectSetup?: () => Promise<SetupInspectionLike>;
  buildPlan?: (inspection: SetupInspectionLike, request: TakeoverImportRequest) => SetupPlanLike;
  loadRuntimeState?: () => Promise<TakeoverRuntimeState>;
  getSettingsSnapshot?: () => Promise<AppSettings>;
  getProviderStoreSnapshot?: () => Promise<Record<string, unknown>>;
  writeBackup?: (payload: TakeoverBackupPayload) => Promise<string>;
  applyImportedProviderState?: (imported: ImportedProviderState) => Promise<void>;
  applyImportedRuntimeSettings?: (payload: {
    gatewayPort: number | null;
    gatewayToken: string | null;
  }) => Promise<void>;
  captureFingerprint?: (request: { inspection: SetupInspectionLike; imported: ImportedProviderState }) => Promise<string>;
  setTakeoverFingerprint?: (value: string) => Promise<void>;
  restoreSettingsSnapshot?: (snapshot: AppSettings) => Promise<void>;
  restoreProviderStoreSnapshot?: (snapshot: Record<string, unknown>) => Promise<void>;
};

let latestTakeoverImportStatus: TakeoverImportStatus = {
  state: 'idle',
  step: 'idle',
  importedAccountCount: 0,
  defaultAccountId: null,
  conflicts: [],
  warnings: [],
  blockingIssues: [],
};
let activeTakeoverImportPromise: Promise<TakeoverImportStatus> | null = null;

const uniq = (values: string[]): string[] => [...new Set(values)];

const SENSITIVE_KEYS = new Set([
  'access',
  'accessToken',
  'apiKey',
  'gatewayToken',
  'key',
  'refresh',
  'refreshToken',
  'secret',
  'token',
]);

const redactSensitiveValue = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map((entry) => redactSensitiveValue(entry));
  }

  if (!value || typeof value !== 'object') {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, entry]) => {
      if (SENSITIVE_KEYS.has(key)) {
        return [key, '[redacted]'];
      }
      return [key, redactSensitiveValue(entry)];
    }),
  );
};

const toBackupPayload = (payload: TakeoverBackupPayload): TakeoverBackupPayload => ({
  generatedAt: payload.generatedAt,
  inspection: payload.inspection,
  plan: payload.plan,
  settings: redactSensitiveValue(payload.settings) as AppSettings,
  providerStore: redactSensitiveValue(payload.providerStore) as Record<string, unknown>,
  runtimeState: redactSensitiveValue(payload.runtimeState) as TakeoverRuntimeState,
});

const defaultNow = (): string => new Date().toISOString();

const defaultWriteBackup = async (payload: TakeoverBackupPayload): Promise<string> => {
  const { app } = await import('electron');
  const backupDir = join(app.getPath('userData'), 'takeover-backups');
  await mkdir(backupDir, { recursive: true });
  const filePath = join(
    backupDir,
    `takeover-${payload.generatedAt.replace(/[:.]/g, '-').replace(/Z$/, 'Z')}.json`,
  );
  await writeFile(filePath, JSON.stringify(payload, null, 2), 'utf-8');
  return filePath;
};

const defaultGetProviderStoreSnapshot = async (): Promise<Record<string, unknown>> => {
  const store = await getXClawProviderStore();
  return { ...store.store };
};

const asRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
};

const parseGatewayPort = (value: unknown): number | null => (
  typeof value === 'number'
  && Number.isInteger(value)
  && value >= 1
  && value <= 65535
    ? value
    : null
);

const extractImportedRuntimeSettings = (
  runtimeState: TakeoverRuntimeState,
  inspection: SetupInspectionLike,
): {
  gatewayPort: number | null;
  gatewayToken: string | null;
} => {
  const config = asRecord(runtimeState.config);
  const gateway = asRecord(config?.gateway);
  const auth = asRecord(gateway?.auth);
  const gatewayToken = typeof auth?.token === 'string' && auth.token.trim()
    ? auth.token
    : null;

  return {
    gatewayPort: parseGatewayPort(gateway?.port) ?? parseGatewayPort(inspection.gatewayPort),
    gatewayToken,
  };
};

const defaultApplyImportedRuntimeSettings = async (
  payload: {
    gatewayPort: number | null;
    gatewayToken: string | null;
  },
): Promise<void> => {
  if (payload.gatewayPort !== null) {
    await setSetting('gatewayPort', payload.gatewayPort);
  }

  if (payload.gatewayToken !== null) {
    await setSetting('gatewayToken', payload.gatewayToken);
  }
};

const defaultRestoreProviderStoreSnapshot = async (snapshot: Record<string, unknown>): Promise<void> => {
  const store = await getXClawProviderStore();
  store.clear();
  store.set(snapshot);
};

const setStatus = (status: TakeoverImportStatus): TakeoverImportStatus => {
  latestTakeoverImportStatus = status;
  return latestTakeoverImportStatus;
};

export const getTakeoverImportStatus = (): TakeoverImportStatus => latestTakeoverImportStatus;

export const runTakeoverImport = async (
  request: TakeoverImportRequest = {},
  dependencies: TakeoverImportDependencies = {},
): Promise<TakeoverImportStatus> => {
  if (activeTakeoverImportPromise) {
    return activeTakeoverImportPromise;
  }

  const execute = async (): Promise<TakeoverImportStatus> => {
  const now = dependencies.now ?? defaultNow;
  const startedAt = now();
  const inspectSetup = dependencies.inspectSetup ?? inspectLocalOpenClawSetup;
  const buildPlan = dependencies.buildPlan ?? ((inspection, nextRequest) => buildSetupPlan(inspection, nextRequest));
  const loadRuntimeState = dependencies.loadRuntimeState ?? loadTakeoverRuntimeState;
  const getSettingsSnapshot = dependencies.getSettingsSnapshot ?? getAllSettings;
  const getProviderStoreSnapshot = dependencies.getProviderStoreSnapshot ?? defaultGetProviderStoreSnapshot;
  const writeBackup = dependencies.writeBackup ?? defaultWriteBackup;
  const commitImportedProviderState = dependencies.applyImportedProviderState ?? applyImportedProviderState;
  const applyImportedRuntimeSettings = dependencies.applyImportedRuntimeSettings ?? defaultApplyImportedRuntimeSettings;
  const captureFingerprint = dependencies.captureFingerprint ?? captureTakeoverFingerprint;
  const setTakeoverFingerprint = dependencies.setTakeoverFingerprint ?? (async (value) => setSetting('takeoverFingerprint', value));
  const restoreSettingsSnapshot = dependencies.restoreSettingsSnapshot ?? replaceAllSettings;
  const restoreProviderStoreSnapshot = dependencies.restoreProviderStoreSnapshot ?? defaultRestoreProviderStoreSnapshot;

  let backupPath: string | undefined;
  let settingsSnapshot: AppSettings | undefined;
  let providerStoreSnapshot: Record<string, unknown> | undefined;
  let planWarnings: string[] = [];
  let imported: ImportedProviderState | undefined;

  try {
    const inspection = await inspectSetup();
    const plan = buildPlan(inspection, {
      mode: request.mode ?? 'takeover',
    });

    planWarnings = [...(plan.warnings ?? [])];
    if (!plan.canApply) {
      return setStatus({
        state: 'blocked',
        step: 'blocked',
        startedAt,
        finishedAt: now(),
        importedAccountCount: 0,
        defaultAccountId: null,
        conflicts: [],
        warnings: planWarnings,
        blockingIssues: [...(plan.blockingIssues ?? [])],
      });
    }

    setStatus({
      state: 'running',
      step: 'backup',
      startedAt,
      importedAccountCount: 0,
      defaultAccountId: null,
      conflicts: [],
      warnings: planWarnings,
      blockingIssues: [],
    });

    const [runtimeState, nextSettingsSnapshot, nextProviderStoreSnapshot] = await Promise.all([
      loadRuntimeState(),
      getSettingsSnapshot(),
      getProviderStoreSnapshot(),
    ]);
    settingsSnapshot = nextSettingsSnapshot;
    providerStoreSnapshot = nextProviderStoreSnapshot;
    imported = buildImportedProviderState({
      now,
      config: runtimeState.config,
      authProfilesByAgent: runtimeState.authProfilesByAgent,
    });
    backupPath = await writeBackup(toBackupPayload({
      generatedAt: startedAt,
      inspection,
      plan,
      settings: settingsSnapshot,
      providerStore: providerStoreSnapshot,
      runtimeState,
    }));

    setStatus({
      state: 'running',
      step: 'import',
      startedAt,
      backupPath,
      importedAccountCount: imported.accounts.length,
      defaultAccountId: imported.defaultAccountId,
      conflicts: imported.conflicts,
      warnings: uniq([...planWarnings, ...imported.warnings]),
      blockingIssues: [],
    });

    await commitImportedProviderState(imported);
    await applyImportedRuntimeSettings(extractImportedRuntimeSettings(runtimeState, inspection));

    setStatus({
      state: 'running',
      step: 'commit',
      startedAt,
      backupPath,
      importedAccountCount: imported.accounts.length,
      defaultAccountId: imported.defaultAccountId,
      conflicts: imported.conflicts,
      warnings: uniq([...planWarnings, ...imported.warnings]),
      blockingIssues: [],
    });

    await setTakeoverFingerprint(await captureFingerprint({ inspection, imported }));

    return setStatus({
      state: 'complete',
      step: 'complete',
      startedAt,
      finishedAt: now(),
      backupPath,
      importedAccountCount: imported.accounts.length,
      defaultAccountId: imported.defaultAccountId,
      conflicts: imported.conflicts,
      warnings: uniq([...planWarnings, ...imported.warnings]),
      blockingIssues: [],
    });
  } catch (error) {
    if (settingsSnapshot) {
      await restoreSettingsSnapshot(settingsSnapshot);
    }
    if (providerStoreSnapshot) {
      await restoreProviderStoreSnapshot(providerStoreSnapshot);
    }

    return setStatus({
      state: 'failed',
      step: 'rollback',
      startedAt,
      finishedAt: now(),
      backupPath,
      importedAccountCount: imported?.accounts.length ?? 0,
      defaultAccountId: imported?.defaultAccountId ?? null,
      conflicts: imported?.conflicts ?? [],
      warnings: uniq([...planWarnings, ...(imported?.warnings ?? [])]),
      blockingIssues: [],
      error: error instanceof Error ? error.message : String(error),
    });
  }
  };

  activeTakeoverImportPromise = execute().finally(() => {
    activeTakeoverImportPromise = null;
  });

  return activeTakeoverImportPromise;
};
