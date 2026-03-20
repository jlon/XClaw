import { access, readFile } from 'fs/promises';
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

export const loadTakeoverRuntimeState = async (): Promise<TakeoverRuntimeState> => {
  const { listConfiguredAgentIds } = await import('../utils/agent-config');
  const config = await readJsonIfExists(OPENCLAW_CONFIG_PATH);
  const discoveredAgentIds = await listConfiguredAgentIds().catch(() => []);
  const agentIds = discoveredAgentIds.length > 0 ? discoveredAgentIds : ['main'];
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
