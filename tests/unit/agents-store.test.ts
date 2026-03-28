import { beforeEach, describe, expect, it, vi } from 'vitest';

const hostApiFetchMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/host-api', () => ({
  hostApiFetch: (...args: unknown[]) => hostApiFetchMock(...args),
}));

describe('agents store', () => {
  beforeEach(() => {
    vi.resetModules();
    hostApiFetchMock.mockReset();
  });

  it('deduplicates concurrent fetchAgents calls against the same in-flight request', async () => {
    let resolveSnapshot: ((value: unknown) => void) | null = null;
    hostApiFetchMock.mockReturnValue(new Promise((resolve) => {
      resolveSnapshot = resolve;
    }));

    const { useAgentsStore } = await import('@/stores/agents');
    const first = useAgentsStore.getState().fetchAgents();
    const second = useAgentsStore.getState().fetchAgents();

    expect(hostApiFetchMock).toHaveBeenCalledTimes(1);
    expect(useAgentsStore.getState().loading).toBe(true);

    resolveSnapshot?.({
      agents: [
        {
          id: 'main',
          name: 'Main',
          isDefault: true,
          modelDisplay: 'GPT-5.2',
          inheritedModel: false,
          workspace: '/tmp/main',
          agentDir: '/tmp/main/agent',
          mainSessionKey: 'agent:main:main',
          channelTypes: [],
        },
      ],
      defaultAgentId: 'main',
      configuredChannelTypes: [],
      channelOwners: {},
      channelAccountOwners: {},
    });

    await Promise.all([first, second]);

    expect(hostApiFetchMock).toHaveBeenCalledTimes(1);
    expect(useAgentsStore.getState().loading).toBe(false);
    expect(useAgentsStore.getState().agents).toEqual([
      expect.objectContaining({
        id: 'main',
        name: 'Main',
      }),
    ]);
  });

  it('allows a fresh fetch after the previous request settles', async () => {
    hostApiFetchMock
      .mockResolvedValueOnce({
        agents: [
          {
            id: 'main',
            name: 'Main',
            isDefault: true,
            modelDisplay: 'GPT-5.2',
            inheritedModel: false,
            workspace: '/tmp/main',
            agentDir: '/tmp/main/agent',
            mainSessionKey: 'agent:main:main',
            channelTypes: [],
          },
        ],
        defaultAgentId: 'main',
        configuredChannelTypes: [],
        channelOwners: {},
        channelAccountOwners: {},
      })
      .mockResolvedValueOnce({
        agents: [
          {
            id: 'ops',
            name: 'Ops',
            isDefault: false,
            modelDisplay: 'GPT-5.2',
            inheritedModel: false,
            workspace: '/tmp/ops',
            agentDir: '/tmp/ops/agent',
            mainSessionKey: 'agent:ops:main',
            channelTypes: [],
          },
        ],
        defaultAgentId: 'main',
        configuredChannelTypes: [],
        channelOwners: {},
        channelAccountOwners: {},
      });

    const { useAgentsStore } = await import('@/stores/agents');

    await useAgentsStore.getState().fetchAgents();
    await useAgentsStore.getState().fetchAgents();

    expect(hostApiFetchMock).toHaveBeenCalledTimes(2);
    expect(useAgentsStore.getState().agents).toEqual([
      expect.objectContaining({
        id: 'ops',
        name: 'Ops',
      }),
    ]);
  });
});
