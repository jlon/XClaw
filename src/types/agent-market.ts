export interface AgentMarketDetailSection {
  kind: string;
  title: string;
  body: string;
  items: string[];
}

export interface AgentMarketCatalogItem {
  id: string;
  category: string;
  name: string;
  role: string;
  sourcePath: string;
  rawUrl: string;
  installMode: string;
  localeKey: string;
  avatarSeed: string;
  headline: string;
  summary: string;
  highlights: string[];
  detailSections: AgentMarketDetailSection[];
  tags: string[];
}
