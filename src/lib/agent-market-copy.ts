import type { TFunction } from 'i18next';
import type { AgentMarketCatalogItem, AgentMarketDetailSection } from '@/types/agent-market';

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

export const resolveMarketItemCopy = (t: TFunction<'agents'>, item: AgentMarketCatalogItem) => {
  const localeKey = item.localeKey || item.id;
  const name = resolveText(t, `workbench.market.items.${localeKey}.name`, item.name || item.id);
  const headline = resolveText(t, `workbench.market.items.${localeKey}.headline`, item.headline);
  const summary = resolveText(t, `workbench.market.items.${localeKey}.summary`, item.summary || item.role);
  const highlights = resolveArray(t, `workbench.market.items.${localeKey}.highlights`, item.highlights);
  const detailSections = item.detailSections.map((section) => ({
    ...section,
    title: resolveSectionTitle(t, section),
  }));

  return {
    name,
    headline,
    summary,
    highlights,
    detailSections,
  };
};
