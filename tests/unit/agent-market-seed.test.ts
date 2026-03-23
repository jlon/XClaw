import { describe, expect, it } from 'vitest';
import agentMarketSeed from '@electron/shared/agent-market-seed.json';

describe('agent market seed metadata', () => {
  it('ships enriched market metadata for every bundled agent', () => {
    expect(agentMarketSeed.items.length).toBe(50);
    expect(agentMarketSeed.source.note.match(/Metadata fields are derived from upstream SOUL\.md templates\./g)?.length ?? 0).toBe(1);
    agentMarketSeed.items.forEach((item) => {
      expect(item.localeKey).toBe(item.id);
      expect(item.avatarSeed).toContain(item.id);
      expect(item.name).not.toMatch(/^SOUL\.md/i);
      expect(item.headline).not.toMatch(/^SOUL\.md/i);
      if (item.id.includes('-')) {
        expect(item.name).not.toBe(item.id);
      }
      expect(item.summary?.trim().length).toBeGreaterThan(0);
      expect(item.headline?.trim().length).toBeGreaterThan(0);
      expect(Array.isArray(item.highlights)).toBe(true);
      expect(item.highlights.length).toBeGreaterThan(0);
      expect(Array.isArray(item.detailSections)).toBe(true);
      expect(item.detailSections.length).toBeGreaterThan(1);
      item.detailSections.forEach((section) => {
        expect(section.kind?.trim().length).toBeGreaterThan(0);
        expect(section.title?.trim().length).toBeGreaterThan(0);
        expect(Array.isArray(section.items)).toBe(true);
      });
    });
  });
});
