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
    expect(source).toContain('--background: 0 0% 99.1%;');
    expect(source).toContain('--surface-base: 0 0% 99.65%;');
    expect(source).not.toContain('--background: 30 20% 94.8%;');
    expect(source).not.toContain('radial-gradient(circle at 84% 16%');
    expect(source).toContain('background-image: none;');
    expect(source).toContain('.desktop-app-chat-nav-shell');
    expect(source).toContain('.desktop-app-titlebar--mac');
    expect(source).toContain('.app-setup-shell');
    expect(source).toContain('.app-setup-hero');
  });

  it('defaults new installs to the branded light theme instead of inheriting system mode', () => {
    const rendererSource = readFileSync(resolve(process.cwd(), 'src/stores/settings.ts'), 'utf8');
    const mainSource = readFileSync(resolve(process.cwd(), 'electron/utils/store.ts'), 'utf8');

    expect(rendererSource).toContain("theme: 'light' as Theme");
    expect(mainSource).toContain("theme: 'light',");
  });

  it('uses the shared system font stack and keeps serif display overrides out of desktop pages', () => {
    const themeSource = readFileSync(resolve(process.cwd(), 'src/styles/globals.css'), 'utf8');
    const pageSources = [
      'src/pages/Channels/index.tsx',
      'src/pages/Agents/index.tsx',
      'src/pages/Skills/index.tsx',
      'src/pages/Cron/index.tsx',
      'src/components/channels/ChannelConfigModal.tsx',
      'src/components/settings/ProvidersSettings.tsx',
    ].map((relativePath) => readFileSync(resolve(process.cwd(), relativePath), 'utf8')).join('\n');

    expect(themeSource).toContain('--font-ui: -apple-system, BlinkMacSystemFont, "SF Pro Text", "PingFang SC", "Hiragino Sans GB", "Segoe UI", "Microsoft YaHei UI", "Microsoft YaHei", sans-serif;');
    expect(themeSource).toContain('--font-display: -apple-system, BlinkMacSystemFont, "SF Pro Display", "PingFang SC", "Hiragino Sans GB", "Segoe UI", "Microsoft YaHei UI", "Microsoft YaHei", sans-serif;');
    expect(themeSource).toContain('--font-sidebar: -apple-system, BlinkMacSystemFont, "SF Pro Text", "PingFang SC", "Hiragino Sans GB", "Segoe UI", "Microsoft YaHei UI", "Microsoft YaHei", sans-serif;');
    expect(themeSource).toContain('font-family: var(--font-ui);');
    expect(pageSources).not.toContain('font-serif');
    expect(pageSources).not.toContain('fontFamily:');
  });
});
