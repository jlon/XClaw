import type { IncomingMessage, ServerResponse } from 'http';
import { homedir } from 'os';
import { join } from 'path';
import { normalizeClawHubCatalogItem, searchSkillHubSkills } from '../../gateway/skillhub';
import { getAllSkillConfigs, readPreinstalledManifest, readPreinstalledMarker, updateSkillConfig } from '../../utils/skill-config';
import { resolveSkillProvenance } from '../../utils/skill-provenance';
import type { HostApiContext } from '../context';
import { parseJsonBody, sendJson } from '../route-utils';

function toSkillCatalogItem(item: ReturnType<typeof normalizeClawHubCatalogItem>) {
  return {
    id: item.providerQualifiedId,
    providerId: item.provider,
    providerSkillId: item.providerSkillId,
    slug: item.slug,
    name: item.name,
    description: item.description,
    version: item.version,
    author: item.author,
    downloads: item.downloads,
    stars: item.stars,
    sourceLabel: item.provider === 'clawhub' ? 'ClawHub' : 'SkillHub',
    installCapability: {
      providerId: item.provider,
      executionKind: item.installDraft.execution.kind,
    },
    metadata: {
      sourceUrl: item.sourceUrl,
      raw: item.raw,
    },
  };
}

type GatewaySkillStatus = {
  skillKey: string;
  slug?: string;
  name?: string;
  description?: string;
  disabled?: boolean;
  emoji?: string;
  version?: string;
  author?: string;
  config?: Record<string, unknown>;
  bundled?: boolean;
  always?: boolean;
  source?: string;
  baseDir?: string;
  filePath?: string;
};

type GatewaySkillsStatusResult = {
  skills?: GatewaySkillStatus[];
};

type ClawHubInstalledSkillResult = {
  slug: string;
  version?: string;
  source?: string;
  baseDir?: string;
};

const PREINSTALLED_MARKER_FILE = '.XClaw-preinstalled.json';

async function buildLocalSkillsCatalog(ctx: HostApiContext) {
  const [manifestSkills, configEntries, installedSkills] = await Promise.all([
    readPreinstalledManifest(),
    getAllSkillConfigs(),
    ctx.clawHubService.listInstalled().catch(() => [] as ClawHubInstalledSkillResult[]),
  ]);

  let gatewaySkills: GatewaySkillStatus[];
  try {
    const gatewayData = await ctx.gatewayManager.rpc<GatewaySkillsStatusResult>('skills.status');
    gatewaySkills = gatewayData.skills || [];
  } catch {
    gatewaySkills = [];
  }

  const combinedSkills = new Map<string, {
    id: string;
    slug: string;
    name: string;
    description: string;
    enabled: boolean;
    icon?: string;
    version?: string;
    author?: string;
    config?: Record<string, unknown>;
    isCore?: boolean;
    isBundled?: boolean;
    source?: string;
    baseDir?: string;
    filePath?: string;
  }>();

  for (const skill of gatewaySkills) {
    const id = skill.skillKey;
    const slug = skill.slug || id;
    combinedSkills.set(id, {
      id,
      slug,
      name: skill.name || slug,
      description: skill.description || '',
      enabled: !skill.disabled,
      icon: skill.emoji || '📦',
      version: skill.version || '1.0.0',
      author: skill.author,
      config: {
        ...(skill.config || {}),
        ...(configEntries[id] || {}),
      },
      isCore: skill.bundled && skill.always,
      isBundled: skill.bundled,
      source: skill.source,
      baseDir: skill.baseDir,
      filePath: skill.filePath,
    });
  }

  for (const installedSkill of installedSkills) {
    const id = installedSkill.slug;
    const existing = combinedSkills.get(id);
    if (existing) {
      if (!existing.baseDir && installedSkill.baseDir) {
        existing.baseDir = installedSkill.baseDir;
      }
      if (!existing.source && installedSkill.source) {
        existing.source = installedSkill.source;
      }
      continue;
    }

    combinedSkills.set(id, {
      id,
      slug: installedSkill.slug,
      name: installedSkill.slug,
      description: 'Recently installed, initializing...',
      enabled: false,
      icon: '⌛',
      version: installedSkill.version || 'unknown',
      config: configEntries[id] || {},
      isCore: false,
      isBundled: false,
      source: installedSkill.source || 'openclaw-managed',
      baseDir: installedSkill.baseDir,
    });
  }

  const catalog = await Promise.all(
    [...combinedSkills.values()].map(async (skill) => {
      const markerPath = join(skill.baseDir || join(homedir(), '.openclaw', 'skills', skill.slug), PREINSTALLED_MARKER_FILE);
      const marker = await readPreinstalledMarker(markerPath);
      const provenance = resolveSkillProvenance({
        slug: skill.slug,
        source: skill.source,
        marker,
        manifestSkills,
      });

      return {
        ...skill,
        source: provenance.source,
        provenance: provenance.source,
        displaySourceLabel: provenance.displaySourceLabel,
      };
    }),
  );

  return catalog;
}

export async function handleSkillRoutes(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
  ctx: HostApiContext,
): Promise<boolean> {
  if (url.pathname === '/api/skills/catalog' && req.method === 'GET') {
    try {
      sendJson(res, 200, { success: true, skills: await buildLocalSkillsCatalog(ctx) });
    } catch (error) {
      sendJson(res, 500, { success: false, error: String(error) });
    }
    return true;
  }

  if (url.pathname === '/api/skills/configs' && req.method === 'GET') {
    sendJson(res, 200, await getAllSkillConfigs());
    return true;
  }

  if (url.pathname === '/api/skills/config' && req.method === 'PUT') {
    try {
      const body = await parseJsonBody<{
        skillKey: string;
        apiKey?: string;
        env?: Record<string, string>;
      }>(req);
      sendJson(res, 200, await updateSkillConfig(body.skillKey, {
        apiKey: body.apiKey,
        env: body.env,
      }));
    } catch (error) {
      sendJson(res, 500, { success: false, error: String(error) });
    }
    return true;
  }

  if (url.pathname === '/api/skills/providers/clawhub/search' && req.method === 'POST') {
    try {
      const body = await parseJsonBody<{ query?: string; limit?: number }>(req);
      const results = await ctx.clawHubService.search({ query: body.query || '', limit: body.limit });
      sendJson(res, 200, {
        success: true,
        results: results.map((item) => toSkillCatalogItem(normalizeClawHubCatalogItem(item))),
      });
    } catch (error) {
      sendJson(res, 500, { success: false, error: String(error) });
    }
    return true;
  }

  if (url.pathname === '/api/skills/providers/skillhub/search' && req.method === 'POST') {
    try {
      const body = await parseJsonBody<{ query?: string; limit?: number }>(req);
      const results = await searchSkillHubSkills({ query: body.query, limit: body.limit });
      sendJson(res, 200, {
        success: true,
        results: results.map((item) => toSkillCatalogItem(item)),
      });
    } catch (error) {
      sendJson(res, 500, { success: false, error: String(error) });
    }
    return true;
  }

  if (url.pathname === '/api/clawhub/search' && req.method === 'POST') {
    try {
      const body = await parseJsonBody<Record<string, unknown>>(req);
      sendJson(res, 200, {
        success: true,
        results: await ctx.clawHubService.search(body),
      });
    } catch (error) {
      sendJson(res, 500, { success: false, error: String(error) });
    }
    return true;
  }

  if (url.pathname === '/api/clawhub/install' && req.method === 'POST') {
    try {
      const body = await parseJsonBody<Record<string, unknown>>(req);
      await ctx.clawHubService.install(body);
      sendJson(res, 200, { success: true });
    } catch (error) {
      sendJson(res, 500, { success: false, error: String(error) });
    }
    return true;
  }

  if (url.pathname === '/api/clawhub/uninstall' && req.method === 'POST') {
    try {
      const body = await parseJsonBody<Record<string, unknown>>(req);
      await ctx.clawHubService.uninstall(body);
      sendJson(res, 200, { success: true });
    } catch (error) {
      sendJson(res, 500, { success: false, error: String(error) });
    }
    return true;
  }

  if (url.pathname === '/api/clawhub/list' && req.method === 'GET') {
    try {
      sendJson(res, 200, { success: true, results: await ctx.clawHubService.listInstalled() });
    } catch (error) {
      sendJson(res, 500, { success: false, error: String(error) });
    }
    return true;
  }

  if (url.pathname === '/api/clawhub/open-readme' && req.method === 'POST') {
    try {
      const body = await parseJsonBody<{ slug?: string; skillKey?: string; baseDir?: string }>(req);
      await ctx.clawHubService.openSkillReadme(body.skillKey || body.slug || '', body.slug, body.baseDir);
      sendJson(res, 200, { success: true });
    } catch (error) {
      sendJson(res, 500, { success: false, error: String(error) });
    }
    return true;
  }

  if (url.pathname === '/api/clawhub/open-path' && req.method === 'POST') {
    try {
      const body = await parseJsonBody<{ slug?: string; skillKey?: string; baseDir?: string }>(req);
      await ctx.clawHubService.openSkillPath(body.skillKey || body.slug || '', body.slug, body.baseDir);
      sendJson(res, 200, { success: true });
    } catch (error) {
      sendJson(res, 500, { success: false, error: String(error) });
    }
    return true;
  }

  return false;
}
