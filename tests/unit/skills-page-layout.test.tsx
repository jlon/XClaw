import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { Skills } from '@/pages/Skills';

const { skillsState, gatewayState, hostApiFetchMock, invokeIpcMock } = vi.hoisted(() => ({
  skillsState: {
    skills: [] as Array<Record<string, unknown>>,
    loading: false,
    error: null as string | null,
    fetchSkills: vi.fn(),
    enableSkill: vi.fn(),
    disableSkill: vi.fn(),
    uninstallSkill: vi.fn(),
  },
  gatewayState: {
    status: { state: 'running', port: 18789 },
  },
  hostApiFetchMock: vi.fn(),
  invokeIpcMock: vi.fn(),
}));

vi.mock('@/stores/skills', () => ({
  useSkillsStore: Object.assign(
    (selector?: (state: typeof skillsState) => unknown) => selector ? selector(skillsState) : skillsState,
    {
      getState: () => skillsState,
    },
  ),
}));

vi.mock('@/stores/gateway', () => ({
  useGatewayStore: (selector: (state: typeof gatewayState) => unknown) => selector(gatewayState),
}));

vi.mock('@/lib/host-api', () => ({
  hostApiFetch: (...args: unknown[]) => hostApiFetchMock(...args),
}));

vi.mock('@/lib/api-client', () => ({
  invokeIpc: (...args: unknown[]) => invokeIpcMock(...args),
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

function translate(key: string, options?: Record<string, unknown>) {
  if (key === 'catalog.descriptions.agent-mbti') {
    return 'AI 智能体人格分析与配置系统，用于快速建立一致的协作风格。';
  }
  if (key === 'detail.disable') {
    return '禁用';
  }
  if (key === 'detail.enable') {
    return '启用';
  }
  if (key === 'card.updating') {
    return '更新中';
  }
  if (key === 'card.enabled') {
    return '已启用';
  }
  if (key === 'card.disabled') {
    return '已停用';
  }
  if (typeof options?.defaultValue === 'string') {
    return options.defaultValue
      .replace('{{count}}', String(options.count ?? ''))
      .replace('{{path}}', String(options.path ?? ''));
  }
  return key;
}

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: translate,
    i18n: {
      exists: (key: string) => key === 'catalog.descriptions.agent-mbti',
    },
  }),
}));

describe('skills page layout', () => {
  beforeEach(() => {
    window.electron.platform = 'darwin';
    window.sessionStorage.clear();
    skillsState.skills = [
      {
        id: 'agent-mbti',
        slug: 'agent-mbti',
        name: 'agent-mbti',
        description: 'AI Agent personality diagnosis and configuration system.',
        enabled: true,
        icon: '🧩',
        version: '1.0.0',
        provenance: 'xclaw-preinstalled',
        displaySourceLabel: '内置技能',
      },
      {
        id: 'arxiv-reader',
        slug: 'arxiv-reader',
        name: 'arxiv-reader',
        description: 'Read and summarize ArXiv papers.',
        enabled: false,
        icon: '📚',
        version: '1.2.0',
        provenance: 'openclaw-managed',
        displaySourceLabel: '已安装',
      },
    ];
    skillsState.loading = false;
    skillsState.error = null;
    skillsState.fetchSkills = vi.fn();
    skillsState.enableSkill = vi.fn().mockResolvedValue(undefined);
    skillsState.disableSkill = vi.fn().mockResolvedValue(undefined);
    skillsState.uninstallSkill = vi.fn().mockResolvedValue(undefined);
    gatewayState.status = { state: 'running', port: 18789 };
    hostApiFetchMock.mockResolvedValue({ success: true, results: [] });
    invokeIpcMock.mockResolvedValue(undefined);
  });

  it('renders a qclaw-style desktop skills center with local search and card grid', () => {
    render(
      <MemoryRouter>
        <Skills />
      </MemoryRouter>,
    );

    expect(screen.getByRole('button', { name: '技能库' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '我的技能' })).toBeInTheDocument();
    expect(screen.getByPlaceholderText('搜索已经安装的技能')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '添加技能' })).toBeInTheDocument();
    expect(screen.getByText('agent-mbti')).toBeInTheDocument();
    expect(screen.getByText('arxiv-reader')).toBeInTheDocument();
    expect(screen.getByText('内置技能')).toBeInTheDocument();
    expect(screen.getByTestId('skills-card-glyph-agent-mbti')).toBeInTheDocument();
    expect(screen.getByTestId('skills-card-glyph-arxiv-reader')).toBeInTheDocument();
    expect(screen.getByTestId('skills-card-grid')).toHaveClass('app-skills-card-grid');
    expect(screen.getByText('agent-mbti').closest('[role="button"]')).toHaveClass('app-skills-card');
    expect(skillsState.fetchSkills).toHaveBeenCalledTimes(1);
  });

  it('opens the add-skill menu with only the three supported import and search entries', async () => {
    render(
      <MemoryRouter>
        <Skills />
      </MemoryRouter>,
    );

    fireEvent.pointerDown(screen.getByRole('button', { name: '添加技能' }));

    expect(await screen.findByRole('menuitem', { name: '从 GitHub 导入' })).toBeInTheDocument();
    expect(await screen.findByRole('menuitem', { name: '从 ClawHub 搜索' })).toBeInTheDocument();
    expect(await screen.findByRole('menuitem', { name: '从 SkillHub 搜索' })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: '通过对话创建' })).not.toBeInTheDocument();
  });

  it('opens the skillhub provider dialog with a direct homepage entry', async () => {
    render(
      <MemoryRouter>
        <Skills />
      </MemoryRouter>,
    );

    fireEvent.pointerDown(screen.getByRole('button', { name: '添加技能' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: '从 SkillHub 搜索' }));

    const homepageButton = await screen.findByRole('button', { name: '访问 SkillHub' });
    expect(homepageButton).toBeInTheDocument();

    fireEvent.click(homepageButton);

    expect(invokeIpcMock).toHaveBeenCalledWith('shell:openExternal', 'https://skillhub.tencent.com/');
  }, 15000);

  it('loads top 50 provider results by default and filters out already installed skills', async () => {
    hostApiFetchMock.mockImplementation(async (path: string, options?: { body?: string }) => {
      if (path === '/api/skills/providers/skillhub/search') {
        expect(options?.body).toBe(JSON.stringify({ query: '', limit: 50 }));
        return {
          success: true,
          results: [
            {
              id: 'skillhub:agent-mbti',
              providerId: 'skillhub',
              providerSkillId: 'agent-mbti',
              slug: 'agent-mbti',
              name: 'agent-mbti',
              description: 'Installed already.',
              version: '1.0.0',
              sourceLabel: 'SkillHub',
              installCapability: {
                providerId: 'skillhub',
                executionKind: 'chat-prompt',
              },
            },
            {
              id: 'skillhub:ai-ppt-generator',
              providerId: 'skillhub',
              providerSkillId: 'ai-ppt-generator',
              slug: 'ai-ppt-generator',
              name: 'Ai Ppt Generator',
              description: 'Generate PPT with Baidu AI.',
              version: '1.1.4',
              sourceLabel: 'SkillHub',
              installCapability: {
                providerId: 'skillhub',
                executionKind: 'chat-prompt',
              },
            },
          ],
        };
      }
      return { success: true };
    });

    render(
      <MemoryRouter>
        <Skills />
      </MemoryRouter>,
    );

    fireEvent.pointerDown(screen.getByRole('button', { name: '添加技能' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: '从 SkillHub 搜索' }));

    await waitFor(() => {
      expect(hostApiFetchMock).toHaveBeenCalledWith(
        '/api/skills/providers/skillhub/search',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ query: '', limit: 50 }),
        }),
      );
    });

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Ai Ppt Generator')).toBeInTheDocument();
    expect(within(dialog).queryByText('Installed already.')).not.toBeInTheDocument();
    expect(within(dialog).queryByText('agent-mbti')).not.toBeInTheDocument();
  });

  it('keeps the skillhub provider dialog scrollable and routes install into the current chat route with a deterministic draft', async () => {
    hostApiFetchMock.mockImplementation(async (path: string) => {
      if (path === '/api/skills/providers/skillhub/search') {
        return {
          success: true,
          results: [
            {
              id: 'skillhub:markdown-converter',
              providerId: 'skillhub',
              providerSkillId: 'markdown-converter',
              slug: 'markdown-converter',
              name: 'Markdown Converter',
              description: 'Convert documents and files to Markdown using markitdown.',
              version: '1.0.0',
              author: 'steipete',
              downloads: 25761,
              sourceLabel: 'SkillHub',
              installCapability: {
                providerId: 'skillhub',
                executionKind: 'chat-prompt',
              },
              metadata: {
                sourceUrl: 'https://clawhub.ai/steipete/markdown-converter',
              },
            },
          ],
        };
      }
      return { success: true };
    });

    function RouteProbe() {
      const location = useLocation();
      const draft = (location.state as {
        skillChatDraft?: { title?: string; providerId?: string; message?: string };
      } | null)?.skillChatDraft;
      return (
        <div>
          <div data-testid="route-probe-path">{location.pathname}</div>
          <div data-testid="route-probe-title">{draft?.title || ''}</div>
          <div data-testid="route-probe-provider">{draft?.providerId || ''}</div>
          <div data-testid="route-probe-message">{draft?.message || ''}</div>
        </div>
      );
    }

    render(
      <MemoryRouter initialEntries={['/skills']}>
        <Routes>
          <Route path="/skills" element={<Skills />} />
          <Route path="/" element={<RouteProbe />} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.pointerDown(screen.getByRole('button', { name: '添加技能' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: '从 SkillHub 搜索' }));

    const dialog = await screen.findByRole('dialog');
    expect(dialog.querySelector('.min-h-0.flex-1.overflow-y-auto')).not.toBeNull();
    expect(await screen.findByRole('button', { name: '发送到聊天' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '发送到聊天' }));

    await waitFor(() => {
      expect(screen.getByTestId('route-probe-path')).toHaveTextContent('/');
    });
    expect(screen.getByTestId('route-probe-title')).toHaveTextContent('安装 Markdown Converter');
    expect(screen.getByTestId('route-probe-provider')).toHaveTextContent('skillhub');
    expect(screen.getByTestId('route-probe-message')).toHaveTextContent('请先检查是否已安装 SkillHub 商店');
  }, 15000);

  it('keeps provider actions visible and opens full details for long search summaries', async () => {
    const fullDescription = '将用户讲稿一键生成布布斯风极简科技感竖屏HTML演示稿。当用户需要生成PPT、演示文稿、Slides、幻灯片，或者要求科技风、极简风、布布斯风排版时使用。';
    hostApiFetchMock.mockImplementation(async (path: string) => {
      if (path === '/api/skills/providers/skillhub/search') {
        return {
          success: true,
          results: [
            {
              id: 'skillhub:ppt-master',
              providerId: 'skillhub',
              providerSkillId: 'ppt-master',
              slug: 'ppt-master',
              name: 'PPT Master',
              description: fullDescription,
              version: '2.0.0',
              author: 'wwlyzzyorg',
              sourceLabel: 'SkillHub',
              installCapability: {
                providerId: 'skillhub',
                executionKind: 'chat-prompt',
              },
              metadata: {
                sourceUrl: 'https://skillhub.tencent.com/',
              },
            },
          ],
        };
      }
      return { success: true };
    });

    render(
      <MemoryRouter>
        <Skills />
      </MemoryRouter>,
    );

    fireEvent.pointerDown(screen.getByRole('button', { name: '添加技能' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: '从 SkillHub 搜索' }));

    const dialog = await screen.findByRole('dialog');
    expect(await within(dialog).findByText('PPT Master')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: '详情' })).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: '发送到聊天' })).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole('button', { name: '详情' }));

    const detailDialog = await screen.findAllByRole('dialog');
    expect(detailDialog.at(-1)).toHaveTextContent(fullDescription);
  }, 15000);

  it('restores the local search query from the skills-to-chat return context', () => {
    window.sessionStorage.setItem('xclaw.skills.return-context', JSON.stringify({
      localQuery: 'arxiv',
    }));

    render(
      <MemoryRouter>
        <Skills />
      </MemoryRouter>,
    );

    expect(screen.getByPlaceholderText('搜索已经安装的技能')).toHaveValue('arxiv');
  });

  it('prefers localized skill descriptions when xclaw has curated copy', () => {
    render(
      <MemoryRouter>
        <Skills />
      </MemoryRouter>,
    );

    expect(screen.getByText('AI 智能体人格分析与配置系统，用于快速建立一致的协作风格。')).toBeInTheDocument();
    expect(screen.queryByText('AI Agent personality diagnosis and configuration system.')).not.toBeInTheDocument();
  });

  it('supports desktop keyboard navigation across skill cards', () => {
    render(
      <MemoryRouter>
        <Skills />
      </MemoryRouter>,
    );

    const firstCard = screen.getByTestId('skills-card-agent-mbti');
    const secondCard = screen.getByTestId('skills-card-arxiv-reader');

    firstCard.focus();
    expect(firstCard).toHaveFocus();

    fireEvent.keyDown(firstCard, { key: 'ArrowRight' });
    expect(secondCard).toHaveFocus();

    fireEvent.keyDown(secondCard, { key: 'ArrowLeft' });
    expect(firstCard).toHaveFocus();

    fireEvent.keyDown(firstCard, { key: 'End' });
    expect(secondCard).toHaveFocus();

    fireEvent.keyDown(secondCard, { key: 'Home' });
    expect(firstCard).toHaveFocus();
  });

  it('shows a pending desktop state while toggling a skill from the card', async () => {
    let resolveToggle: (() => void) | null = null;
    skillsState.disableSkill = vi.fn().mockImplementation(
      () => new Promise<void>((resolve) => {
        resolveToggle = resolve;
      }),
    );

    render(
      <MemoryRouter>
        <Skills />
      </MemoryRouter>,
    );

    const switchButton = screen.getByTestId('skills-card-switch-agent-mbti');
    fireEvent.click(switchButton);

    await waitFor(() => {
      expect(switchButton).toBeDisabled();
    });
    expect(screen.getByText('更新中')).toBeInTheDocument();

    resolveToggle?.();

    await waitFor(() => {
      expect(switchButton).not.toBeDisabled();
    });
    expect(screen.queryByText('更新中')).not.toBeInTheDocument();
  });

  it('locks the detail action button while a toggle is still pending', async () => {
    let resolveToggle: (() => void) | null = null;
    skillsState.disableSkill = vi.fn().mockImplementation(
      () => new Promise<void>((resolve) => {
        resolveToggle = resolve;
      }),
    );

    render(
      <MemoryRouter>
        <Skills />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByText('agent-mbti'));

    const detailButton = await screen.findByRole('button', { name: '禁用' });
    fireEvent.click(detailButton);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '更新中' })).toBeDisabled();
    });

    resolveToggle?.();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '启用' })).not.toBeDisabled();
    });
  }, 15000);
});
