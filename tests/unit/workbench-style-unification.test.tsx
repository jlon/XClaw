import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
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
    agents: [{ id: 'main', name: '主智能体' }],
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
  useAgentsStore: (selector?: (state: typeof agentsState) => unknown) => {
    const state = agentsState;
    return typeof selector === 'function' ? selector(state) : state;
  },
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
    t: (key: string) => {
      if (key === 'title') return '定时任务';
      if (key === 'subtitle') return '安排消息与任务按时执行';
      if (key === 'newTask') return '新建任务';
      if (key === 'refresh') return '刷新';
      if (key === 'stats.total') return '全部';
      if (key === 'stats.active') return '运行';
      if (key === 'stats.paused') return '暂停';
      if (key === 'stats.failed') return '失败';
      if (key === 'gatewayWarning') return '网关未运行。没有活跃的网关，无法管理定时任务。';
      if (key === 'empty.title') return '暂无定时任务';
      if (key === 'empty.description') return '定时安排消息、查询与自动执行。';
      if (key === 'empty.create') return '创建第一个任务';
      return key;
    },
  }),
}));

describe('workbench style unification', () => {
  beforeEach(() => {
    cronState.jobs = [
      {
        id: 'job-1',
        name: 'morning-brief',
        message: 'summarize inbox',
        schedule: '0 9 * * *',
        enabled: true,
        createdAt: '2026-03-22T10:00:00.000Z',
        updatedAt: '2026-03-22T10:00:00.000Z',
      },
      {
        id: 'job-2',
        name: 'report',
        message: 'send report',
        schedule: '0 18 * * *',
        enabled: false,
        createdAt: '2026-03-22T10:00:00.000Z',
        updatedAt: '2026-03-22T10:00:00.000Z',
        lastRun: {
          time: '2026-03-22T11:00:00.000Z',
          success: false,
          error: 'failed',
        },
      },
    ];
    cronState.loading = false;
    cronState.error = null;
    cronState.fetchJobs = vi.fn();
    cronState.createJob = vi.fn();
    cronState.updateJob = vi.fn();
    cronState.toggleJob = vi.fn();
    cronState.deleteJob = vi.fn();
    cronState.triggerJob = vi.fn();
    gatewayState.status = { state: 'running', port: 18789 };
    agentsState.agents = [{ id: 'main', name: '主智能体' }];
    agentsState.defaultAgentId = 'main';
    agentsState.fetchAgents = vi.fn();
    hostApiFetchMock.mockResolvedValue({ success: true, channels: [] });
  });

  it('renders cron with a concise desktop header and icon-led summary strip', () => {
    const { container } = render(<Cron />);

    expect(container.querySelector('.app-cron-workbench-top')).toBeInTheDocument();
    expect(screen.getByText('定时任务')).toBeInTheDocument();
    expect(screen.getByText('安排消息与任务按时执行')).toBeInTheDocument();
    expect(container.querySelector('.app-cron-summary-line')).toBeInTheDocument();
    expect(screen.getByText('全部')).toBeInTheDocument();
    expect(screen.getByText('运行')).toBeInTheDocument();
    expect(screen.getByText('暂停')).toBeInTheDocument();
    expect(screen.getByText('失败')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '刷新' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '新建任务' })).toBeInTheDocument();
  });

  it('keeps only one primary task-creation action in the empty cron state', () => {
    cronState.jobs = [];

    render(<Cron />);

    expect(screen.getByRole('button', { name: '新建任务' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '创建第一个任务' })).not.toBeInTheDocument();
  });
});
