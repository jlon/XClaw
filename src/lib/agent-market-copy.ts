import type { TFunction } from 'i18next';
import type { AgentMarketCatalogItem, AgentMarketDetailSection } from '@/types/agent-market';
import zhMarketCopy from '@/lib/agent-market-copy.zh.json';

const resolveText = (t: TFunction<'agents'>, key: string, fallback: string) => {
  const value = t(key);
  return value === key ? fallback : value;
};

const resolveArray = (t: TFunction<'agents'>, key: string, fallback: string[]) => {
  const value = t(key, { returnObjects: true, defaultValue: fallback });
  return Array.isArray(value) ? value.map((entry) => String(entry)) : fallback;
};

const resolveSectionTitle = (t: TFunction<'agents'>, section: AgentMarketDetailSection) =>
  resolveText(t, `workbench.market.sectionKinds.${section.kind}`, section.title);

export const resolveMarketCategoryLabel = (t: TFunction<'agents'>, category: string) =>
  resolveText(t, `workbench.market.categories.${category}`, category);

type LocalizedDetailSection = Partial<Pick<AgentMarketDetailSection, 'title' | 'body' | 'items'>> & {
  kind?: string;
};

type LocalizedMarketCopy = {
  name?: string;
  headline?: string;
  summary?: string;
  highlights?: string[];
  detailSections?: LocalizedDetailSection[];
};

const localizedMarketCopies: Record<string, Record<string, LocalizedMarketCopy>> = {
  zh: zhMarketCopy as Record<string, LocalizedMarketCopy>,
};

const normalizeLanguage = (language?: string | null) => language?.toLowerCase().split('-')[0] ?? '';

const getLocalizedMarketCopy = (item: AgentMarketCatalogItem, language?: string | null) => {
  const normalizedLanguage = normalizeLanguage(language);
  if (!normalizedLanguage) {
    return null;
  }
  const localeKey = item.localeKey || item.id;
  return localizedMarketCopies[normalizedLanguage]?.[localeKey] ?? null;
};

const resolveDetailSections = (
  t: TFunction<'agents'>,
  item: AgentMarketCatalogItem,
  localizedCopy: LocalizedMarketCopy | null,
) => {
  const localeKey = item.localeKey || item.id;
  const localizedSections = t(`workbench.market.items.${localeKey}.detailSections`, {
    returnObjects: true,
    defaultValue: null,
  });
  const translationOverrides = Array.isArray(localizedSections) ? (localizedSections as LocalizedDetailSection[]) : [];
  const localizedOverrides = Array.isArray(localizedCopy?.detailSections) ? localizedCopy.detailSections : [];
  const sectionOverrides = localizedOverrides.length > 0 ? localizedOverrides : translationOverrides;

  return item.detailSections.map((section, index) => {
    const override = sectionOverrides[index];
    const localizedItems = Array.isArray(override?.items) ? override.items.map((entry) => String(entry)) : section.items;

    return {
      ...section,
      title: typeof override?.title === 'string' && override.title.trim() ? override.title : resolveSectionTitle(t, section),
      body: typeof override?.body === 'string' ? override.body : section.body,
      items: localizedItems,
    };
  });
};

export const resolveMarketItemCopy = (t: TFunction<'agents'>, item: AgentMarketCatalogItem, language?: string | null) => {
  const localeKey = item.localeKey || item.id;
  const localizedCopy = getLocalizedMarketCopy(item, language);
  const name = localizedCopy?.name || resolveText(t, `workbench.market.items.${localeKey}.name`, item.name || item.id);
  const headline = localizedCopy?.headline || resolveText(t, `workbench.market.items.${localeKey}.headline`, item.headline);
  const summary = localizedCopy?.summary || resolveText(t, `workbench.market.items.${localeKey}.summary`, item.summary || item.role);
  const highlights =
    Array.isArray(localizedCopy?.highlights) && localizedCopy.highlights.length > 0
      ? localizedCopy.highlights.map((entry) => String(entry))
      : resolveArray(t, `workbench.market.items.${localeKey}.highlights`, item.highlights);
  const detailSections = resolveDetailSections(t, item, localizedCopy);

  return {
    name,
    headline,
    summary,
    highlights,
    detailSections,
  };
};
