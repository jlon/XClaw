import { useEffect } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { Sidebar } from '@/components/layout/Sidebar';
import { MainLayout } from '@/components/layout/MainLayout';

const {
  settingsState,
  chatState,
  gatewayState,
  agentsState,
  invokeIpcMock,
  chatMountSpy,
  chatUnmountSpy,
  studioMountSpy,
  studioUnmountSpy,
} = vi.hoisted(() => ({
  settingsState: {
    sidebarCollapsed: false,
    chatFocusMode: false,
    setSidebarCollapsed: vi.fn(),
    setChatFocusMode: vi.fn(),
  },
  chatState: {
    sessions: [] as Array<Record<string, unknown>>,
    currentSessionKey: 'agent:main:thread-1',
    currentAgentId: 'main',
    sessionLabels: {} as Record<string, string>,
    sessionLastActivity: {} as Record<string, number>,
    switchSession: vi.fn(),
    newSession: vi.fn(),
    deleteSession: vi.fn(),
    loadSessions: vi.fn(),
    loadHistory: vi.fn(),
    messages: [] as Array<Record<string, unknown>>,
  },
  gatewayState: {
    status: { state: 'running', port: 18789 },
  },
  agentsState: {
    agents: [] as Array<Record<string, unknown>>,
    fetchAgents: vi.fn(),
  },
  invokeIpcMock: vi.fn(),
  chatMountSpy: vi.fn(),
  chatUnmountSpy: vi.fn(),
  studioMountSpy: vi.fn(),
  studioUnmountSpy: vi.fn(),
}));

vi.mock('@/stores/settings', () => ({
  useSettingsStore: (selector: (state: typeof settingsState) => unknown) => selector(settingsState),
}));

vi.mock('@/stores/chat', () => ({
  useChatStore: Object.assign(
    (selector: (state: typeof chatState) => unknown) => selector(chatState),
    {
      getState: () => chatState,
    },
  ),
}));

vi.mock('@/stores/gateway', () => ({
  useGatewayStore: (selector: (state: typeof gatewayState) => unknown) => selector(gatewayState),
}));

vi.mock('@/stores/agents', () => ({
  useAgentsStore: (selector: (state: typeof agentsState) => unknown) => selector(agentsState),
}));

vi.mock('@/components/ui/confirm-dialog', () => ({
  ConfirmDialog: () => null,
}));

vi.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/lib/host-api', () => ({
  hostApiFetch: vi.fn(),
}));

vi.mock('@/lib/api-client', () => ({
  invokeIpc: (...args: unknown[]) => invokeIpcMock(...args),
}));

vi.mock('@/pages/Studio', () => ({
  Studio: () => {
    useEffect(() => {
      studioMountSpy();
      return () => {
        studioUnmountSpy();
      };
    }, []);

    return <div data-testid="studio-surface-probe">Studio body</div>;
  },
}));

function translate(key: string, vars?: Record<string, unknown>): string {
  switch (key) {
    case 'sidebar.chat':
      return 'Chat';
    case 'sidebar.newChat':
      return 'New Chat';
    case 'sidebar.models':
    case 'common:sidebar.models':
      return 'Models';
    case 'sidebar.agents':
    case 'common:sidebar.agents':
      return 'Agents';
    case 'sidebar.channels':
    case 'common:sidebar.channels':
      return 'Channels';
    case 'sidebar.skills':
    case 'common:sidebar.skills':
      return 'Skills';
    case 'sidebar.cronTasks':
    case 'common:sidebar.cronTasks':
      return 'Cron Tasks';
    case 'sidebar.settings':
    case 'common:sidebar.settings':
      return 'Settings';
    case 'sidebar.openClawPage':
    case 'common:sidebar.openClawPage':
      return 'OpenClaw Page';
    case 'actions.confirm':
      return 'Confirm';
    case 'actions.delete':
      return 'Delete';
    case 'actions.cancel':
      return 'Cancel';
    case 'sidebar.deleteSessionConfirm':
      return `Delete ${String(vars?.label ?? '')}`;
    case 'chat:historyBuckets.today':
      return 'Today';
    case 'chat:historyBuckets.withinWeek':
      return 'This Week';
    case 'chat:historyBuckets.withinMonth':
      return 'This Month';
    case 'chat:historyBuckets.older':
      return 'Earlier';
    case 'chat:sessionPane.searchLabel':
      return 'Search chats';
    case 'chat:sessionPane.searchPlaceholder':
      return 'Search';
    case 'chat:sessionPane.emptySearch':
      return 'No matching chats';
    case 'chat:sessionPane.empty':
      return 'No chats yet';
    case 'chat:sessionPane.emptyHint':
      return 'Start a new conversation and it will show up here.';
    case 'chat:sessionPane.newAgentTitle':
      return 'Start with agent';
    case 'chat:sessionPane.currentAgent':
      return 'Current';
    case 'toolbar.hideSessionPane':
    case 'chat:toolbar.hideSessionPane':
      return 'Hide sessions';
    case 'toolbar.showSessionPane':
    case 'chat:toolbar.showSessionPane':
      return 'Show sessions';
    case 'toolbar.office':
      return 'Studio';
    case 'toolbar.backToChat':
      return 'Chat';
    case 'common:sidebar.newChat':
      return 'New Chat';
    default:
      return key;
  }
}

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: translate,
  }),
}));

describe('chat layout', () => {
  beforeEach(() => {
    window.electron.platform = 'darwin';
    settingsState.sidebarCollapsed = false;
    settingsState.chatFocusMode = false;
    settingsState.setSidebarCollapsed = vi.fn((value: boolean) => {
      settingsState.sidebarCollapsed = value;
    });
    settingsState.setChatFocusMode = vi.fn((value: boolean) => {
      settingsState.chatFocusMode = value;
    });
    chatState.sessions = [
      {
        key: 'agent:main:thread-1',
        displayName: 'Design review',
      },
      {
        key: 'agent:writer:thread-2',
        displayName: 'Launch draft',
      },
    ];
    chatState.currentSessionKey = 'agent:main:thread-1';
    chatState.currentAgentId = 'main';
    chatState.sessionLabels = {
      'agent:main:thread-1': 'Design review',
      'agent:writer:thread-2': 'Launch draft',
    };
    chatState.sessionLastActivity = {
      'agent:main:thread-1': Date.now(),
      'agent:writer:thread-2': Date.now() - 1000,
    };
    chatState.switchSession = vi.fn();
    chatState.newSession = vi.fn();
    chatState.deleteSession = vi.fn();
    chatState.loadSessions = vi.fn();
    chatState.loadHistory = vi.fn();
    chatState.messages = [];
    gatewayState.status = { state: 'running', port: 18789 };
    agentsState.agents = [
      {
        id: 'main',
        name: 'Main',
      },
      {
        id: 'writer',
        name: 'Writer',
      },
    ];
    agentsState.fetchAgents = vi.fn();
    invokeIpcMock.mockReset();
    chatMountSpy.mockReset();
    chatUnmountSpy.mockReset();
    studioMountSpy.mockReset();
    studioUnmountSpy.mockReset();
    invokeIpcMock.mockImplementation(async (channel: unknown) => {
      if (channel === 'window:isMaximized') {
        return false;
      }
      return undefined;
    });
  });

  it('shows a dedicated chats pane on the chat route', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route element={<MainLayout />}>
            <Route path="/" element={<div>Chat body</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    const brandLockup = screen.getByTestId('chat-sidebar-brand-lockup');
    const searchTrigger = screen.getByRole('button', { name: 'Search chats' });
    const brandMark = within(brandLockup).getByAltText('XClaw');

    expect(screen.getByTestId('chat-sidebar-brand-wordmark')).toBeInTheDocument();
    expect(brandLockup.compareDocumentPosition(searchTrigger) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(brandMark).toHaveClass('app-brand-mark');
    expect(brandMark).not.toHaveClass('sidebar-brand-mark');
    expect(screen.getByText('Design review')).toBeInTheDocument();
    expect(screen.getByText('Launch draft')).toBeInTheDocument();
    const designReviewRow = screen.getByRole('button', { name: 'Design review' });
    expect(designReviewRow).toBeInTheDocument();
    expect(designReviewRow.querySelector('img')).not.toBeNull();
    expect(screen.queryByText('Main')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Search chats' })).toBeInTheDocument();
    expect(screen.getByTestId('chat-titlebar-session-slot')).toHaveClass('w-[250px]');
    expect(screen.getByTestId('chat-titlebar-session-slot')).toHaveClass('h-full');
    expect(screen.getByTestId('chat-titlebar-session-slot')).toHaveClass('justify-end');
    expect(screen.getByTestId('chat-session-header-controls-titlebar')).toHaveClass('h-full');
    expect(screen.queryByTestId('chat-session-header-controls-pane')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Hide sessions' })).toHaveClass('app-desktop-sidebar-toggle', 'h-6', 'w-6', 'p-0', 'leading-none');
    expect(screen.getByTestId('chat-new-chat-titlebar')).toHaveClass('h-6', 'w-6', 'p-0', 'leading-none');
    expect(within(screen.getByTestId('chat-session-header-controls-titlebar')).getByTestId('qclaw-session-toggle-icon')).toBeInTheDocument();
    expect(within(screen.getByTestId('chat-session-header-controls-titlebar')).getByTestId('qclaw-new-chat-icon')).toBeInTheDocument();
    expect(within(screen.getByTestId('chat-session-header-controls-titlebar')).getByTestId('qclaw-session-toggle-icon')).toHaveClass('block');
    expect(within(screen.getByTestId('chat-session-header-controls-titlebar')).getByTestId('qclaw-new-chat-icon')).toHaveClass('block');
    expect(screen.getByRole('button', { name: 'chat:sessionPane.workspaceLauncher' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Settings' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Expand sidebar' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Chat' })).not.toBeInTheDocument();
    expect(screen.getByTestId('chat-sessions-scroll-area')).toHaveClass('subtle-scrollbar');
    expect(screen.getByTestId('chat-sessions-scroll-area')).not.toHaveClass('subtle-scrollbar-win');
    expect(screen.queryByText(/\d{1,2}:\d{2}/)).not.toBeInTheDocument();
  });

  it('keeps the studio surface mounted while toggling between chat and studio', () => {
    render(
      <MemoryRouter initialEntries={['/studio']}>
        <Routes>
          <Route element={<MainLayout />}>
            <Route path="/" element={<div>Chat body</div>} />
            <Route path="/studio/*" element={<div>Studio route outlet</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(studioMountSpy).toHaveBeenCalledTimes(1);
    expect(studioUnmountSpy).not.toHaveBeenCalled();

    fireEvent.click(screen.getByLabelText('Chat'));

    expect(screen.getByText('Chat body')).toBeInTheDocument();
    expect(studioUnmountSpy).not.toHaveBeenCalled();

    fireEvent.click(screen.getByLabelText('Studio'));

    expect(screen.getByTestId('studio-surface-probe')).toBeInTheDocument();
    expect(studioMountSpy).toHaveBeenCalledTimes(1);
    expect(studioUnmountSpy).not.toHaveBeenCalled();
  });

  it('keeps the chat surface mounted and avoids reloading chat chrome while toggling with studio', () => {
    function ChatProbe() {
      useEffect(() => {
        chatMountSpy();
        return () => {
          chatUnmountSpy();
        };
      }, []);

      return <div data-testid="chat-surface-probe">Chat body</div>;
    }

    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route element={<MainLayout />}>
            <Route path="/" element={<ChatProbe />} />
            <Route path="/studio/*" element={<div>Studio route outlet</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(chatMountSpy).toHaveBeenCalledTimes(1);
    expect(chatUnmountSpy).not.toHaveBeenCalled();
    expect(chatState.loadSessions).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByLabelText('Studio'));

    expect(chatUnmountSpy).not.toHaveBeenCalled();

    fireEvent.click(screen.getByLabelText('Chat'));

    expect(screen.getByTestId('chat-surface-probe')).toBeInTheDocument();
    expect(chatMountSpy).toHaveBeenCalledTimes(1);
    expect(chatUnmountSpy).not.toHaveBeenCalled();
    expect(chatState.loadSessions).toHaveBeenCalledTimes(1);
  });

  it('applies low-saturation theme tones to chat session pane icons without tinting the labels', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route element={<MainLayout />}>
            <Route path="/" element={<div>Chat body</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByRole('button', { name: 'Search chats' }).querySelector('.app-chat-session-toned-icon--search')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'chat:sessionPane.workspaceLauncher' }).querySelector('.app-chat-session-toned-icon--workspace')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Settings' }).querySelector('.app-chat-session-toned-icon--settings')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'chat:sessionPane.workspaceLauncher' })).not.toHaveClass('text-[#b48745]');
    expect(screen.getByTestId('chat-session-header-controls-titlebar')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'chat:sessionPane.workspaceLauncher' }));

    expect(screen.getByRole('button', { name: 'Models' }).querySelector('.app-chat-session-toned-icon--models')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Agents' }).querySelector('.app-chat-session-toned-icon--agents')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Channels' }).querySelector('.app-chat-session-toned-icon--channels')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Skills' }).querySelector('.app-chat-session-toned-icon--skills')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Cron Tasks' }).querySelector('.app-chat-session-toned-icon--cron')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'OpenClaw Page' }).querySelector('.app-chat-session-toned-icon--terminal')).not.toBeNull();
  });

  it('hides the chat sessions pane when chat focus mode is active', () => {
    settingsState.chatFocusMode = true;

    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route element={<MainLayout />}>
            <Route path="/" element={<div>Chat body</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText('Design review')).not.toBeVisible();
    expect(screen.getByTestId('chat-sessions-scroll-area')).not.toBeVisible();
    expect(screen.getByTestId('chat-titlebar-session-slot')).not.toHaveClass('w-[250px]');
    expect(screen.getByTestId('chat-titlebar-session-slot')).toHaveClass('h-full');
    expect(screen.getByTestId('chat-titlebar-session-slot')).toHaveClass('justify-start');
    expect(screen.getByTestId('chat-session-header-controls-titlebar')).toHaveClass('h-full');
    expect(within(screen.getByTestId('chat-session-header-controls-titlebar')).getByTestId('qclaw-session-toggle-icon')).toBeInTheDocument();
    expect(within(screen.getByTestId('chat-session-header-controls-titlebar')).getByTestId('qclaw-new-chat-icon')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Show sessions' })).toHaveClass('app-desktop-sidebar-toggle', 'h-6', 'w-6', 'p-0', 'leading-none');
    expect(screen.getByText('Chat body')).toBeInTheDocument();
  });

  it('toggles chat focus mode from the titlebar session controls', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route element={<MainLayout />}>
            <Route path="/" element={<div>Chat body</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Hide sessions' }));

    expect(settingsState.setChatFocusMode).toHaveBeenCalledWith(true);
  });

  it('only shows an inline agent suffix when duplicate labels need disambiguation', () => {
    chatState.sessions = [
      {
        key: 'agent:main:thread-1',
        displayName: 'Weekly sync',
      },
      {
        key: 'agent:writer:thread-2',
        displayName: 'Weekly sync',
      },
    ];
    chatState.sessionLabels = {
      'agent:main:thread-1': 'Weekly sync',
      'agent:writer:thread-2': 'Weekly sync',
    };
    chatState.sessionLastActivity = {
      'agent:main:thread-1': Date.now(),
      'agent:writer:thread-2': Date.now() - 1000,
    };

    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route element={<MainLayout />}>
            <Route path="/" element={<div>Chat body</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByRole('button', { name: 'Weekly sync Main' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Weekly sync Writer' })).toBeInTheDocument();
  });

  it('treats bare main sessions as untitled conversations instead of agent rows', () => {
    chatState.sessions = [
      {
        key: 'agent:main:main',
        displayName: 'Main',
      },
      {
        key: 'agent:writer:session-2',
        displayName: 'Launch draft',
      },
    ];
    chatState.sessionLabels = {
      'agent:writer:session-2': 'Launch draft',
    };
    chatState.sessionLastActivity = {
      'agent:writer:session-2': Date.now(),
    };
    agentsState.agents = [
      { id: 'main', name: 'Main Agent' },
      { id: 'writer', name: 'Writer' },
    ];

    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route element={<MainLayout />}>
            <Route path="/" element={<div>Chat body</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.queryByRole('button', { name: 'Main Agent' })).not.toBeInTheDocument();
    expect(screen.queryByText('Main')).not.toBeInTheDocument();
    expect(screen.getByText('Launch draft')).toBeInTheDocument();
  });

  it('uses a single chat sidebar instead of rendering the global rail on chat routes', async () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route element={<MainLayout />}>
            <Route path="/" element={<div>Chat body</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.queryByRole('link', { name: 'Chat' })).not.toBeInTheDocument();
    expect(screen.getByTestId('sidebar-brand-wordmark')).not.toBeVisible();
    expect(screen.getByRole('button', { name: 'chat:sessionPane.workspaceLauncher' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Settings' })).toBeInTheDocument();
  });

  it('opens an agent chooser from the titlebar new chat button when multiple agents exist', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route element={<MainLayout />}>
            <Route path="/" element={<div>Chat body</div>} />
            <Route path="/new/:agentId" element={<div data-testid="new-route">New route</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByTestId('chat-new-chat-titlebar'));

    expect(screen.getByText('Start with agent')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'MainCurrent' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Writer' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Writer' }));

    expect(screen.getByTestId('new-route')).toBeInTheDocument();
  });

  it('keeps the global sidebar free of session rows', () => {
    render(
      <MemoryRouter initialEntries={['/models']}>
        <Sidebar />
      </MemoryRouter>,
    );

    expect(screen.queryByText('Design review')).not.toBeInTheDocument();
  });

  it('uses the shared titlebar sidebar toggle on workspace routes', () => {
    render(
      <MemoryRouter initialEntries={['/channels']}>
        <Routes>
          <Route element={<MainLayout />}>
            <Route path="/channels" element={<div>Channels body</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByTestId('workspace-titlebar-sidebar-slot')).toHaveClass('w-56', 'justify-end');
    expect(screen.getByTestId('workspace-sidebar-toggle-titlebar')).toHaveClass('app-desktop-sidebar-toggle');
    expect(screen.queryByTestId('workspace-sidebar-toggle-inline')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Collapse sidebar' }));

    expect(settingsState.setSidebarCollapsed).toHaveBeenCalledWith(true);
  });

  it('keeps the mac workspace toggle clear of traffic lights when the sidebar is collapsed', () => {
    settingsState.sidebarCollapsed = true;

    render(
      <MemoryRouter initialEntries={['/channels']}>
        <Routes>
          <Route element={<MainLayout />}>
            <Route path="/channels" element={<div>Channels body</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByTestId('workspace-titlebar-sidebar-slot')).not.toHaveClass('w-11');
    expect(screen.getByTestId('workspace-titlebar-sidebar-slot')).toHaveClass('justify-start', 'pl-24');
    expect(screen.getByTestId('workspace-sidebar-toggle-titlebar')).toHaveClass('app-desktop-sidebar-toggle');
  });

  it('keeps the Windows workspace toggle aligned to the expanded sidebar width', async () => {
    window.electron.platform = 'win32';

    await act(async () => {
      render(
        <MemoryRouter initialEntries={['/channels']}>
          <Routes>
            <Route element={<MainLayout />}>
              <Route path="/channels" element={<div>Channels body</div>} />
            </Route>
          </Routes>
        </MemoryRouter>,
      );
    });

    expect(screen.getByTestId('workspace-titlebar-sidebar-slot')).toHaveClass('w-56', 'justify-end');
    expect(screen.getByTestId('workspace-titlebar-sidebar-slot')).not.toHaveClass('pl-24');
    expect(screen.getByTestId('workspace-sidebar-toggle-titlebar')).toHaveClass('app-desktop-sidebar-toggle');
  });

  it('keeps the Windows workspace toggle centered inside the collapsed rail without mac inset', async () => {
    window.electron.platform = 'win32';
    settingsState.sidebarCollapsed = true;

    await act(async () => {
      render(
        <MemoryRouter initialEntries={['/channels']}>
          <Routes>
            <Route element={<MainLayout />}>
              <Route path="/channels" element={<div>Channels body</div>} />
            </Route>
          </Routes>
        </MemoryRouter>,
      );
    });

    expect(screen.getByTestId('workspace-titlebar-sidebar-slot')).toHaveClass('w-11', 'justify-center');
    expect(screen.getByTestId('workspace-titlebar-sidebar-slot')).not.toHaveClass('pl-24');
    expect(screen.getByTestId('workspace-sidebar-toggle-titlebar')).toHaveClass('app-desktop-sidebar-toggle');
  });

  it('keeps the Windows chat toggle free of the mac traffic-light inset', async () => {
    window.electron.platform = 'win32';
    settingsState.chatFocusMode = true;

    await act(async () => {
      render(
        <MemoryRouter initialEntries={['/']}>
          <Routes>
            <Route element={<MainLayout />}>
              <Route path="/" element={<div>Chat body</div>} />
            </Route>
          </Routes>
        </MemoryRouter>,
      );
    });

    expect(screen.getByTestId('chat-titlebar-session-slot')).toHaveClass('justify-start', 'pl-1');
    expect(screen.getByTestId('chat-titlebar-session-slot')).not.toHaveClass('pl-24');
    expect(screen.getByRole('button', { name: 'Show sessions' })).toHaveClass('app-desktop-sidebar-toggle');
  });

  it('keeps the global sidebar on the same font stack and applies toned navigation icons', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/channels']}>
        <Routes>
          <Route element={<MainLayout />}>
            <Route path="/channels" element={<div>Channels body</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(container.querySelector('aside')?.className).toContain('[font-family:var(--font-sidebar)]');
    expect(screen.getByRole('link', { name: 'Chat' }).querySelector('.app-sidebar-toned-icon--chat')).not.toBeNull();
    expect(screen.getByRole('link', { name: 'Models' }).querySelector('.app-sidebar-toned-icon--models')).not.toBeNull();
    expect(screen.getByRole('link', { name: 'Agents' }).querySelector('.app-sidebar-toned-icon--agents')).not.toBeNull();
    expect(screen.getByRole('link', { name: 'Channels' }).querySelector('.app-sidebar-toned-icon--channels')).not.toBeNull();
    expect(screen.getByRole('link', { name: 'Skills' }).querySelector('.app-sidebar-toned-icon--skills')).not.toBeNull();
    expect(screen.getByRole('link', { name: 'Cron Tasks' }).querySelector('.app-sidebar-toned-icon--cron')).not.toBeNull();
    expect(screen.getByRole('link', { name: 'Settings' }).querySelector('.app-sidebar-toned-icon--settings')).not.toBeNull();
    expect(screen.getByTestId('sidebar-brand-lockup')).toBeInTheDocument();
    expect(screen.getByTestId('sidebar-brand-wordmark')).toHaveClass('sidebar-brand-wordmark');
    expect(screen.getByRole('button', { name: 'Collapse sidebar' })).toHaveClass('app-desktop-sidebar-toggle');
    expect(screen.getByRole('button', { name: 'Collapse sidebar' }).querySelector('[data-testid="qclaw-session-toggle-icon"]')).not.toBeNull();
  });

  it('filters sessions from the local search box', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route element={<MainLayout />}>
            <Route path="/" element={<div>Chat body</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Search chats' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Search chats' }), {
      target: { value: 'writer' },
    });

    expect(screen.getByText('Launch draft')).toBeInTheDocument();
    expect(screen.queryByText('Design review')).not.toBeInTheDocument();
    expect(screen.queryByText('No matching chats')).not.toBeInTheDocument();
  });

  it('shows an empty state when the local search has no matches', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route element={<MainLayout />}>
            <Route path="/" element={<div>Chat body</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Search chats' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Search chats' }), {
      target: { value: 'non-existent' },
    });

    expect(screen.queryByText('Design review')).not.toBeInTheDocument();
    expect(screen.queryByText('Launch draft')).not.toBeInTheDocument();
    expect(screen.getByText('No matching chats')).toBeInTheDocument();
  });

  it('shows a friendly empty state when there are no sessions yet', () => {
    chatState.sessions = [];
    chatState.sessionLabels = {};
    chatState.sessionLastActivity = {};

    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route element={<MainLayout />}>
            <Route path="/" element={<div>Chat body</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText('No chats yet')).toBeInTheDocument();
    expect(screen.getByText('Start a new conversation and it will show up here.')).toBeInTheDocument();
  });

  it('groups sessions by today, this week, this month, and earlier', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-21T20:00:00.000+08:00'));
    try {
      chatState.sessions = [
        { key: 'agent:main:thread-today', displayName: 'Today session' },
        { key: 'agent:writer:thread-week', displayName: 'Week session' },
        { key: 'agent:ops:thread-month', displayName: 'Month session' },
        { key: 'agent:legacy:thread-older', displayName: 'Older session' },
      ];
      chatState.sessionLabels = {
        'agent:main:thread-today': 'Today session',
        'agent:writer:thread-week': 'Week session',
        'agent:ops:thread-month': 'Month session',
        'agent:legacy:thread-older': 'Older session',
      };
      chatState.sessionLastActivity = {
        'agent:main:thread-today': new Date('2026-03-21T12:00:00.000+08:00').getTime(),
        'agent:writer:thread-week': new Date('2026-03-19T08:00:00.000+08:00').getTime(),
        'agent:ops:thread-month': new Date('2026-03-03T08:00:00.000+08:00').getTime(),
        'agent:legacy:thread-older': new Date('2026-02-20T08:00:00.000+08:00').getTime(),
      };
      agentsState.agents = [
        { id: 'main', name: 'Main' },
        { id: 'writer', name: 'Writer' },
        { id: 'ops', name: 'Ops' },
        { id: 'legacy', name: 'Legacy' },
      ];

      render(
        <MemoryRouter initialEntries={['/']}>
          <Routes>
            <Route element={<MainLayout />}>
              <Route path="/" element={<div>Chat body</div>} />
            </Route>
          </Routes>
        </MemoryRouter>,
      );

      expect(screen.getByText('Today')).toBeInTheDocument();
      expect(screen.getByText('This Week')).toBeInTheDocument();
      expect(screen.getByText('This Month')).toBeInTheDocument();
      expect(screen.getByText('Earlier')).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('uses a Windows-friendly scrollbar treatment on win32', async () => {
    window.electron.platform = 'win32';

    await act(async () => {
      render(
        <MemoryRouter initialEntries={['/']}>
          <Routes>
            <Route element={<MainLayout />}>
              <Route path="/" element={<div>Chat body</div>} />
            </Route>
          </Routes>
        </MemoryRouter>,
      );
    });

    expect(screen.getByTestId('chat-sessions-scroll-area')).toHaveClass('subtle-scrollbar-win');
    expect(screen.getByTestId('chat-sessions-scroll-area')).not.toHaveClass('subtle-scrollbar');
  });
});
