import { describe, expect, it } from 'vitest';
import {
  deriveSetupBootstrapState,
  hasLegacyOpenClawConfigFootprint,
  hasLegacyProviderStoreFootprint,
} from '@electron/main/setup-bootstrap';

describe('setup bootstrap state', () => {
  it('enters readonly mode when setup state is unresolved and no legacy ClawX footprint exists', () => {
    const state = deriveSetupBootstrapState({
      settings: {},
      legacyFootprintDetected: false,
    });

    expect(state).toEqual({
      setupComplete: false,
      source: 'pending',
      readonly: true,
      shouldRunStartupSideEffects: false,
    });
  });

  it('allows normal startup when main-process setupComplete is explicitly true', () => {
    const state = deriveSetupBootstrapState({
      settings: { setupComplete: true },
      legacyFootprintDetected: false,
    });

    expect(state).toEqual({
      setupComplete: true,
      source: 'main-settings',
      readonly: false,
      shouldRunStartupSideEffects: true,
    });
  });

  it('treats explicit setupComplete false as authoritative even if legacy footprint exists', () => {
    const state = deriveSetupBootstrapState({
      settings: { setupComplete: false },
      legacyFootprintDetected: true,
    });

    expect(state).toEqual({
      setupComplete: false,
      source: 'main-settings',
      readonly: true,
      shouldRunStartupSideEffects: false,
    });
  });

  it('keeps legacy ClawX footprint in readonly mode until setup is explicitly completed', () => {
    const state = deriveSetupBootstrapState({
      settings: {},
      legacyFootprintDetected: true,
    });

    expect(state).toEqual({
      setupComplete: false,
      source: 'legacy-footprint',
      readonly: true,
      shouldRunStartupSideEffects: false,
    });
  });
});

describe('legacy ClawX footprint detection', () => {
  it('detects legacy provider store data when provider accounts already exist', () => {
    expect(hasLegacyProviderStoreFootprint({
      providerAccounts: {
        moonshot: {
          id: 'moonshot',
        },
      },
    })).toBe(true);
  });

  it('ignores empty provider store payloads', () => {
    expect(hasLegacyProviderStoreFootprint({})).toBe(false);
    expect(hasLegacyProviderStoreFootprint({
      providerAccounts: {},
      providers: {},
      apiKeys: {},
      providerSecrets: {},
      defaultProvider: null,
      defaultProviderAccountId: null,
      schemaVersion: 0,
    })).toBe(false);
  });

  it('detects ClawX-managed openclaw config by gateway token prefix', () => {
    expect(hasLegacyOpenClawConfigFootprint({
      gateway: {
        auth: {
          token: 'clawx-123',
        },
      },
    })).toBe(true);
  });

  it('detects ClawX-managed openclaw config by file origin allowance', () => {
    expect(hasLegacyOpenClawConfigFootprint({
      gateway: {
        controlUi: {
          allowedOrigins: ['http://localhost:3000', 'file://'],
        },
      },
    })).toBe(true);
  });

  it('ignores unrelated openclaw config payloads', () => {
    expect(hasLegacyOpenClawConfigFootprint({
      gateway: {
        auth: {
          token: 'external-token',
        },
        controlUi: {
          allowedOrigins: ['https://example.com'],
        },
      },
    })).toBe(false);
  });
});
