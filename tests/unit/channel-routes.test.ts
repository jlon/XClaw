import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { IncomingMessage, ServerResponse } from 'http';

const listConfiguredChannelsMock = vi.fn();
const listConfiguredChannelAccountsMock = vi.fn();
const readOpenClawConfigMock = vi.fn();
const listAgentsSnapshotMock = vi.fn();
const sendJsonMock = vi.fn();
const parseJsonBodyMock = vi.fn();
const renameChannelAccountConfigMock = vi.fn();
const renameChannelAccountBindingMock = vi.fn();
const getChannelRecipientHintValuesMock = vi.fn();
const ensureWeixinPluginInstalledMock = vi.fn();
const weixinLoginStartMock = vi.fn();
const weixinLoginPollMock = vi.fn();
const weixinLoginStopMock = vi.fn();
const getWeixinGuardianEnabledMock = vi.fn();
const setWeixinGuardianEnabledMock = vi.fn();
const runWeixinGuardianCheckMock = vi.fn();

vi.mock('@electron/utils/channel-config', () => ({
  deleteChannelAccountConfig: vi.fn(),
  deleteChannelConfig: vi.fn(),
  getChannelEditorValues: vi.fn(),
  getChannelRecipientHintValues: (...args: unknown[]) => getChannelRecipientHintValuesMock(...args),
  getChannelFormValues: vi.fn(),
  listConfiguredChannelAccounts: (...args: unknown[]) => listConfiguredChannelAccountsMock(...args),
  listConfiguredChannels: (...args: unknown[]) => listConfiguredChannelsMock(...args),
  readOpenClawConfig: (...args: unknown[]) => readOpenClawConfigMock(...args),
  renameChannelAccountConfig: (...args: unknown[]) => renameChannelAccountConfigMock(...args),
  saveChannelConfig: vi.fn(),
  setChannelDefaultAccount: vi.fn(),
  setChannelEnabled: vi.fn(),
  validateChannelConfig: vi.fn(),
  validateChannelCredentials: vi.fn(),
}));

vi.mock('@electron/utils/agent-config', () => ({
  assignChannelAccountToAgent: vi.fn(),
  clearAllBindingsForChannel: vi.fn(),
  clearChannelBinding: vi.fn(),
  listAgentsSnapshot: (...args: unknown[]) => listAgentsSnapshotMock(...args),
  renameChannelAccountBinding: (...args: unknown[]) => renameChannelAccountBindingMock(...args),
}));

vi.mock('@electron/utils/plugin-install', () => ({
  ensureDingTalkPluginInstalled: vi.fn(),
  ensureFeishuPluginInstalled: vi.fn(),
  ensureQQBotPluginInstalled: vi.fn(),
  ensureWeComPluginInstalled: vi.fn(),
  ensureWeixinPluginInstalled: (...args: unknown[]) => ensureWeixinPluginInstalledMock(...args),
}));

vi.mock('@electron/utils/whatsapp-login', () => ({
  whatsAppLoginManager: {
    start: vi.fn(),
    stop: vi.fn(),
  },
}));

vi.mock('@electron/utils/weixin-login', () => ({
  weixinLoginManager: {
    start: (...args: unknown[]) => weixinLoginStartMock(...args),
    poll: (...args: unknown[]) => weixinLoginPollMock(...args),
    stop: (...args: unknown[]) => weixinLoginStopMock(...args),
  },
}));

vi.mock('@electron/utils/weixin-guardian', () => ({
  getWeixinGuardianEnabled: (...args: unknown[]) => getWeixinGuardianEnabledMock(...args),
  setWeixinGuardianEnabled: (...args: unknown[]) => setWeixinGuardianEnabledMock(...args),
  weixinGuardianService: {
    runCheck: (...args: unknown[]) => runWeixinGuardianCheckMock(...args),
  },
}));

vi.mock('@electron/api/route-utils', () => ({
  parseJsonBody: (...args: unknown[]) => parseJsonBodyMock(...args),
  sendJson: (...args: unknown[]) => sendJsonMock(...args),
}));

describe('handleChannelRoutes', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    parseJsonBodyMock.mockResolvedValue({});
    ensureWeixinPluginInstalledMock.mockReturnValue({ installed: true });
    weixinLoginStartMock.mockResolvedValue({
      qrcodeUrl: 'https://ilinkai.weixin.qq.com/qrcode/session-1',
      sessionKey: 'session-1',
      message: 'ready',
    });
    weixinLoginPollMock.mockReturnValue({
      status: 'wait',
      connected: false,
      sessionKey: 'session-1',
    });
    weixinLoginStopMock.mockResolvedValue(undefined);
    getWeixinGuardianEnabledMock.mockResolvedValue(false);
    setWeixinGuardianEnabledMock.mockResolvedValue(undefined);
    runWeixinGuardianCheckMock.mockResolvedValue(undefined);
    getChannelRecipientHintValuesMock.mockResolvedValue(undefined);
    listAgentsSnapshotMock.mockResolvedValue({
      entries: [],
      channelAccountOwners: {},
    });
    readOpenClawConfigMock.mockResolvedValue({
      channels: {},
    });
  });

  it('reports healthy running multi-account channels as connected without forcing a probe by default', async () => {
    listConfiguredChannelsMock.mockResolvedValue(['feishu']);
    listConfiguredChannelAccountsMock.mockResolvedValue({
      feishu: {
        defaultAccountId: 'default',
        accountIds: ['default', 'feishu-2412524e'],
      },
    });
    readOpenClawConfigMock.mockResolvedValue({
      channels: {
        feishu: {
          defaultAccount: 'default',
        },
      },
    });
    listAgentsSnapshotMock.mockResolvedValue({
      entries: [],
      channelAccountOwners: {
        'feishu:default': 'main',
        'feishu:feishu-2412524e': 'code',
      },
    });

    const rpc = vi.fn().mockResolvedValue({
      channels: {
        feishu: {
          configured: true,
        },
      },
      channelAccounts: {
        feishu: [
          {
            accountId: 'default',
            configured: true,
            connected: false,
            running: true,
            linked: false,
          },
          {
            accountId: 'feishu-2412524e',
            configured: true,
            connected: false,
            running: true,
            linked: false,
          },
        ],
      },
      channelDefaultAccountId: {
        feishu: 'default',
      },
    });

    const { handleChannelRoutes } = await import('@electron/api/routes/channels');
    const handled = await handleChannelRoutes(
      { method: 'GET' } as IncomingMessage,
      {} as ServerResponse,
      new URL('http://127.0.0.1:3210/api/channels/accounts'),
      {
        gatewayManager: {
          rpc,
          getStatus: () => ({ state: 'running' }),
          debouncedReload: vi.fn(),
          debouncedRestart: vi.fn(),
        },
      } as never,
    );

    expect(handled).toBe(true);
    expect(rpc).toHaveBeenCalledWith('channels.status', { probe: false });
    expect(sendJsonMock).toHaveBeenCalledWith(
      expect.anything(),
      200,
      expect.objectContaining({
        success: true,
        channels: [
          expect.objectContaining({
            channelType: 'feishu',
            status: 'connected',
            accounts: expect.arrayContaining([
              expect.objectContaining({ accountId: 'default', status: 'connected' }),
              expect.objectContaining({ accountId: 'feishu-2412524e', status: 'connected' }),
            ]),
          }),
        ],
      }),
    );
  });

  it('allows explicit runtime probing when the accounts route requests it', async () => {
    listConfiguredChannelsMock.mockResolvedValue(['feishu']);
    listConfiguredChannelAccountsMock.mockResolvedValue({
      feishu: {
        defaultAccountId: 'default',
        accountIds: ['default'],
      },
    });

    const rpc = vi.fn().mockResolvedValue({
      channels: {
        feishu: {
          configured: true,
        },
      },
      channelAccounts: {
        feishu: [
          {
            accountId: 'default',
            configured: true,
            connected: true,
            running: true,
            linked: false,
          },
        ],
      },
      channelDefaultAccountId: {
        feishu: 'default',
      },
    });

    const { handleChannelRoutes } = await import('@electron/api/routes/channels');
    await handleChannelRoutes(
      { method: 'GET' } as IncomingMessage,
      {} as ServerResponse,
      new URL('http://127.0.0.1:3210/api/channels/accounts?probe=1'),
      {
        gatewayManager: {
          rpc,
          getStatus: () => ({ state: 'running' }),
          debouncedReload: vi.fn(),
          debouncedRestart: vi.fn(),
        },
      } as never,
    );

    expect(rpc).toHaveBeenCalledWith('channels.status', { probe: true });
  });

  it('returns recipient hints for cron target inference', async () => {
    getChannelRecipientHintValuesMock.mockResolvedValue({
      pairingAllowFrom: ['ou_123'],
      pairingRecipientId: 'ou_123',
    });

    const { handleChannelRoutes } = await import('@electron/api/routes/channels');
    const handled = await handleChannelRoutes(
      { method: 'GET' } as IncomingMessage,
      {} as ServerResponse,
      new URL('http://127.0.0.1:3210/api/channels/recipient-hints/feishu?accountId=bot2'),
      {
        gatewayManager: {
          rpc: vi.fn(),
          getStatus: () => ({ state: 'running' }),
          debouncedReload: vi.fn(),
          debouncedRestart: vi.fn(),
        },
      } as never,
    );

    expect(handled).toBe(true);
    expect(getChannelRecipientHintValuesMock).toHaveBeenCalledWith('feishu', 'bot2');
    expect(sendJsonMock).toHaveBeenCalledWith(
      expect.anything(),
      200,
      expect.objectContaining({
        success: true,
        values: expect.objectContaining({
          pairingAllowFrom: ['ou_123'],
          pairingRecipientId: 'ou_123',
        }),
      }),
    );
  });

  it('marks channel runtime as unavailable when the gateway is not running', async () => {
    listConfiguredChannelsMock.mockResolvedValue(['wecom']);
    listConfiguredChannelAccountsMock.mockResolvedValue({
      wecom: {
        defaultAccountId: 'default',
        accountIds: ['default', 'main'],
      },
    });
    readOpenClawConfigMock.mockResolvedValue({
      channels: {
        wecom: {
          enabled: true,
          defaultAccount: 'default',
        },
      },
    });

    const { handleChannelRoutes } = await import('@electron/api/routes/channels');
    const handled = await handleChannelRoutes(
      { method: 'GET' } as IncomingMessage,
      {} as ServerResponse,
      new URL('http://127.0.0.1:3210/api/channels/accounts'),
      {
        gatewayManager: {
          rpc: vi.fn(),
          getStatus: () => ({ state: 'stopped' }),
          debouncedReload: vi.fn(),
          debouncedRestart: vi.fn(),
        },
      } as never,
    );

    expect(handled).toBe(true);
    expect(sendJsonMock).toHaveBeenCalledWith(
      expect.anything(),
      200,
      expect.objectContaining({
        success: true,
        runtimeAvailable: false,
        gatewayState: 'stopped',
        channels: [
          expect.objectContaining({
            channelType: 'wecom',
            status: 'disconnected',
            accounts: expect.arrayContaining([
              expect.objectContaining({ accountId: 'default', status: 'disconnected' }),
              expect.objectContaining({ accountId: 'main', status: 'disconnected' }),
            ]),
          }),
        ],
      }),
    );
  });

  it('starts the weixin login flow and returns the qr payload immediately', async () => {
    ensureWeixinPluginInstalledMock.mockReturnValue({ installed: true, changed: true });
    parseJsonBodyMock.mockResolvedValue({
      accountId: 'wx-im-bot',
      force: true,
      config: { routeTag: 'wechat-gray' },
    });

    const restartMock = vi.fn().mockResolvedValue(undefined);
    const { handleChannelRoutes } = await import('@electron/api/routes/channels');

    const handled = await handleChannelRoutes(
      { method: 'POST' } as IncomingMessage,
      {} as ServerResponse,
      new URL('http://127.0.0.1:3210/api/channels/weixin/start'),
      {
        gatewayManager: {
          rpc: vi.fn(),
          restart: restartMock,
          getStatus: () => ({ state: 'running' }),
          debouncedReload: vi.fn(),
          debouncedRestart: vi.fn(),
        },
      } as never,
    );

    expect(handled).toBe(true);
    expect(restartMock).not.toHaveBeenCalled();
    expect(weixinLoginStartMock).toHaveBeenCalledWith(
      expect.anything(),
      {
        accountId: 'wx-im-bot',
        force: true,
        config: { routeTag: 'wechat-gray' },
      },
    );
    expect(sendJsonMock).toHaveBeenCalledWith(expect.anything(), 200, {
      success: true,
      qrcodeUrl: 'https://ilinkai.weixin.qq.com/qrcode/session-1',
      sessionKey: 'session-1',
      message: 'ready',
    });
  });

  it('keeps channel connected when one account is healthy and another errors', async () => {
    listConfiguredChannelsMock.mockResolvedValue(['telegram']);
    listConfiguredChannelAccountsMock.mockResolvedValue({
      telegram: {
        defaultAccountId: 'default',
        accountIds: ['default', 'telegram-b'],
      },
    });
    readOpenClawConfigMock.mockResolvedValue({
      channels: {
        telegram: {
          defaultAccount: 'default',
        },
      },
    });

    const rpc = vi.fn().mockResolvedValue({
      channels: {
        telegram: {
          configured: true,
        },
      },
      channelAccounts: {
        telegram: [
          {
            accountId: 'default',
            configured: true,
            connected: true,
            running: true,
            linked: false,
          },
          {
            accountId: 'telegram-b',
            configured: true,
            connected: false,
            running: false,
            linked: false,
            lastError: 'secondary bot failed',
          },
        ],
      },
      channelDefaultAccountId: {
        telegram: 'default',
      },
    });

    const { handleChannelRoutes } = await import('@electron/api/routes/channels');
    await handleChannelRoutes(
      { method: 'GET' } as IncomingMessage,
      {} as ServerResponse,
      new URL('http://127.0.0.1:3210/api/channels/accounts'),
      {
        gatewayManager: {
          rpc,
          getStatus: () => ({ state: 'running' }),
          debouncedReload: vi.fn(),
          debouncedRestart: vi.fn(),
        },
      } as never,
    );

    expect(sendJsonMock).toHaveBeenCalledWith(
      expect.anything(),
      200,
      expect.objectContaining({
        success: true,
        channels: [
          expect.objectContaining({
            channelType: 'telegram',
            status: 'connected',
            accounts: expect.arrayContaining([
              expect.objectContaining({ accountId: 'default', status: 'connected' }),
              expect.objectContaining({ accountId: 'telegram-b', status: 'error' }),
            ]),
          }),
        ],
      }),
    );
  });

  it('renames an account id and moves account-scoped bindings with it', async () => {
    parseJsonBodyMock.mockResolvedValue({
      channelType: 'feishu',
      accountId: 'default',
      nextAccountId: 'sales-bot',
    });

    const { handleChannelRoutes } = await import('@electron/api/routes/channels');
    const handled = await handleChannelRoutes(
      { method: 'PUT' } as IncomingMessage,
      {} as ServerResponse,
      new URL('http://127.0.0.1:3210/api/channels/account-id/rename'),
      {
        gatewayManager: {
          rpc: vi.fn(),
          getStatus: () => ({ state: 'running' }),
          debouncedReload: vi.fn(),
          debouncedRestart: vi.fn(),
        },
        gatewayRuntimeController: {
          requestRuntimeRefresh: vi.fn().mockResolvedValue(undefined),
        },
      } as never,
    );

    expect(handled).toBe(true);
    expect(renameChannelAccountConfigMock).toHaveBeenCalledWith('feishu', 'default', 'sales-bot');
    expect(renameChannelAccountBindingMock).toHaveBeenCalledWith('feishu', 'default', 'sales-bot');
    expect(sendJsonMock).toHaveBeenCalledWith(
      expect.anything(),
      200,
      expect.objectContaining({ success: true, accountId: 'sales-bot' }),
    );
  });

  it('installs the weixin plugin before saving openclaw-weixin config', async () => {
    parseJsonBodyMock.mockResolvedValue({
      channelType: 'openclaw-weixin',
      accountId: 'wx-bot',
      config: {
        name: 'WeChat Bot',
      },
    });

    const { handleChannelRoutes } = await import('@electron/api/routes/channels');
    const handled = await handleChannelRoutes(
      { method: 'POST' } as IncomingMessage,
      {} as ServerResponse,
      new URL('http://127.0.0.1:3210/api/channels/config'),
      {
        gatewayManager: {
          rpc: vi.fn(),
          getStatus: () => ({ state: 'running' }),
        },
        gatewayRuntimeController: {
          requestRuntimeRefresh: vi.fn().mockResolvedValue(undefined),
        },
      } as never,
    );

    expect(handled).toBe(true);
    expect(ensureWeixinPluginInstalledMock).toHaveBeenCalledTimes(1);
    expect(sendJsonMock).toHaveBeenCalledWith(expect.anything(), 200, { success: true });
  });

  it('starts polls and cancels weixin QR login through the dedicated manager', async () => {
    parseJsonBodyMock
      .mockResolvedValueOnce({ accountId: 'wx-bot', force: true, config: { routeTag: 'wechat-gray' } })
      .mockResolvedValueOnce({ sessionKey: 'session-1' })
      .mockResolvedValueOnce({ sessionKey: 'session-1' });

    const requestRuntimeRefresh = vi.fn().mockResolvedValue(undefined);
    const gatewayManager = {
      rpc: vi.fn(),
      getStatus: () => ({ state: 'running' }),
    };

    const { handleChannelRoutes } = await import('@electron/api/routes/channels');

    const startHandled = await handleChannelRoutes(
      { method: 'POST' } as IncomingMessage,
      {} as ServerResponse,
      new URL('http://127.0.0.1:3210/api/channels/weixin/start'),
      {
        gatewayManager,
        gatewayRuntimeController: {
          requestRuntimeRefresh,
        },
      } as never,
    );

    const pollHandled = await handleChannelRoutes(
      { method: 'POST' } as IncomingMessage,
      {} as ServerResponse,
      new URL('http://127.0.0.1:3210/api/channels/weixin/poll'),
      {
        gatewayManager,
        gatewayRuntimeController: {
          requestRuntimeRefresh,
        },
      } as never,
    );

    const cancelHandled = await handleChannelRoutes(
      { method: 'POST' } as IncomingMessage,
      {} as ServerResponse,
      new URL('http://127.0.0.1:3210/api/channels/weixin/cancel'),
      {
        gatewayManager,
        gatewayRuntimeController: {
          requestRuntimeRefresh,
        },
      } as never,
    );

    expect(startHandled).toBe(true);
    expect(pollHandled).toBe(true);
    expect(cancelHandled).toBe(true);
    expect(ensureWeixinPluginInstalledMock).toHaveBeenCalledTimes(1);
    expect(weixinLoginStartMock).toHaveBeenCalledWith(
      expect.objectContaining({
        gatewayManager,
        gatewayRuntimeController: expect.objectContaining({
          requestRuntimeRefresh,
        }),
      }),
      {
        accountId: 'wx-bot',
        force: true,
        config: { routeTag: 'wechat-gray' },
      },
    );
    expect(weixinLoginPollMock).toHaveBeenCalledWith('session-1');
    expect(weixinLoginStopMock).toHaveBeenCalledWith('session-1');
    expect(sendJsonMock).toHaveBeenNthCalledWith(1, expect.anything(), 200, {
      success: true,
      qrcodeUrl: 'https://ilinkai.weixin.qq.com/qrcode/session-1',
      sessionKey: 'session-1',
      message: 'ready',
    });
    expect(sendJsonMock).toHaveBeenNthCalledWith(2, expect.anything(), 200, {
      success: true,
      status: 'wait',
      connected: false,
      sessionKey: 'session-1',
    });
    expect(sendJsonMock).toHaveBeenNthCalledWith(3, expect.anything(), 200, { success: true });
  });

  it('reads the persisted weixin guardian toggle for an account', async () => {
    getWeixinGuardianEnabledMock.mockResolvedValue(true);

    const { handleChannelRoutes } = await import('@electron/api/routes/channels');
    const handled = await handleChannelRoutes(
      { method: 'GET' } as IncomingMessage,
      {} as ServerResponse,
      new URL('http://127.0.0.1:3210/api/channels/weixin/guardian?accountId=wx-im-bot'),
      {
        gatewayManager: {
          rpc: vi.fn(),
          getStatus: () => ({ state: 'running' }),
        },
      } as never,
    );

    expect(handled).toBe(true);
    expect(getWeixinGuardianEnabledMock).toHaveBeenCalledWith('wx-im-bot');
    expect(sendJsonMock).toHaveBeenCalledWith(
      expect.anything(),
      200,
      expect.objectContaining({ success: true, enabled: true }),
    );
  });

  it('persists the weixin guardian toggle and triggers an immediate check', async () => {
    parseJsonBodyMock.mockResolvedValue({
      accountId: 'wx-im-bot',
      enabled: true,
    });

    const { handleChannelRoutes } = await import('@electron/api/routes/channels');
    const handled = await handleChannelRoutes(
      { method: 'PUT' } as IncomingMessage,
      {} as ServerResponse,
      new URL('http://127.0.0.1:3210/api/channels/weixin/guardian'),
      {
        gatewayManager: {
          rpc: vi.fn(),
          getStatus: () => ({ state: 'running' }),
        },
      } as never,
    );

    expect(handled).toBe(true);
    expect(setWeixinGuardianEnabledMock).toHaveBeenCalledWith('wx-im-bot', true);
    expect(runWeixinGuardianCheckMock).toHaveBeenCalled();
    expect(sendJsonMock).toHaveBeenCalledWith(
      expect.anything(),
      200,
      expect.objectContaining({ success: true, enabled: true }),
    );
  });
});
