import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { Agents } from '@/pages/Agents/index';
import type { AgentSummary } from '@/types/agent';

const hostApiFetchMock = vi.fn();
const subscribeHostEventMock = vi.fn();
const fetchAgentsMock = vi.fn();

const { gatewayState, agentsState } = vi.hoisted(() => ({
  gatewayState: {
    status: { state: 'running', port: 18789 },
    rpc: vi.fn(),
  },
  agentsState: {
    agents: [] as AgentSummary[],
    defaultAgentId: 'main',
    configuredChannelTypes: [] as string[],
    channelOwners: {} as Record<string, string>,
    channelAccountOwners: {} as Record<string, string>,
    loading: false,
    error: null as string | null,
    fetchAgents: vi.fn(),
    createAgent: vi.fn(),
    updateAgent: vi.fn(),
    deleteAgent: vi.fn(),
    assignChannel: vi.fn(),
    removeChannel: vi.fn(),
    clearError: vi.fn(),
  },
}));

vi.mock('@/stores/gateway', () => ({
  useGatewayStore: (selector: (state: typeof gatewayState) => unknown) => selector(gatewayState),
}));

vi.mock('@/stores/agents', () => ({
  useAgentsStore: (selector?: (state: typeof agentsState) => unknown) => {
    const state = agentsState;
    return typeof selector === 'function' ? selector(state) : state;
  },
}));

vi.mock('@/lib/host-api', () => ({
  hostApiFetch: (...args: unknown[]) => hostApiFetchMock(...args),
}));

vi.mock('@/lib/host-events', () => ({
  subscribeHostEvent: (...args: unknown[]) => subscribeHostEventMock(...args),
}));

vi.mock('@/components/ui/confirm-dialog', () => ({
  ConfirmDialog: () => null,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: translate,
  }),
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  },
}));

function translate(key: string, vars?: Record<string, unknown>): string {
  if (key === 'title') return 'Agents';
  if (key === 'subtitle') return 'Agent 工作台';
  if (key === 'refresh') return '刷新';
  if (key === 'addAgent') return '新建';
  if (key === 'createDialog.title') return '新建智能体';
  if (key === 'createDialog.description') return '新建智能体';
  if (key === 'createDialog.nameLabel') return '智能体名称';
  if (key === 'createDialog.namePlaceholder') return 'Coding Helper';
  if (key === 'createDialog.modelLabel') return '模型';
  if (key === 'createDialog.modelSearchPlaceholder') return '搜索可用模型';
  if (key === 'createDialog.useDefaultModel') return '使用 OpenClaw 默认模型';
  if (key === 'createDialog.useDefaultModelDescription') return '移除当前智能体的模型覆盖。';
  if (key === 'createDialog.modelsLoading') return '正在读取可用模型…';
  if (key === 'createDialog.modelsLoadFailed') return '读取模型失败，请稍后重试。';
  if (key === 'createDialog.modelsEmpty') return '当前没有可选模型。';
  if (key === 'createDialog.modelsEmptySearch') return '没有匹配的模型。';
  if (key === 'gatewayWarning') return 'Gateway 服务未运行。';
  if (key === 'defaultBadge') return '默认';
  if (key === 'inherited') return '继承';
  if (key === 'deleteAgent') return '删除 Agent';
  if (key === 'workbench.modes.agents') return '本地';
  if (key === 'workbench.modes.market') return '市场';
  if (key === 'workbench.browse.agentsTitle') return '卡片浏览与配置';
  if (key === 'workbench.browse.agentsDescription') return '先发现和选择你的 Agent，再在右侧工作台管理概览与人格文件。';
  if (key === 'workbench.browse.marketTitle') return '选择并安装现成模板';
  if (key === 'workbench.browse.marketDescription') return '市场负责发现和安装，右侧负责确认来源、命名和落地。';
  if (key === 'workbench.browse.marketSearchPlaceholder') return '搜索模板、角色或分类';
  if (key === 'workbench.browse.refreshCatalog') return '刷新目录';
  if (key === 'workbench.detail.currentAgentLabel') return '当前 Agent';
  if (key === 'workbench.detail.emptyAgentTitle') return '先选择一个 Agent';
  if (key === 'workbench.detail.emptyAgentDescription') return '从左侧选择一个 Agent，右侧会展开概览与人格文件工作台。';
  if (key === 'workbench.detail.emptyMarketTitle') return '选择一个市场模板';
  if (key === 'workbench.detail.emptyMarketDescription') return '从左侧选择一个模板，右侧会展示来源、命名和安装动作。';
  if (key === 'workbench.agentSummary') {
    return `当前模型：${String(vars?.model ?? '')} · 已绑定 ${String(vars?.channels ?? '')} 个频道账号`;
  }
  if (key === 'workbench.agentCard.meta') {
    return `当前模型 ${String(vars?.model ?? '')}，已绑定 ${String(vars?.channels ?? '')} 个频道`;
  }
  if (key === 'workbench.agentCard.channelsMeta') {
    return `${String(vars?.count ?? '')} 个频道`;
  }
  if (key === 'workbench.market.noRole') return '该模板还没有补充职责描述。';
  if (key === 'workbench.market.moreCategories') return '更多分类';
  if (key === 'workbench.market.installReadyTag') return '可安装';
  if (key === 'workbench.persona.loading') return '正在读取工作区文件…';
  if (key === 'workbench.persona.workspaceRoot') return 'workspace 根目录';
  if (key === 'workbench.persona.bootstrapBadge') return '内置';
  if (key === 'workbench.persona.previewTitle') return '文件预览';
  if (key === 'workbench.persona.previewDescription') return '支持直接编辑文本内容；运行时目录仍然只读。';
  if (key === 'workbench.persona.editableBadge') return '可编辑';
  if (key === 'workbench.persona.dirtyBadge') return '未保存';
  if (key === 'workbench.persona.noContent') return '文件为空，或者当前阶段还没有读取到内容。';
  if (key === 'workbench.persona.fileListTitle') return '内置文件';
  if (key === 'workbench.persona.fileListDescription') return '只编辑 workspace 根目录的真实文件，不碰 agentDir 里的运行时配置。';
  if (key === 'workbench.persona.editAction') return '编辑';
  if (key === 'workbench.persona.editorDialog.title') return '编辑人格文件';
  if (key === 'workbench.persona.emptyFiles') return '当前还没有可编辑的文件。';
  if (key === 'workbench.persona.renameAction') return '重命名';
  if (key === 'workbench.persona.deleteAction') return '删除文件';
  if (key === 'workbench.persona.saveAction') return '保存变更';
  if (key === 'workbench.persona.saving') return '保存中…';
  if (key === 'workbench.persona.bootstrapHint') return '内置 bootstrap 文件允许编辑内容，但不允许删除或重命名。';
  if (key === 'workbench.persona.customFileHint') return '自定义文件支持编辑、重命名和删除。';
  if (key === 'workbench.market.installing') return '安装中…';
  if (key === 'workbench.market.installAction') return '安装到工作台';
  if (key === 'workbench.market.installNameLabel') return '新 Agent 名称';
  if (key === 'workbench.market.installReadyDescription') return '安装会创建一个全新的 Agent。';
  if (key === 'workbench.market.installModeLabel') return '安装模式';
  if (key === 'workbench.market.highlightsTitle') return '核心亮点';
  if (key === 'workbench.market.highlightsDescription') return '这些亮点来自模板原始 SOUL.md。';
  if (key === 'workbench.market.detailsTitle') return '模板详情';
  if (key === 'workbench.market.detailsDescription') return '详情来自模板源文件。';
  if (key === 'workbench.market.sourcePathLabel') return '模板来源';
  if (key === 'workbench.market.sourceLabel') return '市场来源';
  if (key === 'workbench.market.categoryAll') return '全部分类';
  if (key === 'workbench.market.sourceHint') return '这里展示的是受控 catalog 里的固定来源，不支持任意地址直装。';
  if (key === 'workbench.market.sourceSummaryTitle') return '来源证据';
  if (key === 'workbench.market.sourceLanguageHint') return '模板说明内容来自上游源文件。';
  if (key === 'workbench.market.categories.productivity') return '效率';
  if (key === 'workbench.market.categories.development') return '开发';
  if (key === 'workbench.market.categories.business') return '商业';
  if (key === 'workbench.market.categories.creative') return '创意';
  if (key === 'workbench.market.categories.data') return '数据';
  if (key === 'workbench.market.categories.management') return '管理';
  if (key === 'workbench.market.sectionKinds.identity') return '角色定位';
  if (key === 'workbench.market.sectionKinds.responsibilities') return '核心职责';
  if (key === 'workbench.market.sectionKinds.behavior') return '行为边界';
  if (key === 'workbench.overview.modelLabel') return '当前模型';
  if (key === 'workbench.overview.channelLabel') return '频道绑定';
  if (key === 'workbench.overview.workspaceLabel') return '工作区路径';
  if (key === 'workbench.overview.agentDirLabel') return '运行时目录';
  if (key === 'workbench.overview.agentDirHint') return '运行时目录只展示，不开放浏览和编辑。';
  if (key === 'workbench.overview.channelsTitle') return '频道归属';
  if (key === 'workbench.overview.summaryTitle') return '核心摘要';
  if (key === 'workbench.overview.quickActionsTitle') return '快捷操作';
  if (key === 'workbench.overview.quickActionsDescription') return '围绕当前 Agent 最常用的工作区动作，不在这里重复造控制台。';
  if (key === 'workbench.overview.noChannels') return '这个 Agent 还没有分配频道账号。';
  if (key === 'workbench.overview.channelsDescription') return '已绑定的账号继续保留在 Channels 页管理，这里只做事实查看。';
  if (key === 'workbench.actions.manageChannels') return '前往频道绑定';
  if (key === 'workbench.actions.editAgent') return '编辑基本信息';
  if (key === 'workbench.actions.installFromMarket') return '从市场安装';
  if (key === 'workbench.actions.createAgent') return '空白创建';
  if (key === 'workbench.actions.startChat') return '开始对话';
  if (key === 'workbench.tabs.persona') return '人格文件';
  if (key === 'workbench.tabs.binding') return '绑定与运行';
  if (key === 'settingsDialog.title') return `${String(vars?.name ?? '')} 设置`;
  if (key === 'settingsDialog.description') return '更新智能体名称，并管理哪些频道归属于这个智能体。';
  if (key === 'settingsDialog.nameLabel') return '智能体名称';
  if (key === 'settingsDialog.agentIdLabel') return '智能体 ID';
  if (key === 'settingsDialog.modelLabel') return '模型';
  if (key === 'settingsDialog.modelDescription') return '保存后会持久化到智能体配置，并异步应用到运行时。';
  if (key === 'settingsDialog.modelSearchPlaceholder') return '搜索可用模型';
  if (key === 'settingsDialog.useDefaultModel') return '使用 OpenClaw 默认模型';
  if (key === 'settingsDialog.useDefaultModelDescription') return '移除当前智能体的模型覆盖。';
  if (key === 'settingsDialog.modelsLoading') return '正在读取可用模型…';
  if (key === 'settingsDialog.modelsLoadFailed') return '读取模型失败，请稍后重试。';
  if (key === 'settingsDialog.modelsEmpty') return '当前没有可选模型。';
  if (key === 'settingsDialog.modelsEmptySearch') return '没有匹配的模型。';
  if (key === 'settingsDialog.saveAndApply') return '保存并应用';
  if (key === 'settingsDialog.savingAndApplying') return '保存并应用中…';
  if (key === 'settingsDialog.mainAccount') return '主账号';
  if (key === 'workbench.actions.openWorkspace') return '打开工作区';
  if (key === 'workbench.actions.revealWorkspace') return '显示工作区';
  if (key === 'workbench.actions.revealRuntimeDir') return '显示运行时目录';
  if (key === 'workbench.overview.runtimeStateLabel') return '运行状态';
  if (key === 'workbench.binding.runtimeDescription') return '这里只展示当前 Gateway 层的事实状态，不在这里做假控制台。';
  if (key === 'workbench.binding.channelDescription') return '频道仍然在 Channels 页面维护，这里只保留事实摘要和跳转。';
  if (key === 'workbench.binding.runtimeStates.running') return '运行中';
  if (key === 'workbench.binding.runtimeStates.starting') return '启动中';
  if (key === 'workbench.binding.runtimeStates.stopped') return '未运行';
  if (key === 'workbench.binding.runtimeStates.error') return '异常';
  if (key === 'workbench.binding.runtimeStates.unknown') return '未知';
  return key;
}

function makeAgent(overrides: Partial<AgentSummary> = {}): AgentSummary {
  return {
    id: 'pangtong',
    name: 'pangtong',
    isDefault: false,
    modelDisplay: 'gpt-5.4',
    modelRef: 'jayden/gpt-5.4',
    defaultModelRef: 'bailian/qwen3.5-plus',
    inheritedModel: false,
    workspace: '/Users/jianglong/.openclaw/agents/pangtong/workspace',
    agentDir: '/Users/jianglong/.openclaw/agents/pangtong/agent',
    mainSessionKey: 'agent:pangtong:main',
    channelTypes: ['telegram'],
    ...overrides,
  };
}

describe('agents workbench layout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    gatewayState.status = { state: 'running', port: 18789 };
    gatewayState.rpc = vi.fn().mockResolvedValue({
      models: [
        { ref: 'bailian/qwen3.5-plus', provider: 'bailian', model: 'qwen3.5-plus' },
        { ref: 'jayden/gpt-5.4', provider: 'jayden', model: 'gpt-5.4' },
      ],
    });
    agentsState.agents = [];
    agentsState.defaultAgentId = 'main';
    agentsState.configuredChannelTypes = [];
    agentsState.channelOwners = {};
    agentsState.channelAccountOwners = {};
    agentsState.loading = false;
    agentsState.error = null;
    agentsState.fetchAgents = fetchAgentsMock;
    agentsState.createAgent = vi.fn();
    agentsState.updateAgent = vi.fn().mockResolvedValue({ applyingRuntime: false });
    agentsState.deleteAgent = vi.fn();
    agentsState.assignChannel = vi.fn();
    agentsState.removeChannel = vi.fn();
    agentsState.clearError = vi.fn();
    fetchAgentsMock.mockResolvedValue(undefined);
    hostApiFetchMock.mockImplementation(async (path: string) => {
      if (path === '/api/channels/accounts') {
        return { success: true, channels: [] };
      }
      if (path === '/api/agent-market/catalog') {
        return {
          success: true,
          version: 1,
          source: { repo: 'test', license: 'MIT', catalogKind: 'seed', note: '' },
          items: [
            {
              id: 'operator-agent',
              category: 'management',
              name: 'Operator Agent',
              role: '处理日常运营和排班。',
              sourcePath: 'management/operator-agent/SOUL.md',
              rawUrl: 'https://example.com/operator-agent.md',
              installMode: 'soul-template',
              localeKey: 'operator-agent',
              avatarSeed: 'management:operator-agent',
              headline: 'Operations Agent',
              summary: '负责日常运营调度、任务分发与排班协调。',
              highlights: ['运营值班', '任务分发', '排班协调'],
              detailSections: [
                {
                  kind: 'identity',
                  title: 'Core Identity',
                  body: '负责日常运营调度、任务分发与排班协调。',
                  items: ['Personality: Calm, organized', 'Communication: Clear and concise'],
                },
                {
                  kind: 'responsibilities',
                  title: 'Responsibilities',
                  body: '',
                  items: ['运营值班', '任务分发', '排班协调'],
                },
                {
                  kind: 'behavior',
                  title: 'Behavioral Guidelines',
                  body: '',
                  items: ['优先明确值班优先级', '升级前先收敛事实'],
                }
              ],
              tags: ['management', 'operator'],
            },
          ],
        };
      }
      return { success: true };
    });
    subscribeHostEventMock.mockReturnValue(vi.fn());
  });

  it('renders adaptive my-agents browse mode with a separate detail workbench', async () => {
    agentsState.agents = [
      makeAgent({ id: 'pangtong', name: 'pangtong', isDefault: true }),
      makeAgent({ id: 'wudaozi', name: 'wudaozi', mainSessionKey: 'agent:wudaozi:main' }),
    ];

    render(<Agents />);

    await waitFor(() => {
      expect(fetchAgentsMock).toHaveBeenCalledTimes(1);
    });

    expect(screen.getByTestId('agents-mode-switch')).toBeInTheDocument();
    expect(screen.getByTestId('agents-browser-rail')).toBeInTheDocument();
    expect(screen.getByTestId('agents-card-list')).toBeInTheDocument();
    expect(screen.getByTestId('agents-detail-workbench')).toBeInTheDocument();
    expect(within(screen.getByTestId('agents-mode-switch')).getByRole('button', { name: '本地' })).toBeInTheDocument();
    expect(within(screen.getByTestId('agents-browser-rail')).getByRole('textbox', { name: '搜索智能体、模型、工作区' })).toBeInTheDocument();
    expect(screen.getAllByText('pangtong').length).toBeGreaterThan(0);
    expect(within(screen.getByTestId('agents-detail-workbench')).getByRole('heading', { name: 'pangtong' })).toBeInTheDocument();
    expect(screen.getByTestId('agents-workbench').className).toContain('min-[980px]:grid-cols-[minmax(340px,0.84fr)_minmax(500px,1.16fr)]');
    expect(screen.getByTestId('agents-workbench').className).toContain('min-[1580px]:grid-cols-[minmax(360px,0.92fr)_minmax(540px,1.08fr)]');
    expect(screen.getByTestId('agents-card-list').className).toContain('min-[1600px]:grid-cols-2');
    expect(screen.getByRole('button', { name: '开始对话' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '人格文件' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '绑定与运行' })).toBeInTheDocument();
  }, 15000);

  it('keeps local agent cards compact instead of stretching them into tall equal-height boards', async () => {
    agentsState.agents = [
      makeAgent({ id: 'pangtong', name: 'pangtong', isDefault: true }),
      makeAgent({ id: 'wudaozi', name: 'wudaozi', mainSessionKey: 'agent:wudaozi:main' }),
    ];

    render(<Agents />);

    await waitFor(() => {
      expect(fetchAgentsMock).toHaveBeenCalledTimes(1);
    });

    const cardList = screen.getByTestId('agents-card-list');
    expect(cardList.className).not.toContain('auto-rows-fr');

    const localAgentCards = within(cardList).getAllByRole('button');
    expect(localAgentCards[0]?.className).not.toContain('min-h-[136px]');
  });

  it('keeps bindings and runtime in a dedicated detail tab instead of mixing them into overview', async () => {
    agentsState.agents = [makeAgent({ id: 'pangtong', name: 'pangtong', isDefault: true })];

    render(<Agents />);

    await waitFor(() => {
      expect(fetchAgentsMock).toHaveBeenCalledTimes(1);
    });

    fireEvent.click(screen.getByRole('button', { name: '绑定与运行' }));

    const detailWorkbench = screen.getByTestId('agents-detail-workbench');
    expect(within(detailWorkbench).getByText('运行状态')).toBeInTheDocument();
    expect(within(detailWorkbench).getByText('agent')).toBeInTheDocument();
    expect(within(detailWorkbench).getAllByRole('button', { name: '前往频道绑定' }).length).toBeGreaterThan(0);
  });

  it('shows my-agents empty state with create and install actions while preserving the detail placeholder', async () => {
    agentsState.agents = [];

    render(<Agents />);

    await waitFor(() => {
      expect(fetchAgentsMock).toHaveBeenCalledTimes(1);
    });

    const emptyState = screen.getAllByTestId('agents-empty-state')[0];
    expect(emptyState).toBeInTheDocument();
    expect(within(emptyState).getByRole('button', { name: '空白创建' })).toBeInTheDocument();
    expect(within(emptyState).getByRole('button', { name: '从市场安装' })).toBeInTheDocument();
    expect(screen.getByTestId('agents-detail-workbench')).toBeInTheDocument();
  });

  it('loads the market grid only after switching to market mode', async () => {
    agentsState.agents = [makeAgent({ id: 'pangtong', name: 'pangtong' })];

    render(<Agents />);

    await waitFor(() => {
      expect(fetchAgentsMock).toHaveBeenCalledTimes(1);
    });

    expect(hostApiFetchMock).not.toHaveBeenCalledWith('/api/agent-market/catalog');

    fireEvent.click(screen.getByRole('button', { name: '市场' }));

    await waitFor(() => {
      expect(hostApiFetchMock).toHaveBeenCalledWith('/api/agent-market/catalog');
      expect(screen.getByTestId('agents-market-grid')).toBeInTheDocument();
      expect(within(screen.getByTestId('agents-detail-workbench')).getByRole('heading', { name: 'Operator Agent' })).toBeInTheDocument();
      expect(within(screen.getByTestId('agents-detail-workbench')).getByLabelText('新 Agent 名称')).toBeInTheDocument();
      expect(within(screen.getByTestId('agents-detail-workbench')).getByRole('button', { name: '安装到工作台' })).toBeInTheDocument();
      expect(within(screen.getByTestId('agents-detail-workbench')).getByText('核心亮点')).toBeInTheDocument();
      expect(within(screen.getByTestId('agents-detail-workbench')).getByText('模板详情')).toBeInTheDocument();
      expect(within(screen.getByTestId('agents-detail-workbench')).getAllByText('负责日常运营调度、任务分发与排班协调。').length).toBeGreaterThan(0);
    });
    expect(screen.getByTestId('agents-workbench').className).toContain('min-[980px]:grid-cols-[minmax(0,1.02fr)_minmax(420px,0.98fr)]');
  });

  it('filters market cards by category without leaving market mode', async () => {
    hostApiFetchMock.mockImplementation(async (path: string) => {
      if (path === '/api/channels/accounts') {
        return { success: true, channels: [] };
      }
      if (path === '/api/agent-market/catalog') {
        return {
          success: true,
          version: 1,
          source: { repo: 'test', license: 'MIT', catalogKind: 'seed', note: '' },
          items: [
            {
              id: 'operator-agent',
              category: 'management',
              name: 'Operator Agent',
              role: '处理日常运营和排班。',
              sourcePath: 'management/operator-agent/SOUL.md',
              rawUrl: 'https://example.com/operator-agent.md',
              installMode: 'soul-template',
              localeKey: 'operator-agent',
              avatarSeed: 'management:operator-agent',
              headline: 'Operations Agent',
              summary: '负责日常运营调度、任务分发与排班协调。',
              highlights: ['运营值班', '任务分发', '排班协调'],
              detailSections: [
                {
                  kind: 'identity',
                  title: 'Core Identity',
                  body: '负责日常运营调度、任务分发与排班协调。',
                  items: ['Personality: Calm, organized', 'Communication: Clear and concise'],
                },
                {
                  kind: 'responsibilities',
                  title: 'Responsibilities',
                  body: '',
                  items: ['运营值班', '任务分发', '排班协调'],
                },
              ],
              tags: ['management', 'operator'],
            },
            {
              id: 'research-agent',
              category: 'productivity',
              name: 'Research Agent',
              role: '做研究与分析。',
              sourcePath: 'productivity/research-agent/SOUL.md',
              rawUrl: 'https://example.com/research-agent.md',
              installMode: 'soul-template',
              localeKey: 'research-agent',
              avatarSeed: 'productivity:research-agent',
              headline: 'Research Agent',
              summary: '面向研究、资料整理与分析汇总。',
              highlights: ['课题拆解', '资料整理', '结论归纳'],
              detailSections: [
                {
                  kind: 'identity',
                  title: 'Core Identity',
                  body: '面向研究、资料整理与分析汇总。',
                  items: ['Personality: Curious, evidence-based'],
                },
                {
                  kind: 'responsibilities',
                  title: 'Responsibilities',
                  body: '',
                  items: ['课题拆解', '资料整理', '结论归纳'],
                },
              ],
              tags: ['productivity'],
            },
          ],
        };
      }
      return { success: true };
    });

    render(<Agents />);

    await waitFor(() => {
      expect(fetchAgentsMock).toHaveBeenCalledTimes(1);
    });

    fireEvent.click(screen.getByRole('button', { name: '市场' }));

    await waitFor(() => {
      expect(within(screen.getByTestId('agents-market-grid')).getByRole('heading', { name: 'Research Agent' })).toBeInTheDocument();
      expect(within(screen.getByTestId('agents-detail-workbench')).getByRole('heading', { name: 'Operator Agent' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: '管理' }));

    await waitFor(() => {
      expect(within(screen.getByTestId('agents-detail-workbench')).getByRole('heading', { name: 'Operator Agent' })).toBeInTheDocument();
      expect(within(screen.getByTestId('agents-market-grid')).queryByText('Research Agent')).not.toBeInTheDocument();
    });
  }, 15000);

  it('localizes market category chips and card badges in Chinese', async () => {
    agentsState.agents = [makeAgent({ id: 'pangtong', name: 'pangtong' })];

    render(<Agents />);

    await waitFor(() => {
      expect(fetchAgentsMock).toHaveBeenCalledTimes(1);
    });

    fireEvent.click(screen.getByRole('button', { name: '市场' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '管理' })).toBeInTheDocument();
      expect(screen.getAllByText('管理').length).toBeGreaterThan(0);
      expect(screen.queryByRole('button', { name: 'management' })).not.toBeInTheDocument();
      expect(screen.queryByText('management')).not.toBeInTheDocument();
    });
  });

  it('keeps the current detail tab when switching between local agent cards', async () => {
    agentsState.agents = [
      makeAgent({ id: 'pangtong', name: 'pangtong', isDefault: true }),
      makeAgent({ id: 'wudaozi', name: 'wudaozi', mainSessionKey: 'agent:wudaozi:main' }),
    ];
    hostApiFetchMock.mockImplementation(async (path: string) => {
      if (path === '/api/channels/accounts') {
        return { success: true, channels: [] };
      }
      if (typeof path === 'string' && path.includes('/files?root=workspace')) {
        return { success: true, files: [] };
      }
      if (typeof path === 'string' && path.includes('/files/content?root=workspace')) {
        return { success: true, content: '' };
      }
      return { success: true };
    });

    render(<Agents />);

    await waitFor(() => {
      expect(fetchAgentsMock).toHaveBeenCalledTimes(1);
    });

    fireEvent.click(screen.getByRole('button', { name: '人格文件' }));

    await waitFor(() => {
      expect(hostApiFetchMock).toHaveBeenCalledWith('/api/agents/pangtong/files?root=workspace');
    });

    fireEvent.click(screen.getByRole('button', { name: /wudaozi/ }));

    await waitFor(() => {
      expect(hostApiFetchMock).toHaveBeenCalledWith('/api/agents/wudaozi/files?root=workspace');
      expect(within(screen.getByTestId('agents-detail-workbench')).getByRole('heading', { name: 'wudaozi' })).toBeInTheDocument();
    });
  });

  it('saves agent settings with a persistent model override', async () => {
    agentsState.agents = [
      makeAgent({
        id: 'pangtong',
        name: 'pangtong',
        inheritedModel: true,
        modelDisplay: 'qwen3.5-plus',
        modelRef: 'bailian/qwen3.5-plus',
      }),
    ];
    agentsState.updateAgent = vi.fn().mockResolvedValue({ applyingRuntime: true });
    hostApiFetchMock.mockImplementation(async (path: string) => {
      if (path === '/api/channels/accounts') {
        return { success: true, channels: [] };
      }
      if (path === '/api/provider-accounts') {
        return [];
      }
      return { success: true };
    });

    render(<Agents />);

    await waitFor(() => {
      expect(fetchAgentsMock).toHaveBeenCalledTimes(1);
    });

    fireEvent.pointerDown(screen.getByLabelText('更多操作'));
    fireEvent.click(await screen.findByRole('menuitem', { name: '编辑基本信息' }));

    await waitFor(() => {
      expect(screen.getByText('pangtong 设置')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'qwen3.5-plus' }));
    fireEvent.change(screen.getByRole('textbox', { name: '搜索可用模型' }), {
      target: { value: 'gpt-5.4' },
    });
    fireEvent.click(await screen.findByRole('button', { name: /gpt-5\.4/ }));
    fireEvent.click(screen.getByRole('button', { name: '保存并应用' }));

    await waitFor(() => {
      expect(agentsState.updateAgent).toHaveBeenCalledWith('pangtong', {
        name: 'pangtong',
        modelRef: 'jayden/gpt-5.4',
      });
    });
  }, 15000);

  it('creates a new agent with a provider-scoped model ref selected from the picker', async () => {
    agentsState.agents = [makeAgent({ id: 'main', name: 'Main Agent', isDefault: true })];
    agentsState.createAgent = vi.fn().mockResolvedValue('thumbnail-designer');
    gatewayState.rpc = vi.fn().mockResolvedValue({
      models: [
        { ref: 'openai/gpt-5.4', provider: 'openai', model: 'gpt-5.4' },
        { ref: 'provider-998/gpt-5.4', provider: 'provider-998', model: 'gpt-5.4' },
      ],
    });
    hostApiFetchMock.mockImplementation(async (path: string) => {
      if (path === '/api/channels/accounts') {
        return { success: true, channels: [] };
      }
      if (path === '/api/provider-accounts') {
        return [
          { id: 'openai', label: 'OpenAI', providerType: 'openai', runtimeKey: 'openai' },
          { id: '998', label: '998', providerType: 'openai-compatible', runtimeKey: 'provider-998' },
        ];
      }
      return { success: true };
    });

    render(<Agents />);

    await waitFor(() => {
      expect(fetchAgentsMock).toHaveBeenCalledTimes(1);
    });

    fireEvent.click(screen.getByRole('button', { name: '新建' }));
    fireEvent.click(await screen.findByRole('button', { name: '空白创建' }));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: '新建智能体' })).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText('智能体名称'), {
      target: { value: 'Thumbnail Designer' },
    });
    fireEvent.click(screen.getByRole('button', { name: '使用 OpenClaw 默认模型' }));
    fireEvent.change(screen.getByRole('textbox', { name: '搜索可用模型' }), {
      target: { value: '998' },
    });
    fireEvent.click(await screen.findByRole('button', { name: /998/i }));
    fireEvent.click(screen.getByRole('button', { name: 'common:actions.save' }));

    await waitFor(() => {
      expect(agentsState.createAgent).toHaveBeenCalledWith('Thumbnail Designer', 'provider-998/gpt-5.4');
    });
  }, 15000);
});
