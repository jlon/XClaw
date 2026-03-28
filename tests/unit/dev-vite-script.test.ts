import { describe, expect, it } from 'vitest';
import packageJson from '../../package.json';

import {
  buildViteDevEnv,
  normalizeViteDevArgs,
  shouldPreferPollingFirst,
  shouldRetryWithPolling,
} from '../../scripts/dev-vite.mjs';

describe('dev-vite script', () => {
  it('routes the dev command through the vite wrapper script', () => {
    expect(packageJson.scripts.dev).toBe('node scripts/dev-vite.mjs');
  });

  it('retries with polling only for watcher exhaustion before polling is enabled', () => {
    expect(shouldRetryWithPolling({
      exitCode: 1,
      alreadyPolling: false,
      stderr: 'Error: ENOSPC: System limit for number of file watchers reached',
    })).toBe(true);

    expect(shouldRetryWithPolling({
      exitCode: 1,
      alreadyPolling: true,
      stderr: 'Error: ENOSPC: System limit for number of file watchers reached',
    })).toBe(false);

    expect(shouldRetryWithPolling({
      exitCode: 1,
      alreadyPolling: false,
      stderr: 'Error: listen EADDRINUSE: address already in use',
    })).toBe(false);
  });

  it('adds chokidar polling flags only for the fallback retry', () => {
    const baseEnv = { PATH: '/usr/bin', CHOKIDAR_INTERVAL: '250' };

    expect(buildViteDevEnv({ baseEnv, usePolling: false, repoRoot: '/repo/XClaw' })).toMatchObject({
      ...baseEnv,
      XClaw_USER_DATA_DIR: '/repo/XClaw/tmp/XClaw-dev-user-data',
    });
    expect(buildViteDevEnv({ baseEnv, usePolling: true })).toMatchObject({
      PATH: '/usr/bin',
      CHOKIDAR_USEPOLLING: '1',
      CHOKIDAR_INTERVAL: '250',
      XClaw_USER_DATA_DIR: expect.stringContaining('XClaw-dev-user-data'),
    });
  });

  it('preserves an explicit dev userData override', () => {
    expect(buildViteDevEnv({
      baseEnv: {
        PATH: '/usr/bin',
        XClaw_USER_DATA_DIR: '/tmp/custom-xclaw-user-data',
      },
      usePolling: false,
      repoRoot: '/repo/XClaw',
    })).toMatchObject({
      PATH: '/usr/bin',
      XClaw_USER_DATA_DIR: '/tmp/custom-xclaw-user-data',
    });
  });

  it('strips pnpm’s leading standalone double-dash before forwarding args to vite', () => {
    expect(normalizeViteDevArgs(['--', '--host', '0.0.0.0', '--port', '5175'])).toEqual([
      '--host',
      '0.0.0.0',
      '--port',
      '5175',
    ]);

    expect(normalizeViteDevArgs(['--host', '0.0.0.0'])).toEqual(['--host', '0.0.0.0']);
  });

  it('prefers polling first on Linux when watcher limit is already at the low default ceiling', () => {
    expect(shouldPreferPollingFirst({
      platform: 'linux',
      env: {},
      watcherLimitRaw: '65536',
    })).toBe(true);

    expect(shouldPreferPollingFirst({
      platform: 'linux',
      env: {},
      watcherLimitRaw: '1048576',
    })).toBe(false);
  });

  it('does not force polling first outside Linux unless polling is already requested', () => {
    expect(shouldPreferPollingFirst({
      platform: 'darwin',
      env: {},
      watcherLimitRaw: '65536',
    })).toBe(false);

    expect(shouldPreferPollingFirst({
      platform: 'linux',
      env: { CHOKIDAR_USEPOLLING: '1' },
      watcherLimitRaw: null,
    })).toBe(true);
  });
});
