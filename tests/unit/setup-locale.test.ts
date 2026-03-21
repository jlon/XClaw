import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const readSetupLocale = <T,>(language: 'zh' | 'en' | 'ja') => JSON.parse(
  readFileSync(resolve(process.cwd(), `src/i18n/locales/${language}/setup.json`), 'utf8'),
) as T;

interface SetupLocaleShape {
  wizard: {
    rail: {
      title: string;
      aria: string;
    };
    stages: {
      start: { label: string; description: string };
      preparation: { label: string; description: string };
      provider: { label: string; description: string };
      complete: { label: string; description: string; applyingDescription: string };
    };
    footer: {
      start: { title: string; body: string; primary: string; secondary: string };
      applying: { title: string; body: string };
    };
    exitDialog: {
      title: string;
      message: string;
      applyingTitle: string;
      applyingMessage: string;
      confirm: string;
      cancel: string;
    };
    loading: {
      description: string;
    };
    errorState: {
      title: string;
      retry: string;
    };
  };
  runtime: {
    advanced: {
      toggle: string;
      hide: string;
    };
  };
}

describe('setup locale coverage', () => {
  it('defines wizard shell and advanced-preparation copy in zh/en/ja', () => {
    const zhSetup = readSetupLocale<SetupLocaleShape>('zh');
    const enSetup = readSetupLocale<SetupLocaleShape>('en');
    const jaSetup = readSetupLocale<SetupLocaleShape>('ja');

    for (const locale of [zhSetup, enSetup, jaSetup]) {
      expect(locale.wizard.rail.title).toBeTruthy();
      expect(locale.wizard.rail.aria).toBeTruthy();
      expect(locale.wizard.stages.start.label).toBeTruthy();
      expect(locale.wizard.stages.complete.applyingDescription).toBeTruthy();
      expect(locale.wizard.footer.start.primary).toBeTruthy();
      expect(locale.wizard.footer.applying.body).toBeTruthy();
      expect(locale.wizard.exitDialog.applyingTitle).toBeTruthy();
      expect(locale.wizard.loading.description).toBeTruthy();
      expect(locale.wizard.errorState.retry).toBeTruthy();
      expect(locale.runtime.advanced.toggle).toBeTruthy();
      expect(locale.runtime.advanced.hide).toBeTruthy();
    }
  });
});
