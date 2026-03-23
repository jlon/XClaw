import { access, readFile, readdir, stat } from 'fs/promises';
import { constants } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

export type AuthProfileEntry = {
  type: 'api_key';
  provider: string;
  key: string;
} | {
  type: 'oauth';
  provider: string;
  access: string;
  refresh: string;
  expires: number;
  email?: string;
  projectId?: string;
};

export type AuthProfilesStore = {
  profiles?: Record<string, AuthProfileEntry>;
};

export type TakeoverRuntimeState = {
  config: unknown;
  authProfilesByAgent: Record<string, AuthProfilesStore>;
};

const OPENCLAW_DIR = join(homedir(), '.openclaw');
const OPENCLAW_CONFIG_PATH = join(OPENCLAW_DIR, 'openclaw.json');
const OPENCLAW_AGENTS_DIR = join(OPENCLAW_DIR, 'agents');
const CASE_INSENSITIVE_FILESYSTEM = process.platform === 'win32' || process.platform === 'darwin';
const IGNORED_DISK_ENTRY_NAMES = new Set(['desktop.ini', 'thumbs.db', '.ds_store']);

const asRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
};

const fileExists = async (path: string): Promise<boolean> => {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
};

const readJsonIfExists = async (path: string): Promise<unknown> => {
  if (!(await fileExists(path))) {
    return null;
  }

  return JSON.parse(await readFile(path, 'utf-8'));
};

const normalizeFilesystemKey = (value: string): string => (
  CASE_INSENSITIVE_FILESYSTEM ? value.toLocaleLowerCase() : value
);

const uniqByFilesystemIdentity = (values: string[]): string[] => {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const trimmed = value.trim();
    if (!trimmed) {
      continue;
    }
    const key = normalizeFilesystemKey(trimmed);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(trimmed);
  }
  return result;
};

const isIgnoredDiskEntryName = (name: string): boolean => (
  !name || name.startsWith('.') || IGNORED_DISK_ENTRY_NAMES.has(name.toLocaleLowerCase())
);

const getConfiguredAgentIdsFromConfig = (config: unknown): string[] => {
  const configRecord = asRecord(config);
  const agents = asRecord(configRecord?.agents);
  const entries = Array.isArray(agents?.list) ? agents.list : [];
  return uniqByFilesystemIdentity(
    entries
      .map((entry) => {
        const agent = asRecord(entry);
        return typeof agent?.id === 'string' ? agent.id.trim() : '';
      })
      .filter(Boolean),
  );
};

const getAgentIdsFromDisk = async (): Promise<string[]> => {
  if (!(await fileExists(OPENCLAW_AGENTS_DIR))) {
    return [];
  }

  try {
    const directories = await Promise.all(
      (await readdir(OPENCLAW_AGENTS_DIR))
        .map((name) => name.trim())
        .filter((name) => !isIgnoredDiskEntryName(name))
        .map(async (name) => {
          try {
            return (await stat(join(OPENCLAW_AGENTS_DIR, name))).isDirectory() ? name : null;
          } catch {
            return null;
          }
        }),
    );
    return uniqByFilesystemIdentity(directories.filter((value): value is string => Boolean(value)));
  } catch {
    return [];
  }
};

export const loadTakeoverRuntimeState = async (): Promise<TakeoverRuntimeState> => {
  const config = await readJsonIfExists(OPENCLAW_CONFIG_PATH);
  const agentIds = uniqByFilesystemIdentity([
    ...getConfiguredAgentIdsFromConfig(config),
    ...(await getAgentIdsFromDisk()),
  ]);
  const authProfilesByAgent = Object.fromEntries(
    (
      await Promise.all(
        agentIds.map(async (agentId) => {
          const authPath = join(OPENCLAW_AGENTS_DIR, agentId, 'agent', 'auth-profiles.json');
          const authProfiles = await readJsonIfExists(authPath);
          return [agentId, asRecord(authProfiles) as AuthProfilesStore | null] as const;
        }),
      )
    ).filter((entry): entry is readonly [string, AuthProfilesStore] => Boolean(entry[1])),
  );

  return {
    config,
    authProfilesByAgent,
  };
};
