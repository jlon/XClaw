import { describe, expect, it } from 'vitest';
import {
  WEIXIN_GUARD_EXPIRED_IDLE_MS,
  WEIXIN_GUARD_WARNING_IDLE_MS,
  evaluateWeixinGuardian,
} from '../../shared/weixin-guardian';

describe('weixin guardian evaluation', () => {
  it('stays disabled until the user opts in', () => {
    expect(
      evaluateWeixinGuardian(
        {
          enabled: false,
          lastInboundAt: Date.now() - WEIXIN_GUARD_WARNING_IDLE_MS - 1,
        },
        Date.now(),
      ),
    ).toBeNull();
  });

  it('treats session-expired runtime errors as immediate risk', () => {
    expect(
      evaluateWeixinGuardian(
        {
          enabled: true,
          lastError: 'session expired: errcode -14',
        },
        Date.now(),
      ),
    ).toMatchObject({
      level: 'expired',
      reason: 'runtime-error',
      shouldNotify: true,
    });
  });

  it('warns when activity has been idle close to the 24-hour window', () => {
    expect(
      evaluateWeixinGuardian(
        {
          enabled: true,
          lastOutboundAt: Date.now() - WEIXIN_GUARD_WARNING_IDLE_MS - 1,
        },
        Date.now(),
      ),
    ).toMatchObject({
      level: 'warning',
      reason: 'idle-window',
    });
  });

  it('marks the account expired once the idle window is fully exceeded', () => {
    expect(
      evaluateWeixinGuardian(
        {
          enabled: true,
          lastInboundAt: Date.now() - WEIXIN_GUARD_EXPIRED_IDLE_MS - 1,
        },
        Date.now(),
      ),
    ).toMatchObject({
      level: 'expired',
      reason: 'idle-window',
      shouldNotify: true,
    });
  });
});
