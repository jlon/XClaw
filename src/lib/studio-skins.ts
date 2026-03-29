import type { StudioSkinApplyResult, StudioSkinDescriptor } from '@/types/studio';

export interface StudioSkinSession {
  readonly skins: readonly StudioSkinDescriptor[];
  readonly defaultFallbackSkinKey: string | null;
  currentSkinKey: string | null;
  lastAppliedSkinKey: string | null;
}

type RandomSource = () => number;

const isSelectableSkin = (skin: StudioSkinDescriptor): boolean => skin.enabled && skin.selectable;

const compareSkinKeys = (left: StudioSkinDescriptor, right: StudioSkinDescriptor): number =>
  left.key.localeCompare(right.key);

const findDefaultFallbackSkinKey = (skins: readonly StudioSkinDescriptor[]): string | null => {
  const explicitFallback = skins.find((skin) => skin.isDefaultFallback && skin.enabled);
  if (explicitFallback) {
    return explicitFallback.key;
  }

  return [...skins]
    .filter((skin) => skin.enabled)
    .sort(compareSkinKeys)[0]?.key ?? null;
};

const normalizeSkinKey = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed || null;
};

const isKnownEnabledSkinKey = (session: StudioSkinSession, skinKey: string): boolean =>
  session.skins.some((skin) => skin.key === skinKey && skin.enabled);

const pickSkinKey = (skins: readonly StudioSkinDescriptor[], randomSource: RandomSource): string | null => {
  if (skins.length === 0) {
    return null;
  }

  const index = Math.min(skins.length - 1, Math.floor(randomSource() * skins.length));
  return skins[index]?.key ?? null;
};

const getSelectableSkins = (session: StudioSkinSession): StudioSkinDescriptor[] =>
  session.skins.filter(isSelectableSkin);

const getFallbackSkinKey = (session: StudioSkinSession): string | null =>
  session.defaultFallbackSkinKey;

export function createStudioSkinSession(skins: readonly StudioSkinDescriptor[]): StudioSkinSession {
  return {
    skins: [...skins],
    defaultFallbackSkinKey: findDefaultFallbackSkinKey(skins),
    currentSkinKey: null,
    lastAppliedSkinKey: null,
  };
}

export function selectEntryStudioSkin(
  session: StudioSkinSession,
  randomSource: RandomSource = Math.random,
): string | null {
  const selectableSkins = getSelectableSkins(session);
  const candidateSkins =
    session.lastAppliedSkinKey && selectableSkins.length > 1
      ? selectableSkins.filter((skin) => skin.key !== session.lastAppliedSkinKey)
      : selectableSkins;

  return pickSkinKey(candidateSkins, randomSource) ?? getFallbackSkinKey(session);
}

export function selectManualStudioSkin(
  session: StudioSkinSession,
  randomSource: RandomSource = Math.random,
): string | null {
  const candidateSkins = getSelectableSkins(session).filter((skin) => skin.key !== session.currentSkinKey);

  if (candidateSkins.length === 0) {
    return null;
  }

  return pickSkinKey(candidateSkins, randomSource);
}

export function confirmStudioSkinApplied(
  session: StudioSkinSession,
  result: StudioSkinApplyResult,
): void {
  const fallbackSkinKey = getFallbackSkinKey(session);
  const normalizedAppliedSkinKey = normalizeSkinKey(result.appliedSkinKey);
  const appliedSkinKey =
    result.ok && normalizedAppliedSkinKey && isKnownEnabledSkinKey(session, normalizedAppliedSkinKey)
      ? normalizedAppliedSkinKey
      : fallbackSkinKey;

  session.currentSkinKey = appliedSkinKey;
  session.lastAppliedSkinKey = appliedSkinKey;
}

export function recordStudioSkinOnLeave(session: StudioSkinSession): void {
  session.lastAppliedSkinKey = session.currentSkinKey;
}

export function resetStudioSkinSession(session: StudioSkinSession): void {
  session.currentSkinKey = null;
  session.lastAppliedSkinKey = null;
}
