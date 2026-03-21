import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { Sidebar } from '@/components/layout/Sidebar';
import { MainLayout } from '@/components/layout/MainLayout';

const {
  settingsState,
  chatState,
  gatewayState,
  agentsState,
} = vi.hoisted(() => ({
  settingsState: {
    sidebarCollapsed: false,
    setSidebarCollapsed: vi.fn(),
  },
  chatState: {
    sessions: [] as Array<Record<string, unknown>>,
    currentSessionKey: 'agent:main:thread-1',
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

vi.mock('@/lib/host-api', () => ({
  hostApiFetch: vi.fn(),
}));

vi.mock('@/components/layout/TitleBar', () => ({
  TitleBar: () => <div data-testid="title-bar" />,
}));

function translate(key: string, vars?: Record<string, unknown>): string {
  switch (key) {
    case 'sidebar.chat':
      return 'Chat';
    case 'sidebar.newChat':
      return 'New Chat';
    case 'sidebar.models':
      return 'Models';
    case 'sidebar.agents':
      return 'Agents';
    case 'sidebar.channels':
      return 'Channels';
    case 'sidebar.skills':
      return 'Skills';
    case 'sidebar.cronTasks':
      return 'Cron Tasks';
    case 'sidebar.settings':
      return 'Settings';
    case 'sidebar.openClawPage':
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
    settingsState.setSidebarCollapsed = vi.fn();
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

    expect(screen.getByText('Design review')).toBeInTheDocument();
    expect(screen.getByText('Launch draft')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Design review Main' })).toBeInTheDocument();
    expect(screen.queryByText('Main')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Search chats' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'New Chat' })).toHaveLength(1);
    expect(screen.getByAltText('XClaw')).toBeInTheDocument();
    expect(screen.getByAltText('XClaw')).toHaveClass('sidebar-brand-mark');
    expect(screen.getByTestId('sidebar-brand-wordmark')).toHaveClass('opacity-0');
    expect(screen.queryByRole('button', { name: 'Expand sidebar' })).not.toBeInTheDocument();
    expect(screen.getByTestId('chat-sessions-scroll-area')).toHaveClass('subtle-scrollbar');
    expect(screen.getByTestId('chat-sessions-scroll-area')).not.toHaveClass('subtle-scrollbar-win');
    expect(screen.queryByText(/\d{1,2}:\d{2}/)).not.toBeInTheDocument();
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

  it('gives collapsed rail items a stronger hover shell and bounded tooltip labels', async () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route element={<MainLayout />}>
            <Route path="/" element={<div>Chat body</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    const chatLink = screen.getByRole('link', { name: 'Chat' });
    expect(chatLink).toHaveClass('h-[34px]');
    expect(chatLink).toHaveClass('w-[34px]');
    expect(chatLink).toHaveClass('hover:bg-[hsl(var(--foreground)/0.045)]');
    expect(chatLink).not.toHaveAttribute('title');

    fireEvent.mouseEnter(chatLink);

    const tooltip = chatLink.parentElement?.querySelector('[data-testid="sidebar-tooltip-content"]');
    expect(tooltip).toHaveTextContent('Chat');
    expect(tooltip).toHaveClass('opacity-0');
    expect(tooltip?.firstElementChild).toHaveClass('max-w-[160px]');
  });

  it('keeps the global sidebar free of session rows', () => {
    render(
      <MemoryRouter initialEntries={['/models']}>
        <Sidebar />
      </MemoryRouter>,
    );

    expect(screen.queryByText('Design review')).not.toBeInTheDocument();
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

  it('uses a Windows-friendly scrollbar treatment on win32', () => {
    window.electron.platform = 'win32';

    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route element={<MainLayout />}>
            <Route path="/" element={<div>Chat body</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByTestId('chat-sessions-scroll-area')).toHaveClass('subtle-scrollbar-win');
    expect(screen.getByTestId('chat-sessions-scroll-area')).not.toHaveClass('subtle-scrollbar');
  });
});
