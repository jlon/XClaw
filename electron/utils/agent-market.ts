import { buildAgentAvatarProfile, type AgentAvatarProfile } from '../../shared/agent-avatar-persona';
import agentMarketSeed from '../shared/agent-market-seed.json';
import agentMarketTemplates from '../shared/agent-market-templates.json';
import {
  createAgentWithId,
  deleteAgentConfig,
  ensureMissingAgentBootstrapWorkspaceFiles,
  removeAgentWorkspaceDirectory,
  type AgentsSnapshot,
  writeAgentWorkspaceFileContent,
} from './agent-config';

type AgentMarketItem = (typeof agentMarketSeed.items)[number];

export interface EnrichedAgentMarketItem extends AgentMarketItem {
  avatarProfile: AgentAvatarProfile;
}

export interface AgentMarketCatalog {
  version: number;
  source: typeof agentMarketSeed.source;
  items: EnrichedAgentMarketItem[];
}

export interface AgentMarketInstallResult {
  snapshot: AgentsSnapshot;
  createdAgentId: string;
}

const AGENT_MARKET_SOURCE_PREFIX = 'https://raw.githubusercontent.com/mergisi/awesome-openclaw-agents/main/';
const AGENT_MARKET_AVATAR_SOURCE_TEXT_LIMIT = 4000;

function getCatalogItem(catalogItemId: string): AgentMarketItem {
  const item = agentMarketSeed.items.find((entry) => entry.id === catalogItemId);
  if (!item) {
    throw new Error(`Unknown catalog item: ${catalogItemId}`);
  }
  return item;
}

function assertSupportedCatalogItem(item: AgentMarketItem): void {
  if (item.installMode !== 'soul-template') {
    throw new Error(`Unsupported install mode: ${item.installMode}`);
  }
  if (!item.rawUrl.startsWith(AGENT_MARKET_SOURCE_PREFIX)) {
    throw new Error(`Unsupported catalog source: ${item.rawUrl}`);
  }
}

function getBundledSoulTemplate(item: AgentMarketItem): string {
  assertSupportedCatalogItem(item);
  const content = agentMarketTemplates[item.id as keyof typeof agentMarketTemplates];
  if (!content.trim()) {
    throw new Error(`Bundled market template is empty: ${item.id}`);
  }
  return content;
}

export async function listAgentMarketCatalog(): Promise<AgentMarketCatalog> {
  const items = agentMarketSeed.items.map((item) => ({
    ...item,
    avatarProfile: buildAgentAvatarProfile({
      id: item.id,
      name: item.name,
      category: item.category,
      headline: item.headline,
      summary: item.summary,
      role: item.role,
      tags: item.tags,
      sourceText: buildMarketAvatarSourceText(item),
      seedHint: item.avatarSeed || `${item.category}:${item.id}`,
      source: 'market',
    }),
  }));
  return {
    version: agentMarketSeed.version,
    source: agentMarketSeed.source,
    items,
  };
}

export async function installAgentFromCatalog(catalogItemId: string, name?: string): Promise<AgentMarketInstallResult> {
  const item = getCatalogItem(catalogItemId);
  const soulContent = getBundledSoulTemplate(item);
  const targetName = (name ?? '').trim() || item.name || item.id;
  const { snapshot, createdAgentId } = await createAgentWithId(targetName, { bootstrapMode: 'empty' });
  try {
    await writeAgentWorkspaceFileContent(createdAgentId, 'SOUL.md', soulContent);
    await ensureMissingAgentBootstrapWorkspaceFiles(createdAgentId);
    return {
      snapshot,
      createdAgentId,
    };
  } catch (error) {
    const rollback = await deleteAgentConfig(createdAgentId).catch(() => null);
    if (rollback) {
      await removeAgentWorkspaceDirectory(rollback.removedEntry).catch(() => undefined);
    }
    throw error;
  }
}

function buildMarketAvatarSourceText(item: AgentMarketItem): string {
  return [
    item.role,
    item.headline,
    item.summary,
    item.highlights.join(' '),
    item.detailSections.map((section) => [section.title, section.body, section.items.join(' ')].join(' ')).join(' '),
  ]
    .filter(Boolean)
    .join(' ')
    .slice(0, AGENT_MARKET_AVATAR_SOURCE_TEXT_LIMIT);
}
