import { beforeEach, describe, expect, it, vi } from 'vitest';

const fetchMock = vi.fn();

describe('skill provider adapters', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.stubGlobal('fetch', fetchMock);
  });

  it('normalizes SkillHub top results with provider-qualified ids and install drafts', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValueOnce({
        code: 0,
        data: {
          skills: [
            {
              slug: 'excel-analyzer',
              name: 'Excel Analyzer',
              description: 'Parse spreadsheets into structured summaries.',
              description_zh: '把表格解析成结构化摘要。',
              version: '1.2.3',
              ownerName: 'Tencent',
              downloads: 1200,
              installs: 580,
              stars: 88,
              homepage: 'https://skillhub.tencent.com/skills/excel-analyzer',
            },
          ],
        },
        message: 'success',
      }),
    });

    const { searchSkillHubSkills } = await import('../../electron/gateway/skillhub');
    const results = await searchSkillHubSkills({ limit: 3 });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://lightmake.site/api/skills?page=1&pageSize=3&sortBy=score&order=desc',
      expect.objectContaining({ method: 'GET' }),
    );
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      id: 'skillhub:excel-analyzer',
      provider: 'skillhub',
      providerQualifiedId: 'skillhub:excel-analyzer',
      providerSkillId: 'excel-analyzer',
      slug: 'excel-analyzer',
      name: 'Excel Analyzer',
      description: 'Parse spreadsheets into structured summaries.',
      version: '1.2.3',
      author: 'Tencent',
      downloads: 1200,
      stars: 88,
      sourceUrl: 'https://skillhub.tencent.com/skills/excel-analyzer',
    });
    expect(results[0].installDraft).toMatchObject({
      provider: 'skillhub',
      providerQualifiedId: 'skillhub:excel-analyzer',
      providerSkillId: 'excel-analyzer',
      slug: 'excel-analyzer',
      name: 'Excel Analyzer',
      description: 'Parse spreadsheets into structured summaries.',
      version: '1.2.3',
    });
    expect(results[0].installDraft.execution).toMatchObject({
      kind: 'chat-prompt',
      payload: {
        provider: 'skillhub',
        providerQualifiedId: 'skillhub:excel-analyzer',
        providerSkillId: 'excel-analyzer',
        slug: 'excel-analyzer',
        name: 'Excel Analyzer',
      },
    });
  });

  it('normalizes SkillHub search results from the query endpoint', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValueOnce({
        code: 0,
        data: {
          skills: [
            {
              slug: 'diagram-maker',
              name: 'Diagram Maker',
              description: 'Generate diagrams from rough notes.',
              description_zh: '把草稿笔记生成图表。',
              homepage: 'https://skillhub.tencent.com/skills/diagram-maker',
              ownerName: 'SkillHub',
              downloads: 42,
              installs: 12,
              stars: 7,
              version: '0.9.0',
            },
          ],
          total: 1,
        },
        message: 'success',
      }),
    });

    const { searchSkillHubSkills } = await import('../../electron/gateway/skillhub');
    const results = await searchSkillHubSkills({ query: 'diagram' });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://lightmake.site/api/skills?page=1&pageSize=24&sortBy=score&order=desc&keyword=diagram',
      expect.objectContaining({ method: 'GET' }),
    );
    expect(results[0]).toMatchObject({
      id: 'skillhub:diagram-maker',
      providerQualifiedId: 'skillhub:diagram-maker',
      providerSkillId: 'diagram-maker',
      name: 'Diagram Maker',
      description: 'Generate diagrams from rough notes.',
      sourceUrl: 'https://skillhub.tencent.com/skills/diagram-maker',
    });
    expect(results[0].installDraft.metadata).toMatchObject({
      provider: 'skillhub',
      sourceUrl: 'https://skillhub.tencent.com/skills/diagram-maker',
      hasSourceUrl: true,
    });
  });

  it('normalizes ClawHub records with provider-qualified ids and install drafts', async () => {
    const { normalizeClawHubCatalogItem } = await import('../../electron/gateway/skillhub');
    const result = normalizeClawHubCatalogItem({
      slug: 'daily-standup',
      name: 'Daily Standup',
      description: 'Prepare concise meeting updates.',
      version: '1.0.0',
      author: 'OpenClaw',
      downloads: 42,
      stars: 7,
    });

    expect(result).toMatchObject({
      id: 'clawhub:daily-standup',
      provider: 'clawhub',
      providerQualifiedId: 'clawhub:daily-standup',
      providerSkillId: 'daily-standup',
      slug: 'daily-standup',
      name: 'Daily Standup',
      description: 'Prepare concise meeting updates.',
      version: '1.0.0',
      author: 'OpenClaw',
      downloads: 42,
      stars: 7,
    });
    expect(result.installDraft).toMatchObject({
      provider: 'clawhub',
      providerQualifiedId: 'clawhub:daily-standup',
      providerSkillId: 'daily-standup',
      slug: 'daily-standup',
      name: 'Daily Standup',
    });
    expect(result.installDraft.execution).toMatchObject({
      kind: 'host-install',
      payload: {
        provider: 'clawhub',
        providerQualifiedId: 'clawhub:daily-standup',
      },
    });
  });
});
