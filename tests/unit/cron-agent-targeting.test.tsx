import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Cron } from '@/pages/Cron';
import type { CronJob } from '@/types/cron';

const { cronState, gatewayState, agentsState, hostApiFetchMock } = vi.hoisted(() => ({
  cronState: {
    jobs: [] as CronJob[],
    loading: false,
    error: null as string | null,
    fetchJobs: vi.fn(),
    createJob: vi.fn(),
    updateJob: vi.fn(),
    toggleJob: vi.fn(),
    deleteJob: vi.fn(),
    triggerJob: vi.fn(),
  },
  gatewayState: {
    status: { state: 'running', port: 18789 },
  },
  agentsState: {
    agents: [] as Array<{ id: string; name: string }>,
    defaultAgentId: 'main',
    fetchAgents: vi.fn(),
  },
  hostApiFetchMock: vi.fn(),
}));

vi.mock('@/stores/cron', () => ({
  useCronStore: (selector?: (state: typeof cronState) => unknown) => {
    const state = cronState;
    return typeof selector === 'function' ? selector(state) : state;
  },
}));

vi.mock('@/stores/gateway', () => ({
  useGatewayStore: (selector: (state: typeof gatewayState) => unknown) => selector(gatewayState),
}));

vi.mock('@/stores/agents', () => ({
  useAgentsStore: Object.assign(
    (selector?: (state: typeof agentsState) => unknown) => {
      const state = agentsState;
      return typeof selector === 'function' ? selector(state) : state;
    },
    {
      getState: () => agentsState,
    },
  ),
}));

vi.mock('@/components/ui/confirm-dialog', () => ({
  ConfirmDialog: () => null,
}));

vi.mock('@/lib/host-api', () => ({
  hostApiFetch: (...args: unknown[]) => hostApiFetchMock(...args),
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, string>) => {
      if (key === 'title') return '定时任务';
      if (key === 'subtitle') return '安排消息与任务按时执行';
      if (key === 'newTask') return '新建任务';
      if (key === 'refresh') return '刷新';
      if (key === 'dialog.createTitle') return '创建任务';
      if (key === 'dialog.description') return '安排自动化的 AI 任务';
      if (key === 'dialog.taskName') return '任务名称';
      if (key === 'dialog.taskNamePlaceholder') return '例如：早间简报';
      if (key === 'dialog.agent') return '执行智能体';
      if (key === 'dialog.agentPlaceholder') return '选择智能体';
      if (key === 'dialog.message') return '消息/提示词';
      if (key === 'dialog.messagePlaceholder') return 'AI 应该做什么？';
      if (key === 'dialog.targetChannel') return '投递频道';
      if (key === 'dialog.targetRecipient') return '目标会话 ID';
      if (key === 'dialog.targetRecipientDesc') return '输入投递目标';
      if (key === 'dialog.targetRecipientAuto') return `已自动填充 ${params?.value ?? ''}`;
      if (key === 'dialog.targetRecipientDetected') return `检测到 ${params?.value ?? ''}`;
      if (key === 'dialog.targetRecipientWildcard') return '需要手动填写';
      if (key === 'dialog.targetRecipientMultiple') return '检测到多个';
      if (key === 'dialog.targetRecipientUnavailable') return '未检测到';
      if (key === 'dialog.targetRecipientPlaceholder') return '例如：频道 / 群组 / 聊天 ID';
      if (key === 'dialog.noChannels') return '暂无频道';
      if (key === 'dialog.schedule') return '调度计划';
      if (key === 'dialog.enableImmediately') return '立即启用';
      if (key === 'dialog.enableImmediatelyDesc') return '创建后立即开始运行此任务';
      if (key === 'dialog.saveChanges') return '保存更改';
      if (key === 'common:actions.cancel') return '取消';
      if (key === 'common:status.saving') return '保存中...';
      if (key === 'toast.created') return '任务已创建';
      if (key === 'toast.updated') return '任务已更新';
      if (key === 'toast.nameRequired') return '请输入任务名称';
      if (key === 'toast.messageRequired') return '请输入消息';
      if (key === 'toast.scheduleRequired') return '请选择或输入调度计划';
      if (key === 'toast.agentRequired') return '请选择执行智能体';
      if (key === 'toast.channelRequired') return '请选择投递频道';
      if (key === 'toast.recipientRequired') return '请输入目标会话 ID';
      if (key === 'presets.daily9am') return '每天上午 9 点';
      if (key === 'dialog.useCustomCron') return '使用自定义 Cron';
      if (key === 'schedule.dailyAt') return '每天 09:00';
      if (key === 'card.next') return '下次运行';
      return key;
    },
  }),
}));

describe('cron agent targeting', () => {
  beforeEach(() => {
    cronState.jobs = [];
    cronState.loading = false;
    cronState.error = null;
    cronState.fetchJobs = vi.fn();
    cronState.createJob = vi.fn().mockResolvedValue({
      id: 'job-1',
      name: '早报',
      message: '发日报',
      schedule: '0 9 * * *',
      enabled: true,
      agentId: 'main',
      createdAt: '2026-03-23T10:00:00.000Z',
      updatedAt: '2026-03-23T10:00:00.000Z',
    });
    cronState.updateJob = vi.fn();
    cronState.toggleJob = vi.fn();
    cronState.deleteJob = vi.fn();
    cronState.triggerJob = vi.fn();
    gatewayState.status = { state: 'running', port: 18789 };
    agentsState.agents = [
      { id: 'main', name: '主智能体' },
      { id: 'ops', name: '运维智能体' },
    ];
    agentsState.defaultAgentId = 'main';
    agentsState.fetchAgents = vi.fn();
    hostApiFetchMock.mockImplementation(async (path: string) => {
      if (path === '/api/channels/accounts') {
        return {
          success: true,
          channels: [
            {
              channelType: 'feishu',
              enabled: true,
              accounts: [
                {
                  accountId: 'bot2',
                  configured: true,
                  enabled: true,
                  agentId: 'main',
                },
              ],
            },
          ],
        };
      }
      if (path.startsWith('/api/channels/recipient-hints/feishu')) {
        return {
          success: true,
          hint: {
            reason: 'derived',
            recipientId: 'ou_123',
          },
        };
      }
      return { success: true };
    });
  });

  it('does not preload channel accounts before the task dialog is opened', async () => {
    render(<Cron />);

    await waitFor(() => {
      expect(agentsState.fetchAgents).toHaveBeenCalledTimes(1);
    });

    expect(hostApiFetchMock).not.toHaveBeenCalledWith('/api/channels/accounts');
  });

  it('requires an explicit agent target in the task dialog and submits it on create', async () => {
    render(<Cron />);

    fireEvent.click(screen.getByRole('button', { name: '新建任务' }));

    await waitFor(() => {
      expect(screen.getByLabelText('目标会话 ID')).toHaveValue('ou_123');
    });

    const agentSelect = screen.getByLabelText('执行智能体');
    expect(agentSelect).toBeInTheDocument();
    expect(agentSelect).toHaveTextContent('主智能体');

    fireEvent.change(screen.getByLabelText('任务名称'), { target: { value: '早报' } });
    fireEvent.change(screen.getByLabelText('消息/提示词'), { target: { value: '发日报' } });
    fireEvent.click(screen.getByRole('button', { name: '创建任务' }));

    await waitFor(() => {
      expect(cronState.createJob).toHaveBeenCalledWith(
        expect.objectContaining({
          name: '早报',
          message: '发日报',
          agentId: 'main',
        }),
      );
    });
  }, 15000);

  it('auto-fills a unique pairing-store recipient hint for cron delivery', async () => {
    render(<Cron />);

    fireEvent.click(screen.getByRole('button', { name: '新建任务' }));

    await waitFor(() => {
      expect(screen.getByLabelText('目标会话 ID')).toHaveValue('ou_123');
    });

    expect(hostApiFetchMock).toHaveBeenCalledWith('/api/channels/accounts');
    expect(hostApiFetchMock).toHaveBeenCalledWith('/api/channels/recipient-hints/feishu?accountId=bot2');
  }, 15000);

  it('uses wallpaper-aware surfaces for cron cards and dialog inputs', async () => {
    cronState.jobs = [
      {
        id: 'job-1',
        name: '早报',
        message: '发日报',
        schedule: '0 9 * * *',
        enabled: true,
        agentId: 'main',
        createdAt: '2026-03-23T10:00:00.000Z',
        updatedAt: '2026-03-23T10:00:00.000Z',
      },
    ];

    render(<Cron />);

    await waitFor(() => {
      expect(screen.getByText('早报')).toBeInTheDocument();
    });

    expect(screen.getByText('早报').closest('.app-cron-task-card')).toHaveClass('app-pane-surface');

    fireEvent.click(screen.getByRole('button', { name: '新建任务' }));

    await waitFor(() => {
      expect(screen.getByLabelText('任务名称')).toBeInTheDocument();
    });

    expect(screen.getByLabelText('任务名称')).toHaveClass('app-field-surface');
    expect(screen.getByLabelText('消息/提示词')).toHaveClass('app-field-surface');
  });
});
