import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { StudioSkinDescriptor, StudioSkinApplyResult } from '@/types/studio';
import {
  confirmStudioSkinApplied,
  createStudioSkinSession,
  recordStudioSkinOnLeave,
  resetStudioSkinSession,
  selectEntryStudioSkin,
  selectManualStudioSkin,
} from '@/lib/studio-skins';

const studioSkins: StudioSkinDescriptor[] = [
  { key: 'lodge-default', enabled: true, selectable: false, isDefaultFallback: true },
  { key: 'ember-cabin', enabled: true, selectable: true },
  { key: 'frost-ops', enabled: true, selectable: true },
  { key: 'archive', enabled: true, selectable: false },
  { key: 'broken', enabled: false, selectable: true },
];

function createSession() {
  return createStudioSkinSession(studioSkins);
}

function confirmOk(appliedSkinKey: string): StudioSkinApplyResult {
  return {
    ok: true,
    appliedSkinKey,
    fallbackApplied: false,
    reason: null,
  };
}

describe('studio skin session state machine', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('first entry picks only enabled and selectable skins', () => {
    const session = createSession();

    const picked = selectEntryStudioSkin(session, () => 0.99);

    expect(picked).toBe('frost-ops');
    expect(picked).not.toBe('lodge-default');
    expect(picked).not.toBe('archive');
    expect(picked).not.toBe('broken');
  });

  it('avoids the last applied skin when the pool has more than one candidate', () => {
    const session = createSession();

    confirmStudioSkinApplied(session, confirmOk('ember-cabin'));
    recordStudioSkinOnLeave(session);

    const picked = selectEntryStudioSkin(session, () => 0);

    expect(picked).toBe('frost-ops');
  });

  it('excludes the current skin from manual switch selection', () => {
    const session = createSession();

    confirmStudioSkinApplied(session, confirmOk('ember-cabin'));

    const picked = selectManualStudioSkin(session, () => 0);

    expect(picked).toBe('frost-ops');
    expect(picked).not.toBe('ember-cabin');
  });

  it('excludes the currently displayed skin even before session confirmation catches up', () => {
    const session = createSession();

    const picked = selectManualStudioSkin(session, () => 0, 'ember-cabin');

    expect(picked).toBe('frost-ops');
    expect(picked).not.toBe('ember-cabin');
  });

  it('returns null for manual switching when only one available skin remains', () => {
    const session = createStudioSkinSession([
      { key: 'lodge-default', enabled: true, selectable: false, isDefaultFallback: true },
      { key: 'ember-cabin', enabled: true, selectable: true },
      { key: 'archive', enabled: false, selectable: true },
    ]);

    confirmStudioSkinApplied(session, confirmOk('ember-cabin'));

    expect(selectManualStudioSkin(session)).toBeNull();
  });

  it('keeps the default fallback skin out of the selectable pools when selectable is false', () => {
    const session = createSession();

    const picked = selectEntryStudioSkin(session, () => 0);

    expect(picked).not.toBe('lodge-default');
  });

  it('updates state only after runtime confirmation', () => {
    const session = createSession();

    const picked = selectEntryStudioSkin(session, () => 0);

    expect(session.currentSkinKey).toBeNull();
    expect(session.lastAppliedSkinKey).toBeNull();

    confirmStudioSkinApplied(session, confirmOk(picked ?? 'ember-cabin'));

    expect(session.currentSkinKey).toBe('ember-cabin');
    expect(session.lastAppliedSkinKey).toBe('ember-cabin');
  });

  it('falls back to the explicit fallback skin when runtime confirms an unknown key', () => {
    const session = createSession();

    confirmStudioSkinApplied(session, {
      ok: true,
      appliedSkinKey: 'missing-skin',
      fallbackApplied: false,
      reason: null,
    });

    expect(session.currentSkinKey).toBe('lodge-default');
    expect(session.lastAppliedSkinKey).toBe('lodge-default');
  });

  it('converges to the default fallback skin when apply fails and fallback was not applied', () => {
    const session = createSession();

    confirmStudioSkinApplied(session, {
      ok: false,
      appliedSkinKey: 'ember-cabin',
      fallbackApplied: false,
      reason: 'runtime rejected the skin',
    });

    expect(session.currentSkinKey).toBe('lodge-default');
    expect(session.lastAppliedSkinKey).toBe('lodge-default');
  });

  it('derives a deterministic fallback when explicit fallback metadata is missing', () => {
    const session = createStudioSkinSession([
      { key: 'zeta-skin', enabled: true, selectable: true },
      { key: 'alpha-skin', enabled: true, selectable: false },
      { key: 'disabled-skin', enabled: false, selectable: true },
    ]);

    expect(session.defaultFallbackSkinKey).toBe('alpha-skin');

    confirmStudioSkinApplied(session, {
      ok: false,
      appliedSkinKey: 'zeta-skin',
      fallbackApplied: false,
      reason: 'runtime rejected the skin',
    });

    expect(session.currentSkinKey).toBe('alpha-skin');
    expect(session.lastAppliedSkinKey).toBe('alpha-skin');
  });

  it('resets the session state without changing the fallback definition', () => {
    const session = createSession();

    confirmStudioSkinApplied(session, confirmOk('ember-cabin'));
    recordStudioSkinOnLeave(session);
    resetStudioSkinSession(session);

    expect(session.currentSkinKey).toBeNull();
    expect(session.lastAppliedSkinKey).toBeNull();
    expect(session.defaultFallbackSkinKey).toBe('lodge-default');
  });
});
