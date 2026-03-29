import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { WorkspacePageFrame } from '@/components/layout/WorkspacePage';

const settingsState = {
  sidebarWidth: 250,
  initialized: true,
  setupComplete: true,
  globalWallpaperEnabled: true,
  globalWallpaperOpacity: 0.44,
  globalWallpaperAssetKey: 'managed.png',
  syncGlobalWallpaperState: vi.fn(),
  setSidebarWidth: vi.fn(),
  sidebarCollapsed: false,
  chatFocusMode: false,
};

vi.mock('@/stores/settings', () => ({
  useSettingsStore: (selector: (state: typeof settingsState) => unknown) => selector(settingsState),
  SIDEBAR_RAIL_WIDTH: 44,
  SIDEBAR_WIDTH_MIN: 200,
  SIDEBAR_WIDTH_MAX: 360,
}));

vi.mock('@/components/layout/ChatSessionsPane', () => ({
  ChatSessionsPane: () => <div data-testid="chat-sessions-pane" />,
}));

vi.mock('@/components/layout/Sidebar', () => ({
  Sidebar: ({ className }: { className?: string }) => <div className={className} data-testid="global-sidebar" />,
}));

vi.mock('@/components/layout/TitleBar', () => ({
  TitleBar: () => <div data-testid="titlebar" />,
}));

vi.mock('@/pages/Studio', () => ({
  Studio: () => <div data-testid="studio-surface" />,
}));

vi.mock('@/lib/studio', () => ({
  isChatRoutePath: (pathname: string) => pathname === '/',
  isChatSurfaceRoutePath: (pathname: string) => pathname === '/',
  isStudioRoutePath: (pathname: string) => pathname.startsWith('/studio'),
  saveLastChatRoute: vi.fn(),
}));

vi.mock('@/lib/host-api', () => ({
  getHostApiBase: () => 'http://127.0.0.1:3210',
}));

describe('global wallpaper layout', () => {
  it('adds a whole-window wallpaper layer when wallpaper mode is enabled', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/models']}>
        <Routes>
          <Route element={<MainLayout />}>
            <Route
              path="/models"
              element={(
                <WorkspacePageFrame>
                  <div>Models body</div>
                </WorkspacePageFrame>
              )}
            />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    const shell = container.querySelector('.desktop-app-shell');

    expect(shell).toHaveClass('desktop-app-shell--wallpaper');
    expect(shell).toHaveStyle({
      '--app-global-wallpaper-opacity': '0.44',
      '--app-global-wallpaper-image': 'url("http://127.0.0.1:3210/api/app/global-wallpaper/asset?v=managed.png")',
      '--app-global-shell-glass-opacity': '0.36',
      '--app-global-workspace-opacity': '0.16',
      '--app-global-composer-opacity': '0.22',
      '--app-global-pane-opacity': '0.45',
    });
    expect(container.querySelector('.workspace-page-frame')).toHaveClass('app-page-stage');
    expect(container.querySelector('.desktop-app-global-wallpaper-layer')).toBeInTheDocument();
    expect(container.querySelector('.desktop-app-global-wallpaper-scrim')).toBeInTheDocument();
    expect(container.querySelector('.desktop-app-shell-material-layer')).toBeInTheDocument();
    expect(container.querySelector('.desktop-app-shell-titlebar-backdrop')).not.toBeInTheDocument();
    expect(container.querySelector('.desktop-app-shell-sidebar-backdrop')).not.toBeInTheDocument();
  });
});
