import { describe, expect, it } from 'vitest';
import { resolveMarketCategoryLabel, resolveMarketItemCopy } from '@/lib/agent-market-copy';
import type { AgentMarketCatalogItem } from '@/types/agent-market';
import zhMarketCopy from '@/lib/agent-market-copy.zh.json';

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
  it('localizes market category labels through shell translation keys', () => {
    const t = ((key: string, options?: Record<string, unknown>) => {
      if (key === 'workbench.market.categories.productivity') return '效率';
      return options?.defaultValue ?? key;
    }) as never;

    expect(resolveMarketCategoryLabel(t, 'productivity')).toBe('效率');
    expect(resolveMarketCategoryLabel(t, 'unknown-category')).toBe('unknown-category');
  });

  it('uses locale overrides for market copy while localizing section titles', () => {
    const item = makeItem();
    const t = ((key: string, options?: Record<string, unknown>) => {
      if (key === 'workbench.market.items.ux-researcher.name') return '用户研究';
      if (key === 'workbench.market.items.ux-researcher.headline') return '用户研究助手';
      if (key === 'workbench.market.items.ux-researcher.summary') return '帮助产品团队理解用户反馈并提炼洞察。';
      if (key === 'workbench.market.items.ux-researcher.highlights') return ['问卷设计', '反馈分析'];
      if (key === 'workbench.market.items.ux-researcher.detailSections') {
        return [
          {
            kind: 'identity',
            title: '角色定位',
            body: '帮助产品团队理解用户反馈并提炼洞察。',
            items: [],
          },
          {
            kind: 'responsibilities',
            title: '核心职责',
            body: '',
            items: ['问卷设计', '反馈分析'],
          },
        ];
      }
      return options?.defaultValue ?? key;
    }) as never;

    const copy = resolveMarketItemCopy(t, item, 'en');

    expect(copy.name).toBe('用户研究');
    expect(copy.headline).toBe('用户研究助手');
    expect(copy.summary).toBe('帮助产品团队理解用户反馈并提炼洞察。');
    expect(copy.highlights).toEqual(['问卷设计', '反馈分析']);
    expect(copy.detailSections.map((section) => section.title)).toEqual(['角色定位', '核心职责']);
    expect(copy.detailSections[0].body).toBe('帮助产品团队理解用户反馈并提炼洞察。');
    expect(copy.detailSections[1].items).toEqual(['问卷设计', '反馈分析']);
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

  it('prefers bundled zh market copy for card and detail content', () => {
    const item: AgentMarketCatalogItem = {
      id: 'daily-standup',
      category: 'productivity',
      name: 'Daily Standup',
      role: 'daily standup collector',
      sourcePath: 'agents/productivity/daily-standup/SOUL.md',
      rawUrl: 'https://example.com/daily-standup.md',
      installMode: 'soul-template',
      localeKey: 'daily-standup',
      avatarSeed: 'productivity:daily-standup',
      headline: 'Daily Standup',
      summary: 'Daily standup collector and summarizer',
      highlights: ['Standup collection'],
      detailSections: [
        {
          kind: 'identity',
          title: 'Identity',
          body: 'Daily standup collector and summarizer',
          items: [],
        },
      ],
      tags: ['productivity'],
    };
    const t = ((key: string, options?: Record<string, unknown>) => options?.defaultValue ?? key) as never;

    const copy = resolveMarketItemCopy(t, item, 'zh-CN');
    const expected = (zhMarketCopy as Record<string, { name: string; summary: string; detailSections: Array<{ title: string; body: string }> }>)['daily-standup'];

    expect(copy.name).toBe(expected.name);
    expect(copy.summary).toBe(expected.summary);
    expect(copy.detailSections[0].title).toBe(expected.detailSections[0].title);
    expect(copy.detailSections[0].body).toBe(expected.detailSections[0].body);
  });
});
