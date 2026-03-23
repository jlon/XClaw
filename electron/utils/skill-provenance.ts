import type { PreinstalledMarker, PreinstalledSkillSpec } from './skill-config';

export type SkillProvenanceSource =
    | 'xclaw-preinstalled'
    | 'openclaw-managed'
    | 'openclaw-workspace'
    | 'openclaw-extra'
    | 'agents-personal'
    | 'agents-project'
    | 'openclaw-bundled'
    | 'unknown';

export interface SkillProvenance {
    source: SkillProvenanceSource;
    displaySourceLabel: string;
    slug: string;
    markerVersion?: string;
    hasXClawPreinstalledMarker: boolean;
    isXClawPreinstalledManifestSkill: boolean;
}

export interface ResolveSkillProvenanceInput {
    slug: string;
    source?: string | null;
    marker?: PreinstalledMarker | null;
    manifestSkills?: PreinstalledSkillSpec[];
}

const SOURCE_LABELS: Record<SkillProvenanceSource, string> = {
    'xclaw-preinstalled': '内置技能',
    'openclaw-managed': '已安装',
    'openclaw-workspace': '工作区',
    'openclaw-extra': '额外目录',
    'agents-personal': 'Agent',
    'agents-project': 'Agent',
    'openclaw-bundled': 'Bundled',
    unknown: '其他来源',
};

const KNOWN_SOURCES = new Set<SkillProvenanceSource>([
    'xclaw-preinstalled',
    'openclaw-managed',
    'openclaw-workspace',
    'openclaw-extra',
    'agents-personal',
    'agents-project',
    'openclaw-bundled',
    'unknown',
]);

const AGENT_SOURCE_MAP: Record<string, SkillProvenanceSource> = {
    'agents-personal': 'agents-personal',
    'agents-project': 'agents-project',
    'agents-skills-personal': 'agents-personal',
    'agents-skills-project': 'agents-project',
};

const normalizeKnownSource = (source?: string | null): SkillProvenanceSource => {
    const trimmed = source?.trim();
    if (!trimmed) {
        return 'unknown';
    }
    if (trimmed === 'bundled') {
        return 'openclaw-bundled';
    }
    if (trimmed in AGENT_SOURCE_MAP) {
        return AGENT_SOURCE_MAP[trimmed];
    }
    return KNOWN_SOURCES.has(trimmed as SkillProvenanceSource) ? (trimmed as SkillProvenanceSource) : 'unknown';
};

const isManifestSkill = (slug: string, manifestSkills?: PreinstalledSkillSpec[]): boolean => manifestSkills?.some((skill) => skill.slug === slug) ?? false;

export const getSkillSourceLabel = (source?: string | null): string => SOURCE_LABELS[resolveSkillProvenanceSource(source)];

export const resolveSkillProvenanceSource = (source?: string | null): SkillProvenanceSource => normalizeKnownSource(source);

export const resolveSkillProvenance = (input: ResolveSkillProvenanceInput): SkillProvenance => {
    const isMarkerPreinstalled = input.marker?.source === 'XClaw-preinstalled' && input.marker.slug === input.slug;
    const isManifestPreinstalled = isManifestSkill(input.slug, input.manifestSkills);
    const source = isMarkerPreinstalled && isManifestPreinstalled
        ? 'xclaw-preinstalled'
        : resolveSkillProvenanceSource(input.source);

    return {
        source,
        displaySourceLabel: SOURCE_LABELS[source],
        slug: input.slug,
        markerVersion: input.marker?.version,
        hasXClawPreinstalledMarker: isMarkerPreinstalled,
        isXClawPreinstalledManifestSkill: isManifestPreinstalled,
    };
};
