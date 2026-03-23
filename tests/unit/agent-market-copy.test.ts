import { describe, expect, it } from 'vitest';
import { resolveMarketItemCopy } from '@/lib/agent-market-copy';
import type { AgentMarketCatalogItem } from '@/types/agent-market';

const makeItem = (): AgentMarketCatalogItem => ({
  id: 'ux-researcher',
  category: 'creative',
  name: 'UX Researcher',
  role: 'user research assistant',
  sourcePath: 'agents/creative/ux-researcher/SOUL.md',
  rawUrl: 'https://example.com/ux-researcher.md',
  installMode: 'soul-template',
  localeKey: 'ux-researcher',
  avatarSeed: 'creative:ux-researcher',
  headline: 'UX Researcher',
  summary: 'user research assistant',
  highlights: ['Survey design', 'Feedback analysis', 'Usability review'],
  detailSections: [
    {
      kind: 'identity',
      title: 'Identity',
      body: 'user research assistant',
      items: [],
    },
    {
      kind: 'responsibilities',
      title: 'Responsibilities',
      body: '',
      items: ['Survey design', 'Feedback analysis'],
    },
  ],
  tags: ['creative', 'ux'],
});

describe('resolveMarketItemCopy', () => {
  it('uses locale overrides for market copy while localizing section titles', () => {
    const item = makeItem();
    const t = ((key: string, options?: Record<string, unknown>) => {
      if (key === 'workbench.market.items.ux-researcher.name') return '用户研究';
      if (key === 'workbench.market.items.ux-researcher.headline') return '用户研究助手';
      if (key === 'workbench.market.items.ux-researcher.summary') return '帮助产品团队理解用户反馈并提炼洞察。';
      if (key === 'workbench.market.items.ux-researcher.highlights') return ['问卷设计', '反馈分析'];
      if (key === 'workbench.market.sectionKinds.identity') return '角色定位';
      if (key === 'workbench.market.sectionKinds.responsibilities') return '核心职责';
      return options?.defaultValue ?? key;
    }) as never;

    const copy = resolveMarketItemCopy(t, item);

    expect(copy.name).toBe('用户研究');
    expect(copy.headline).toBe('用户研究助手');
    expect(copy.summary).toBe('帮助产品团队理解用户反馈并提炼洞察。');
    expect(copy.highlights).toEqual(['问卷设计', '反馈分析']);
    expect(copy.detailSections.map((section) => section.title)).toEqual(['角色定位', '核心职责']);
  });

  it('falls back to canonical metadata when localized content is absent', () => {
    const item = makeItem();
    const t = ((key: string, options?: Record<string, unknown>) => options?.defaultValue ?? key) as never;

    const copy = resolveMarketItemCopy(t, item);

    expect(copy.name).toBe(item.name);
    expect(copy.headline).toBe(item.headline);
    expect(copy.summary).toBe(item.summary);
    expect(copy.highlights).toEqual(item.highlights);
    expect(copy.detailSections[0].title).toBe('Identity');
  });
});
