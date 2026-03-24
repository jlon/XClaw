import { describe, expect, it } from 'vitest';
import { resolveSetupPrimaryAction } from '@/components/setup/stage-utils';

const labels = {
  activate: 'Get Started',
  takeoverImport: 'Import and Continue',
  takeoverImportAndReview: 'Import and Review Providers',
  providerReview: 'Review Providers',
  reviewSummary: 'Review Summary',
  providerSubmit: 'Save and Continue',
  advance: 'Next',
};

describe('setup primary action model', () => {
  it('treats fresh provider configuration as a footer-owned submit when the form is ready but not yet saved', () => {
    expect(resolveSetupPrimaryAction({
      stage: 'provider',
      mode: 'fresh',
      providerConfigured: false,
      providerCanSubmit: true,
      labels,
    })).toEqual({
      intent: 'provider-submit',
      label: 'Save and Continue',
    });
  });

  it('falls back to a normal advance action after the provider has already been saved', () => {
    expect(resolveSetupPrimaryAction({
      stage: 'provider',
      mode: 'fresh',
      providerConfigured: true,
      providerCanSubmit: true,
      labels,
    })).toEqual({
      intent: 'advance',
      label: 'Next',
    });
  });

  it('keeps takeover import and final activation as distinct primary intents', () => {
    expect(resolveSetupPrimaryAction({
      stage: 'preparation',
      mode: 'takeover',
      takeoverImportComplete: false,
      labels,
    })).toEqual({
      intent: 'takeover-import',
      label: 'Import and Continue',
    });

    expect(resolveSetupPrimaryAction({
      stage: 'complete',
      phase: 'summary',
      mode: 'fresh',
      labels,
    })).toEqual({
      intent: 'activate',
      label: 'Get Started',
    });
  });
});
