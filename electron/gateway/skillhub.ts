import type { ClawHubSkillResult } from './clawhub';

export type ProviderId = 'clawhub' | 'skillhub';

export interface ProviderInstallExecutionPayload {
  provider: ProviderId;
  providerQualifiedId: string;
  providerSkillId: string;
  slug: string;
  name: string;
  description: string;
  version?: string;
  author?: string;
  downloads?: number;
  stars?: number;
  sourceUrl?: string;
  recommendedAction: 'install';
}

export interface ProviderInstallDraft {
  provider: ProviderId;
  providerQualifiedId: string;
  providerSkillId: string;
  slug: string;
  name: string;
  description: string;
  version?: string;
  author?: string;
  downloads?: number;
  stars?: number;
  sourceUrl?: string;
  metadata: {
    provider: ProviderId;
    sourceUrl?: string;
    hasSourceUrl: boolean;
    author?: string;
    downloads?: number;
    stars?: number;
  };
  execution: {
    kind: 'chat-prompt';
    payload: ProviderInstallExecutionPayload;
  };
}

export interface ProviderCatalogItem {
  id: string;
  provider: ProviderId;
  providerQualifiedId: string;
  providerSkillId: string;
  slug: string;
  name: string;
  description: string;
  version?: string;
  author?: string;
  downloads?: number;
  stars?: number;
  sourceUrl?: string;
  installDraft: ProviderInstallDraft;
  raw: unknown;
}

export interface SkillHubSearchParams {
  query?: string;
  limit?: number;
}

export class ProviderAdapterError extends Error {
  provider: ProviderId;
  status?: number;

  constructor(provider: ProviderId, message: string, status?: number) {
    super(message);
    this.name = 'ProviderAdapterError';
    this.provider = provider;
    this.status = status;
  }
}

const SKILLHUB_SEARCH_URL = 'https://lightmake.site/api/skills';

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const firstText = (...values: unknown[]): string | undefined => {
  for (const value of values) {
    if (typeof value !== 'string') continue;
    const trimmed = value.trim();
    if (trimmed) return trimmed;
  }
  return undefined;
};

const toPositiveNumber = (...values: unknown[]): number | undefined => {
  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim()) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return undefined;
};

const slugify = (value: string): string => value
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '') || 'skill';

const buildQualifiedId = (provider: ProviderId, providerSkillId: string): string => `${provider}:${slugify(providerSkillId)}`;

const extractRecords = (payload: unknown): unknown[] => {
  if (Array.isArray(payload)) return payload;
  if (!isRecord(payload)) return [];

  const data = payload.data;
  if (isRecord(data)) {
    for (const key of ['skills', 'items', 'results', 'list', 'records']) {
      const value = data[key];
      if (Array.isArray(value)) return value;
    }
  }

  for (const key of ['items', 'results', 'data', 'list', 'skills', 'records']) {
    const value = payload[key];
    if (Array.isArray(value)) return value;
  }

  return [];
};

const normalizeCatalogItem = (
  provider: ProviderId,
  raw: Record<string, unknown>,
  executionKind: 'chat-prompt' | 'host-install' = 'chat-prompt',
): ProviderCatalogItem => {
  const providerSkillId = slugify(firstText(raw.skillId, raw.skill_id, raw.id, raw.slug, raw.name, raw.title, raw.label) || 'skill');
  const name = firstText(raw.name, raw.title, raw.label, raw.skillName, providerSkillId) || providerSkillId;
  const description = firstText(raw.description, raw.summary, raw.desc, raw.overview, raw.introduction, name) || name;
  const version = firstText(raw.version, raw.latestVersion, raw.release, raw.tag, raw.latest);
  const author = firstText(raw.author, raw.vendor, raw.publisher);
  const downloads = toPositiveNumber(raw.downloads, raw.downloadCount, raw.installCount, raw.installs);
  const stars = toPositiveNumber(raw.stars, raw.starCount, raw.rating);
  const sourceUrl = firstText(raw.sourceUrl, raw.installUrl, raw.url, raw.homepage, raw.readmeUrl, raw.detailUrl);
  const providerQualifiedId = buildQualifiedId(provider, providerSkillId);

  return {
    id: providerQualifiedId,
    provider,
    providerQualifiedId,
    providerSkillId,
    slug: providerSkillId,
    name,
    description,
    version,
    author,
    downloads,
    stars,
    sourceUrl,
    installDraft: {
      provider,
      providerQualifiedId,
      providerSkillId,
      slug: providerSkillId,
      name,
      description,
      version,
      author,
      downloads,
      stars,
      sourceUrl,
      metadata: {
        provider,
        sourceUrl,
        hasSourceUrl: Boolean(sourceUrl),
        author,
        downloads,
        stars,
      },
      execution: {
        kind: executionKind,
        payload: {
          provider,
          providerQualifiedId,
          providerSkillId,
          slug: providerSkillId,
          name,
          description,
          version,
          author,
          downloads,
          stars,
          sourceUrl,
          recommendedAction: 'install',
        },
      },
    },
    raw,
  };
};

const requestJson = async (url: string, fetchImpl: typeof fetch = globalThis.fetch): Promise<unknown> => {
  const response = await fetchImpl(url, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new ProviderAdapterError('skillhub', `SkillHub request failed with status ${response.status}`, response.status);
  }

  return response.json();
};

export const normalizeSkillHubCatalogItem = (raw: Record<string, unknown>): ProviderCatalogItem => normalizeCatalogItem('skillhub', {
  skillId: raw.slug ?? raw.skillId ?? raw.id,
  slug: raw.slug,
  name: raw.name,
  title: raw.title,
  description: raw.description,
  summary: raw.summary,
  desc: raw.desc,
  overview: raw.overview,
  version: raw.version,
  author: raw.ownerName ?? raw.author,
  downloads: raw.downloads,
  installCount: raw.installs,
  stars: raw.stars,
  homepage: raw.homepage,
  url: raw.url,
  sourceUrl: raw.sourceUrl,
});

export const normalizeClawHubCatalogItem = (raw: ClawHubSkillResult): ProviderCatalogItem => normalizeCatalogItem('clawhub', {
  slug: raw.slug,
  name: raw.name,
  description: raw.description,
  version: raw.version,
  author: raw.author,
  downloads: raw.downloads,
  stars: raw.stars,
}, 'host-install');

export const searchSkillHubSkills = async (
  params: SkillHubSearchParams = {},
  fetchImpl: typeof fetch = globalThis.fetch,
): Promise<ProviderCatalogItem[]> => {
  const query = params.query?.trim() || '';
  const baseUrl = new URL(SKILLHUB_SEARCH_URL);
  const pageSize = typeof params.limit === 'number' && Number.isFinite(params.limit) && params.limit > 0
    ? Math.max(1, Math.trunc(params.limit))
    : 24;

  baseUrl.searchParams.set('page', '1');
  baseUrl.searchParams.set('pageSize', String(pageSize));
  baseUrl.searchParams.set('sortBy', 'score');
  baseUrl.searchParams.set('order', 'desc');
  if (query) {
    baseUrl.searchParams.set('keyword', query);
  }

  const payload = await requestJson(baseUrl.toString(), fetchImpl);
  const records = extractRecords(payload);

  return records
    .filter(isRecord)
    .map((record) => normalizeSkillHubCatalogItem(record));
};
