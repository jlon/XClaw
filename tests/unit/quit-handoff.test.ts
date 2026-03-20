import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('createBeforeQuitHandler', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('prevents quit until gateway handoff completes, then exits once', async () => {
    let resolveHandoff: (() => void) | null = null;
    const handoffGateway = vi.fn().mockImplementation(() => new Promise<void>((resolve) => {
      resolveHandoff = resolve;
    }));
    const app = { exit: vi.fn() };
    const setQuitting = vi.fn();
    const closeAll = vi.fn();
    const closeHostApiServer = vi.fn();
    const warn = vi.fn();
    const event = { preventDefault: vi.fn() };

    const { createBeforeQuitHandler } = await import('@electron/main/quit-handoff');
    const handler = createBeforeQuitHandler({
      app,
      setQuitting,
      closeAll,
      closeHostApiServer,
      handoffGateway,
      logger: { warn },
      quitTimeoutMs: 5000,
    });

    handler(event);

    expect(event.preventDefault).toHaveBeenCalledTimes(1);
    expect(handoffGateway).toHaveBeenCalledTimes(1);
    expect(app.exit).not.toHaveBeenCalled();

    resolveHandoff?.();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(app.exit).toHaveBeenCalledWith(0);
    expect(app.exit).toHaveBeenCalledTimes(1);
    expect(setQuitting).toHaveBeenCalledTimes(1);
    expect(closeAll).toHaveBeenCalledTimes(1);
    expect(closeHostApiServer).toHaveBeenCalledTimes(1);
  });

  it('coalesces repeated before-quit events while handoff is still running', async () => {
    let resolveHandoff: (() => void) | null = null;
    const handoffGateway = vi.fn().mockImplementation(() => new Promise<void>((resolve) => {
      resolveHandoff = resolve;
    }));
    const app = { exit: vi.fn() };
    const event = { preventDefault: vi.fn() };

    const { createBeforeQuitHandler } = await import('@electron/main/quit-handoff');
    const handler = createBeforeQuitHandler({
      app,
      setQuitting: vi.fn(),
      closeAll: vi.fn(),
      closeHostApiServer: vi.fn(),
      handoffGateway,
      logger: { warn: vi.fn() },
      quitTimeoutMs: 5000,
    });

    handler(event);
    handler(event);

    expect(event.preventDefault).toHaveBeenCalledTimes(2);
    expect(handoffGateway).toHaveBeenCalledTimes(1);

    resolveHandoff?.();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(app.exit).toHaveBeenCalledTimes(1);
  });

  it('falls back to app exit when handoff stalls past the timeout', async () => {
    vi.useFakeTimers();
    const handoffGateway = vi.fn().mockImplementation(() => new Promise<void>(() => {}));
    const app = { exit: vi.fn() };
    const warn = vi.fn();
    const event = { preventDefault: vi.fn() };

    const { createBeforeQuitHandler } = await import('@electron/main/quit-handoff');
    const handler = createBeforeQuitHandler({
      app,
      setQuitting: vi.fn(),
      closeAll: vi.fn(),
      closeHostApiServer: vi.fn(),
      handoffGateway,
      logger: { warn },
      quitTimeoutMs: 250,
    });

    handler(event);
    await vi.advanceTimersByTimeAsync(250);

    expect(event.preventDefault).toHaveBeenCalledTimes(1);
    expect(app.exit).toHaveBeenCalledWith(0);
    expect(warn).toHaveBeenCalled();
    vi.useRealTimers();
  });
});
