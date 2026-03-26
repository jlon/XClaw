import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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
      init: vi.fn().mockResolvedValue(undefined),
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
  motion: new Proxy({}, {
    get: () => ({ children, layout: _layout, ...props }: { children: unknown; layout?: unknown }) => <div {...props}>{children}</div>,
  }),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

const { tMock } = vi.hoisted(() => ({
  tMock: (key: string) => ({
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
    'takeover.preparation.title': '准备接管当前 OpenClaw 环境',
    'takeover.preparation.description': '先确认将导入的内容和潜在冲突，再执行真正的接管。',
    'takeover.preparation.pendingHint': '点击“导入并继续”后，XClaw 才会开始真正的接管和导入。',
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
    'wizard.rail.title': '引导流程',
    'wizard.rail.aria': '引导步骤',
    'wizard.stages.start.label': '开始',
    'wizard.stages.start.description': '确认要接管还是全新开始',
    'wizard.stages.preparation.label': '准备',
    'wizard.stages.preparation.description': '检查环境并准备导入',
    'wizard.stages.provider.label': '模型与接入',
    'wizard.stages.provider.description': '确认模型接入或复用结果',
    'wizard.stages.complete.label': '完成',
    'wizard.stages.complete.description': '确认完成并进入应用',
    'wizard.stages.complete.applyingDescription': '正在应用最终变更',
    'wizard.actions.takeoverImport': '导入并继续',
    'wizard.actions.takeoverImportAndReview': '导入并进入 Provider 复核',
    'wizard.actions.providerReview': '前往 Provider 复核',
    'wizard.actions.reviewSummary': '查看摘要',
    'wizard.actions.providerSubmit': '保存并继续',
    'wizard.footer.start.title': '开始引导',
    'wizard.footer.start.body': '先确认怎么开始，再继续后面的准备和接入。',
    'wizard.footer.start.primary': '下一步',
    'wizard.footer.start.secondary': '退出引导',
    'wizard.footer.preparation.title': '准备环境',
    'wizard.footer.preparation.body': '先完成本地环境确认，再进入模型与接入。',
    'wizard.footer.preparation.primary': '下一步',
    'wizard.footer.preparation.secondary': '返回',
    'wizard.footer.provider.title': '模型与接入',
    'wizard.footer.provider.body': '先选接入方式，再继续下一步。',
    'wizard.footer.provider.primary': '下一步',
    'wizard.footer.provider.secondary': '返回',
    'wizard.footer.complete.title': '完成',
    'wizard.footer.complete.body': '确认变更并进入应用。',
    'wizard.footer.complete.primary': '进入 XClaw',
    'wizard.footer.complete.secondary': '返回',
    'wizard.footer.enhancements.title': '准备核心环境',
    'wizard.footer.enhancements.body': '先完成 Python 运行时准备，成功后会自动进入最终摘要。',
    'wizard.footer.applying.title': '正在应用变更',
    'wizard.footer.applying.body': '请保持窗口打开，完成后会自动进入摘要。',
    'nav.next': '下一步',
    'nav.back': '返回',
    'nav.skipSetup': '跳过设置',
    'nav.getStarted': '开始使用',
    'complete.title': '设置完成！',
    'complete.subtitle': 'XClaw 已配置并准备就绪。',
    'complete.applying.title': '正在完成设置',
    'complete.applying.subtitle': 'XClaw 正在写入最终配置并启动核心服务，请保持窗口打开。',
    'complete.applying.details': '通常只需要几秒钟，完成后会自动进入应用。',
    'complete.provider': 'AI 提供商',
    'complete.gateway': '网关',
    'complete.running': '运行中',
    'complete.footer': '你可以在设置中继续调整其它能力。',
    'complete.gatewayPendingHint': '网关还在准备中。',
    'complete.enhancements.stageTitle': '准备核心环境',
    'complete.enhancements.stageSubtitle': '先确认 uv、Python 运行时和工作室依赖都已就绪，再进入最终摘要。',
    'complete.enhancements.title': '核心运行环境',
    'complete.enhancements.requiredBody': 'XClaw 会在这里准备 uv、Python 运行时，以及工作室所需的 Python 依赖。若本机已有可复用环境，会优先直接复用；否则必须先完成准备。',
    'complete.enhancements.readyTitle': '增强能力已就绪',
    'complete.enhancements.readyBody': '已检测到可复用的本机环境与工作室依赖。',
    'complete.enhancements.prepareNow': '准备核心环境',
    'complete.enhancements.preparing': '准备中...',
    'complete.enhancements.prepareFailed': '增强能力准备失败',
    'complete.enhancements.prepareIncomplete': '核心环境或工作室依赖尚未完成，请稍后重试。',
    'complete.enhancements.prepareCancelled': '已取消核心环境准备',
    'complete.enhancements.uvLabel': 'uv 环境',
    'complete.enhancements.pythonLabel': 'Python 运行时',
    'complete.enhancements.studioLabel': '工作室运行时',
    'complete.enhancements.checking': '检查中',
    'complete.enhancements.reused': '已复用',
    'complete.enhancements.notReady': '尚未就绪',
    'complete.enhancements.required': '必须完成',
    'complete.enhancements.logsShow': '查看日志',
    'complete.enhancements.logsHide': '收起日志',
    'complete.enhancements.logsTitle': '安装日志',
    'complete.enhancements.cancel': '取消准备',
  }[key] ?? key),
}));

vi.mock('react-i18next', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-i18next')>();
  return {
    ...actual,
    useTranslation: () => ({
      t: tMock,
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
  let environmentState: {
    uvInstalled: boolean;
    pythonReady: boolean;
    studioDependenciesReady: boolean;
    studioInterpreterReady: boolean;
    studioError: string | null;
  };
  let prepareTaskState: {
    state: 'idle' | 'running' | 'succeeded' | 'failed' | 'cancelled';
    step: 'idle' | 'uv' | 'python' | 'studio' | 'verify';
    canCancel: boolean;
    error: string | null;
    logs: Array<{ id: number; level: 'info' | 'error'; message: string }>;
  };
  let prepareTaskStatusCalls: number;
  let prepareTaskMode: 'instant-success' | 'manual';

  const handleSetupEnvironmentHostApi = async (path: string, init?: RequestInit) => {
    if (path === '/api/app/setup-environment-status') {
      return environmentState;
    }
    if (path === '/api/app/setup-environment-task') {
      prepareTaskStatusCalls += 1;
      if (prepareTaskMode === 'instant-success' && prepareTaskState.state === 'running') {
        environmentState = {
          uvInstalled: true,
          pythonReady: true,
          studioDependenciesReady: true,
          studioInterpreterReady: true,
          studioError: null,
        };
        prepareTaskState = {
          state: 'succeeded',
          step: 'verify',
          canCancel: false,
          error: null,
          startedAt: null,
          finishedAt: Date.now(),
          logs: [
            ...prepareTaskState.logs,
            { id: prepareTaskState.logs.length + 1, level: 'info', message: '核心环境已准备完成' },
          ],
        } as typeof prepareTaskState;
      }
      if (prepareTaskMode === 'manual' && prepareTaskState.state === 'running' && prepareTaskStatusCalls >= 2 && prepareTaskState.logs.length === 1) {
        prepareTaskState = {
          ...prepareTaskState,
          step: 'studio',
          logs: [
            ...prepareTaskState.logs,
            { id: 2, level: 'info', message: '正在安装工作室依赖' },
          ],
        };
      }
      return prepareTaskState;
    }
    if (path === '/api/app/setup-environment-prepare' && init?.method === 'POST') {
      prepareTaskStatusCalls = 0;
      prepareTaskState = {
        state: 'running',
        step: prepareTaskMode === 'manual' ? 'python' : 'uv',
        canCancel: true,
        error: null,
        startedAt: Date.now(),
        finishedAt: null,
        logs: [
          {
            id: 1,
            level: 'info',
            message: prepareTaskMode === 'manual' ? '正在安装 Python 运行时' : '正在检查 uv 环境',
          },
        ],
      } as typeof prepareTaskState;
      return prepareTaskState;
    }
    if (path === '/api/app/setup-environment-cancel' && init?.method === 'POST') {
      prepareTaskState = {
        state: 'cancelled',
        step: 'idle',
        canCancel: false,
        error: null,
        logs: [
          ...prepareTaskState.logs,
          { id: prepareTaskState.logs.length + 1, level: 'info', message: '已取消核心环境准备' },
        ],
      };
      return { success: true };
    }
    throw new Error(`Unexpected host API path: ${path}`);
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    settingsState.language = 'zh-CN';
    settingsState.devModeUnlocked = false;
    settingsState.gatewayPort = 18789;
    settingsState.setGatewayPort = vi.fn();
    gatewayState.status = { state: 'stopped', port: 18789 };
    gatewayState.init = vi.fn().mockResolvedValue(undefined);
    gatewayState.start = vi.fn();
    environmentState = {
      uvInstalled: false,
      pythonReady: false,
      studioDependenciesReady: false,
      studioInterpreterReady: false,
      studioError: null,
    };
    prepareTaskState = {
      state: 'idle',
      step: 'idle',
      canCancel: false,
      error: null,
      logs: [],
    };
    prepareTaskStatusCalls = 0;
    prepareTaskMode = 'instant-success';
    hostApiFetchMock.mockImplementation(handleSetupEnvironmentHostApi);
    invokeIpcMock.mockImplementation(async (channel: string) => {
      if (channel === 'setup:environment-status') {
        return environmentState;
      }
      if (channel === 'setup:prepare-environment-status') {
        prepareTaskStatusCalls += 1;
        if (prepareTaskMode === 'instant-success' && prepareTaskState.state === 'running') {
          environmentState = {
            uvInstalled: true,
            pythonReady: true,
            studioDependenciesReady: true,
            studioInterpreterReady: true,
            studioError: null,
          };
          prepareTaskState = {
            state: 'succeeded',
            step: 'verify',
            canCancel: false,
            error: null,
            startedAt: null,
            finishedAt: Date.now(),
            logs: [
              ...prepareTaskState.logs,
              { id: prepareTaskState.logs.length + 1, level: 'info', message: '核心环境已准备完成' },
            ],
          } as typeof prepareTaskState;
        }
        if (prepareTaskMode === 'manual' && prepareTaskState.state === 'running' && prepareTaskStatusCalls >= 2 && prepareTaskState.logs.length === 1) {
          prepareTaskState = {
            ...prepareTaskState,
            step: 'studio',
            logs: [
              ...prepareTaskState.logs,
              { id: 2, level: 'info', message: '正在安装工作室依赖' },
            ],
          };
        }
        return prepareTaskState;
      }
      if (channel === 'setup:prepare-environment') {
        prepareTaskStatusCalls = 0;
        prepareTaskState = {
          state: 'running',
          step: prepareTaskMode === 'manual' ? 'python' : 'uv',
          canCancel: true,
          error: null,
          startedAt: Date.now(),
          finishedAt: null,
          logs: [
            {
              id: 1,
              level: 'info',
              message: prepareTaskMode === 'manual' ? '正在安装 Python 运行时' : '正在检查 uv 环境',
            },
          ],
        } as typeof prepareTaskState;
        return prepareTaskState;
      }
      if (channel === 'setup:prepare-environment-cancel') {
        prepareTaskState = {
          state: 'cancelled',
          step: 'idle',
          canCancel: false,
          error: null,
          logs: [
            ...prepareTaskState.logs,
            { id: prepareTaskState.logs.length + 1, level: 'info', message: '已取消核心环境准备' },
          ],
        };
        return { success: true };
      }
      return false;
    });
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

      return handleSetupEnvironmentHostApi(path, init);
    });

    render(<Setup />);

    await waitFor(() => {
      expect(screen.getByText('检测到现有 OpenClaw')).toBeInTheDocument();
    });

    expect(screen.getAllByText('接管现有安装').length).toBeGreaterThan(0);
    expect(screen.getByText('从头创建')).toBeInTheDocument();
    expect(screen.getByText((content) => content.includes('检测到外部 Gateway 仍在运行，请先停止后再继续接管'))).toBeInTheDocument();
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

      return handleSetupEnvironmentHostApi(path, init);
    });

    render(<Setup />);

    await waitFor(() => {
      expect(screen.getAllByText('接管现有安装').length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getByText('从头创建'));

    expect(screen.getAllByText('/Users/test/.openclaw/workspace-xclaw').length).toBeGreaterThan(0);
    expect(screen.getAllByText('18790').length).toBeGreaterThan(0);
    expect(screen.queryByText('当前不能直接接管')).not.toBeInTheDocument();
    expect(screen.queryByText('检测到外部 Gateway 仍在运行，请先停止后再继续接管')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '下一步' })).toBeEnabled();
  });

  it('does not expose a global skip-setup action in the desktop wizard shell', async () => {
    hostApiFetchMock.mockImplementation(async (path: string, init?: RequestInit) => {
      if (path === '/api/app/setup-inspection') {
        return {
          hasExistingOpenClaw: false,
          suggestedMode: 'fresh',
          counts: {
            runtimeProviders: 0,
            skills: 0,
            extensions: 0,
          },
          defaultWorkspacePath: '/Users/test/.openclaw/workspace',
        };
      }

      if (path === '/api/app/setup-plan' && init?.method === 'POST') {
        return {
          mode: 'fresh',
          canApply: true,
          blockingIssues: [],
          warnings: [],
          runtime: {
            gatewayPort: 18789,
            portAvailable: true,
            suggestedGatewayPort: 18789,
            externalGatewayDetected: false,
            configChanging: false,
          },
          workspace: {
            defaultPath: '/Users/test/.openclaw/workspace',
            configuredPaths: [],
          },
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

      return handleSetupEnvironmentHostApi(path, init);
    });

    render(<Setup />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '下一步' })).toBeInTheDocument();
    });

    expect(screen.queryByRole('button', { name: '跳过设置' })).not.toBeInTheDocument();
  });

  it('moves takeover import behind the preparation stage instead of running it from the start step', async () => {
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

      return handleSetupEnvironmentHostApi(path, init);
    });

    render(<Setup />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '下一步' })).toBeEnabled();
    });

    fireEvent.click(screen.getByRole('button', { name: '下一步' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '返回' })).toBeInTheDocument();
    });

    expect(hostApiFetchMock).not.toHaveBeenCalledWith(
      '/api/app/takeover-import',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(markSetupCompleteMock).not.toHaveBeenCalled();
    expect(navigateMock).not.toHaveBeenCalled();
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

      return handleSetupEnvironmentHostApi(path, init);
    });

    render(<Setup />);

    await waitFor(() => {
      expect(screen.getAllByText('接管现有安装').length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getByRole('button', { name: '下一步' }));
    fireEvent.click(screen.getByRole('button', { name: '导入并继续' }));

    await waitFor(() => {
      expect(hostApiFetchMock).toHaveBeenCalledWith(
        '/api/app/takeover-import',
        expect.objectContaining({
          method: 'POST',
        }),
      );
    });
    expect(hostApiFetchMock).not.toHaveBeenCalledWith(
      '/api/app/setup-activation',
      expect.objectContaining({
        method: 'POST',
      }),
    );

    await waitFor(() => {
      expect(screen.getByText('核心运行环境')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '准备核心环境' })).toBeEnabled();
    });

    fireEvent.click(screen.getByRole('button', { name: '准备核心环境' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '开始使用' })).toBeEnabled();
    });

    fireEvent.click(screen.getByRole('button', { name: '开始使用' }));

    await waitFor(() => {
      expect(hostApiFetchMock).toHaveBeenCalledWith(
        '/api/app/setup-activation',
        expect.objectContaining({
          method: 'POST',
        }),
      );
      expect(navigateMock).toHaveBeenCalledWith('/');
    });
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

      return handleSetupEnvironmentHostApi(path, init);
    });

    render(<Setup />);

    await waitFor(() => {
      expect(screen.getAllByText('接管现有安装').length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getByRole('button', { name: '下一步' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '导入并进入 Provider 复核' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: '导入并进入 Provider 复核' }));

    await waitFor(() => {
      expect(screen.getByText('请复核 Provider 导入结果')).toBeInTheDocument();
    });

    expect(markSetupCompleteMock).not.toHaveBeenCalled();
    expect(navigateMock).not.toHaveBeenCalled();
    expect(screen.getAllByText('moonshot').length).toBeGreaterThan(0);
    expect(screen.getByText('需要人工复核的导入项')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '下一步' }));

    await waitFor(() => {
      expect(screen.getByText('核心运行环境')).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '准备核心环境' })).toBeEnabled();
    });

    fireEvent.click(screen.getByRole('button', { name: '准备核心环境' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '开始使用' })).toBeInTheDocument();
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
  }, 15000);

  it('shows a dedicated applying state while final setup activation is still pending', async () => {
    let resolveActivation: ((value: { success: boolean }) => void) | null = null;

    hostApiFetchMock.mockImplementation((path: string, init?: RequestInit) => {
      if (path === '/api/app/setup-inspection') {
        return Promise.resolve({
          hasExistingOpenClaw: true,
          suggestedMode: 'takeover',
          counts: {
            runtimeProviders: 1,
            skills: 2,
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

      if (path === '/api/app/takeover-import' && init?.method === 'POST') {
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

      if (path === '/api/app/setup-activation' && init?.method === 'POST') {
        return new Promise((resolve) => {
          resolveActivation = resolve;
        });
      }

      return handleSetupEnvironmentHostApi(path, init);
    });

    render(<Setup />);

    await waitFor(() => {
      expect(screen.getAllByText('接管现有安装').length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getByRole('button', { name: '下一步' }));
    fireEvent.click(screen.getByRole('button', { name: '导入并继续' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '准备核心环境' })).toBeEnabled();
    });

    fireEvent.click(screen.getByRole('button', { name: '准备核心环境' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '开始使用' })).toBeEnabled();
    });

    fireEvent.click(screen.getByRole('button', { name: '开始使用' }));

    await waitFor(() => {
      expect(hostApiFetchMock).toHaveBeenCalledWith(
        '/api/app/setup-activation',
        expect.objectContaining({ method: 'POST' }),
      );
    });

    expect(screen.getByText('正在完成设置')).toBeInTheDocument();
    expect(screen.getByText('通常只需要几秒钟，完成后会自动进入应用。')).toBeInTheDocument();
    expect(screen.queryByText('设置完成！')).not.toBeInTheDocument();
    const activationAction = screen.getByRole('button', { name: '开始使用' });

    expect(activationAction).toBeDisabled();
    expect(activationAction).toHaveAttribute('aria-busy', 'true');
    expect(activationAction.querySelector('svg.animate-spin')).not.toBeNull();

    resolveActivation?.({ success: true });
  });

  it('keeps the enhancement step visible when only the Studio runtime dependencies are missing', async () => {
    environmentState = {
      uvInstalled: true,
      pythonReady: true,
      studioDependenciesReady: false,
      studioInterpreterReady: true,
      studioError: 'Studio virtual environment is missing',
    };

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

      if (path === '/api/app/takeover-import' && init?.method === 'POST') {
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

      return handleSetupEnvironmentHostApi(path, init);
    });

    render(<Setup />);

    await waitFor(() => {
      expect(screen.getAllByText('接管现有安装').length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getByRole('button', { name: '下一步' }));
    fireEvent.click(screen.getByRole('button', { name: '导入并继续' }));

    await waitFor(() => {
      expect(screen.getByText('核心运行环境')).toBeInTheDocument();
    });

    expect(screen.getByText('工作室运行时')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: '准备核心环境' })).toBeEnabled();
    });
  });

  it('shows live setup logs and allows cancelling environment preparation', async () => {
    prepareTaskMode = 'manual';

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

      if (path === '/api/app/takeover-import' && init?.method === 'POST') {
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

      return handleSetupEnvironmentHostApi(path, init);
    });

    render(<Setup />);

    await waitFor(() => {
      expect(screen.getAllByText('接管现有安装').length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getByRole('button', { name: '下一步' }));
    fireEvent.click(screen.getByRole('button', { name: '导入并继续' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '准备核心环境' })).toBeEnabled();
    });

    fireEvent.click(screen.getByRole('button', { name: '准备核心环境' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '取消准备' })).toBeEnabled();
    });

    expect(screen.getByText('安装日志')).toBeInTheDocument();
    expect(screen.getAllByText('正在安装 Python 运行时').length).toBeGreaterThan(0);

    await waitFor(() => {
      expect(screen.getAllByText('正在安装工作室依赖').length).toBeGreaterThan(0);
    }, { timeout: 2500 });

    fireEvent.click(screen.getByRole('button', { name: '收起日志' }));
    expect(screen.queryAllByText('正在安装 Python 运行时')).toHaveLength(0);

    fireEvent.click(screen.getByRole('button', { name: '查看日志' }));
    expect(screen.getAllByText('正在安装 Python 运行时').length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: '取消准备' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '准备核心环境' })).toBeEnabled();
    });

    expect(screen.queryByRole('button', { name: '取消准备' })).not.toBeInTheDocument();
    expect(hostApiFetchMock).toHaveBeenCalledWith(
      '/api/app/setup-environment-cancel',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('renders the live enhancement status below the action row so log text does not shove footer actions around', async () => {
    prepareTaskMode = 'manual';

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

      if (path === '/api/app/takeover-import' && init?.method === 'POST') {
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

      return handleSetupEnvironmentHostApi(path, init);
    });

    render(<Setup />);

    await waitFor(() => {
      expect(screen.getAllByText('接管现有安装').length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getByRole('button', { name: '下一步' }));
    fireEvent.click(screen.getByRole('button', { name: '导入并继续' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '准备核心环境' })).toBeEnabled();
    });

    fireEvent.click(screen.getByRole('button', { name: '准备核心环境' }));

    const actionRow = await screen.findByTestId('setup-enhancement-actions');
    const statusRow = await screen.findByTestId('setup-enhancement-live-status');

    expect(actionRow).toHaveClass('justify-end');
    expect(actionRow).toHaveClass('sm:flex-nowrap');
    expect(statusRow).toHaveTextContent('正在安装 Python 运行时');
    expect(within(actionRow).queryByText('正在安装 Python 运行时')).not.toBeInTheDocument();
    expect(within(actionRow).getByRole('button', { name: '取消准备' })).toBeEnabled();
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

      return handleSetupEnvironmentHostApi(path, init);
    });

    render(<Setup />);

    await waitFor(() => {
      expect(screen.getAllByText('接管现有安装').length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getByRole('button', { name: '下一步' }));
    fireEvent.click(screen.getByRole('button', { name: '导入并继续' }));

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
      expect(screen.getByText('核心运行环境')).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '准备核心环境' })).toBeEnabled();
    });

    fireEvent.click(screen.getByRole('button', { name: '准备核心环境' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '开始使用' })).toBeInTheDocument();
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
  }, 15000);

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

      return handleSetupEnvironmentHostApi(path, init);
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
      expect(screen.getByText('核心运行环境')).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '准备核心环境' })).toBeEnabled();
    });

    fireEvent.click(screen.getByRole('button', { name: '准备核心环境' }));

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

      return handleSetupEnvironmentHostApi(path, init);
    });

    render(<Setup />);

    await waitFor(() => {
      expect(screen.getByText('请复核 Provider 导入结果')).toBeInTheDocument();
    });

    expect(screen.queryByText('接管现有安装')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '下一步' }));

    await waitFor(() => {
      expect(screen.getByText('核心运行环境')).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '准备核心环境' })).toBeEnabled();
    }, { timeout: 5000 });

    fireEvent.click(screen.getByRole('button', { name: '准备核心环境' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '开始使用' })).toBeInTheDocument();
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

      return handleSetupEnvironmentHostApi(path, init);
    });

    render(<Setup />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '下一步' })).toBeEnabled();
    });

    fireEvent.click(screen.getByRole('button', { name: '下一步' }));
    fireEvent.click(screen.getByRole('button', { name: '导入并继续' }));

    await waitFor(() => {
      expect(hostApiFetchMock).toHaveBeenCalledWith(
        '/api/app/takeover-import',
        expect.objectContaining({ method: 'POST' }),
      );
    });

    await waitFor(() => {
      expect(hostApiFetchMock).toHaveBeenCalledWith('/api/app/takeover-status');
    });

    const takeoverAction = screen.getByRole('button', { name: '导入并继续' });

    expect(takeoverAction).toBeDisabled();
    expect(takeoverAction).toHaveAttribute('aria-busy', 'true');
    expect(takeoverAction.querySelector('svg.animate-spin')).not.toBeNull();

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
      expect(screen.getByText('核心运行环境')).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '准备核心环境' })).toBeEnabled();
    }, { timeout: 5000 });

    fireEvent.click(screen.getByRole('button', { name: '准备核心环境' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '开始使用' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: '开始使用' }));

    await waitFor(() => {
      expect(hostApiFetchMock).toHaveBeenCalledWith(
        '/api/app/setup-activation',
        expect.objectContaining({ method: 'POST' }),
      );
    });
  }, 15000);

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

      return handleSetupEnvironmentHostApi(path, init);
    });

    render(<Setup />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '下一步' })).toBeEnabled();
    });

    fireEvent.click(screen.getByRole('button', { name: '下一步' }));

    const action = screen.getByRole('button', { name: '导入并继续' });
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
      expect(screen.getByText('核心运行环境')).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '准备核心环境' })).toBeEnabled();
    });

    fireEvent.click(screen.getByRole('button', { name: '准备核心环境' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '开始使用' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: '开始使用' }));

    await waitFor(() => {
      expect(hostApiFetchMock).toHaveBeenCalledWith(
        '/api/app/setup-activation',
        expect.objectContaining({ method: 'POST' }),
      );
    });
  }, 15000);
});
