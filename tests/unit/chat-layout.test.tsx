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
    sidebarWidth: 250,
    chatFocusMode: false,
    initialized: true,
    setupComplete: true,
    setSidebarCollapsed: vi.fn(),
    setSidebarWidth: vi.fn(),
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
  SIDEBAR_RAIL_WIDTH: 44,
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
  useAgentsStore: Object.assign(
    (selector: (state: typeof agentsState) => unknown) => selector(agentsState),
    {
      getState: () => agentsState,
    },
  ),
}));

vi.mock('@/components/agents/AgentAvatar', () => ({
  AgentAvatar: ({ agentId }: { agentId: string }) => <img alt={agentId} data-testid={`agent-avatar-${agentId}`} />,
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
  getHostApiBase: () => 'http://127.0.0.1:3210',
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
    settingsState.sidebarWidth = 250;
    settingsState.chatFocusMode = false;
    settingsState.initialized = true;
    settingsState.setupComplete = true;
    settingsState.setSidebarCollapsed = vi.fn((value: boolean) => {
      settingsState.sidebarCollapsed = value;
    });
    settingsState.setSidebarWidth = vi.fn((value: number) => {
      settingsState.sidebarWidth = value;
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

    const sessionSlot = screen.getByTestId('chat-titlebar-session-slot');
    const brandLockup = screen.getByTestId('chat-sidebar-brand-lockup');
    const searchTrigger = screen.getByRole('button', { name: 'Search chats' });
    const brandMark = within(brandLockup).getByAltText('XClaw');

    expect(screen.getByTestId('chat-sidebar-brand-wordmark')).toBeInTheDocument();
    expect(within(sessionSlot).queryByTestId('chat-sidebar-brand-lockup')).toBeNull();
    expect(brandMark).toHaveClass('app-brand-mark');
    expect(brandMark).not.toHaveClass('sidebar-brand-mark');
    expect(screen.getByText('Design review')).toBeInTheDocument();
    expect(screen.getByText('Launch draft')).toBeInTheDocument();
    const designReviewRow = screen.getByRole('button', { name: 'Design review' });
    expect(designReviewRow).toBeInTheDocument();
    expect(designReviewRow.querySelector('img')).not.toBeNull();
    expect(screen.queryByText('Main')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Search chats' })).toBeInTheDocument();
    expect(screen.queryByTestId('chat-titlebar-control-rail')).not.toBeInTheDocument();
    expect(sessionSlot.querySelector('[data-chat-sidebar-header-slot="true"]')).toHaveClass('justify-end');
    expect(within(sessionSlot).getByTestId('chat-session-header-controls-titlebar')).toHaveClass('h-full', 'no-drag');
    expect(screen.queryByTestId('chat-session-header-controls-pane')).not.toBeInTheDocument();
    expect(screen.getByRole('main')).toHaveClass('rounded-bl-[12px]');
    expect(screen.getByRole('main')).not.toHaveClass('rounded-l-[12px]');
    expect(screen.getByRole('button', { name: 'Hide sessions' })).toHaveClass('app-desktop-sidebar-toggle', 'h-6', 'w-6', 'p-0', 'leading-none');
    expect(screen.getByTestId('chat-new-chat-titlebar')).toHaveClass('h-6', 'w-6', 'p-0', 'leading-none');
    expect(within(sessionSlot).getByTestId('chat-session-header-controls-titlebar')).toContainElement(screen.getByTestId('chat-new-chat-titlebar'));
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
    expect(screen.getByTestId('desktop-shell-resize-handle')).toBeInTheDocument();
    expect(screen.queryByText(/\d{1,2}:\d{2}/)).not.toBeInTheDocument();

    fireEvent.click(searchTrigger);

    const searchInput = screen.getByRole('textbox', { name: 'Search chats' });
    const searchControl = searchInput.closest('.app-chat-session-control--search');

    expect(searchControl).not.toBeNull();
    expect(searchControl).toHaveClass('ring-1');
    expect(searchControl).not.toHaveClass('rounded-full');
    expect(searchControl).not.toHaveClass('focus-within:ring-2');
    expect(searchTrigger).toHaveClass('rounded-[6px]');
    expect(designReviewRow).toHaveClass('app-chat-session-row');
    expect(designReviewRow).not.toHaveClass('shadow-none');
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

    fireEvent.click(screen.getByRole('link', { name: 'Chat' }));

    expect(screen.getByText('Chat body')).toBeInTheDocument();
    expect(studioUnmountSpy).not.toHaveBeenCalled();

    fireEvent.click(screen.getByLabelText('Studio'));

    expect(screen.getByTestId('studio-surface-probe')).toBeInTheDocument();
    expect(studioMountSpy).toHaveBeenCalledTimes(1);
    expect(studioUnmountSpy).not.toHaveBeenCalled();
  });

  it('does not mount the studio surface before setup is complete', () => {
    settingsState.initialized = false;
    settingsState.setupComplete = false;

    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route element={<MainLayout />}>
            <Route path="/" element={<div>Chat body</div>} />
            <Route path="/studio/*" element={<div>Studio route outlet</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText('Chat body')).toBeInTheDocument();
    expect(screen.queryByTestId('studio-surface-probe')).not.toBeInTheDocument();
    expect(studioMountSpy).not.toHaveBeenCalled();
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

    fireEvent.click(screen.getByRole('link', { name: 'Chat' }));

    expect(screen.getByTestId('chat-surface-probe')).toBeInTheDocument();
    expect(chatMountSpy).toHaveBeenCalledTimes(1);
    expect(chatUnmountSpy).not.toHaveBeenCalled();
    expect(chatState.loadSessions).toHaveBeenCalled();
  });

  it('keeps the chat surface mounted while toggling between chat and settings', () => {
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
            <Route path="/settings" element={<div>Settings body</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(chatMountSpy).toHaveBeenCalledTimes(1);
    expect(chatUnmountSpy).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));

    expect(screen.getByText('Settings body')).toBeInTheDocument();
    expect(chatUnmountSpy).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('link', { name: 'Chat' }));

    expect(screen.getByTestId('chat-surface-probe')).toBeInTheDocument();
    expect(chatMountSpy).toHaveBeenCalledTimes(1);
    expect(chatUnmountSpy).not.toHaveBeenCalled();
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

    expect(document.querySelector('.desktop-app-shell-nav[data-chat-nav-visible="false"]')).not.toBeNull();
    expect(screen.getByTestId('chat-titlebar-control-rail')).toHaveClass('absolute', 'left-[80px]', 'top-[12px]');
    expect(screen.queryByTestId('chat-titlebar-session-slot')).not.toBeInTheDocument();
    expect(screen.getByTestId('chat-session-header-controls-titlebar')).toHaveClass('h-full');
    expect(within(screen.getByTestId('chat-session-header-controls-titlebar')).getByTestId('qclaw-session-toggle-icon')).toBeInTheDocument();
    expect(within(screen.getByTestId('chat-session-header-controls-titlebar')).queryByTestId('qclaw-new-chat-icon')).toBeNull();
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
    expect(screen.queryByTestId('sidebar-brand-wordmark')).not.toBeInTheDocument();
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

    expect(screen.getByTestId('workspace-titlebar-control-rail')).toHaveClass('absolute', 'left-[80px]', 'top-[12px]', 'no-drag');
    expect(screen.queryByTestId('workspace-titlebar-sidebar-slot')).not.toBeInTheDocument();
    expect(screen.getByTestId('workspace-sidebar-toggle-titlebar')).toHaveClass('app-desktop-sidebar-toggle', 'no-drag');
    expect(screen.queryByTestId('workspace-sidebar-toggle-inline')).not.toBeInTheDocument();
    expect(screen.getByTestId('desktop-shell-resize-handle')).toBeInTheDocument();

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

    expect(screen.getByTestId('workspace-titlebar-control-rail')).toHaveClass('absolute', 'left-[80px]', 'top-[12px]');
    expect(screen.queryByTestId('workspace-titlebar-sidebar-slot')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Expand sidebar' })).toHaveClass('app-desktop-sidebar-toggle');
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

    expect(screen.getByTestId('workspace-titlebar-sidebar-slot')).toHaveClass('w-[var(--desktop-sidebar-width)]', 'justify-end');
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

    expect(screen.getByTestId('workspace-titlebar-sidebar-slot')).toHaveClass('w-[var(--desktop-sidebar-rail-width)]', 'justify-center');
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
