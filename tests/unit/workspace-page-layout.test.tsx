import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { WorkspacePageFrame, WorkspacePageScrollArea, WorkspacePageShell } from '@/components/layout/WorkspacePage';

describe('workspace page layout', () => {
  it('provides shared shell and platform-aware scroll area styles', () => {
    render(
      <WorkspacePageFrame data-testid="frame">
        <WorkspacePageShell data-testid="shell" className="max-w-[1680px]">
          <WorkspacePageScrollArea data-testid="scroll" platform="win32">
            content
          </WorkspacePageScrollArea>
        </WorkspacePageShell>
      </WorkspacePageFrame>,
    );

    expect(screen.getByTestId('frame').className).toContain('workspace-page-frame');
    expect(screen.getByTestId('shell').className).toContain('workspace-page-shell');
    expect(screen.getByTestId('shell').className).toContain('max-w-[1680px]');
    expect(screen.getByTestId('scroll').className).toContain('workspace-page-scroll');
    expect(screen.getByTestId('scroll').className).toContain('workspace-page-scroll-win');
  });

  it('moves the major workbench pages onto the shared workspace shell', () => {
    const pageFiles = [
      'src/pages/Agents/index.tsx',
      'src/pages/Channels/index.tsx',
      'src/pages/Cron/index.tsx',
      'src/pages/Models/index.tsx',
      'src/pages/Settings/index.tsx',
      'src/pages/Skills/index.tsx',
    ];

    for (const relativePath of pageFiles) {
      const source = readFileSync(resolve(process.cwd(), relativePath), 'utf8');
      expect(source).toContain('WorkspacePage');
      expect(source).not.toContain('max-w-5xl mx-auto flex flex-col h-full p-10 pt-16');
    }
  });

  it('keeps global main layout on container-managed overflow instead of adding extra page gutters', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/components/layout/MainLayout.tsx'), 'utf8');
    expect(source).toContain('<main className="flex-1 min-w-0 overflow-hidden');
    expect(source).not.toContain('overflow-auto px-4 py-5 xl:px-5');
  });
});
