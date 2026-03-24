import { EventEmitter } from 'node:events';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const execSyncMock = vi.fn();
const spawnMock = vi.fn();

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
    execSyncMock.mockReturnValue(Buffer.from('/usr/bin/uv\n'));
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
