import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const saveChannelConfigMock = vi.fn();
const proxyAwareFetchMock = vi.fn();
const getOpenClawConfigDirMock = vi.fn();

vi.mock('@electron/utils/channel-config', () => ({
  saveChannelConfig: (...args: unknown[]) => saveChannelConfigMock(...args),
}));

vi.mock('@electron/utils/proxy-fetch', () => ({
  proxyAwareFetch: (...args: unknown[]) => proxyAwareFetchMock(...args),
}));

vi.mock('@electron/utils/paths', () => ({
  getOpenClawConfigDir: () => getOpenClawConfigDirMock(),
}));

vi.mock('@electron/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('weixinLoginManager', () => {
  let openclawDir = '';

  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.useFakeTimers();
    openclawDir = await mkdtemp(join(tmpdir(), 'xclaw-weixin-login-'));
    getOpenClawConfigDirMock.mockReturnValue(openclawDir);
    saveChannelConfigMock.mockResolvedValue(undefined);
  });

  afterEach(async () => {
    const { weixinLoginManager } = await import('@electron/utils/weixin-login');
    await weixinLoginManager.stop();
    vi.useRealTimers();
    await rm(openclawDir, { recursive: true, force: true });
  });

  it('returns qrcodeUrl and sessionKey immediately after start', async () => {
    proxyAwareFetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({
        qrcode: 'raw-session-1',
        qrcode_img_content: 'https://ilinkai.weixin.qq.com/qrcode/session-1',
      }), { status: 200 }),
    );

    const { weixinLoginManager } = await import('@electron/utils/weixin-login');
    const result = await weixinLoginManager.start(
      {
        gatewayRuntimeController: {
          requestRuntimeRefresh: vi.fn().mockResolvedValue(undefined),
        },
      } as never,
      { config: { routeTag: 'wechat-gray' } },
    );

    expect(result.qrcodeUrl).toBe('https://ilinkai.weixin.qq.com/qrcode/session-1');
    expect(result.sessionKey).toMatch(/^xclaw-weixin-session-/);
    expect(proxyAwareFetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/ilink/bot/get_bot_qrcode?bot_type=3'),
      expect.objectContaining({
        headers: expect.objectContaining({
          SKRouteTag: 'wechat-gray',
        }),
      }),
    );
    expect(weixinLoginManager.poll(result.sessionKey)).toEqual({
      accountId: undefined,
      connected: false,
      message: 'ready',
      qrcodeUrl: 'https://ilinkai.weixin.qq.com/qrcode/session-1',
      sessionKey: result.sessionKey,
      status: 'wait',
    });
  });

  it('persists the confirmed weixin account and requests a gateway reload', async () => {
    proxyAwareFetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify({
          qrcode: 'raw-session-2',
          qrcode_img_content: 'https://ilinkai.weixin.qq.com/qrcode/session-2',
        }), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({
          status: 'confirmed',
          bot_token: 'bot-token-2',
          ilink_bot_id: 'wx@im.bot',
          baseurl: 'https://ilinkai.weixin.qq.com',
          ilink_user_id: 'user-2',
        }), { status: 200 }),
      );

    const requestRuntimeRefreshMock = vi.fn().mockResolvedValue(undefined);
    const { weixinLoginManager } = await import('@electron/utils/weixin-login');
    const result = await weixinLoginManager.start(
      {
        gatewayRuntimeController: {
          requestRuntimeRefresh: requestRuntimeRefreshMock,
        },
      } as never,
      { config: { routeTag: 'wechat-gray', cdnBaseUrl: 'https://cdn.example.com' } },
    );

    await vi.advanceTimersByTimeAsync(1600);
    await vi.waitFor(() => {
      expect(saveChannelConfigMock).toHaveBeenCalledWith(
        'openclaw-weixin',
        {
          enabled: true,
          routeTag: 'wechat-gray',
          cdnBaseUrl: 'https://cdn.example.com',
        },
        'wx-im-bot',
      );
    });

    const accountFile = JSON.parse(
      await readFile(join(openclawDir, 'openclaw-weixin', 'accounts', 'wx-im-bot.json'), 'utf8'),
    ) as Record<string, string>;
    const accountIndex = JSON.parse(
      await readFile(join(openclawDir, 'openclaw-weixin', 'accounts.json'), 'utf8'),
    ) as string[];

    expect(accountFile).toMatchObject({
      token: 'bot-token-2',
      baseUrl: 'https://ilinkai.weixin.qq.com',
      userId: 'user-2',
    });
    expect(accountIndex).toEqual(['wx-im-bot']);
    expect(requestRuntimeRefreshMock).toHaveBeenCalledWith({ mode: 'reload' });
    expect(weixinLoginManager.poll(result.sessionKey)).toEqual({
      accountId: 'wx-im-bot',
      connected: true,
      message: 'connected',
      qrcodeUrl: 'https://ilinkai.weixin.qq.com/qrcode/session-2',
      sessionKey: result.sessionKey,
      status: 'confirmed',
    });
  });

  it('marks the session expired without auto-refreshing a new qrcode', async () => {
    proxyAwareFetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify({
          qrcode: 'raw-session-3',
          qrcode_img_content: 'https://ilinkai.weixin.qq.com/qrcode/session-3',
        }), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({
          status: 'expired',
        }), { status: 200 }),
      );

    const { weixinLoginManager } = await import('@electron/utils/weixin-login');
    const result = await weixinLoginManager.start(
      {
        gatewayRuntimeController: {
          requestRuntimeRefresh: vi.fn().mockResolvedValue(undefined),
        },
      } as never,
      {},
    );

    await vi.advanceTimersByTimeAsync(1600);

    expect(proxyAwareFetchMock).toHaveBeenCalledTimes(2);
    expect(weixinLoginManager.poll(result.sessionKey)).toEqual({
      connected: false,
      message: 'expired',
      qrcodeUrl: 'https://ilinkai.weixin.qq.com/qrcode/session-3',
      sessionKey: result.sessionKey,
      status: 'expired',
    });
    expect(saveChannelConfigMock).not.toHaveBeenCalled();
  });
});
