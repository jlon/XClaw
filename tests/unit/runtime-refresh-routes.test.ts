import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { IncomingMessage, ServerResponse } from 'http';

const parseJsonBodyMock = vi.fn();
const sendJsonMock = vi.fn();
const createAgentWithIdMock = vi.fn();
const updateAgentSettingsMock = vi.fn();
const deleteAgentConfigMock = vi.fn();
const removeAgentWorkspaceDirectoryMock = vi.fn();
const writeAgentWorkspaceFileContentMock = vi.fn();
const createAgentWorkspaceFileMock = vi.fn();
const uploadAgentWorkspaceFileMock = vi.fn();
const renameAgentWorkspaceFileMock = vi.fn();
const deleteAgentWorkspaceFileMock = vi.fn();
const installAgentFromCatalogMock = vi.fn();
const setChannelDefaultAccountMock = vi.fn();
const setChannelEnabledMock = vi.fn();
const getChannelEditorValuesMock = vi.fn();
const getChannelFormValuesMock = vi.fn();
const saveChannelConfigMock = vi.fn();
const syncAllProviderAuthToRuntimeMock = vi.fn();

vi.mock('@electron/api/route-utils', () => ({
  parseJsonBody: (...args: unknown[]) => parseJsonBodyMock(...args),
  sendJson: (...args: unknown[]) => sendJsonMock(...args),
}));

vi.mock('@electron/utils/agent-config', () => ({
  assignChannelToAgent: vi.fn(),
  assignChannelAccountToAgent: vi.fn(),
  clearAllBindingsForChannel: vi.fn(),
  clearChannelBinding: vi.fn(),
  createAgentWithId: (...args: unknown[]) => createAgentWithIdMock(...args),
  createAgentWorkspaceFile: (...args: unknown[]) => createAgentWorkspaceFileMock(...args),
  deleteAgentConfig: (...args: unknown[]) => deleteAgentConfigMock(...args),
  deleteAgentWorkspaceFile: (...args: unknown[]) => deleteAgentWorkspaceFileMock(...args),
  listAgentsSnapshot: vi.fn().mockResolvedValue({ entries: [], channelAccountOwners: {} }),
  listAgentWorkspaceFiles: vi.fn(),
  readAgentWorkspaceFileContent: vi.fn(),
  removeAgentWorkspaceDirectory: (...args: unknown[]) => removeAgentWorkspaceDirectoryMock(...args),
  renameChannelAccountBinding: vi.fn(),
  renameAgentWorkspaceFile: (...args: unknown[]) => renameAgentWorkspaceFileMock(...args),
  resolveAccountIdForAgent: vi.fn().mockReturnValue('default'),
  updateAgentName: vi.fn(),
  updateAgentSettings: (...args: unknown[]) => updateAgentSettingsMock(...args),
  uploadAgentWorkspaceFile: (...args: unknown[]) => uploadAgentWorkspaceFileMock(...args),
  writeAgentWorkspaceFileContent: (...args: unknown[]) => writeAgentWorkspaceFileContentMock(...args),
}));

vi.mock('@electron/utils/agent-market', () => ({
  installAgentFromCatalog: (...args: unknown[]) => installAgentFromCatalogMock(...args),
  listAgentMarketCatalog: vi.fn(),
}));

vi.mock('@electron/utils/channel-config', () => ({
  deleteChannelAccountConfig: vi.fn(),
  deleteChannelConfig: vi.fn(),
  getChannelEditorValues: (...args: unknown[]) => getChannelEditorValuesMock(...args),
  getChannelFormValues: (...args: unknown[]) => getChannelFormValuesMock(...args),
  listConfiguredChannelAccounts: vi.fn().mockResolvedValue({}),
  listConfiguredChannels: vi.fn().mockResolvedValue([]),
  readOpenClawConfig: vi.fn().mockResolvedValue({ channels: {} }),
  renameChannelAccountConfig: vi.fn(),
  saveChannelConfig: (...args: unknown[]) => saveChannelConfigMock(...args),
  setChannelDefaultAccount: (...args: unknown[]) => setChannelDefaultAccountMock(...args),
  setChannelEnabled: (...args: unknown[]) => setChannelEnabledMock(...args),
  validateChannelConfig: vi.fn(),
  validateChannelCredentials: vi.fn(),
}));

vi.mock('@electron/utils/plugin-install', () => ({
  ensureDingTalkPluginInstalled: vi.fn().mockResolvedValue({ installed: true }),
  ensureFeishuPluginInstalled: vi.fn().mockResolvedValue({ installed: true }),
  ensureQQBotPluginInstalled: vi.fn().mockResolvedValue({ installed: true }),
  ensureWeComPluginInstalled: vi.fn().mockResolvedValue({ installed: true }),
}));

vi.mock('@electron/utils/whatsapp-login', () => ({
  whatsAppLoginManager: {
    start: vi.fn(),
    stop: vi.fn(),
  },
}));

vi.mock('@electron/services/providers/provider-runtime-sync', () => ({
  syncAllProviderAuthToRuntime: (...args: unknown[]) => syncAllProviderAuthToRuntimeMock(...args),
}));

describe('agent and channel runtime refresh routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    parseJsonBodyMock.mockResolvedValue({});
    createAgentWithIdMock.mockResolvedValue({ snapshot: { entries: [] }, createdAgentId: 'agent-a' });
    updateAgentSettingsMock.mockResolvedValue({
      snapshot: {
        agents: [],
        defaultAgentId: 'main',
        configuredChannelTypes: [],
        channelOwners: {},
        channelAccountOwners: {},
      },
      modelChanged: false,
      nameChanged: false,
    });
    deleteAgentConfigMock.mockResolvedValue({
      snapshot: { entries: [], channelAccountOwners: {} },
      removedEntry: { id: 'agent-a' },
    });
    removeAgentWorkspaceDirectoryMock.mockResolvedValue(undefined);
    writeAgentWorkspaceFileContentMock.mockResolvedValue(undefined);
    createAgentWorkspaceFileMock.mockResolvedValue(undefined);
    uploadAgentWorkspaceFileMock.mockResolvedValue(undefined);
    renameAgentWorkspaceFileMock.mockResolvedValue(undefined);
    deleteAgentWorkspaceFileMock.mockResolvedValue(undefined);
    installAgentFromCatalogMock.mockResolvedValue({ snapshot: { entries: [] }, createdAgentId: 'agent-b' });
    syncAllProviderAuthToRuntimeMock.mockResolvedValue(undefined);
    setChannelDefaultAccountMock.mockResolvedValue(undefined);
    setChannelEnabledMock.mockResolvedValue(undefined);
    getChannelEditorValuesMock.mockResolvedValue(undefined);
    getChannelFormValuesMock.mockResolvedValue(undefined);
    saveChannelConfigMock.mockResolvedValue(undefined);
  });

  it('routes agent create and delete through the runtime controller', async () => {
    const { handleAgentRoutes } = await import('@electron/api/routes/agents');
    const restartRuntime = vi.fn().mockResolvedValue(undefined);
    const replaceRuntime = vi.fn().mockResolvedValue(undefined);
    const gatewayManager = {
      getStatus: vi.fn().mockReturnValue({ state: 'running', pid: undefined, port: undefined }),
      debouncedReload: vi.fn(),
      restart: vi.fn(),
    };
    const ctx = {
      gatewayManager,
      gatewayRuntimeController: {
        restartRuntime,
        replaceRuntime,
      },
    } as never;

    parseJsonBodyMock.mockResolvedValueOnce({ name: 'My Agent' });
    await handleAgentRoutes(
      { method: 'POST' } as IncomingMessage,
      {} as ServerResponse,
      new URL('http://127.0.0.1:3210/api/agents'),
      ctx,
    );

    await handleAgentRoutes(
      { method: 'DELETE' } as IncomingMessage,
      {} as ServerResponse,
      new URL('http://127.0.0.1:3210/api/agents/agent-a'),
      ctx,
    );

    expect(syncAllProviderAuthToRuntimeMock).toHaveBeenCalledTimes(1);
    expect(restartRuntime).toHaveBeenCalledTimes(1);
    expect(replaceRuntime).toHaveBeenCalledTimes(1);
    expect(gatewayManager.debouncedReload).not.toHaveBeenCalled();
    expect(gatewayManager.restart).not.toHaveBeenCalled();
  });

  it('routes workspace file mutations and market install through runtime restart', async () => {
    const { handleAgentRoutes } = await import('@electron/api/routes/agents');
    const { handleAgentMarketRoutes } = await import('@electron/api/routes/agent-market');
    const restartRuntime = vi.fn().mockResolvedValue(undefined);
    const ctx = {
      gatewayRuntimeController: {
        restartRuntime,
      },
    } as never;

    parseJsonBodyMock
      .mockResolvedValueOnce({ root: 'workspace', relativePath: 'SOUL.md', content: '# soul' })
      .mockResolvedValueOnce({ catalogItemId: 'research/planner', name: 'Planner' });

    await handleAgentRoutes(
      { method: 'PUT' } as IncomingMessage,
      {} as ServerResponse,
      new URL('http://127.0.0.1:3210/api/agents/main/files/content'),
      ctx,
    );

    await handleAgentMarketRoutes(
      { method: 'POST' } as IncomingMessage,
      {} as ServerResponse,
      new URL('http://127.0.0.1:3210/api/agent-market/install'),
      ctx,
    );

    expect(writeAgentWorkspaceFileContentMock).toHaveBeenCalledWith('main', 'SOUL.md', '# soul');
    expect(installAgentFromCatalogMock).toHaveBeenCalledWith('research/planner', 'Planner');
    expect(syncAllProviderAuthToRuntimeMock).toHaveBeenCalledTimes(1);
    expect(restartRuntime).toHaveBeenCalledTimes(2);
  });

  it('updates agent settings and only requests async restart when the model changes', async () => {
    const { handleAgentRoutes } = await import('@electron/api/routes/agents');
    const requestRuntimeRefresh = vi.fn().mockResolvedValue(undefined);
    const ctx = {
      gatewayRuntimeController: {
        requestRuntimeRefresh,
      },
    } as never;

    parseJsonBodyMock
      .mockResolvedValueOnce({ name: 'Main Agent', modelRef: 'openai/gpt-5.4' })
      .mockResolvedValueOnce({ name: 'Main Agent v2', modelRef: 'openai/gpt-5.4' });
    updateAgentSettingsMock
      .mockResolvedValueOnce({
        snapshot: {
          agents: [],
          defaultAgentId: 'main',
          configuredChannelTypes: [],
          channelOwners: {},
          channelAccountOwners: {},
        },
        modelChanged: true,
        nameChanged: false,
      })
      .mockResolvedValueOnce({
        snapshot: {
          agents: [],
          defaultAgentId: 'main',
          configuredChannelTypes: [],
          channelOwners: {},
          channelAccountOwners: {},
        },
        modelChanged: false,
        nameChanged: true,
      });

    await handleAgentRoutes(
      { method: 'PUT' } as IncomingMessage,
      {} as ServerResponse,
      new URL('http://127.0.0.1:3210/api/agents/main'),
      ctx,
    );

    await handleAgentRoutes(
      { method: 'PUT' } as IncomingMessage,
      {} as ServerResponse,
      new URL('http://127.0.0.1:3210/api/agents/main'),
      ctx,
    );

    expect(updateAgentSettingsMock).toHaveBeenNthCalledWith(1, 'main', {
      name: 'Main Agent',
      modelRef: 'openai/gpt-5.4',
    });
    expect(updateAgentSettingsMock).toHaveBeenNthCalledWith(2, 'main', {
      name: 'Main Agent v2',
      modelRef: 'openai/gpt-5.4',
    });
    expect(requestRuntimeRefresh).toHaveBeenCalledTimes(1);
    expect(requestRuntimeRefresh).toHaveBeenCalledWith({ mode: 'restart' });
  });

  it('routes channel default-account and enable toggles through the runtime controller', async () => {
    const { handleChannelRoutes } = await import('@electron/api/routes/channels');
    const requestRuntimeRefresh = vi.fn().mockResolvedValue(undefined);

    parseJsonBodyMock
      .mockResolvedValueOnce({ channelType: 'telegram', accountId: 'default' })
      .mockResolvedValueOnce({ channelType: 'telegram', enabled: true });

    await handleChannelRoutes(
      { method: 'PUT' } as IncomingMessage,
      {} as ServerResponse,
      new URL('http://127.0.0.1:3210/api/channels/default-account'),
      {
        gatewayManager: {
          rpc: vi.fn(),
        },
        gatewayRuntimeController: {
          requestRuntimeRefresh,
        },
      } as never,
    );

    await handleChannelRoutes(
      { method: 'PUT' } as IncomingMessage,
      {} as ServerResponse,
      new URL('http://127.0.0.1:3210/api/channels/config/enabled'),
      {
        gatewayManager: {
          rpc: vi.fn(),
        },
        gatewayRuntimeController: {
          requestRuntimeRefresh,
        },
      } as never,
    );

    expect(requestRuntimeRefresh).toHaveBeenNthCalledWith(1, { mode: 'reload' });
    expect(requestRuntimeRefresh).toHaveBeenNthCalledWith(2, { mode: 'restart' });
  });

  it('skips runtime refresh when channel config does not change', async () => {
    const { handleChannelRoutes } = await import('@electron/api/routes/channels');
    const requestRuntimeRefresh = vi.fn().mockResolvedValue(undefined);

    parseJsonBodyMock.mockResolvedValueOnce({
      channelType: 'feishu',
      accountId: 'default',
      config: {
        appId: 'abc',
      },
    });
    getChannelEditorValuesMock.mockResolvedValueOnce({
      appId: 'abc',
    });

    await handleChannelRoutes(
      { method: 'POST' } as IncomingMessage,
      {} as ServerResponse,
      new URL('http://127.0.0.1:3210/api/channels/config'),
      {
        gatewayManager: {
          rpc: vi.fn(),
        },
        gatewayRuntimeController: {
          requestRuntimeRefresh,
        },
      } as never,
    );

    expect(requestRuntimeRefresh).not.toHaveBeenCalled();
    expect(saveChannelConfigMock).not.toHaveBeenCalled();
    expect(sendJsonMock).toHaveBeenCalledWith(expect.anything(), 200, { success: true, noChange: true });
  });
});
