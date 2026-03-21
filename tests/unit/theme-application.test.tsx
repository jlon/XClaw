import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('theme application', () => {
  it('keeps root theme class switching, platform tagging, and setup-first light fallback in App', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/App.tsx'), 'utf8');

    expect(source).toContain("root.classList.remove('light', 'dark')");
    expect(source).toContain("window.matchMedia('(prefers-color-scheme: dark)')");
    expect(source).toContain("root.dataset.platform = window.electron?.platform ?? 'unknown';");
    expect(source).toContain("const resolvedTheme = theme === 'system' && !setupComplete ? 'light' : theme;");
  });

  it('defines desktop theme tokens for both light and dark themes', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/styles/globals.css'), 'utf8');

    [
      '--surface-base',
      '--surface-elevated',
      '--surface-panel',
      '--chrome',
      '--chrome-strong',
      '--chrome-divider',
      '--border-subtle',
      '--border-strong',
      '--glow-brand',
      '--glow-focus',
      '--motion-fast',
      '--motion-base',
      '--motion-slow',
      '.app-shell-surface',
      '.app-panel-surface',
      '.app-field-surface',
    ].forEach((token) => {
      expect(source).toContain(token);
    });

    expect(source).not.toContain('--primary: 221.2 83.2% 53.3%;');
    expect(source).not.toContain('--primary: 217.2 91.2% 59.8%;');
    expect(source).toContain('color-scheme: light;');
    expect(source).toContain('color-scheme: dark;');
    expect(source).toContain('radial-gradient(circle at 84% 16%');
    expect(source).toContain('.app-setup-shell');
    expect(source).toContain('.app-setup-hero');
  });

  it('defaults new installs to the branded light theme instead of inheriting system mode', () => {
    const rendererSource = readFileSync(resolve(process.cwd(), 'src/stores/settings.ts'), 'utf8');
    const mainSource = readFileSync(resolve(process.cwd(), 'electron/utils/store.ts'), 'utf8');

    expect(rendererSource).toContain("theme: 'light' as Theme");
    expect(mainSource).toContain("theme: 'light',");
  });
});
