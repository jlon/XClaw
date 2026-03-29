import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Sidebar } from '@/components/layout/Sidebar';
import { TitleBar } from '@/components/layout/TitleBar';

const settingsState = {
  sidebarCollapsed: false,
  sidebarWidth: 250,
  chatFocusMode: false,
  setSidebarCollapsed: vi.fn(),
};

vi.mock('@/stores/settings', () => ({
  useSettingsStore: (selector: (state: typeof settingsState) => unknown) => selector(settingsState),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      if (key === 'sidebar.chat' || key === 'common:sidebar.chat') return 'Chat';
      if (key === 'sidebar.models' || key === 'common:sidebar.models') return 'Models';
      if (key === 'sidebar.agents' || key === 'common:sidebar.agents') return 'Agents';
      if (key === 'sidebar.channels' || key === 'common:sidebar.channels') return 'Channels';
      if (key === 'sidebar.skills' || key === 'common:sidebar.skills') return 'Skills';
      if (key === 'sidebar.cronTasks' || key === 'common:sidebar.cronTasks') return 'Cron Tasks';
      if (key === 'sidebar.settings' || key === 'common:sidebar.settings') return 'Settings';
      return key;
    },
  }),
}));

vi.mock('@/lib/studio', () => ({
  isChatRoutePath: (pathname: string) => pathname === '/',
  isStudioRoutePath: (pathname: string) => pathname.startsWith('/studio'),
  resolveLastChatRoute: () => '/',
}));

vi.mock('@/components/layout/ChatSessionHeaderControls', () => ({
  ChatSessionHeaderControls: () => <div data-testid="chat-session-header-controls" />,
}));

vi.mock('@/components/layout/WorkspaceSidebarToggleButton', () => ({
  WorkspaceSidebarToggleButton: (props: React.ButtonHTMLAttributes<HTMLButtonElement>) => <button type="button" {...props} />,
}));

vi.mock('@/components/layout/GlobalTitleBarUtilities', () => ({
  GlobalTitleBarUtilities: () => <div data-testid="global-titlebar-utilities" />,
}));

vi.mock('@/components/layout/AppBrandLockup', () => ({
  AppBrandLockup: () => <div data-testid="app-brand-lockup" />,
}));

vi.mock('@/pages/Chat/ChatToolbar', () => ({
  ChatToolbar: () => <div data-testid="chat-toolbar" />,
}));

vi.mock('@/lib/api-client', () => ({
  invokeIpc: vi.fn(),
}));

describe('sidebar chrome surfaces', () => {
  it('marks the sidebar shell and active settings link with shared wallpaper-aware classes', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/settings']}>
        <Sidebar />
      </MemoryRouter>,
    );

    expect(container.querySelector('aside.desktop-app-sidebar')).toHaveClass('app-sidebar-chrome-surface', 'app-sidebar-shell-divider');
    expect(container.querySelector('.app-sidebar-utility-divider')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Settings' })).toHaveClass('app-sidebar-nav-link--active');
  });

  it('marks the mac workspace titlebar strip with the shared sidebar chrome surface class', () => {
    window.electron = { platform: 'darwin', ipcRenderer: {} } as never;

    const { container } = render(<TitleBar pathname="/settings" />);

    expect(container.querySelector('.desktop-app-titlebar-sidebar-slot--workspace')).toHaveClass('app-sidebar-chrome-surface');
    expect(container.querySelector('.desktop-app-titlebar-main-surface')).toHaveClass('app-sidebar-chrome-surface');
  });
});
