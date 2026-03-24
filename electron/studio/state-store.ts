import { existsSync } from 'fs';
import { copyFile, mkdir, readFile, rename, writeFile } from 'fs/promises';
import { dirname } from 'path';
import type { StudioAgentSnapshot, StudioAgentsStateFile, StudioCommittedSnapshot, StudioMainStateFile, StudioManifestFile, StudioSnapshotPaths } from './types';
import {
  STUDIO_AGENT_STATUSES,
  STUDIO_DETAIL_SOURCES,
  STUDIO_SNAPSHOT_OWNER,
  STUDIO_SNAPSHOT_SCHEMA_VERSION,
} from './types';

const MAIN_FILE_NAME = 'state.json' as const;
const AGENTS_FILE_NAME = 'agents-state.json' as const;
const MANIFEST_FILE_NAME = 'manifest.json' as const;

const isObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const isStudioAgentStatus = (value: unknown): value is StudioAgentSnapshot['status'] =>
  typeof value === 'string' && STUDIO_AGENT_STATUSES.includes(value as StudioAgentSnapshot['status']);

const isStudioDetailSource = (value: unknown): value is StudioAgentSnapshot['detailSource'] =>
  typeof value === 'string' && STUDIO_DETAIL_SOURCES.includes(value as StudioAgentSnapshot['detailSource']);

type PersistedStudioAgent = Omit<StudioAgentSnapshot, 'sceneName'> & { sceneName?: string };

const validateAgent = (value: unknown): value is PersistedStudioAgent =>
  isObject(value)
  && typeof value.agentId === 'string'
  && value.agentId.length > 0
  && typeof value.displayName === 'string'
  && value.displayName.length > 0
  && (typeof value.sceneName === 'undefined' || (typeof value.sceneName === 'string' && value.sceneName.length > 0))
  && isStudioAgentStatus(value.status)
  && typeof value.detail === 'string'
  && isStudioDetailSource(value.detailSource)
  && typeof value.updatedAt === 'string';

const validateMain = (value: unknown): value is StudioMainStateFile =>
  isObject(value)
  && value.schemaVersion === STUDIO_SNAPSHOT_SCHEMA_VERSION
  && value.owner === STUDIO_SNAPSHOT_OWNER
  && typeof value.generation === 'number'
  && Number.isInteger(value.generation)
  && value.generation >= 1
  && typeof value.updatedAt === 'string'
  && validateAgent(value.agent);

const validateAgents = (value: unknown): value is StudioAgentsStateFile =>
  isObject(value)
  && value.schemaVersion === STUDIO_SNAPSHOT_SCHEMA_VERSION
  && value.owner === STUDIO_SNAPSHOT_OWNER
  && typeof value.generation === 'number'
  && Number.isInteger(value.generation)
  && value.generation >= 1
  && typeof value.updatedAt === 'string'
  && Array.isArray(value.agents)
  && value.agents.every(validateAgent);

const validateManifest = (value: unknown): value is StudioManifestFile =>
  isObject(value)
  && value.schemaVersion === STUDIO_SNAPSHOT_SCHEMA_VERSION
  && value.owner === STUDIO_SNAPSHOT_OWNER
  && typeof value.generation === 'number'
  && Number.isInteger(value.generation)
  && value.generation >= 1
  && typeof value.committedAt === 'string'
  && isObject(value.files)
  && value.files.main === MAIN_FILE_NAME
  && value.files.agents === AGENTS_FILE_NAME;

const readJson = async <T>(filePath: string): Promise<T | null> => {
  try {
    return JSON.parse(await readFile(filePath, 'utf8')) as T;
  } catch {
    return null;
  }
};

const writeJsonAtomically = async (filePath: string, payload: unknown): Promise<void> => {
  const tempPath = `${filePath}.tmp`;
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(tempPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  await rename(tempPath, filePath);
};

const normalizePersistedAgent = (agent: PersistedStudioAgent): StudioAgentSnapshot => ({
  ...agent,
  sceneName: agent.sceneName || agent.displayName,
});

const readSnapshotSet = async (paths: StudioSnapshotPaths): Promise<StudioCommittedSnapshot | null> => {
  const [main, agents, manifest] = await Promise.all([
    readJson<StudioMainStateFile>(paths.stateFilePath),
    readJson<StudioAgentsStateFile>(paths.agentsStateFilePath),
    readJson<StudioManifestFile>(paths.manifestFilePath),
  ]);

  if (!validateMain(main) || !validateAgents(agents) || !validateManifest(manifest)) {
    return null;
  }

  if (main.generation !== manifest.generation || agents.generation !== manifest.generation) {
    return null;
  }

  return {
    main: {
      ...main,
      agent: normalizePersistedAgent(main.agent),
    },
    agents: {
      ...agents,
      agents: agents.agents.map(normalizePersistedAgent),
    },
    manifest,
  };
};

const cloneSnapshot = (snapshot: StudioCommittedSnapshot): StudioCommittedSnapshot =>
  JSON.parse(JSON.stringify(snapshot)) as StudioCommittedSnapshot;

const createCommittedSnapshot = (
  generation: number,
  mainAgent: StudioAgentSnapshot,
  agents: StudioAgentSnapshot[],
  timestamp: string,
): StudioCommittedSnapshot => ({
  main: {
    schemaVersion: STUDIO_SNAPSHOT_SCHEMA_VERSION,
    generation,
    updatedAt: timestamp,
    owner: STUDIO_SNAPSHOT_OWNER,
    agent: mainAgent,
  },
  agents: {
    schemaVersion: STUDIO_SNAPSHOT_SCHEMA_VERSION,
    generation,
    updatedAt: timestamp,
    owner: STUDIO_SNAPSHOT_OWNER,
    agents,
  },
  manifest: {
    schemaVersion: STUDIO_SNAPSHOT_SCHEMA_VERSION,
    generation,
    committedAt: timestamp,
    owner: STUDIO_SNAPSHOT_OWNER,
    files: {
      main: MAIN_FILE_NAME,
      agents: AGENTS_FILE_NAME,
    },
  },
});

export async function readStudioSnapshot(
  currentPaths: StudioSnapshotPaths,
  lastKnownGoodPaths: StudioSnapshotPaths,
): Promise<StudioCommittedSnapshot | null> {
  const current = await readSnapshotSet(currentPaths);
  if (current) {
    return current;
  }
  return await readSnapshotSet(lastKnownGoodPaths);
}

export async function commitStudioSnapshot(options: {
  currentPaths: StudioSnapshotPaths;
  lastKnownGoodPaths: StudioSnapshotPaths;
  mainAgent: StudioAgentSnapshot;
  agents: StudioAgentSnapshot[];
}): Promise<StudioCommittedSnapshot> {
  const current = await readSnapshotSet(options.currentPaths);
  const generation = (current?.manifest.generation ?? 0) + 1;
  const timestamp = new Date().toISOString();
  const snapshot = createCommittedSnapshot(generation, options.mainAgent, options.agents, timestamp);

  await Promise.all([
    mkdir(options.currentPaths.rootDir, { recursive: true }),
    mkdir(options.lastKnownGoodPaths.rootDir, { recursive: true }),
  ]);

  await writeJsonAtomically(options.currentPaths.stateFilePath, snapshot.main);
  await writeJsonAtomically(options.currentPaths.agentsStateFilePath, snapshot.agents);
  await writeJsonAtomically(options.currentPaths.manifestFilePath, snapshot.manifest);

  await Promise.all([
    copyFile(options.currentPaths.stateFilePath, options.lastKnownGoodPaths.stateFilePath),
    copyFile(options.currentPaths.agentsStateFilePath, options.lastKnownGoodPaths.agentsStateFilePath),
    copyFile(options.currentPaths.manifestFilePath, options.lastKnownGoodPaths.manifestFilePath),
  ]);

  return cloneSnapshot(snapshot);
}

export async function getNextStudioGeneration(paths: StudioSnapshotPaths): Promise<number> {
  const current = await readSnapshotSet(paths);
  return (current?.manifest.generation ?? 0) + 1;
}

export function hasStudioSnapshot(paths: StudioSnapshotPaths): boolean {
  return existsSync(paths.manifestFilePath) && existsSync(paths.stateFilePath) && existsSync(paths.agentsStateFilePath);
}
