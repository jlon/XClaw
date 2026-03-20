import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Setup } from '@/pages/Setup/index';

const {
  hostApiFetchMock,
  invokeIpcMock,
  navigateMock,
  markSetupCompleteMock,
  settingsState,
  gatewayState,
} = vi.hoisted(() => {
  const markSetupComplete = vi.fn().mockResolvedValue(undefined);
  return {
    hostApiFetchMock: vi.fn(),
    invokeIpcMock: vi.fn(),
    navigateMock: vi.fn(),
    markSetupCompleteMock: markSetupComplete,
    settingsState: {
      language: 'zh-CN',
      devModeUnlocked: false,
      gatewayPort: 18789,
      markSetupComplete,
      setGatewayPort: vi.fn(),
      setLanguage: vi.fn(),
    },
    gatewayState: {
      status: { state: 'stopped', port: 18789 },
      start: vi.fn(),
    },
  };
});

vi.mock('@/lib/host-api', () => ({
  hostApiFetch: (...args: unknown[]) => hostApiFetchMock(...args),
}));

vi.mock('@/lib/api-client', () => ({
  invokeIpc: (...args: unknown[]) => invokeIpcMock(...args),
}));

vi.mock('@/lib/host-events', () => ({
  subscribeHostEvent: vi.fn().mockReturnValue(() => {}),
}));

vi.mock('@/stores/settings', () => ({
  useSettingsStore: Object.assign(
    (selector?: (state: typeof settingsState) => unknown) => (
      selector ? selector(settingsState) : settingsState
    ),
    {
      getState: () => settingsState,
    },
  ),
}));

vi.mock('@/stores/gateway', () => ({
  useGatewayStore: Object.assign(
    (selector?: (state: typeof gatewayState) => unknown) => (
      selector ? selector(gatewayState) : gatewayState
    ),
    {
      getState: () => gatewayState,
    },
  ),
}));

vi.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ children }: { children: unknown }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: unknown }) => <>{children}</>,
  TooltipContent: ({ children }: { children: unknown }) => <>{children}</>,
}));

vi.mock('framer-motion', () => ({
  AnimatePresence: ({ children }: { children: unknown }) => <>{children}</>,
  motion: {
    div: ({ children, ...props }: { children: unknown }) => <div {...props}>{children}</div>,
  },
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock('react-i18next', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-i18next')>();
  return {
    ...actual,
    useTranslation: () => ({
      t: (key: string) => ({
        'steps.takeover.title': '接管现有 OpenClaw',
        'steps.takeover.description': '检测到本地已有 OpenClaw 环境',
        'steps.providerReview.title': '复核 Provider 导入',
        'steps.providerReview.description': '这些导入项需要你确认',
        'providerReview.title': '请复核 Provider 导入结果',
        'providerReview.description': '接管已经完成，但仍有部分导入项需要你确认。',
        'providerReview.summary.imported': '已导入账户',
        'providerReview.summary.default': '默认账户',
        'providerReview.summary.conflicts': '冲突项',
        'providerReview.summary.unsupported': '未直接导入',
        'providerReview.defaultMissing': '未自动确定',
        'providerReview.conflictsTitle': '需要人工复核的导入项',
        'providerReview.nextHint': '你可以先继续进入应用，稍后在设置页修正这些 Provider。',
        'takeover.title': '检测到现有 OpenClaw',
        'takeover.description': '你可以接管当前环境，或继续创建新的 XClaw 配置。',
        'takeover.progress.idle': '等待开始接管',
        'takeover.progress.blocked': '正在校验是否允许接管',
        'takeover.progress.backup': '正在备份当前 XClaw 本地状态',
        'takeover.progress.import': '正在导入 OpenClaw 的 Provider 与认证信息',
        'takeover.progress.commit': '正在提交接管结果并写入完成状态',
        'takeover.progress.rollback': '接管失败，正在回滚本地状态',
        'takeover.progress.complete': '接管完成',
        'takeover.choice.takeover': '接管现有安装',
        'takeover.choice.fresh': '从头创建',
        'takeover.choice.takeoverDescription': '复用现有的 OpenClaw 配置、技能和 Provider 状态。',
        'takeover.choice.freshDescription': '保留现有 OpenClaw，同时创建一套新的 XClaw 默认配置。',
        'takeover.summary.providers': 'Provider',
        'takeover.summary.skills': '技能',
        'takeover.summary.extensions': '扩展',
        'takeover.summary.workspace': '工作区',
        'takeover.blockingTitle': '当前不能直接接管',
        'takeover.warningsTitle': '接管提醒',
        'takeover.mode.takeoverTitle': '将接管当前 OpenClaw 环境',
        'takeover.mode.takeoverDescription': 'XClaw 会导入现有 Provider、工作区和技能状态。',
        'takeover.mode.freshTitle': '将创建新的 XClaw 配置',
        'takeover.mode.freshDescription': '现有 OpenClaw 会保留不动，下一步继续确认不冲突的工作区和端口。',
        'takeover.mode.currentWorkspace': '当前工作区',
        'takeover.mode.recommendedWorkspace': '推荐新工作区',
        'takeover.mode.currentPort': '当前网关端口',
        'takeover.mode.recommendedPort': '推荐新端口',
        'takeover.mode.workspaceHint': 'XClaw 会默认使用这个新目录，后续你仍可修改。',
        'takeover.mode.portHint': '如果当前端口已被现有 OpenClaw 使用，XClaw 会引导你改成不冲突的端口。',
        'takeover.mode.nextHint': '下一步继续检查环境并确认这些值。',
        'takeover.mode.freshBlockingTitle': '当前配置还不能继续',
        'takeover.mode.freshWarningsTitle': '新建提醒',
        'nav.next': '下一步',
        'nav.back': '返回',
        'nav.skipSetup': '跳过设置',
        'nav.getStarted': '开始使用',
      }[key] ?? key),
      i18n: { language: 'zh-CN' },
    }),
  };
});

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  },
}));

describe('Setup takeover flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    settingsState.language = 'zh-CN';
    settingsState.devModeUnlocked = false;
    settingsState.gatewayPort = 18789;
    settingsState.setGatewayPort = vi.fn();
    gatewayState.status = { state: 'stopped', port: 18789 };
    gatewayState.start = vi.fn();
    invokeIpcMock.mockReset();
  });

  it('shows a takeover decision step and blocks direct takeover when the latest plan cannot apply', async () => {
    hostApiFetchMock.mockImplementation(async (path: string, init?: RequestInit) => {
      if (path === '/api/app/setup-inspection') {
        return {
          hasExistingOpenClaw: true,
          suggestedMode: 'takeover',
          counts: {
            runtimeProviders: 2,
            skills: 3,
            extensions: 1,
          },
          defaultWorkspacePath: '/Users/test/.openclaw/workspace',
        };
      }

      if (path === '/api/app/setup-plan' && init?.method === 'POST') {
        const body = JSON.parse(String(init.body));
        if (body.mode === 'takeover') {
          return {
            mode: 'takeover',
            canApply: false,
            blockingIssues: ['检测到外部 Gateway 仍在运行，请先停止后再继续接管'],
            warnings: [],
          };
        }

        return {
          mode: 'fresh',
          canApply: true,
          blockingIssues: [],
          warnings: [],
        };
      }

      throw new Error(`Unexpected host API path: ${path}`);
    });

    render(<Setup />);

    await waitFor(() => {
      expect(screen.getByText('检测到现有 OpenClaw')).toBeInTheDocument();
    });

    expect(screen.getByText('接管现有安装')).toBeInTheDocument();
    expect(screen.getByText('从头创建')).toBeInTheDocument();
    expect(screen.getByText('检测到外部 Gateway 仍在运行，请先停止后再继续接管')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '下一步' })).toBeDisabled();
  }, 15000);

  it('shows fresh-specific guidance with recommended workspace and port when creating a new config', async () => {
    hostApiFetchMock.mockImplementation(async (path: string, init?: RequestInit) => {
      if (path === '/api/app/setup-inspection') {
        return {
          hasExistingOpenClaw: true,
          suggestedMode: 'takeover',
          counts: {
            runtimeProviders: 2,
            skills: 3,
            extensions: 1,
          },
          gatewayPort: 18789,
          defaultWorkspacePath: '/Users/test/.openclaw/workspace',
        };
      }

      if (path === '/api/app/setup-plan' && init?.method === 'POST') {
        const body = JSON.parse(String(init.body));
        if (body.mode === 'takeover') {
          return {
            mode: 'takeover',
            canApply: false,
            blockingIssues: ['检测到外部 Gateway 仍在运行，请先停止后再继续接管'],
            warnings: [],
          };
        }

        return {
          mode: 'fresh',
          canApply: true,
          blockingIssues: [],
          warnings: [],
          runtime: {
            gatewayPort: 18790,
            portAvailable: true,
            suggestedGatewayPort: 18790,
            externalGatewayDetected: true,
            configChanging: false,
          },
          workspace: {
            defaultPath: '/Users/test/.openclaw/workspace-xclaw',
            configuredPaths: ['/Users/test/.openclaw/workspace'],
          },
        };
      }

      throw new Error(`Unexpected host API path: ${path}`);
    });

    render(<Setup />);

    await waitFor(() => {
      expect(screen.getByText('接管现有安装')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('从头创建'));

    await waitFor(() => {
      expect(screen.getAllByText('将创建新的 XClaw 配置').length).toBeGreaterThan(0);
    });

    expect(screen.getAllByText('/Users/test/.openclaw/workspace-xclaw').length).toBeGreaterThan(0);
    expect(screen.getAllByText('18790').length).toBeGreaterThan(0);
    expect(screen.queryByText('当前不能直接接管')).not.toBeInTheDocument();
    expect(screen.queryByText('检测到外部 Gateway 仍在运行，请先停止后再继续接管')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '下一步' })).toBeEnabled();
  });

  it('runs takeover import, syncs renderer setup state and navigates home after success', async () => {
    hostApiFetchMock.mockImplementation(async (path: string, init?: RequestInit) => {
      if (path === '/api/app/setup-inspection') {
        return {
          hasExistingOpenClaw: true,
          suggestedMode: 'takeover',
          counts: {
            runtimeProviders: 1,
            skills: 2,
            extensions: 0,
          },
          defaultWorkspacePath: '/Users/test/.openclaw/workspace',
        };
      }

      if (path === '/api/app/setup-plan' && init?.method === 'POST') {
        return {
          mode: JSON.parse(String(init.body)).mode,
          canApply: true,
          blockingIssues: [],
          warnings: [],
        };
      }

      if (path === '/api/app/takeover-import' && init?.method === 'POST') {
        return {
          state: 'complete',
          step: 'complete',
          importedAccountCount: 1,
          defaultAccountId: 'moonshot',
          warnings: [],
          conflicts: [],
          blockingIssues: [],
        };
      }

      if (path === '/api/app/takeover-status' && !init) {
        return {
          state: 'idle',
          step: 'idle',
          importedAccountCount: 0,
          defaultAccountId: null,
          warnings: [],
          conflicts: [],
          blockingIssues: [],
        };
      }

      if (path === '/api/app/setup-activation' && init?.method === 'POST') {
        return { success: true };
      }

      throw new Error(`Unexpected host API path: ${path}`);
    });

    render(<Setup />);

    await waitFor(() => {
      expect(screen.getByText('接管现有安装')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('接管现有安装'));
    fireEvent.click(screen.getByRole('button', { name: '下一步' }));

    await waitFor(() => {
      expect(hostApiFetchMock).toHaveBeenCalledWith(
        '/api/app/takeover-import',
        expect.objectContaining({
          method: 'POST',
        }),
      );
    });
    expect(hostApiFetchMock).toHaveBeenCalledWith(
      '/api/app/setup-activation',
      expect.objectContaining({
        method: 'POST',
      }),
    );
    expect(markSetupCompleteMock).toHaveBeenCalledTimes(1);
    expect(navigateMock).toHaveBeenCalledWith('/');
  });

  it('routes takeover with provider review requirements into a review step before finishing setup', async () => {
    hostApiFetchMock.mockImplementation(async (path: string, init?: RequestInit) => {
      if (path === '/api/app/setup-inspection') {
        return {
          hasExistingOpenClaw: true,
          suggestedMode: 'takeover',
          counts: {
            runtimeProviders: 2,
            skills: 2,
            extensions: 1,
          },
          defaultWorkspacePath: '/Users/test/.openclaw/workspace',
        };
      }

      if (path === '/api/app/setup-plan' && init?.method === 'POST') {
        return {
          mode: JSON.parse(String(init.body)).mode,
          canApply: true,
          blockingIssues: [],
          warnings: ['检测到需要人工确认的 provider 导入项'],
          providerImport: {
            defaultRuntimeProviderKey: 'moonshot',
            importableCount: 2,
            conflictCount: 1,
            unsupportedCount: 1,
            requiresReview: true,
          },
        };
      }

      if (path === '/api/app/takeover-import' && init?.method === 'POST') {
        return {
          state: 'complete',
          step: 'complete',
          importedAccountCount: 2,
          defaultAccountId: 'moonshot',
          warnings: ['检测到需要人工确认的 provider 导入项'],
          conflicts: ['moonshot'],
          blockingIssues: [],
        };
      }

      if (path === '/api/app/takeover-status' && !init) {
        return {
          state: 'idle',
          step: 'idle',
          importedAccountCount: 0,
          defaultAccountId: null,
          warnings: [],
          conflicts: [],
          blockingIssues: [],
        };
      }

      if (path === '/api/app/setup-activation' && init?.method === 'POST') {
        return { success: true };
      }

      throw new Error(`Unexpected host API path: ${path}`);
    });

    render(<Setup />);

    await waitFor(() => {
      expect(screen.getByText('接管现有安装')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: '下一步' }));

    await waitFor(() => {
      expect(screen.getByText('请复核 Provider 导入结果')).toBeInTheDocument();
    });

    expect(markSetupCompleteMock).not.toHaveBeenCalled();
    expect(navigateMock).not.toHaveBeenCalled();
    expect(screen.getAllByText('moonshot').length).toBeGreaterThan(0);
    expect(screen.getByText('需要人工复核的导入项')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '开始使用' }));

    await waitFor(() => {
      expect(hostApiFetchMock).toHaveBeenCalledWith(
        '/api/app/setup-activation',
        expect.objectContaining({ method: 'POST' }),
      );
      expect(markSetupCompleteMock).toHaveBeenCalledTimes(1);
    });
    expect(navigateMock).toHaveBeenCalledWith('/');
  });

  it('polls takeover status while import is still running', async () => {
    let resolveTakeoverImport: ((value: unknown) => void) | null = null;
    let takeoverStatusCalls = 0;
    hostApiFetchMock.mockImplementation((path: string, init?: RequestInit) => {
      if (path === '/api/app/setup-inspection') {
        return Promise.resolve({
          hasExistingOpenClaw: true,
          suggestedMode: 'takeover',
          counts: {
            runtimeProviders: 1,
            skills: 1,
            extensions: 0,
          },
          defaultWorkspacePath: '/Users/test/.openclaw/workspace',
        });
      }

      if (path === '/api/app/setup-plan' && init?.method === 'POST') {
        return Promise.resolve({
          mode: JSON.parse(String(init.body)).mode,
          canApply: true,
          blockingIssues: [],
          warnings: [],
        });
      }

      if (path === '/api/app/takeover-status' && !init) {
        takeoverStatusCalls += 1;
        if (takeoverStatusCalls === 1) {
          return Promise.resolve({
            state: 'idle',
            step: 'idle',
            importedAccountCount: 0,
            defaultAccountId: null,
            warnings: [],
            conflicts: [],
            blockingIssues: [],
          });
        }

        return Promise.resolve({
          state: 'running',
          step: 'commit',
          importedAccountCount: 1,
          defaultAccountId: 'moonshot',
          warnings: ['正在提交接管结果'],
          conflicts: [],
          blockingIssues: [],
        });
      }

      if (path === '/api/app/takeover-import' && init?.method === 'POST') {
        return new Promise((resolve) => {
          resolveTakeoverImport = resolve;
        });
      }

      if (path === '/api/app/setup-activation' && init?.method === 'POST') {
        return Promise.resolve({ success: true });
      }

      return Promise.reject(new Error(`Unexpected host API path: ${path}`));
    });

    render(<Setup />);

    await waitFor(() => {
      expect(screen.getByText('接管现有安装')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: '下一步' }));

    await waitFor(() => {
      expect(hostApiFetchMock).toHaveBeenCalledWith(
        '/api/app/takeover-import',
        expect.objectContaining({ method: 'POST' }),
      );
    });

    await waitFor(() => {
      expect(hostApiFetchMock).toHaveBeenCalledWith('/api/app/takeover-status');
    }, { timeout: 1500 });

    expect(screen.getByText('正在提交接管结果并写入完成状态')).toBeInTheDocument();
    expect(screen.getByText('正在提交接管结果')).toBeInTheDocument();

    resolveTakeoverImport?.({
      state: 'complete',
      step: 'complete',
      importedAccountCount: 1,
      defaultAccountId: 'moonshot',
      warnings: [],
      conflicts: [],
      blockingIssues: [],
    });

    await waitFor(() => {
      expect(hostApiFetchMock).toHaveBeenCalledWith(
        '/api/app/setup-activation',
        expect.objectContaining({ method: 'POST' }),
      );
      expect(markSetupCompleteMock).toHaveBeenCalledTimes(1);
    });
    expect(navigateMock).toHaveBeenCalledWith('/');
  });

  it('recovers an in-flight takeover after the setup page reloads', async () => {
    let takeoverStatusPolls = 0;
    hostApiFetchMock.mockImplementation((path: string, init?: RequestInit) => {
      if (path === '/api/app/setup-inspection') {
        return Promise.resolve({
          hasExistingOpenClaw: true,
          suggestedMode: 'takeover',
          counts: {
            runtimeProviders: 1,
            skills: 1,
            extensions: 0,
          },
          defaultWorkspacePath: '/Users/test/.openclaw/workspace',
        });
      }

      if (path === '/api/app/setup-plan' && init?.method === 'POST') {
        return Promise.resolve({
          mode: JSON.parse(String(init.body)).mode,
          canApply: true,
          blockingIssues: [],
          warnings: [],
        });
      }

      if (path === '/api/app/takeover-status' && !init) {
        takeoverStatusPolls += 1;
        if (takeoverStatusPolls === 1) {
          return Promise.resolve({
            state: 'running',
            step: 'commit',
            importedAccountCount: 1,
            defaultAccountId: 'moonshot',
            warnings: ['正在提交接管结果'],
            conflicts: [],
            blockingIssues: [],
          });
        }

        return Promise.resolve({
          state: 'complete',
          step: 'complete',
          importedAccountCount: 1,
          defaultAccountId: 'moonshot',
          warnings: [],
          conflicts: [],
          blockingIssues: [],
        });
      }

      if (path === '/api/app/setup-activation' && init?.method === 'POST') {
        return Promise.resolve({ success: true });
      }

      return Promise.reject(new Error(`Unexpected host API path: ${path}`));
    });

    render(<Setup />);

    await waitFor(() => {
      expect(hostApiFetchMock).toHaveBeenCalledWith('/api/app/takeover-status');
    });

    expect(hostApiFetchMock).not.toHaveBeenCalledWith(
      '/api/app/takeover-import',
      expect.anything(),
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '开始使用' })).toBeEnabled();
    });

    fireEvent.click(screen.getByRole('button', { name: '开始使用' }));

    await waitFor(() => {
      expect(hostApiFetchMock).toHaveBeenCalledWith(
        '/api/app/setup-activation',
        expect.objectContaining({ method: 'POST' }),
      );
      expect(markSetupCompleteMock).toHaveBeenCalledTimes(1);
    });
    expect(navigateMock).toHaveBeenCalledWith('/');
  });

  it('restores the provider review step when takeover already completed before the page reloads', async () => {
    hostApiFetchMock.mockImplementation((path: string, init?: RequestInit) => {
      if (path === '/api/app/setup-inspection') {
        return Promise.resolve({
          hasExistingOpenClaw: true,
          suggestedMode: 'takeover',
          counts: {
            runtimeProviders: 2,
            skills: 2,
            extensions: 1,
          },
          defaultWorkspacePath: '/Users/test/.openclaw/workspace',
        });
      }

      if (path === '/api/app/setup-plan' && init?.method === 'POST') {
        return Promise.resolve({
          mode: JSON.parse(String(init.body)).mode,
          canApply: true,
          blockingIssues: [],
          warnings: ['检测到需要人工确认的 provider 导入项'],
          providerImport: {
            defaultRuntimeProviderKey: 'moonshot',
            importableCount: 2,
            conflictCount: 1,
            unsupportedCount: 0,
            requiresReview: true,
          },
        });
      }

      if (path === '/api/app/takeover-status' && !init) {
        return Promise.resolve({
          state: 'complete',
          step: 'complete',
          importedAccountCount: 2,
          defaultAccountId: 'moonshot',
          warnings: ['检测到需要人工确认的 provider 导入项'],
          conflicts: ['moonshot'],
          blockingIssues: [],
        });
      }

      if (path === '/api/app/setup-activation' && init?.method === 'POST') {
        return Promise.resolve({ success: true });
      }

      return Promise.reject(new Error(`Unexpected host API path: ${path}`));
    });

    render(<Setup />);

    await waitFor(() => {
      expect(screen.getByText('请复核 Provider 导入结果')).toBeInTheDocument();
    });

    expect(screen.queryByText('接管现有安装')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '开始使用' }));

    await waitFor(() => {
      expect(hostApiFetchMock).toHaveBeenCalledWith(
        '/api/app/setup-activation',
        expect.objectContaining({ method: 'POST' }),
      );
      expect(markSetupCompleteMock).toHaveBeenCalledTimes(1);
    });
    expect(navigateMock).toHaveBeenCalledWith('/');
  });

  it('keeps the takeover action locked while the first status poll is still idle', async () => {
    let resolveTakeoverImport: ((value: unknown) => void) | null = null;
    let takeoverStatusCalls = 0;

    hostApiFetchMock.mockImplementation((path: string, init?: RequestInit) => {
      if (path === '/api/app/setup-inspection') {
        return Promise.resolve({
          hasExistingOpenClaw: true,
          suggestedMode: 'takeover',
          counts: {
            runtimeProviders: 1,
            skills: 1,
            extensions: 0,
          },
          defaultWorkspacePath: '/Users/test/.openclaw/workspace',
        });
      }

      if (path === '/api/app/setup-plan' && init?.method === 'POST') {
        return Promise.resolve({
          mode: JSON.parse(String(init.body)).mode,
          canApply: true,
          blockingIssues: [],
          warnings: [],
        });
      }

      if (path === '/api/app/takeover-status' && !init) {
        takeoverStatusCalls += 1;
        if (takeoverStatusCalls <= 2) {
          return Promise.resolve({
            state: 'idle',
            step: 'idle',
            importedAccountCount: 0,
            defaultAccountId: null,
            warnings: [],
            conflicts: [],
            blockingIssues: [],
          });
        }

        return Promise.resolve({
          state: 'running',
          step: 'commit',
          importedAccountCount: 1,
          defaultAccountId: 'moonshot',
          warnings: [],
          conflicts: [],
          blockingIssues: [],
        });
      }

      if (path === '/api/app/takeover-import' && init?.method === 'POST') {
        return new Promise((resolve) => {
          resolveTakeoverImport = resolve;
        });
      }

      if (path === '/api/app/setup-activation' && init?.method === 'POST') {
        return Promise.resolve({ success: true });
      }

      return Promise.reject(new Error(`Unexpected host API path: ${path}`));
    });

    render(<Setup />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '下一步' })).toBeEnabled();
    });

    fireEvent.click(screen.getByRole('button', { name: '下一步' }));

    await waitFor(() => {
      expect(hostApiFetchMock).toHaveBeenCalledWith(
        '/api/app/takeover-import',
        expect.objectContaining({ method: 'POST' }),
      );
    });

    await waitFor(() => {
      expect(hostApiFetchMock).toHaveBeenCalledWith('/api/app/takeover-status');
    });

    expect(screen.getByRole('button', { name: '下一步' })).toBeDisabled();

    resolveTakeoverImport?.({
      state: 'complete',
      step: 'complete',
      importedAccountCount: 1,
      defaultAccountId: 'moonshot',
      warnings: [],
      conflicts: [],
      blockingIssues: [],
    });

    await waitFor(() => {
      expect(hostApiFetchMock).toHaveBeenCalledWith(
        '/api/app/setup-activation',
        expect.objectContaining({ method: 'POST' }),
      );
    });
  });

  it('does not submit takeover import twice when the primary action is double-clicked', async () => {
    let resolveTakeoverImport: ((value: unknown) => void) | null = null;

    hostApiFetchMock.mockImplementation((path: string, init?: RequestInit) => {
      if (path === '/api/app/setup-inspection') {
        return Promise.resolve({
          hasExistingOpenClaw: true,
          suggestedMode: 'takeover',
          counts: {
            runtimeProviders: 1,
            skills: 1,
            extensions: 0,
          },
          defaultWorkspacePath: '/Users/test/.openclaw/workspace',
        });
      }

      if (path === '/api/app/setup-plan' && init?.method === 'POST') {
        return Promise.resolve({
          mode: JSON.parse(String(init.body)).mode,
          canApply: true,
          blockingIssues: [],
          warnings: [],
        });
      }

      if (path === '/api/app/takeover-status' && !init) {
        return Promise.resolve({
          state: 'idle',
          step: 'idle',
          importedAccountCount: 0,
          defaultAccountId: null,
          warnings: [],
          conflicts: [],
          blockingIssues: [],
        });
      }

      if (path === '/api/app/takeover-import' && init?.method === 'POST') {
        return new Promise((resolve) => {
          resolveTakeoverImport = resolve;
        });
      }

      if (path === '/api/app/setup-activation' && init?.method === 'POST') {
        return Promise.resolve({ success: true });
      }

      return Promise.reject(new Error(`Unexpected host API path: ${path}`));
    });

    render(<Setup />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '下一步' })).toBeEnabled();
    });

    const action = screen.getByRole('button', { name: '下一步' });
    fireEvent.click(action);
    fireEvent.click(action);

    await waitFor(() => {
      expect(
        hostApiFetchMock.mock.calls.filter(([path, init]) => (
          path === '/api/app/takeover-import' && (init as RequestInit | undefined)?.method === 'POST'
        )),
      ).toHaveLength(1);
    });

    resolveTakeoverImport?.({
      state: 'complete',
      step: 'complete',
      importedAccountCount: 1,
      defaultAccountId: 'moonshot',
      warnings: [],
      conflicts: [],
      blockingIssues: [],
    });

    await waitFor(() => {
      expect(hostApiFetchMock).toHaveBeenCalledWith(
        '/api/app/setup-activation',
        expect.objectContaining({ method: 'POST' }),
      );
    });
  });
});
