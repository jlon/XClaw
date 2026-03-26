import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { IncomingMessage, ServerResponse } from 'http';

const parseJsonBodyMock = vi.fn();
const sendJsonMock = vi.fn();
const sendNoContentMock = vi.fn();
const studioServiceStartMock = vi.fn();
const studioServiceRetryRuntimeMock = vi.fn();
const studioServiceGetRuntimeSnapshotMock = vi.fn();

vi.mock('@electron/api/route-utils', () => ({
  parseJsonBody: (...args: unknown[]) => parseJsonBodyMock(...args),
  sendJson: (...args: unknown[]) => sendJsonMock(...args),
  sendNoContent: (...args: unknown[]) => sendNoContentMock(...args),
}));

describe('handleStudioRoutes', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('returns the current runtime snapshot without implicitly starting studio', async () => {
    studioServiceGetRuntimeSnapshotMock.mockReturnValue({
      status: 'idle',
      resolvedUrl: null,
      runtimeInstanceId: null,
      lastError: null,
      port: null,
      python: {
        uvInstalled: true,
        interpreterReady: true,
        dependenciesReady: true,
        pythonPath: 'C:\\Users\\tester\\AppData\\Local\\uv\\python.exe',
        venvPythonPath: 'C:\\Users\\tester\\AppData\\Roaming\\XClaw\\studio\\.venv\\Scripts\\python.exe',
        error: null,
      },
    });

    const { handleStudioRoutes } = await import('@electron/api/routes/studio');

    const handled = await handleStudioRoutes(
      { method: 'GET' } as IncomingMessage,
      {} as ServerResponse,
      new URL('http://127.0.0.1:3210/api/studio/runtime'),
      {
        studioService: {
          start: studioServiceStartMock,
          retryRuntime: studioServiceRetryRuntimeMock,
          getRuntimeSnapshot: studioServiceGetRuntimeSnapshotMock,
        },
      } as never,
    );

    expect(handled).toBe(true);
    expect(studioServiceStartMock).not.toHaveBeenCalled();
    expect(sendJsonMock).toHaveBeenCalledWith(expect.anything(), 200, expect.objectContaining({
      status: 'idle',
    }));
  });

  it('starts studio runtime through the dedicated start route', async () => {
    studioServiceStartMock.mockResolvedValue({
      status: 'starting',
      resolvedUrl: null,
      runtimeInstanceId: null,
      lastError: null,
      port: null,
      python: {
        uvInstalled: true,
        interpreterReady: true,
        dependenciesReady: true,
        pythonPath: 'C:\\Users\\tester\\AppData\\Local\\uv\\python.exe',
        venvPythonPath: 'C:\\Users\\tester\\AppData\\Roaming\\XClaw\\studio\\.venv\\Scripts\\python.exe',
        error: null,
      },
    });

    const { handleStudioRoutes } = await import('@electron/api/routes/studio');

    const handled = await handleStudioRoutes(
      { method: 'POST' } as IncomingMessage,
      {} as ServerResponse,
      new URL('http://127.0.0.1:3210/api/studio/runtime/start'),
      {
        studioService: {
          start: studioServiceStartMock,
          retryRuntime: studioServiceRetryRuntimeMock,
          getRuntimeSnapshot: studioServiceGetRuntimeSnapshotMock,
        },
      } as never,
    );

    expect(handled).toBe(true);
    expect(studioServiceStartMock).toHaveBeenCalledTimes(1);
    expect(sendJsonMock).toHaveBeenCalledWith(expect.anything(), 200, expect.objectContaining({
      status: 'starting',
    }));
  });
});
