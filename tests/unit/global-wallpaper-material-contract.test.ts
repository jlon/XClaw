import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('global wallpaper material contract', () => {
  it('keeps the mac titlebar main surface on the shared shell chrome instead of a transparent seam', () => {
    const layoutSource = readFileSync(resolve(process.cwd(), 'src/components/layout/MainLayout.tsx'), 'utf8');
    const titleBarSource = readFileSync(resolve(process.cwd(), 'src/components/layout/TitleBar.tsx'), 'utf8');
    const chatToolbarSource = readFileSync(resolve(process.cwd(), 'src/pages/Chat/ChatToolbar.tsx'), 'utf8');
    const themeSource = readFileSync(resolve(process.cwd(), 'src/styles/globals.css'), 'utf8');

    expect(layoutSource).toContain('desktop-app-shell-material-layer');
    expect(layoutSource).not.toContain('desktop-app-shell-titlebar-backdrop');
    expect(layoutSource).not.toContain('desktop-app-shell-sidebar-backdrop');
    expect(titleBarSource).toContain('desktop-app-titlebar-main-surface app-sidebar-chrome-surface');
    expect(titleBarSource).not.toContain('window-drag-bar');
    expect(chatToolbarSource).toContain("'app-chat-toolbar-button no-drag app-titlebar-utility-surface rounded-md'");
    expect(themeSource).toContain('.desktop-app-shell-material-layer {');
    expect(themeSource).toContain('.desktop-app-shell .app-titlebar-utility-surface {');
  });

  it('keeps the chat composer on wallpaper-aware workspace material instead of a hardcoded opaque background', () => {
    const layoutSource = readFileSync(resolve(process.cwd(), 'src/components/layout/MainLayout.tsx'), 'utf8');
    const inputSource = readFileSync(resolve(process.cwd(), 'src/pages/Chat/ChatInput.tsx'), 'utf8');
    const themeSource = readFileSync(resolve(process.cwd(), 'src/styles/globals.css'), 'utf8');

    expect(layoutSource).toContain('--app-global-chat-composer-opacity');
    expect(inputSource).toContain('app-chat-composer-dock');
    expect(inputSource).not.toContain("border border-[hsl(var(--border-subtle)/0.68)] bg-[hsl(var(--surface-elevated)/0.985)]");
    expect(themeSource).toContain('--app-global-composer-opacity');
    expect(themeSource).toContain('--app-global-chat-composer-opacity');
    expect(themeSource).toContain('.desktop-app-shell .app-chat-composer-surface,');
    expect(themeSource).toContain('hsl(var(--surface-elevated) / calc(var(--app-global-chat-composer-opacity) + 0.12))');
    expect(themeSource).toContain('hsl(var(--surface-panel) / var(--app-global-chat-composer-opacity))');
    expect(themeSource).toContain('box-shadow:');
  });

  it('keeps wallpaper pages on a single workspace base layer instead of nested opaque stages', () => {
    const layoutSource = readFileSync(resolve(process.cwd(), 'src/components/layout/MainLayout.tsx'), 'utf8');
    const workspaceSource = readFileSync(resolve(process.cwd(), 'src/components/layout/WorkspacePage.tsx'), 'utf8');
    const chatSource = readFileSync(resolve(process.cwd(), 'src/pages/Chat/index.tsx'), 'utf8');
    const themeSource = readFileSync(resolve(process.cwd(), 'src/styles/globals.css'), 'utf8');

    expect(layoutSource).toContain('--app-global-chat-stage-opacity');
    expect(workspaceSource).toContain('workspace-page-frame desktop-workspace-frame app-page-stage');
    expect(workspaceSource).toContain('bg-transparent');
    expect(chatSource).toContain("app-chat-shell app-page-stage");
    expect(themeSource).toContain('.desktop-app-shell .app-page-stage {\n  background: transparent;\n}');
    expect(themeSource).toContain('.app-chat-shell {\n  background: transparent;\n}');
    expect(themeSource).toContain('.desktop-app-shell .app-chat-main-stage::before {');
    expect(themeSource).toContain('hsl(var(--surface-base) / var(--app-global-chat-stage-opacity))');
  });
});
