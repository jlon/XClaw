import { EventEmitter } from 'node:events';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const spawnMock = vi.fn();

vi.mock('child_process', async () => {
  const actual = await vi.importActual<typeof import('child_process')>('child_process');
  return {
    ...actual,
    default: {
      ...actual,
      spawn: (...args: unknown[]) => spawnMock(...args),
    },
    spawn: (...args: unknown[]) => spawnMock(...args),
  };
});

class FakeChildProcess extends EventEmitter {
  stdout = new EventEmitter();
  stderr = new EventEmitter();
  kill = vi.fn();
  pid = 4321;
}

describe('runChildCommand', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('rejects and terminates the child when the command exceeds timeoutMs', async () => {
    const child = new FakeChildProcess();
    spawnMock.mockReturnValue(child);

    const { runChildCommand } = await import('@electron/utils/run-child-command');
    const pending = Symbol('pending');
    const resultPromise = runChildCommand('/tmp/fake-command', [], { timeoutMs: 20 })
      .then((value) => value, (error) => error);

    await vi.advanceTimersByTimeAsync(25);

    const outcome = await Promise.race([resultPromise, Promise.resolve(pending)]);
    expect(outcome).toBeInstanceOf(Error);
    expect((outcome as Error).message).toMatch(/timed out/i);
    expect(child.kill).toHaveBeenCalledWith('SIGTERM');
  });
});
