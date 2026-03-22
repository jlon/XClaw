import { Notification } from 'electron';
import type { HostApiContext } from '../api/context';
import { logger } from './logger';
import { evaluateWeixinGuardian } from '../../shared/weixin-guardian';

interface WeixinGuardianStoreShape {
  accounts: Record<string, { enabled: boolean }>;
}

interface GatewayWeixinStatusPayload {
  channelAccounts?: Record<string, Array<{
    accountId?: string;
    lastError?: string;
    lastConnectedAt?: number | null;
    lastInboundAt?: number | null;
    lastOutboundAt?: number | null;
  }>>;
}

type ElectronStoreLike = {
  get: <T>(key: string, defaultValue?: T) => T;
  set: (key: string, value: unknown) => void;
};

let guardianStoreInstance: ElectronStoreLike | null = null;

async function getWeixinGuardianStore(): Promise<ElectronStoreLike> {
  if (!guardianStoreInstance) {
    const Store = (await import('electron-store')).default;
    guardianStoreInstance = new Store<WeixinGuardianStoreShape>({
      name: 'weixin-guardian',
      defaults: {
        accounts: {},
      },
    }) as ElectronStoreLike;
  }
  return guardianStoreInstance;
}

export async function getWeixinGuardianEnabled(accountId: string): Promise<boolean> {
  const store = await getWeixinGuardianStore();
  return store.get(`accounts.${accountId}.enabled`, false);
}

export async function setWeixinGuardianEnabled(accountId: string, enabled: boolean): Promise<void> {
  const store = await getWeixinGuardianStore();
  store.set(`accounts.${accountId}.enabled`, enabled);
}

async function listEnabledWeixinGuardianAccounts(): Promise<string[]> {
  const store = await getWeixinGuardianStore();
  const accounts = store.get<Record<string, { enabled?: boolean }>>('accounts', {});
  return Object.entries(accounts)
    .filter(([, value]) => value?.enabled === true)
    .map(([accountId]) => accountId);
}

function buildGuardianNotificationBody(accountId: string, risk: ReturnType<typeof evaluateWeixinGuardian>): string {
  if (!risk || risk.level === 'healthy') {
    return `${accountId} is healthy.`;
  }

  if (risk.reason === 'runtime-error') {
    return `${accountId} reported a session issue. Re-scan QR to recover.`;
  }

  if (risk.level === 'expired') {
    return `${accountId} has passed the 24-hour activity window. Re-scan QR to recover.`;
  }

  return `${accountId} is approaching the 24-hour activity window. Check the channel and prepare to re-scan QR.`;
}

class WeixinGuardianService {
  private ctx: HostApiContext | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private notificationMarks = new Map<string, number>();

  start(ctx: HostApiContext): void {
    this.ctx = ctx;
    if (this.timer) {
      clearInterval(this.timer);
    }
    this.timer = setInterval(() => {
      void this.runCheck(this.ctx ?? undefined);
    }, 5 * 60 * 1000);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  async runCheck(ctx = this.ctx ?? undefined): Promise<void> {
    if (!ctx) {
      return;
    }

    const enabledAccounts = await listEnabledWeixinGuardianAccounts();
    if (enabledAccounts.length === 0) {
      return;
    }

    if (ctx.gatewayManager.getStatus().state !== 'running') {
      return;
    }

    let payload: GatewayWeixinStatusPayload;
    try {
      payload = await ctx.gatewayManager.rpc<GatewayWeixinStatusPayload>('channels.status', { probe: false });
    } catch (error) {
      logger.warn('[weixin-guardian] Failed to read channels.status', error);
      return;
    }

    const runtimeAccounts = payload?.channelAccounts?.['openclaw-weixin'] ?? [];
    const now = Date.now();

    for (const accountId of enabledAccounts) {
      const runtime = runtimeAccounts.find((entry) => entry.accountId === accountId) ?? {};
      const risk = evaluateWeixinGuardian({
        enabled: true,
        lastError: runtime.lastError,
        lastConnectedAt: runtime.lastConnectedAt,
        lastInboundAt: runtime.lastInboundAt,
        lastOutboundAt: runtime.lastOutboundAt,
      }, now);

      if (!risk || !risk.shouldNotify || risk.level === 'healthy') {
        continue;
      }

      const notificationKey = `${accountId}:${risk.level}:${risk.reason}:${risk.matchedError ?? ''}`;
      const lastNotifiedAt = this.notificationMarks.get(notificationKey) ?? 0;
      if (now - lastNotifiedAt < 6 * 60 * 60 * 1000) {
        continue;
      }

      this.notificationMarks.set(notificationKey, now);
      try {
        if (Notification.isSupported()) {
          new Notification({
            title: 'WeChat health guard',
            body: buildGuardianNotificationBody(accountId, risk),
            silent: false,
          }).show();
        }
      } catch (error) {
        logger.warn('[weixin-guardian] Failed to show desktop notification', error);
      }
    }
  }
}

export const weixinGuardianService = new WeixinGuardianService();
