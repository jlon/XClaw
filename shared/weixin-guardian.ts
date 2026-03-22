export const WEIXIN_GUARD_WARNING_IDLE_MS = 20 * 60 * 60 * 1000;
export const WEIXIN_GUARD_EXPIRED_IDLE_MS = 24 * 60 * 60 * 1000;

export interface WeixinGuardianSignal {
  enabled: boolean;
  lastError?: string | null;
  lastConnectedAt?: number | null;
  lastInboundAt?: number | null;
  lastOutboundAt?: number | null;
}

export type WeixinGuardianLevel = 'healthy' | 'warning' | 'expired';
export type WeixinGuardianReason = 'runtime-error' | 'idle-window';

export interface WeixinGuardianEvaluation {
  level: WeixinGuardianLevel;
  reason: WeixinGuardianReason;
  shouldNotify: boolean;
  idleMs?: number;
  matchedError?: string;
}

const EXPIRY_ERROR_PATTERNS = [
  'session expired',
  'errcode -14',
  'errcode:-14',
  'login again',
  're-login',
  'relogin',
  'paused',
  'pause',
  'expired',
  '过期',
  '暂停',
];

function normalizeErrorMessage(value: string | null | undefined): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function getLatestActivityAt(signal: WeixinGuardianSignal): number | null {
  const candidates = [
    signal.lastInboundAt,
    signal.lastOutboundAt,
    signal.lastConnectedAt,
  ].filter((value): value is number => typeof value === 'number' && Number.isFinite(value));

  if (candidates.length === 0) {
    return null;
  }

  return Math.max(...candidates);
}

export function evaluateWeixinGuardian(
  signal: WeixinGuardianSignal,
  now = Date.now(),
): WeixinGuardianEvaluation | null {
  if (!signal.enabled) {
    return null;
  }

  const normalizedError = normalizeErrorMessage(signal.lastError);
  if (normalizedError && EXPIRY_ERROR_PATTERNS.some((pattern) => normalizedError.includes(pattern))) {
    return {
      level: 'expired',
      reason: 'runtime-error',
      shouldNotify: true,
      matchedError: signal.lastError ?? undefined,
    };
  }

  const latestActivityAt = getLatestActivityAt(signal);
  if (latestActivityAt === null) {
    return {
      level: 'warning',
      reason: 'idle-window',
      shouldNotify: false,
    };
  }

  const idleMs = Math.max(0, now - latestActivityAt);
  if (idleMs >= WEIXIN_GUARD_EXPIRED_IDLE_MS) {
    return {
      level: 'expired',
      reason: 'idle-window',
      shouldNotify: true,
      idleMs,
    };
  }

  if (idleMs >= WEIXIN_GUARD_WARNING_IDLE_MS) {
    return {
      level: 'warning',
      reason: 'idle-window',
      shouldNotify: false,
      idleMs,
    };
  }

  return {
    level: 'healthy',
    reason: 'idle-window',
    shouldNotify: false,
    idleMs,
  };
}
