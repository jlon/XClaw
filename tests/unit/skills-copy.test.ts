import { describe, expect, it, vi } from 'vitest';
import { getSkillDescriptionTranslationKey, resolveLocalizedSkillDescription } from '@/pages/Skills/skill-copy';

describe('skills description copy', () => {
  it('uses localized copy when the skill description key exists', () => {
    const t = vi.fn((key: string) => key === 'catalog.descriptions.pdf' ? '从 PDF 中提取内容、表格与结构化文本。' : key);
    const exists = vi.fn((key: string) => key === 'catalog.descriptions.pdf');

    expect(resolveLocalizedSkillDescription({
      id: 'pdf',
      slug: 'pdf',
      description: 'Extract structured content from PDFs.',
    }, t as never, exists)).toBe('从 PDF 中提取内容、表格与结构化文本。');
  });

  it('falls back to the source description when no localized copy exists', () => {
    const t = vi.fn((key: string) => key);
    const exists = vi.fn(() => false);

    expect(resolveLocalizedSkillDescription({
      id: 'custom-skill',
      slug: 'custom-skill',
      description: 'Custom skill from a third-party catalog.',
    }, t as never, exists)).toBe('Custom skill from a third-party catalog.');
  });

  it('normalizes the translation key from slug or id', () => {
    expect(getSkillDescriptionTranslationKey({
      id: 'Brave Web Search',
      description: '',
    })).toBe('catalog.descriptions.brave-web-search');
  });
});
