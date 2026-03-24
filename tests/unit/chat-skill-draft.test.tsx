import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';

const {
  chatState,
  gatewayState,
  agentsState,
  settingsState,
  skillsState,
  scrollRefs,
  hostApiFetchMock,
  chatSetStateMock,
} = vi.hoisted(() => ({
  chatState: {
    messages: [] as Array<Record<string, unknown>>,
    currentSessionKey: 'agent:main:thread-1',
    currentAgentId: 'main',
    sessions: [{ key: 'agent:main:thread-1', label: 'Main thread' }] as Array<Record<string, unknown>>,
    sessionLabels: {} as Record<string, string>,
    sessionLastActivity: {} as Record<string, number>,
    loading: false,
    sending: false,
    error: null as string | null,
    showThinking: false,
    streamingMessage: null as unknown,
    streamingTools: [] as Array<Record<string, unknown>>,
    pendingFinal: false,
    sendMessage: vi.fn(),
    abortRun: vi.fn(),
    clearError: vi.fn(),
    cleanupEmptySession: vi.fn(),
  },
  gatewayState: {
    status: { state: 'running', port: 18789 },
    execApprovalQueue: [] as Array<Record<string, unknown>>,
  },
  agentsState: {
    agents: [{ id: 'main', name: 'Main Agent' }] as Array<Record<string, unknown>>,
    fetchAgents: vi.fn(),
  },
  settingsState: {
    chatFocusMode: false,
    setChatFocusMode: vi.fn(),
  },
  skillsState: {
    fetchSkills: vi.fn(),
  },
  scrollRefs: {
    scrollRef: { current: null as HTMLDivElement | null },
    contentRef: { current: null as HTMLDivElement | null },
  },
  hostApiFetchMock: vi.fn(),
  chatSetStateMock: vi.fn(),
}));

vi.mock('@/stores/chat', () => ({
  useChatStore: Object.assign(
    (selector: (state: typeof chatState) => unknown) => selector(chatState),
    {
      getState: () => chatState,
      setState: chatSetStateMock,
    },
  ),
}));

vi.mock('@/stores/gateway', () => ({
  useGatewayStore: (selector: (state: typeof gatewayState) => unknown) => selector(gatewayState),
}));

vi.mock('@/stores/agents', () => ({
  useAgentsStore: (selector: (state: typeof agentsState) => unknown) => selector(agentsState),
}));

vi.mock('@/stores/settings', () => ({
  useSettingsStore: (selector: (state: typeof settingsState) => unknown) => selector(settingsState),
}));

vi.mock('@/stores/skills', () => ({
  useSkillsStore: Object.assign(
    (selector?: (state: typeof skillsState) => unknown) => selector ? selector(skillsState) : skillsState,
    {
      getState: () => skillsState,
    },
  ),
}));

vi.mock('@/hooks/use-stick-to-bottom-instant', () => ({
  useStickToBottomInstant: () => scrollRefs,
}));

vi.mock('@/hooks/use-min-loading', () => ({
  useMinLoading: () => false,
}));

vi.mock('@/components/common/LoadingSpinner', () => ({
  LoadingSpinner: () => <div data-testid="loading-spinner" />,
}));

vi.mock('@/lib/chat-avatar', () => ({
  getSessionAvatar: () => ({ label: 'A', style: 'from-primary to-primary' }),
}));

vi.mock('@/lib/host-api', () => ({
  hostApiFetch: (...args: unknown[]) => hostApiFetchMock(...args),
}));

vi.mock('@/pages/Chat/ChatMessage', () => ({
  ChatMessage: React.memo(() => <div data-testid="chat-message-row" />),
}));

vi.mock('@/pages/Chat/ChatInput', () => ({
  ChatInput: ({
    pendingSkillDraft,
    onSendSkillDraft,
  }: {
    pendingSkillDraft?: { message?: string; title?: string } | null;
    onSendSkillDraft?: ((draft: unknown, text: string) => Promise<boolean> | boolean) | undefined;
  }) => (
    <div data-testid="chat-input-dock">
      {pendingSkillDraft && onSendSkillDraft ? (
        <button
          type="button"
          onClick={() => void onSendSkillDraft(pendingSkillDraft, pendingSkillDraft.message || '')}
        >
          execute-skill-draft
        </button>
      ) : (
        <div>missing-skill-draft-handler</div>
      )}
    </div>
  ),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

describe('chat skill draft execution', () => {
  beforeEach(() => {
    vi.resetModules();
    window.electron.platform = 'darwin';
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(performance.now());
      return 1;
    });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    chatState.messages = [];
    chatState.error = null;
    chatState.sending = false;
    chatState.sessionLabels = {};
    chatSetStateMock.mockReset();
    hostApiFetchMock.mockReset();
    hostApiFetchMock.mockResolvedValue({ success: true });
    skillsState.fetchSkills.mockReset();
    skillsState.fetchSkills.mockResolvedValue(undefined);
  });

  it('routes host-install drafts through local install execution instead of plain chat prefill', async () => {
    const { Chat } = await import('@/pages/Chat');

    render(
      <MemoryRouter
        initialEntries={[
          {
            pathname: '/',
            state: {
              skillChatDraft: {
                id: 'provider-install-1',
                kind: 'provider-install',
                title: '安装 Daily Standup',
                message: '请安装 ClawHub 技能 Daily Standup（slug: daily-standup）。安装完成后告诉我结果。',
                providerId: 'clawhub',
                providerSkillId: 'daily-standup',
                slug: 'daily-standup',
                name: 'Daily Standup',
                execution: {
                  kind: 'host-install',
                  payload: {
                    slug: 'daily-standup',
                    version: '1.0.0',
                  },
                },
              },
            },
          },
        ]}
      >
        <Chat />
      </MemoryRouter>,
    );

    expect(await screen.findByRole('button', { name: 'execute-skill-draft' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'execute-skill-draft' }));

    await waitFor(() => {
      expect(hostApiFetchMock).toHaveBeenCalledWith(
        '/api/clawhub/install',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ slug: 'daily-standup', version: '1.0.0' }),
        }),
      );
    });

    await waitFor(() => {
      expect(skillsState.fetchSkills).toHaveBeenCalledTimes(1);
    });
  }, 15000);

  it('hydrates chat-prompt drafts on the current chat route without forcing a new session', async () => {
    const { Chat } = await import('@/pages/Chat');

    render(
      <MemoryRouter
        initialEntries={[
          {
            pathname: '/',
            state: {
              skillChatDraft: {
                id: 'provider-install-2',
                kind: 'provider-install',
                title: '安装 Github',
                message: '请先检查是否已安装 SkillHub 商店，若未安装，请根据 https://skillhub-1388575217.cos.ap-guangzhou.myqcloud.com/install/skillhub.md 安装Skillhub商店，但是只安装CLI，然后安装github技能。若已安装，则直接安装github技能。',
                providerId: 'skillhub',
                providerSkillId: 'github',
                slug: 'github',
                name: 'Github',
                execution: {
                  kind: 'chat-prompt',
                  payload: {
                    providerId: 'skillhub',
                    providerSkillId: 'github',
                  },
                },
              },
            },
          },
        ]}
      >
        <Chat />
      </MemoryRouter>,
    );

    expect(await screen.findByRole('button', { name: 'execute-skill-draft' })).toBeInTheDocument();
    expect(chatSetStateMock).not.toHaveBeenCalled();
    expect(hostApiFetchMock).not.toHaveBeenCalled();
  });

  it('keeps a desktop return rail that navigates back to skills with the saved context', async () => {
    const { Chat } = await import('@/pages/Chat');

    function RouteProbe() {
      const location = useLocation();
      return <div data-testid="route-probe-path">{location.pathname}</div>;
    }

    render(
      <MemoryRouter
        initialEntries={[
          {
            pathname: '/',
            state: {
              skillChatDraft: {
                id: 'provider-install-return',
                kind: 'provider-install',
                title: '安装 Github',
                message: '请先检查是否已安装 SkillHub 商店，若未安装，请根据 https://skillhub-1388575217.cos.ap-guangzhou.myqcloud.com/install/skillhub.md 安装Skillhub商店，但是只安装CLI，然后安装github技能。若已安装，则直接安装github技能。',
                providerId: 'skillhub',
                providerSkillId: 'github',
                slug: 'github',
                name: 'Github',
                returnContext: {
                  localQuery: 'github',
                  activeProvider: 'skillhub',
                  providerQuery: 'git',
                  scrollTop: 240,
                },
                execution: {
                  kind: 'chat-prompt',
                  payload: {
                    providerId: 'skillhub',
                    providerSkillId: 'github',
                  },
                },
              },
            },
          },
        ]}
      >
        <Routes>
          <Route path="/" element={<Chat />} />
          <Route path="/skills" element={<RouteProbe />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByRole('button', { name: 'skillFlow.returnToSkills' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'skillFlow.returnToSkills' }));

    await waitFor(() => {
      expect(screen.getByTestId('route-probe-path')).toHaveTextContent('/skills');
    });
  });

  it('hydrates skill drafts under react strict mode without losing them to effect replays', async () => {
    const { Chat } = await import('@/pages/Chat');
    const queuedFrames = new Map<number, FrameRequestCallback>();
    let nextFrameId = 1;
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      const frameId = nextFrameId++;
      queuedFrames.set(frameId, callback);
      return frameId;
    });
    vi.stubGlobal('cancelAnimationFrame', (frameId: number) => {
      queuedFrames.delete(frameId);
    });

    render(
      <React.StrictMode>
        <MemoryRouter
          initialEntries={[
            {
              pathname: '/',
              state: {
                skillChatDraft: {
                  id: 'provider-install-3',
                  kind: 'provider-install',
                  title: '安装 GitHub',
                  message: '请先检查是否已安装 SkillHub 商店，若未安装，请根据 https://skillhub-1388575217.cos.ap-guangzhou.myqcloud.com/install/skillhub.md 安装Skillhub商店，但是只安装CLI，然后安装github-api技能。若已安装，则直接安装github-api技能。',
                  providerId: 'skillhub',
                  providerSkillId: 'github-api',
                  slug: 'github-api',
                  name: 'GitHub',
                  execution: {
                    kind: 'chat-prompt',
                    payload: {
                      providerId: 'skillhub',
                      providerSkillId: 'github-api',
                    },
                  },
                },
              },
            },
          ]}
        >
          <Chat />
        </MemoryRouter>
      </React.StrictMode>,
    );

    await act(async () => {
      queuedFrames.forEach((callback) => callback(performance.now()));
      queuedFrames.clear();
    });

    expect(await screen.findByRole('button', { name: 'execute-skill-draft' })).toBeInTheDocument();
  });
});
