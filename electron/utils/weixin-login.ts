import { EventEmitter } from 'events';
import { randomUUID } from 'node:crypto';
import { chmod, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { HostApiContext } from '../api/context';
import { normalizeAccountId } from '../../shared/account-id';
import { saveChannelConfig } from './channel-config';
import { logger } from './logger';
import { getOpenClawConfigDir } from './paths';
import { proxyAwareFetch } from './proxy-fetch';

type WeixinLoginStartOptions = {
  accountId?: string;
  force?: boolean;
  timeoutMs?: number;
  config?: Record<string, unknown>;
};

type WeixinLoginStartResult = {
  message?: string;
  qrcodeUrl?: string;
  sessionKey: string;
};

type WeixinLoginPollResult = {
  accountId?: string;
  connected: boolean;
  message?: string;
  qrcodeUrl?: string;
  sessionKey: string;
  status: 'wait' | 'scaned' | 'confirmed' | 'expired' | 'error';
};

type QrCodeResponse = {
  qrcode: string;
  qrcode_img_content: string;
};

type QrStatusResponse = {
  baseurl?: string;
  bot_token?: string;
  ilink_bot_id?: string;
  ilink_user_id?: string;
  status: 'wait' | 'scaned' | 'confirmed' | 'expired';
};

type ActiveLoginSession = {
  accountId?: string;
  apiBaseUrl: string;
  config: Record<string, unknown>;
  connected: boolean;
  message?: string;
  qrcode: string;
  qrcodeUrl: string;
  routeTag?: string;
  sessionKey: string;
  status: WeixinLoginPollResult['status'];
  stopped: boolean;
  timeoutMs: number;
};

const DEFAULT_API_BASE_URL = 'https://ilinkai.weixin.qq.com';
const DEFAULT_BOT_TYPE = '3';
const POLL_INTERVAL_MS = 1500;
const SESSION_TIMEOUT_MS = 5 * 60_000;

function normalizeConfig(config?: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(config ?? {}).flatMap(([key, value]) => {
      if (typeof value === 'string') {
        const trimmed = value.trim();
        return trimmed ? [[key, trimmed]] : [];
      }
      return value === undefined ? [] : [[key, value]];
    }),
  );
}

function buildHeaders(routeTag?: string, clientVersion = false): Record<string, string> {
  return {
    ...(clientVersion ? { 'iLink-App-ClientVersion': '1' } : {}),
    ...(routeTag ? { SKRouteTag: routeTag } : {}),
  };
}

async function parseJsonResponse<T>(response: Response, label: string): Promise<T> {
  const body = await response.text();
  if (!response.ok) {
    throw new Error(`${label}: ${response.status} ${response.statusText}${body ? ` ${body}` : ''}`);
  }
  return JSON.parse(body) as T;
}

async function fetchQrCode(apiBaseUrl: string, routeTag?: string): Promise<QrCodeResponse> {
  const url = new URL(`ilink/bot/get_bot_qrcode?bot_type=${encodeURIComponent(DEFAULT_BOT_TYPE)}`, apiBaseUrl.endsWith('/') ? apiBaseUrl : `${apiBaseUrl}/`);
  return parseJsonResponse<QrCodeResponse>(
    await proxyAwareFetch(url.toString(), { headers: buildHeaders(routeTag) }),
    'Failed to fetch QR code',
  );
}

async function fetchQrStatus(apiBaseUrl: string, qrcode: string, routeTag?: string): Promise<QrStatusResponse> {
  const url = new URL(`ilink/bot/get_qrcode_status?qrcode=${encodeURIComponent(qrcode)}`, apiBaseUrl.endsWith('/') ? apiBaseUrl : `${apiBaseUrl}/`);
  return parseJsonResponse<QrStatusResponse>(
    await proxyAwareFetch(url.toString(), { headers: buildHeaders(routeTag, true) }),
    'Failed to poll QR status',
  );
}

async function saveWeixinAccountState(
  accountId: string,
  data: {
    baseUrl: string;
    token: string;
    userId?: string;
  },
): Promise<void> {
  const stateDir = join(getOpenClawConfigDir(), 'openclaw-weixin');
  const accountsDir = join(stateDir, 'accounts');
  const accountIndexPath = join(stateDir, 'accounts.json');
  const accountPath = join(accountsDir, `${accountId}.json`);
  await mkdir(accountsDir, { recursive: true });
  let existingAccountIds: string[];
  try {
    existingAccountIds = JSON.parse(await readFile(accountIndexPath, 'utf8')) as string[];
  } catch {
    existingAccountIds = [];
  }
  if (!existingAccountIds.includes(accountId)) {
    existingAccountIds = [...existingAccountIds, accountId];
  }
  await writeFile(accountIndexPath, JSON.stringify(existingAccountIds, null, 2), 'utf8');
  await writeFile(accountPath, JSON.stringify({
    token: data.token,
    savedAt: new Date().toISOString(),
    baseUrl: data.baseUrl,
    ...(data.userId ? { userId: data.userId } : {}),
  }, null, 2), 'utf8');
  try {
    await chmod(accountPath, 0o600);
  } catch {
    logger.warn('failed to chmod weixin account state file');
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

class WeixinLoginManager extends EventEmitter {
  private activeSession: ActiveLoginSession | null = null;

  async start(ctx: HostApiContext, options: WeixinLoginStartOptions = {}): Promise<WeixinLoginStartResult> {
    const config = normalizeConfig(options.config);
    const routeTag = typeof config.routeTag === 'string' ? config.routeTag : undefined;
    const apiBaseUrl = DEFAULT_API_BASE_URL;

    if (this.activeSession && (!options.force || this.activeSession.accountId === options.accountId?.trim())) {
      return {
        message: this.activeSession.message || '二维码已就绪，请使用微信扫描。',
        qrcodeUrl: this.activeSession.qrcodeUrl,
        sessionKey: this.activeSession.sessionKey,
      };
    }

    await this.stop();

    const qr = await fetchQrCode(apiBaseUrl, routeTag);
    const session: ActiveLoginSession = {
      accountId: options.accountId?.trim() || undefined,
      apiBaseUrl,
      config,
      connected: false,
      message: 'ready',
      qrcode: qr.qrcode,
      qrcodeUrl: qr.qrcode_img_content,
      routeTag,
      sessionKey: `xclaw-weixin-session-${randomUUID()}`,
      status: 'wait',
      stopped: false,
      timeoutMs: Math.max(options.timeoutMs ?? SESSION_TIMEOUT_MS, 1000),
    };
    this.activeSession = session;
    void this.watchSession(ctx, session);
    return {
      message: 'ready',
      qrcodeUrl: session.qrcodeUrl,
      sessionKey: session.sessionKey,
    };
  }

  poll(sessionKey: string): WeixinLoginPollResult {
    const session = this.activeSession;
    if (!session || session.sessionKey !== sessionKey) {
      return {
        connected: false,
        message: '当前没有进行中的登录，请先发起登录。',
        sessionKey,
        status: 'error',
      };
    }
    return {
      accountId: session.connected ? session.accountId : undefined,
      connected: session.connected,
      message: session.message,
      qrcodeUrl: session.qrcodeUrl,
      sessionKey: session.sessionKey,
      status: session.status,
    };
  }

  async stop(sessionKey?: string): Promise<void> {
    if (!this.activeSession) {
      return;
    }
    if (sessionKey && this.activeSession.sessionKey !== sessionKey) {
      return;
    }
    this.activeSession.stopped = true;
    this.activeSession = null;
  }

  private async watchSession(ctx: HostApiContext, session: ActiveLoginSession): Promise<void> {
    const deadline = Date.now() + session.timeoutMs;
    while (this.activeSession === session && !session.stopped && Date.now() < deadline) {
      await delay(POLL_INTERVAL_MS);
      if (this.activeSession !== session || session.stopped) {
        return;
      }
      try {
        const status = await fetchQrStatus(session.apiBaseUrl, session.qrcode, session.routeTag);
        session.status = status.status;
        session.message = status.status;
        if (status.status === 'confirmed') {
          if (!status.bot_token?.trim() || !status.ilink_bot_id?.trim()) {
            session.status = 'error';
            session.message = 'invalid-confirmed-state';
            return;
          }
          const normalizedAccountId = normalizeAccountId(status.ilink_bot_id);
          await saveWeixinAccountState(normalizedAccountId, {
            baseUrl: status.baseurl?.trim() || session.apiBaseUrl,
            token: status.bot_token.trim(),
            userId: status.ilink_user_id?.trim() || undefined,
          });
          await saveChannelConfig('openclaw-weixin', { enabled: true, ...session.config }, normalizedAccountId);
          await ctx.gatewayRuntimeController.requestRuntimeRefresh({ mode: 'reload' });
          session.accountId = normalizedAccountId;
          session.connected = true;
          session.message = 'connected';
          return;
        }
        if (status.status === 'expired') {
          session.message = 'expired';
          return;
        }
      } catch (error) {
        logger.error('weixin login polling failed', error);
        session.status = 'error';
        session.message = String(error);
        return;
      }
    }
    if (this.activeSession === session && !session.stopped && !session.connected) {
      session.status = 'expired';
      session.message = 'expired';
    }
  }
}

export const weixinLoginManager = new WeixinLoginManager();
export type { WeixinLoginPollResult, WeixinLoginStartOptions, WeixinLoginStartResult };
