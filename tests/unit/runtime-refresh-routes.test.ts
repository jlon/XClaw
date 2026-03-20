import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { IncomingMessage, ServerResponse } from 'http';

const parseJsonBodyMock = vi.fn();
const sendJsonMock = vi.fn();
const createAgentMock = vi.fn();
const deleteAgentConfigMock = vi.fn();
const removeAgentWorkspaceDirectoryMock = vi.fn();
const setChannelDefaultAccountMock = vi.fn();
const setChannelEnabledMock = vi.fn();
const getChannelEditorValuesMock = vi.fn();
const getChannelFormValuesMock = vi.fn();
const saveChannelConfigMock = vi.fn();

vi.mock('@electron/api/route-utils', () => ({
  parseJsonBody: (...args: unknown[]) => parseJsonBodyMock(...args),
  sendJson: (...args: unknown[]) => sendJsonMock(...args),
}));

vi.mock('@electron/utils/agent-config', () => ({
  assignChannelToAgent: vi.fn(),
  assignChannelAccountToAgent: vi.fn(),
  clearAllBindingsForChannel: vi.fn(),
  clearChannelBinding: vi.fn(),
  createAgent: (...args: unknown[]) => createAgentMock(...args),
  deleteAgentConfig: (...args: unknown[]) => deleteAgentConfigMock(...args),
  listAgentsSnapshot: vi.fn().mockResolvedValue({ entries: [], channelAccountOwners: {} }),
  removeAgentWorkspaceDirectory: (...args: unknown[]) => removeAgentWorkspaceDirectoryMock(...args),
  renameChannelAccountBinding: vi.fn(),
  resolveAccountIdForAgent: vi.fn().mockReturnValue('default'),
  updateAgentName: vi.fn(),
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
  syncAllProviderAuthToRuntime: vi.fn().mockResolvedValue(undefined),
}));

describe('agent and channel runtime refresh routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    parseJsonBodyMock.mockResolvedValue({});
    createAgentMock.mockResolvedValue({ entries: [] });
    deleteAgentConfigMock.mockResolvedValue({
      snapshot: { entries: [], channelAccountOwners: {} },
      removedEntry: { id: 'agent-a' },
    });
    removeAgentWorkspaceDirectoryMock.mockResolvedValue(undefined);
    setChannelDefaultAccountMock.mockResolvedValue(undefined);
    setChannelEnabledMock.mockResolvedValue(undefined);
    getChannelEditorValuesMock.mockResolvedValue(undefined);
    getChannelFormValuesMock.mockResolvedValue(undefined);
    saveChannelConfigMock.mockResolvedValue(undefined);
  });

  it('routes agent create and delete through the runtime controller', async () => {
    const { handleAgentRoutes } = await import('@electron/api/routes/agents');
    const requestRuntimeRefresh = vi.fn().mockResolvedValue(undefined);
    const replaceRuntime = vi.fn().mockResolvedValue(undefined);
    const gatewayManager = {
      getStatus: vi.fn().mockReturnValue({ state: 'running', pid: undefined, port: undefined }),
      debouncedReload: vi.fn(),
      restart: vi.fn(),
    };
    const ctx = {
      gatewayManager,
      gatewayRuntimeController: {
        requestRuntimeRefresh,
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

    expect(requestRuntimeRefresh).toHaveBeenCalledWith({ mode: 'reload' });
    expect(replaceRuntime).toHaveBeenCalledTimes(1);
    expect(gatewayManager.debouncedReload).not.toHaveBeenCalled();
    expect(gatewayManager.restart).not.toHaveBeenCalled();
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
