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
    expect(source).toContain('desktop-app-shell-resize-handle');
    expect(source).toContain('desktop-app-workspace-tint');
    expect(source).toContain('--desktop-sidebar-width');
  });

  it('keeps preserved chat chrome wrappers stretched to the full shell height', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/components/layout/MainLayout.tsx'), 'utf8');

    expect(source).toContain('relative flex min-h-0 shrink-0 self-stretch');
    expect(source).toContain('desktop-app-chat-nav-shell app-sidebar-chrome-surface absolute inset-y-0 left-0 z-20 flex h-full min-h-0');
  });

  it('uses semantic shell classes in Sidebar and avoids hardcoded panel colors', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/components/layout/Sidebar.tsx'), 'utf8');

    expect(source).toContain('desktop-app-sidebar');
    expect(source).toContain('desktop-app-sidebar-surface');
    expect(source).toContain('app-sidebar-shell-divider');
    expect(source).toContain('app-sidebar-utility-divider');
    expect(source).toContain('desktop-app-sidebar-rail');
    expect(source).not.toMatch(/bg-\[#/);
    expect(source).not.toContain('border-r border-border/55');
    expect(source).not.toContain('border-t border-border/55');
  });

  it('keeps title bar chrome scoped to platform modifiers instead of theme forks', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/components/layout/TitleBar.tsx'), 'utf8');

    expect(source).toContain('desktop-app-titlebar');
    expect(source).toContain('desktop-app-titlebar--mac');
    expect(source).toContain('desktop-app-titlebar--win');
    expect(source).toContain('chat-titlebar-control-rail');
    expect(source).toContain('workspace-titlebar-control-rail');
    expect(source).toContain('desktop-app-titlebar-sidebar-slot desktop-app-titlebar-sidebar-slot--chat');
    expect(source).toContain('desktop-app-titlebar-sidebar-slot desktop-app-titlebar-sidebar-slot--workspace');
    expect(source).toContain('left-[80px]');
    expect(source).toContain('drag-region');
    expect(source).toContain('no-drag');
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
    expect(shellSource).toContain('.desktop-app-shell-material-layer {');
    expect(shellSource).toContain('.desktop-app-shell-body {');
    expect(shellSource).toContain('background: transparent;');
    expect(shellSource).toContain('.desktop-app-shell-sidebar {');
    expect(shellSource).toContain('.desktop-app-chat-nav-shell {');
    expect(shellSource).toContain('hsl(var(--chrome-divider) / 0.48)');
    expect(shellSource).toContain('.desktop-app-workspace {');
    expect(shellSource).toContain('background: transparent;');
    expect(source).toContain('.desktop-app-shell-resize-handle {');
    expect(source).toContain('.desktop-app-shell-resize-handle:hover::after,');
    expect(source).toContain("data-sidebar-resizing='true']");
    expect(source).toContain('.desktop-app-workspace-tint {');
    expect(shellSource).not.toContain('background: #f8f8f9;');
    expect(shellSource).not.toContain('background: #fafafa;');
  });

  it('lets the mac titlebar own the upper-left workspace corner to avoid seam leaks', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/styles/globals.css'), 'utf8');
    const macWorkspaceSource = source.match(/html\[data-platform="darwin"\] \.mac-workspace-main \{[\s\S]*?\}/u)?.[0] ?? '';

    expect(macWorkspaceSource).toContain('border-top-left-radius: 0;');
    expect(macWorkspaceSource).toContain('border-bottom-left-radius: 12px;');
    expect(macWorkspaceSource).toContain('box-shadow: none;');
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
    expect(screen.getByTestId('shell')).not.toHaveClass('mx-auto');
    expect(screen.getByTestId('shell')).not.toHaveClass('max-w-[1560px]');
    expect(screen.getByTestId('scroll')).toHaveClass('workspace-page-scroll', 'desktop-workspace-scroll', 'workspace-page-scroll-win');
  });

  it('keeps the workspace shell free of centered web-page sizing by default', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/components/layout/WorkspacePage.tsx'), 'utf8');

    expect(source).toContain('workspace-page-shell desktop-workspace-shell');
    expect(source).not.toContain('mx-auto flex h-full w-full max-w-[1560px]');
  });
});
