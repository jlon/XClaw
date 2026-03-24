import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const readFileMock = vi.fn();
const readIdentityNameMock = vi.fn();
const listAgentsSnapshotMock = vi.fn();
const commitStudioSnapshotMock = vi.fn();
const readStudioSnapshotMock = vi.fn();

vi.mock('@electron/utils/agent-config', () => ({
  listAgentsSnapshot: (...args: unknown[]) => listAgentsSnapshotMock(...args),
}));

vi.mock('@electron/studio/state-store', () => ({
  commitStudioSnapshot: (...args: unknown[]) => commitStudioSnapshotMock(...args),
  readStudioSnapshot: (...args: unknown[]) => readStudioSnapshotMock(...args),
}));

vi.mock('@electron/studio/paths', () => ({
  getStudioSnapshotPaths: () => ({
    rootDir: '/tmp/xclaw-studio',
    stateFilePath: '/tmp/xclaw-studio/state.json',
    agentsStateFilePath: '/tmp/xclaw-studio/agents-state.json',
    manifestFilePath: '/tmp/xclaw-studio/manifest.json',
  }),
  getStudioLastKnownGoodPaths: () => ({
    rootDir: '/tmp/xclaw-studio/last-known-good',
    stateFilePath: '/tmp/xclaw-studio/last-known-good/state.json',
    agentsStateFilePath: '/tmp/xclaw-studio/last-known-good/agents-state.json',
    manifestFilePath: '/tmp/xclaw-studio/last-known-good/manifest.json',
  }),
}));

vi.mock('@electron/utils/logger', () => ({
  logger: {
    debug: vi.fn(),
    warn: vi.fn(),
  },
}));

describe('StudioStateManager', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-24T10:00:00.000Z'));
    vi.clearAllMocks();
    readStudioSnapshotMock.mockResolvedValue(null);
    commitStudioSnapshotMock.mockResolvedValue(undefined);
    listAgentsSnapshotMock.mockResolvedValue({
      agents: [
        { id: 'main', name: 'Main Agent', workspace: '/workspaces/main' },
        { id: 'planner', name: 'Planner', workspace: '/workspaces/planner' },
        { id: 'analyst', name: 'Analyst', workspace: '/workspaces/analyst' },
      ],
    });
    readFileMock.mockImplementation(async (path: string) => {
      if (path === '/workspaces/main/STAR_OFFICE_DETAIL.txt') {
        return '长期主任务';
      }
      if (path === '/workspaces/planner/STAR_OFFICE_DETAIL.txt') {
        return '长期规划中';
      }
      if (path === '/workspaces/analyst/STAR_OFFICE_DETAIL.txt') {
        return '等待分析任务';
      }
      throw new Error(`Unexpected file read: ${path}`);
    });
    readIdentityNameMock.mockImplementation(async (workspacePath: string) => {
      if (workspacePath === '/workspaces/main') {
        return '主脑';
      }
      if (workspacePath === '/workspaces/planner') {
        return '军师';
      }
      return null;
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('accepts agent status events, rejects stale sessions, and falls back to detail files after TTL expiry', async () => {
    const { StudioStateManager } = await import('@electron/studio/state-manager');
    const manager = new StudioStateManager({
      readDetailFile: async (workspacePath: string) => await readFileMock(`${workspacePath}/STAR_OFFICE_DETAIL.txt`),
    });

    await manager.bootstrap();
    expect(readFileMock.mock.calls.map(([path]) => path)).toEqual([
      '/workspaces/main/STAR_OFFICE_DETAIL.txt',
      '/workspaces/planner/STAR_OFFICE_DETAIL.txt',
      '/workspaces/analyst/STAR_OFFICE_DETAIL.txt',
    ]);

    await manager.handleGatewayNotification({
      jsonrpc: '2.0',
      method: 'studio.agent_status',
      params: {
        schemaVersion: 1,
        agentId: 'planner',
        sessionKey: 'planner-session-b',
        sessionStartedAt: '2026-03-24T10:00:00.000Z',
        sequence: 1,
        status: 'researching',
        detail: '正在阅读设计文档',
        timestamp: '2026-03-24T10:00:00.000Z',
      },
    });

    expect(manager.getCurrentSnapshot().agents).toContainEqual(expect.objectContaining({
      agentId: 'planner',
      status: 'researching',
      detail: '正在阅读设计文档',
    }));

    await manager.handleGatewayNotification({
      jsonrpc: '2.0',
      method: 'studio.agent_status',
      params: {
        schemaVersion: 1,
        agentId: 'planner',
        sessionKey: 'planner-session-a',
        sessionStartedAt: '2026-03-24T09:59:59.000Z',
        sequence: 99,
        status: 'executing',
        detail: '这个旧 session 不应覆盖',
        timestamp: '2026-03-24T10:00:01.000Z',
      },
    });

    expect(manager.getCurrentSnapshot().agents).toContainEqual(expect.objectContaining({
      agentId: 'planner',
      status: 'researching',
      detail: '正在阅读设计文档',
    }));

    await vi.advanceTimersByTimeAsync(90_001);

    expect(manager.getCurrentSnapshot().agents).toContainEqual(expect.objectContaining({
      agentId: 'planner',
      status: 'idle',
      detail: '长期规划中',
      detailSource: 'detail-file',
    }));
  });

  it('lets main agent realtime protocol override coarse gateway chat updates and final idle falls back to detail file', async () => {
    const { StudioStateManager } = await import('@electron/studio/state-manager');
    const manager = new StudioStateManager({
      readDetailFile: async (workspacePath: string) => await readFileMock(`${workspacePath}/STAR_OFFICE_DETAIL.txt`),
    });

    await manager.bootstrap();
    await manager.handleChatMessage('先走旧的主智能体粗粒度链路');
    expect(manager.getCurrentSnapshot().mainAgent).toMatchObject({
      status: 'writing',
      detail: '先走旧的主智能体粗粒度链路',
    });

    await manager.handleGatewayNotification({
      jsonrpc: '2.0',
      method: 'studio.agent_status',
      params: {
        schemaVersion: 1,
        agentId: 'main',
        sessionKey: 'main-session',
        sessionStartedAt: '2026-03-24T10:01:00.000Z',
        sequence: 1,
        status: 'writing',
        detail: '协议驱动中',
        timestamp: '2026-03-24T10:01:01.000Z',
      },
    });

    await manager.handleChatMessage('这条粗粒度消息不应再覆盖 main');

    expect(manager.getCurrentSnapshot().mainAgent).toMatchObject({
      status: 'writing',
      detail: '协议驱动中',
    });

    await manager.handleGatewayNotification({
      jsonrpc: '2.0',
      method: 'studio.agent_status',
      params: {
        schemaVersion: 1,
        agentId: 'main',
        sessionKey: 'main-session',
        sessionStartedAt: '2026-03-24T10:01:00.000Z',
        sequence: 2,
        status: 'idle',
        timestamp: '2026-03-24T10:01:02.000Z',
        final: true,
      },
    });

    expect(manager.getCurrentSnapshot().mainAgent).toMatchObject({
      status: 'idle',
      detail: '长期主任务',
      detailSource: 'detail-file',
    });
  });

  it('removes deleted agents from the committed snapshot on inventory refresh', async () => {
    const { StudioStateManager } = await import('@electron/studio/state-manager');
    const manager = new StudioStateManager({
      readDetailFile: async (workspacePath: string) => await readFileMock(`${workspacePath}/STAR_OFFICE_DETAIL.txt`),
    });

    await manager.bootstrap();

    await manager.handleGatewayNotification({
      jsonrpc: '2.0',
      method: 'studio.agent_status',
      params: {
        schemaVersion: 1,
        agentId: 'analyst',
        sessionKey: 'analyst-session',
        sessionStartedAt: '2026-03-24T10:02:00.000Z',
        sequence: 1,
        status: 'executing',
        detail: '正在整理分析结果',
        timestamp: '2026-03-24T10:02:01.000Z',
      },
    });

    expect(manager.getCurrentSnapshot().agents.some((agent) => agent.agentId === 'analyst')).toBe(true);

    listAgentsSnapshotMock.mockResolvedValueOnce({
      agents: [
        { id: 'main', name: 'Main Agent', workspace: '/workspaces/main' },
        { id: 'planner', name: 'Planner', workspace: '/workspaces/planner' },
      ],
    });

    await manager.refreshAgentInventory();

    expect(manager.getCurrentSnapshot().agents.some((agent) => agent.agentId === 'analyst')).toBe(false);
  });

  it('bridges gateway agent notifications into realtime agent snapshots and final idle fallback', async () => {
    const { StudioStateManager } = await import('@electron/studio/state-manager');
    const manager = new StudioStateManager({
      readDetailFile: async (workspacePath: string) => await readFileMock(`${workspacePath}/STAR_OFFICE_DETAIL.txt`),
    });

    await manager.bootstrap();

    await manager.handleGatewayNotification({
      jsonrpc: '2.0',
      method: 'agent',
      params: {
        runId: 'planner-run-1',
        sessionKey: 'agent:planner:desk',
        phase: 'started',
        startedAt: '2026-03-24T10:03:00.000Z',
      },
    });

    expect(manager.getCurrentSnapshot().agents).toContainEqual(expect.objectContaining({
      agentId: 'planner',
      status: 'syncing',
      detail: '正在处理新任务...',
    }));

    await manager.handleGatewayNotification({
      jsonrpc: '2.0',
      method: 'agent',
      params: {
        runId: 'planner-run-1',
        sessionKey: 'agent:planner:desk',
        seq: 1,
        state: 'delta',
        message: {
          role: 'assistant',
          content: [
            { type: 'tool_use', id: 'tool-1', name: 'web_search' },
          ],
        },
      },
    });

    expect(manager.getCurrentSnapshot().agents).toContainEqual(expect.objectContaining({
      agentId: 'planner',
      status: 'researching',
      detail: '正在使用 web_search 调研资料',
    }));

    await manager.handleGatewayNotification({
      jsonrpc: '2.0',
      method: 'agent',
      params: {
        runId: 'planner-run-1',
        sessionKey: 'agent:planner:desk',
        phase: 'completed',
      },
    });

    expect(manager.getCurrentSnapshot().agents).toContainEqual(expect.objectContaining({
      agentId: 'planner',
      status: 'idle',
      detail: '长期规划中',
      detailSource: 'detail-file',
    }));
  });

  it('uses bridged main-agent events as the active source and suppresses coarse chat fallback updates', async () => {
    const { StudioStateManager } = await import('@electron/studio/state-manager');
    const manager = new StudioStateManager({
      readDetailFile: async (workspacePath: string) => await readFileMock(`${workspacePath}/STAR_OFFICE_DETAIL.txt`),
    });

    await manager.bootstrap();

    await manager.handleGatewayNotification({
      jsonrpc: '2.0',
      method: 'agent',
      params: {
        runId: 'main-run-1',
        sessionKey: 'agent:main:main',
        phase: 'started',
        startedAt: '2026-03-24T10:05:00.000Z',
      },
    });

    expect(manager.getCurrentSnapshot().mainAgent).toMatchObject({
      status: 'syncing',
      detail: '正在处理新任务...',
    });

    await manager.handleChatMessage('这条粗粒度消息不应覆盖 bridge 实时态');

    expect(manager.getCurrentSnapshot().mainAgent).toMatchObject({
      status: 'syncing',
      detail: '正在处理新任务...',
    });

    await manager.handleGatewayNotification({
      jsonrpc: '2.0',
      method: 'agent',
      params: {
        runId: 'main-run-1',
        sessionKey: 'agent:main:main',
        seq: 1,
        state: 'delta',
        message: {
          role: 'assistant',
          content: '正在整理工作室闭环实现',
        },
      },
    });

    expect(manager.getCurrentSnapshot().mainAgent).toMatchObject({
      status: 'writing',
      detail: '正在整理工作室闭环实现',
    });
  });

  it('prefers IDENTITY names for studio display names and falls back to configured names', async () => {
    listAgentsSnapshotMock.mockResolvedValueOnce({
      agents: [
        { id: 'main', name: 'Main Agent', workspace: '/workspaces/main' },
        { id: 'planner', name: 'planner', workspace: '/workspaces/planner' },
        { id: 'analyst', name: 'Analyst', workspace: '/workspaces/analyst' },
      ],
    });

    const { StudioStateManager } = await import('@electron/studio/state-manager');
    const manager = new StudioStateManager({
      readDetailFile: async (workspacePath: string) => await readFileMock(`${workspacePath}/STAR_OFFICE_DETAIL.txt`),
      readIdentityName: async (workspacePath: string) => await readIdentityNameMock(workspacePath),
    });

    await manager.bootstrap();

    expect(manager.getCurrentSnapshot().mainAgent.displayName).toBe('主脑');
    expect(manager.getCurrentSnapshot().agents).toContainEqual(expect.objectContaining({
      agentId: 'planner',
      displayName: '军师',
    }));
    expect(manager.getCurrentSnapshot().agents).toContainEqual(expect.objectContaining({
      agentId: 'analyst',
      displayName: 'Analyst',
    }));
  });

  it('derives a shorter sceneName for compact in-scene labels while preserving displayName', async () => {
    listAgentsSnapshotMock.mockResolvedValueOnce({
      agents: [
        { id: 'main', name: 'Main Agent', workspace: '/workspaces/main' },
        { id: 'thumbnail-designer', name: 'Thumbnail Designer', workspace: '/workspaces/thumbnail-designer' },
        { id: 'coordinator', name: 'Coordinator', workspace: '/workspaces/coordinator' },
      ],
    });
    readFileMock.mockImplementation(async (path: string) => {
      if (path === '/workspaces/main/STAR_OFFICE_DETAIL.txt') {
        return '长期主任务';
      }
      if (path === '/workspaces/thumbnail-designer/STAR_OFFICE_DETAIL.txt') {
        return '等待封面设计任务';
      }
      if (path === '/workspaces/coordinator/STAR_OFFICE_DETAIL.txt') {
        return '等待协调任务';
      }
      throw new Error(`Unexpected file read: ${path}`);
    });
    readIdentityNameMock.mockImplementation(async (workspacePath: string) => {
      if (workspacePath === '/workspaces/main') {
        return '主脑';
      }
      if (workspacePath === '/workspaces/thumbnail-designer') {
        return '祗钧（Zhī Jūn）';
      }
      return null;
    });

    const { StudioStateManager } = await import('@electron/studio/state-manager');
    const manager = new StudioStateManager({
      readDetailFile: async (workspacePath: string) => await readFileMock(`${workspacePath}/STAR_OFFICE_DETAIL.txt`),
      readIdentityName: async (workspacePath: string) => await readIdentityNameMock(workspacePath),
    });

    await manager.bootstrap();

    expect(manager.getCurrentSnapshot().mainAgent).toMatchObject({
      displayName: '主脑',
      sceneName: '主脑',
    });
    expect(manager.getCurrentSnapshot().agents).toContainEqual(expect.objectContaining({
      agentId: 'thumbnail-designer',
      displayName: '祗钧（Zhī Jūn）',
      sceneName: '祗钧',
    }));
    expect(manager.getCurrentSnapshot().agents).toContainEqual(expect.objectContaining({
      agentId: 'coordinator',
      displayName: 'Coordinator',
      sceneName: 'Coordinator',
    }));
  });

  it('migrates legacy snapshots without sceneName and flushes normalized snapshots back to disk', async () => {
    readStudioSnapshotMock.mockResolvedValueOnce({
      main: {
        schemaVersion: 1,
        generation: 3,
        updatedAt: '2026-03-24T10:00:00.000Z',
        owner: 'xclaw-main',
        agent: {
          agentId: 'main',
          displayName: '主脑',
          status: 'idle',
          detail: '长期主任务',
          detailSource: 'detail-file',
          updatedAt: '2026-03-24T10:00:00.000Z',
        },
      },
      agents: {
        schemaVersion: 1,
        generation: 3,
        updatedAt: '2026-03-24T10:00:00.000Z',
        owner: 'xclaw-main',
        agents: [
          {
            agentId: 'thumbnail-designer',
            displayName: '祗钧（Zhī Jūn）',
            status: 'idle',
            detail: '等待封面设计任务',
            detailSource: 'detail-file',
            updatedAt: '2026-03-24T10:00:00.000Z',
          },
        ],
      },
      manifest: {
        schemaVersion: 1,
        generation: 3,
        committedAt: '2026-03-24T10:00:00.000Z',
        owner: 'xclaw-main',
        files: {
          main: 'state.json',
          agents: 'agents-state.json',
        },
      },
    });

    const { StudioStateManager } = await import('@electron/studio/state-manager');
    const manager = new StudioStateManager();

    await manager.bootstrap();

    expect(manager.getCurrentSnapshot().mainAgent).toMatchObject({
      displayName: '主脑',
      sceneName: '主脑',
    });
    expect(manager.getCurrentSnapshot().agents).toContainEqual(expect.objectContaining({
      agentId: 'thumbnail-designer',
      displayName: '祗钧（Zhī Jūn）',
      sceneName: '祗钧',
    }));
    expect(commitStudioSnapshotMock).toHaveBeenCalledTimes(1);
    expect(commitStudioSnapshotMock.mock.calls[0][0]).toMatchObject({
      mainAgent: expect.objectContaining({
        sceneName: '主脑',
      }),
      agents: expect.arrayContaining([
        expect.objectContaining({
          agentId: 'thumbnail-designer',
          sceneName: '祗钧',
        }),
      ]),
    });
  });
});
