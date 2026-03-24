export const STUDIO_SNAPSHOT_SCHEMA_VERSION = 1 as const;
export const STUDIO_SNAPSHOT_OWNER = 'xclaw-main' as const;
export const STUDIO_DEFAULT_PORT = 3211;

export const STUDIO_AGENT_STATUSES = [
  'idle',
  'writing',
  'researching',
  'executing',
  'syncing',
  'error',
] as const;

export const STUDIO_DETAIL_SOURCES = [
  'detail-file',
  'event-summary',
  'default',
] as const;

export const STUDIO_RUNTIME_STATUSES = [
  'starting',
  'restarting',
  'stopping',
  'ready',
  'python-missing',
  'runtime-error',
] as const;

export type StudioAgentStatus = (typeof STUDIO_AGENT_STATUSES)[number];
export type StudioDetailSource = (typeof STUDIO_DETAIL_SOURCES)[number];
export type StudioRuntimeStatus = (typeof STUDIO_RUNTIME_STATUSES)[number];

export interface StudioAgentSnapshot {
  agentId: string;
  displayName: string;
  sceneName: string;
  status: StudioAgentStatus;
  detail: string;
  detailSource: StudioDetailSource;
  updatedAt: string;
}

export interface StudioMainStateFile {
  schemaVersion: typeof STUDIO_SNAPSHOT_SCHEMA_VERSION;
  generation: number;
  updatedAt: string;
  owner: typeof STUDIO_SNAPSHOT_OWNER;
  agent: StudioAgentSnapshot;
}

export interface StudioAgentsStateFile {
  schemaVersion: typeof STUDIO_SNAPSHOT_SCHEMA_VERSION;
  generation: number;
  updatedAt: string;
  owner: typeof STUDIO_SNAPSHOT_OWNER;
  agents: StudioAgentSnapshot[];
}

export interface StudioManifestFile {
  schemaVersion: typeof STUDIO_SNAPSHOT_SCHEMA_VERSION;
  generation: number;
  committedAt: string;
  owner: typeof STUDIO_SNAPSHOT_OWNER;
  files: {
    main: 'state.json';
    agents: 'agents-state.json';
  };
}

export interface StudioCommittedSnapshot {
  main: StudioMainStateFile;
  agents: StudioAgentsStateFile;
  manifest: StudioManifestFile;
}

export interface StudioPythonReadiness {
  uvInstalled: boolean;
  interpreterReady: boolean;
  dependenciesReady: boolean;
  pythonPath: string | null;
  venvPythonPath: string | null;
  error: string | null;
}

export interface StudioRuntimeSnapshot {
  status: StudioRuntimeStatus;
  resolvedUrl: string | null;
  runtimeInstanceId: string | null;
  lastError: string | null;
  port: number | null;
  python: StudioPythonReadiness;
}
