/**
 * Skill Type Definitions
 * Types for skills/plugins
 */

/**
 * Skill data structure
 */
export interface Skill {
  id: string;
  slug?: string;
  name: string;
  description: string;
  enabled: boolean;
  icon?: string;
  version?: string;
  author?: string;
  configurable?: boolean;
  config?: Record<string, unknown>;
  isCore?: boolean;
  isBundled?: boolean;
  dependencies?: string[];
  source?: string;
  provenance?: SkillProvenance;
  displaySourceLabel?: string;
  providerId?: SkillProviderId;
  providerSkillId?: string;
  installCapability?: SkillInstallCapability;
  baseDir?: string;
  filePath?: string;
}

export type SkillProvenance =
  | 'xclaw-preinstalled'
  | 'openclaw-managed'
  | 'openclaw-workspace'
  | 'openclaw-extra'
  | 'agents-personal'
  | 'agents-project'
  | 'openclaw-bundled'
  | 'unknown';

export type SkillProviderId = 'clawhub' | 'skillhub';

export type SkillInstallExecutionKind = 'host-install' | 'chat-prompt';

export interface SkillInstallCapability {
  providerId: SkillProviderId;
  executionKind: SkillInstallExecutionKind;
}

/**
 * Skill bundle (preset skill collection)
 */
export interface SkillBundle {
  id: string;
  name: string;
  nameZh: string;
  description: string;
  descriptionZh: string;
  icon: string;
  skills: string[];
  recommended?: boolean;
}


/**
 * Marketplace skill data
 */
export interface MarketplaceSkill {
  slug: string;
  name: string;
  description: string;
  version: string;
  author?: string;
  downloads?: number;
  stars?: number;
}

export interface SkillCatalogItem {
  id: string;
  providerId: SkillProviderId;
  providerSkillId: string;
  slug: string;
  name: string;
  description: string;
  version?: string;
  author?: string;
  downloads?: number;
  stars?: number;
  sourceLabel?: string;
  installCapability: SkillInstallCapability;
  metadata?: Record<string, unknown>;
}

export interface SkillChatDraftContext {
  localQuery?: string;
  scrollTop?: number;
  activeProvider?: SkillProviderId | null;
  providerQuery?: string;
}

export interface SkillChatDraft {
  id: string;
  kind: 'create-skill' | 'github-import' | 'provider-install';
  title: string;
  message: string;
  returnContext?: SkillChatDraftContext;
  providerId?: SkillProviderId;
  providerSkillId?: string;
  slug?: string;
  name?: string;
  execution: {
    kind: SkillInstallExecutionKind;
    payload: Record<string, unknown>;
  };
}

/**
 * Skill configuration schema
 */
export interface SkillConfigSchema {
  type: 'object';
  properties: Record<string, {
    type: 'string' | 'number' | 'boolean' | 'array';
    title?: string;
    description?: string;
    default?: unknown;
    enum?: unknown[];
  }>;
  required?: string[];
}
