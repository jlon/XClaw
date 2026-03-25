import { describe, expect, it } from 'vitest';
import packageJson from '../../package.json';

import {
  buildViteDevEnv,
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

    expect(buildViteDevEnv({ baseEnv, usePolling: false })).toMatchObject(baseEnv);
    expect(buildViteDevEnv({ baseEnv, usePolling: true })).toMatchObject({
      PATH: '/usr/bin',
      CHOKIDAR_USEPOLLING: '1',
      CHOKIDAR_INTERVAL: '250',
    });
  });
});
