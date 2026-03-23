import { access, mkdir, readFile, rm, symlink, writeFile } from 'fs/promises';
import { join } from 'path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { testHome, testUserData } = vi.hoisted(() => {
  const suffix = Math.random().toString(36).slice(2);
  return {
    testHome: `/tmp/XClaw-agent-config-${suffix}`,
    testUserData: `/tmp/XClaw-agent-config-user-data-${suffix}`,
  };
});

vi.mock('os', async () => {
  const actual = await vi.importActual<typeof import('os')>('os');
  const mocked = {
    ...actual,
    homedir: () => testHome,
  };
  return {
    ...mocked,
    default: mocked,
  };
});

vi.mock('electron', () => ({
  app: {
    isPackaged: false,
    getPath: () => testUserData,
    getVersion: () => '0.0.0-test',
  },
}));

async function writeOpenClawJson(config: unknown): Promise<void> {
  const openclawDir = join(testHome, '.openclaw');
  await mkdir(openclawDir, { recursive: true });
  await writeFile(join(openclawDir, 'openclaw.json'), JSON.stringify(config, null, 2), 'utf8');
}

async function readOpenClawJson(): Promise<Record<string, unknown>> {
  const content = await readFile(join(testHome, '.openclaw', 'openclaw.json'), 'utf8');
  return JSON.parse(content) as Record<string, unknown>;
}

describe('agent config lifecycle', () => {
  beforeEach(async () => {
    vi.resetModules();
    vi.restoreAllMocks();
    await rm(testHome, { recursive: true, force: true });
    await rm(testUserData, { recursive: true, force: true });
  });

  it('lists configured agent ids from openclaw.json', async () => {
    await writeOpenClawJson({
      agents: {
        list: [
          { id: 'main', name: 'Main', default: true },
          { id: 'test3', name: 'test3' },
        ],
      },
    });

    const { listConfiguredAgentIds } = await import('@electron/utils/agent-config');

    await expect(listConfiguredAgentIds()).resolves.toEqual(['main', 'test3']);
  });

  it('falls back to the implicit main agent when no list exists', async () => {
    await writeOpenClawJson({});

    const { listConfiguredAgentIds } = await import('@electron/utils/agent-config');

    await expect(listConfiguredAgentIds()).resolves.toEqual(['main']);
  });

  it('includes canonical per-agent main session keys in the snapshot', async () => {
    await writeOpenClawJson({
      session: {
        mainKey: 'desk',
      },
      agents: {
        list: [
          { id: 'main', name: 'Main', default: true },
          { id: 'research', name: 'Research' },
        ],
      },
    });

    const { listAgentsSnapshot } = await import('@electron/utils/agent-config');

    const snapshot = await listAgentsSnapshot();
    expect(snapshot.agents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'main',
          mainSessionKey: 'agent:main:desk',
        }),
        expect.objectContaining({
          id: 'research',
          mainSessionKey: 'agent:research:desk',
        }),
      ]),
    );
  });

  it('persists agent model overrides as object config and preserves existing fallbacks', async () => {
    await writeOpenClawJson({
      agents: {
        defaults: {
          model: {
            primary: 'bailian/qwen3.5-plus',
          },
        },
        list: [
          {
            id: 'main',
            name: 'Main',
            default: true,
            model: {
              primary: 'bailian/qwen3.5-plus',
              fallbacks: ['bailian/glm-5'],
            },
          },
        ],
      },
    });

    const { updateAgentSettings } = await import('@electron/utils/agent-config');

    const result = await updateAgentSettings('main', {
      name: 'Main',
      modelRef: 'openai/gpt-5.4',
    });

    const config = await readOpenClawJson();
    const mainAgent = ((config.agents as { list: Array<{ id: string; model?: unknown }> }).list).find(
      (agent) => agent.id === 'main',
    );

    expect(mainAgent?.model).toEqual({
      primary: 'openai/gpt-5.4',
      fallbacks: ['bailian/glm-5'],
    });
    expect(result.modelChanged).toBe(true);
    expect(result.snapshot.agents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'main',
          modelDisplay: 'gpt-5.4',
          modelRef: 'openai/gpt-5.4',
          defaultModelRef: 'bailian/qwen3.5-plus',
          inheritedModel: false,
        }),
      ]),
    );
  });

  it('persists a provider-scoped modelRef when creating a new agent', async () => {
    await writeOpenClawJson({
      agents: {
        defaults: {
          model: {
            primary: 'bailian/qwen3.5-plus',
          },
        },
        list: [
          {
            id: 'main',
            name: 'Main',
            default: true,
            workspace: '~/.openclaw/workspace',
            agentDir: '~/.openclaw/agents/main/agent',
          },
        ],
      },
    });

    const mainWorkspace = join(testHome, '.openclaw', 'workspace');
    const mainAgentDir = join(testHome, '.openclaw', 'agents', 'main', 'agent');
    await mkdir(mainWorkspace, { recursive: true });
    await mkdir(mainAgentDir, { recursive: true });

    const { createAgentWithId } = await import('@electron/utils/agent-config');

    const result = await createAgentWithId('Thumbnail Designer', {
      modelRef: 'provider-998/gpt-5.4',
    });

    const config = await readOpenClawJson();
    const createdAgent = ((config.agents as { list: Array<{ id: string; model?: unknown }> }).list).find(
      (agent) => agent.id === result.createdAgentId,
    );

    expect(createdAgent?.model).toEqual({
      primary: 'provider-998/gpt-5.4',
    });
    expect(result.snapshot.agents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: result.createdAgentId,
          modelDisplay: 'gpt-5.4',
          modelRef: 'provider-998/gpt-5.4',
          inheritedModel: false,
        }),
      ]),
    );
  });

  it('deletes the config entry and bindings while deferring runtime/workspace cleanup for a removed agent', async () => {
    await writeOpenClawJson({
      agents: {
        defaults: {
          model: {
            primary: 'custom-custom27/MiniMax-M2.5',
            fallbacks: [],
          },
        },
        list: [
          {
            id: 'main',
            name: 'Main',
            default: true,
            workspace: '~/.openclaw/workspace',
            agentDir: '~/.openclaw/agents/main/agent',
          },
          {
            id: 'test2',
            name: 'test2',
            workspace: '~/.openclaw/workspace-test2',
            agentDir: '~/.openclaw/agents/test2/agent',
          },
          {
            id: 'test3',
            name: 'test3',
            workspace: '~/.openclaw/workspace-test3',
            agentDir: '~/.openclaw/agents/test3/agent',
          },
        ],
      },
      channels: {
        feishu: {
          enabled: true,
        },
      },
      bindings: [
        {
          agentId: 'test2',
          match: {
            channel: 'feishu',
          },
        },
      ],
    });

    const test2RuntimeDir = join(testHome, '.openclaw', 'agents', 'test2');
    const test2WorkspaceDir = join(testHome, '.openclaw', 'workspace-test2');
    await mkdir(join(test2RuntimeDir, 'agent'), { recursive: true });
    await mkdir(join(test2RuntimeDir, 'sessions'), { recursive: true });
    await mkdir(join(test2WorkspaceDir, '.openclaw'), { recursive: true });
    await writeFile(
      join(test2RuntimeDir, 'agent', 'auth-profiles.json'),
      JSON.stringify({ version: 1, profiles: {} }, null, 2),
      'utf8',
    );
    await writeFile(join(test2WorkspaceDir, 'AGENTS.md'), '# test2', 'utf8');

    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const { deleteAgentConfig } = await import('@electron/utils/agent-config');

    const { snapshot } = await deleteAgentConfig('test2');

    expect(snapshot.agents.map((agent) => agent.id)).toEqual(['main', 'test3']);
    expect(snapshot.channelOwners.feishu).toBe('main');

    const config = await readOpenClawJson();
    expect((config.agents as { list: Array<{ id: string }> }).list.map((agent) => agent.id)).toEqual([
      'main',
      'test3',
    ]);
    expect(config.bindings).toEqual([]);
    // Runtime/workspace deletion is intentionally deferred by the route handler until
    // after Gateway replacement succeeds, so both directories should still exist here.
    await expect(access(test2RuntimeDir)).resolves.toBeUndefined();
    await expect(access(test2WorkspaceDir)).resolves.toBeUndefined();

    infoSpy.mockRestore();
  });

  it('preserves unmanaged custom workspaces when deleting an agent', async () => {
    const customWorkspaceDir = join(testHome, 'custom-workspace-test2');

    await writeOpenClawJson({
      agents: {
        list: [
          {
            id: 'main',
            name: 'Main',
            default: true,
            workspace: '~/.openclaw/workspace',
            agentDir: '~/.openclaw/agents/main/agent',
          },
          {
            id: 'test2',
            name: 'test2',
            workspace: customWorkspaceDir,
            agentDir: '~/.openclaw/agents/test2/agent',
          },
        ],
      },
    });

    await mkdir(join(testHome, '.openclaw', 'agents', 'test2', 'agent'), { recursive: true });
    await mkdir(customWorkspaceDir, { recursive: true });
    await writeFile(join(customWorkspaceDir, 'AGENTS.md'), '# custom', 'utf8');

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const { deleteAgentConfig } = await import('@electron/utils/agent-config');

    await deleteAgentConfig('test2');

    await expect(access(customWorkspaceDir)).resolves.toBeUndefined();

    warnSpy.mockRestore();
    infoSpy.mockRestore();
  });

  it('hides inherited bootstrap files for non-main agents while keeping agent-specific SOUL visible', async () => {
    const mainWorkspaceDir = join(testHome, '.openclaw', 'workspace');
    const marketWorkspaceDir = join(testHome, '.openclaw', 'workspace-thumbnail-designer');

    await writeOpenClawJson({
      agents: {
        list: [
          {
            id: 'main',
            name: 'Main',
            default: true,
            workspace: '~/.openclaw/workspace',
            agentDir: '~/.openclaw/agents/main/agent',
          },
          {
            id: 'thumbnail-designer',
            name: 'Thumbnail Designer',
            workspace: '~/.openclaw/workspace-thumbnail-designer',
            agentDir: '~/.openclaw/agents/thumbnail-designer/agent',
          },
        ],
      },
    });

    await mkdir(mainWorkspaceDir, { recursive: true });
    await mkdir(marketWorkspaceDir, { recursive: true });
    await writeFile(join(mainWorkspaceDir, 'AGENTS.md'), '# main rules', 'utf8');
    await writeFile(join(mainWorkspaceDir, 'IDENTITY.md'), '# main identity', 'utf8');
    await writeFile(join(mainWorkspaceDir, 'SOUL.md'), '# main soul', 'utf8');

    await writeFile(join(marketWorkspaceDir, 'AGENTS.md'), '# main rules', 'utf8');
    await writeFile(join(marketWorkspaceDir, 'IDENTITY.md'), '# main identity', 'utf8');
    await writeFile(join(marketWorkspaceDir, 'SOUL.md'), '# thumbnail soul', 'utf8');

    const { listAgentWorkspaceFiles } = await import('@electron/utils/agent-config');

    const files = await listAgentWorkspaceFiles('thumbnail-designer');

    expect(files.map((file) => file.relativePath)).toEqual(['SOUL.md']);
  });

  it('does not delete a legacy-named account when it is owned by another agent', async () => {
    await writeOpenClawJson({
      agents: {
        list: [
          { id: 'main', name: 'Main', default: true },
          { id: 'test2', name: 'test2' },
          { id: 'test3', name: 'test3' },
        ],
      },
      channels: {
        feishu: {
          enabled: true,
          defaultAccount: 'default',
          accounts: {
            default: { enabled: true, appId: 'main-app' },
            test2: { enabled: true, appId: 'legacy-test2-app' },
          },
        },
      },
      bindings: [
        {
          agentId: 'test3',
          match: {
            channel: 'feishu',
            accountId: 'test2',
          },
        },
      ],
    });

    const { deleteAgentConfig } = await import('@electron/utils/agent-config');
    await deleteAgentConfig('test2');

    const config = await readOpenClawJson();
    const feishu = (config.channels as Record<string, unknown>).feishu as {
      accounts?: Record<string, unknown>;
    };
    expect(feishu.accounts?.test2).toBeDefined();
  });

  it('allows the same agent to bind multiple different channels', async () => {
    await writeOpenClawJson({
      agents: {
        list: [
          { id: 'main', name: 'Main', default: true },
        ],
      },
      channels: {
        feishu: { enabled: true },
        telegram: { enabled: true },
      },
    });

    const { assignChannelAccountToAgent, listAgentsSnapshot } = await import('@electron/utils/agent-config');

    await assignChannelAccountToAgent('main', 'feishu', 'default');
    await assignChannelAccountToAgent('main', 'telegram', 'default');

    const snapshot = await listAgentsSnapshot();
    expect(snapshot.channelAccountOwners['feishu:default']).toBe('main');
    expect(snapshot.channelAccountOwners['telegram:default']).toBe('main');
  });

  it('replaces previous account binding for the same agent and channel', async () => {
    await writeOpenClawJson({
      agents: {
        list: [
          { id: 'main', name: 'Main', default: true },
        ],
      },
      channels: {
        feishu: {
          enabled: true,
          defaultAccount: 'default',
          accounts: {
            default: { enabled: true, appId: 'main-app' },
            alt: { enabled: true, appId: 'alt-app' },
          },
        },
      },
    });

    const { assignChannelAccountToAgent, listAgentsSnapshot } = await import('@electron/utils/agent-config');

    await assignChannelAccountToAgent('main', 'feishu', 'default');
    await assignChannelAccountToAgent('main', 'feishu', 'alt');

    const snapshot = await listAgentsSnapshot();
    expect(snapshot.channelAccountOwners['feishu:default']).toBeUndefined();
    expect(snapshot.channelAccountOwners['feishu:alt']).toBe('main');
  });

  it('keeps a single owner for the same channel account', async () => {
    await writeOpenClawJson({
      agents: {
        list: [
          { id: 'main', name: 'Main', default: true },
          { id: 'test2', name: 'test2' },
        ],
      },
      channels: {
        feishu: {
          enabled: true,
          accounts: {
            default: { enabled: true, appId: 'main-app' },
          },
        },
      },
    });

    const { assignChannelAccountToAgent, listAgentsSnapshot } = await import('@electron/utils/agent-config');

    await assignChannelAccountToAgent('main', 'feishu', 'default');
    await assignChannelAccountToAgent('test2', 'feishu', 'default');

    const snapshot = await listAgentsSnapshot();
    expect(snapshot.channelAccountOwners['feishu:default']).toBe('test2');
  });

  it('can clear one channel account binding without affecting another channel on the same agent', async () => {
    await writeOpenClawJson({
      agents: {
        list: [
          { id: 'main', name: 'Main', default: true },
        ],
      },
      channels: {
        feishu: { enabled: true },
        telegram: { enabled: true },
      },
    });

    const { assignChannelAccountToAgent, clearChannelBinding, listAgentsSnapshot } = await import('@electron/utils/agent-config');

    await assignChannelAccountToAgent('main', 'feishu', 'default');
    await assignChannelAccountToAgent('main', 'telegram', 'default');
    await clearChannelBinding('feishu', 'default');

    const snapshot = await listAgentsSnapshot();
    expect(snapshot.channelAccountOwners['feishu:default']).toBeUndefined();
    expect(snapshot.channelAccountOwners['telegram:default']).toBe('main');
  });

  it('retargets legacy channel-wide bindings when the default account is renamed', async () => {
    await writeOpenClawJson({
      agents: {
        list: [
          { id: 'main', name: 'Main', default: true },
        ],
      },
      channels: {
        feishu: {
          enabled: true,
          defaultAccount: 'sales-bot',
          accounts: {
            'sales-bot': { enabled: true, appId: 'sales-app' },
          },
        },
      },
      bindings: [
        {
          agentId: 'main',
          match: {
            channel: 'feishu',
          },
        },
      ],
    });

    const { listAgentsSnapshot, renameChannelAccountBinding } = await import('@electron/utils/agent-config');

    await renameChannelAccountBinding('feishu', 'default', 'sales-bot');

    const config = await readOpenClawJson();
    expect(config.bindings).toEqual([
      {
        agentId: 'main',
        match: {
          channel: 'feishu',
          accountId: 'sales-bot',
        },
      },
    ]);

    const snapshot = await listAgentsSnapshot();
    expect(snapshot.channelAccountOwners['feishu:default']).toBeUndefined();
    expect(snapshot.channelAccountOwners['feishu:sales-bot']).toBe('main');
  });

  it('rejects workspace file creation for an unknown agent without creating a ghost workspace', async () => {
    await writeOpenClawJson({
      agents: {
        list: [
          { id: 'main', name: 'Main', default: true },
        ],
      },
    });

    const { createAgentWorkspaceFile } = await import('@electron/utils/agent-config');

    await expect(createAgentWorkspaceFile('ghost', 'SOUL.md', '# ghost')).rejects.toThrow('Agent "ghost" not found');
    await expect(access(join(testHome, '.openclaw', 'workspace-ghost'))).rejects.toThrow();
  });

  it('rejects workspace operations when the configured workspace root is a symlink', async () => {
    const realWorkspaceDir = join(testHome, 'actual-workspace');
    const symlinkWorkspaceDir = join(testHome, 'workspace-link');

    await writeOpenClawJson({
      agents: {
        list: [
          { id: 'main', name: 'Main', default: true },
          {
            id: 'symlinked',
            name: 'Symlinked',
            workspace: symlinkWorkspaceDir,
            agentDir: '~/.openclaw/agents/symlinked/agent',
          },
        ],
      },
    });

    await mkdir(realWorkspaceDir, { recursive: true });
    await writeFile(join(realWorkspaceDir, 'SOUL.md'), '# soul', 'utf8');
    await symlink(realWorkspaceDir, symlinkWorkspaceDir);

    const { listAgentWorkspaceFiles } = await import('@electron/utils/agent-config');

    await expect(listAgentWorkspaceFiles('symlinked')).rejects.toThrow(`Unsupported workspace root symlink: ${symlinkWorkspaceDir}`);
  });
});
