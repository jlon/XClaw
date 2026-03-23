import { describe, expect, it } from 'vitest';
import { buildGatewayConnectFrame } from '@electron/gateway/ws-client';

describe('gateway ws-client connect frame', () => {
  it('includes operator.approvals scope for exec approval resolution flows', () => {
    const { frame } = buildGatewayConnectFrame({
      challengeNonce: 'nonce-1',
      token: 'token-1',
      deviceIdentity: null,
      platform: 'darwin',
    });

    expect(frame).toMatchObject({
      method: 'connect',
      params: {
        role: 'operator',
        scopes: ['operator.admin', 'operator.approvals'],
      },
    });

    const scopes = (frame.params as { scopes?: string[] } | undefined)?.scopes ?? [];
    expect(scopes).toContain('operator.approvals');
  });
});
