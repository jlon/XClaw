import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { WorkspacePageFrame, WorkspacePageScrollArea, WorkspacePageShell } from '@/components/layout/WorkspacePage';

describe('workspace page layout', () => {
  it('keeps MainLayout on a single desktop shell container', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/components/layout/MainLayout.tsx'), 'utf8');

    expect(source).toContain('desktop-app-shell');
    expect(source).toContain('desktop-app-workspace');
    expect(source).toContain('desktop-app-shell-sidebar');
  });

  it('keeps preserved chat chrome wrappers stretched to the full shell height', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/components/layout/MainLayout.tsx'), 'utf8');

    expect(source).toContain('relative flex min-h-0 shrink-0 self-stretch');
    expect(source).toContain('desktop-app-chat-nav-shell flex h-full min-h-0');
  });

  it('uses semantic shell classes in Sidebar and avoids hardcoded panel colors', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/components/layout/Sidebar.tsx'), 'utf8');

    expect(source).toContain('desktop-app-sidebar');
    expect(source).toContain('desktop-app-sidebar-surface');
    expect(source).toContain('desktop-app-sidebar-rail');
    expect(source).not.toMatch(/bg-\[#/);
  });

  it('keeps title bar chrome scoped to platform modifiers instead of theme forks', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/components/layout/TitleBar.tsx'), 'utf8');

    expect(source).toContain('desktop-app-titlebar');
    expect(source).toContain('desktop-app-titlebar--mac');
    expect(source).toContain('desktop-app-titlebar--win');
    expect(source).not.toContain('border-b border-border/70');
  });

  it('keeps the title bar chrome line-free across workspace pages', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/styles/globals.css'), 'utf8');

    expect(source).toContain('.desktop-app-titlebar {');
    expect(source).toContain('box-shadow: none;');
  });

  it('keeps desktop shell chrome on theme tokens instead of hardcoded light fills', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/styles/globals.css'), 'utf8');
    const shellSource = source.match(/\.desktop-app-shell \{[\s\S]*?\.desktop-app-titlebar \{/u)?.[0] ?? '';

    expect(shellSource).toContain('.desktop-app-shell {');
    expect(shellSource).toContain('hsl(var(--chrome) / 0.98)');
    expect(shellSource).toContain('.desktop-app-shell-body {');
    expect(shellSource).toContain('hsl(var(--surface-base) / 0.98)');
    expect(shellSource).toContain('.desktop-app-shell-sidebar {');
    expect(shellSource).toContain('.desktop-app-chat-nav-shell {');
    expect(shellSource).toContain('hsl(var(--chrome-divider) / 0.82)');
    expect(shellSource).toContain('.desktop-app-workspace {');
    expect(shellSource).toContain('hsl(var(--surface-panel) / 0.965)');
    expect(shellSource).not.toContain('background: #f8f8f9;');
    expect(shellSource).not.toContain('background: #fafafa;');
  });

  it('marks workspace frame, shell, and scroll area with shared desktop classes', () => {
    render(
      <WorkspacePageFrame data-testid="frame">
        <WorkspacePageShell data-testid="shell" className="max-w-[1680px]">
          <WorkspacePageScrollArea data-testid="scroll" platform="win32">
            content
          </WorkspacePageScrollArea>
        </WorkspacePageShell>
      </WorkspacePageFrame>,
    );

    expect(screen.getByTestId('frame')).toHaveClass('workspace-page-frame', 'desktop-workspace-frame');
    expect(screen.getByTestId('shell')).toHaveClass('workspace-page-shell', 'desktop-workspace-shell', 'max-w-[1680px]');
    expect(screen.getByTestId('scroll')).toHaveClass('workspace-page-scroll', 'desktop-workspace-scroll', 'workspace-page-scroll-win');
  });
});
