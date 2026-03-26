import { EventEmitter } from 'node:events';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const execSyncMock = vi.fn();
const spawnMock = vi.fn();
const existsSyncMock = vi.fn();

vi.mock('electron', () => ({
  app: {
    isPackaged: false,
    getPath: vi.fn().mockReturnValue('/tmp'),
  },
}));

vi.mock('child_process', async () => {
  const actual = await vi.importActual<typeof import('child_process')>('child_process');
  return {
    ...actual,
    default: {
      ...actual,
      execSync: (...args: unknown[]) => execSyncMock(...args),
      spawn: (...args: unknown[]) => spawnMock(...args),
    },
    execSync: (...args: unknown[]) => execSyncMock(...args),
    spawn: (...args: unknown[]) => spawnMock(...args),
  };
});

vi.mock('fs', async () => {
  const actual = await vi.importActual<typeof import('fs')>('fs');
  return {
    ...actual,
    existsSync: (...args: unknown[]) => existsSyncMock(...args),
    default: {
      ...actual,
      existsSync: (...args: unknown[]) => existsSyncMock(...args),
    },
  };
});

vi.mock('@electron/utils/uv-env', () => ({
  getUvMirrorEnv: vi.fn().mockResolvedValue({}),
}));

vi.mock('@electron/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('setupManagedPython', () => {
  beforeEach(() => {
    vi.resetModules();
    execSyncMock.mockReset();
    spawnMock.mockReset();
    existsSyncMock.mockReset();
    execSyncMock.mockReturnValue(Buffer.from('/usr/bin/uv\n'));
    existsSyncMock.mockReturnValue(false);
  });

  it('downloads bundled uv in dev with zx instead of the electron binary', async () => {
    let downloaded = false;

    execSyncMock.mockImplementation(() => {
      throw new Error('uv missing');
    });
    existsSyncMock.mockImplementation((target: string) => (
      target.endsWith('node_modules/.bin/zx')
        || target.endsWith('scripts/download-bundled-uv.mjs')
        || (downloaded && target.endsWith('resources/bin/linux-x64/uv'))
    ));
    spawnMock.mockImplementation((_cmd: string, args: string[]) => {
      const child = new EventEmitter() as EventEmitter & {
        stdout: EventEmitter;
        stderr: EventEmitter;
      };
      child.stdout = new EventEmitter();
      child.stderr = new EventEmitter();

      queueMicrotask(() => {
        if (args[0]?.endsWith('download-bundled-uv.mjs')) {
          downloaded = true;
          child.stdout.emit('data', 'downloaded');
        }
        child.emit('close', 0);
      });

      return child;
    });

    const { installUv } = await import('@electron/utils/uv-setup');

    await expect(installUv()).resolves.toBeUndefined();
    expect(spawnMock).toHaveBeenCalledWith(
      expect.stringMatching(/node_modules\/\.bin\/zx$/),
      [expect.stringMatching(/scripts\/download-bundled-uv\.mjs$/)],
      expect.objectContaining({
        cwd: process.cwd(),
        shell: false,
        windowsHide: true,
      }),
    );
  });

  it('deduplicates concurrent Python setup requests', async () => {
    let installCount = 0;

    spawnMock.mockImplementation((_cmd: string, args: string[]) => {
      const child = new EventEmitter() as EventEmitter & {
        stdout: EventEmitter;
        stderr: EventEmitter;
      };
      child.stdout = new EventEmitter();
      child.stderr = new EventEmitter();

      queueMicrotask(() => {
        if (args[0] === 'python' && args[1] === 'install') {
          installCount += 1;
          child.stdout.emit('data', 'installed');
        }

        if (args[0] === 'python' && args[1] === 'find') {
          child.stdout.emit('data', '/tmp/python-3.12');
        }

        child.emit('close', 0);
      });

      return child;
    });

    const { setupManagedPython } = await import('@electron/utils/uv-setup');

    await Promise.all([
      setupManagedPython(),
      setupManagedPython(),
    ]);

    expect(installCount).toBe(1);
    expect(spawnMock).toHaveBeenCalledTimes(2);
  });
});
