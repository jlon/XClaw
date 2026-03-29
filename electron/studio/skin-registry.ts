import { existsSync, readFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import type { StudioSkinDescriptor } from '@/types/studio';

export interface StudioSkinRegistryEntry extends StudioSkinDescriptor {
  name: string;
  manifestPath: string;
}

export interface StudioSkinRegistrySnapshot {
  defaultFallbackSkinKey: string;
  skins: StudioSkinRegistryEntry[];
}

const CURRENT_DIR = dirname(fileURLToPath(import.meta.url));
const REGISTRY_CANDIDATES = [
  resolve(CURRENT_DIR, '../../scripts/star-office-runtime-overrides/frontend/skins/registry.json'),
  resolve(CURRENT_DIR, '../../resources/star-office-runtime/frontend/skins/registry.json'),
];

const normalizeBoolean = (value: unknown, fallback: boolean): boolean =>
  typeof value === 'boolean' ? value : fallback;

const normalizeString = (value: unknown, fallback: string): string =>
  typeof value === 'string' && value.trim() ? value.trim() : fallback;

const normalizeEntry = (value: unknown): StudioSkinRegistryEntry | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  const record = value as Record<string, unknown>;
  const key = normalizeString(record.key, '');
  const name = normalizeString(record.name, key);
  const manifestPath = normalizeString(record.manifestPath, `${key}/manifest.json`);
  if (!key) {
    return null;
  }
  return {
    key,
    name,
    manifestPath,
    enabled: normalizeBoolean(record.enabled, true),
    selectable: normalizeBoolean(record.selectable, true),
    isDefaultFallback: normalizeBoolean(record.isDefaultFallback, false),
  };
};

const getFallbackRegistry = (): StudioSkinRegistrySnapshot => ({
  defaultFallbackSkinKey: 'lodge-default',
  skins: [
    {
      key: 'lodge-default',
      name: 'Lodge Default',
      manifestPath: 'lodge-default/manifest.json',
      enabled: true,
      selectable: true,
      isDefaultFallback: true,
    },
  ],
});

export function getStudioSkinRegistryPath(): string | null {
  return REGISTRY_CANDIDATES.find((candidate) => existsSync(candidate)) ?? null;
}

export function readStudioSkinRegistry(): StudioSkinRegistrySnapshot {
  const registryPath = getStudioSkinRegistryPath();
  if (!registryPath) {
    return getFallbackRegistry();
  }

  try {
    const parsed = JSON.parse(readFileSync(registryPath, 'utf8')) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return getFallbackRegistry();
    }

    const record = parsed as Record<string, unknown>;
    const skins = Array.isArray(record.skins)
      ? record.skins.map(normalizeEntry).filter((entry): entry is StudioSkinRegistryEntry => entry !== null)
      : [];
    const defaultFallbackSkinKey = normalizeString(record.defaultFallbackSkinKey, '');
    const normalizedFallbackKey = defaultFallbackSkinKey || skins.find((entry) => entry.isDefaultFallback)?.key || 'lodge-default';

    return {
      defaultFallbackSkinKey: normalizedFallbackKey,
      skins,
    };
  } catch {
    return getFallbackRegistry();
  }
}
