import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { IncomingMessage, ServerResponse } from 'http';
import { Readable } from 'node:stream';
import { appendStudioSkinQuery } from '@/lib/studio';

const parseJsonBodyMock = vi.fn();
const sendJsonMock = vi.fn();
const sendNoContentMock = vi.fn();
const studioServiceStartMock = vi.fn();
const studioServiceRetryRuntimeMock = vi.fn();
const studioServiceGetRuntimeSnapshotMock = vi.fn();
const fetchMock = vi.fn();

const createResponseRecorder = () => {
  const headers = new Map<string, string>();
  let statusCode = 200;
  let endedBody: Buffer | string | null = null;
  return {
    response: {
      setHeader: (name: string, value: string) => {
        headers.set(name.toLowerCase(), value);
      },
      removeHeader: (name: string) => {
        headers.delete(name.toLowerCase());
      },
      getHeader: (name: string) => headers.get(name.toLowerCase()),
      end: (body?: Buffer | string) => {
        endedBody = body ?? null;
      },
      get statusCode() {
        return statusCode;
      },
      set statusCode(value: number) {
        statusCode = value;
      },
    } as unknown as ServerResponse,
    getStatusCode: () => statusCode,
    getHeader: (name: string) => headers.get(name.toLowerCase()),
    getBodyText: () => {
      if (typeof endedBody === 'string') {
        return endedBody;
      }
      if (Buffer.isBuffer(endedBody)) {
        return endedBody.toString('utf8');
      }
      return '';
    },
  };
};

vi.mock('@electron/api/route-utils', () => ({
  parseJsonBody: (...args: unknown[]) => parseJsonBodyMock(...args),
  sendJson: (...args: unknown[]) => sendJsonMock(...args),
  sendNoContent: (...args: unknown[]) => sendNoContentMock(...args),
}));

describe('handleStudioRoutes', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubGlobal('fetch', fetchMock);
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

  it('returns the host-owned studio skin registry before runtime starts', async () => {
    const { handleStudioRoutes } = await import('@electron/api/routes/studio');

    const handled = await handleStudioRoutes(
      { method: 'GET' } as IncomingMessage,
      {} as ServerResponse,
      new URL('http://127.0.0.1:3210/api/studio/skins/registry'),
      {
        studioService: {
          start: studioServiceStartMock,
          retryRuntime: studioServiceRetryRuntimeMock,
          getRuntimeSnapshot: studioServiceGetRuntimeSnapshotMock,
        },
      } as never,
    );

    expect(handled).toBe(true);
    expect(studioServiceGetRuntimeSnapshotMock).not.toHaveBeenCalled();
    expect(sendJsonMock).toHaveBeenCalledWith(
      expect.anything(),
      200,
      expect.objectContaining({
        defaultFallbackSkinKey: 'lodge-default',
        skins: expect.arrayContaining([
          expect.objectContaining({
            key: 'lodge-default',
            isDefaultFallback: true,
          }),
          expect.objectContaining({
            key: 'ember-cabin',
            enabled: true,
            selectable: true,
          }),
          expect.objectContaining({
            key: 'frost-ops',
            enabled: true,
            selectable: true,
          }),
        ]),
      }),
    );
  });

  it('proxies runtime-backed studio skin listing when the runtime is available', async () => {
    studioServiceGetRuntimeSnapshotMock.mockReturnValue({
      status: 'ready',
      resolvedUrl: 'http://127.0.0.1:3211/electron-standalone?embedded=1&readonly=1',
      runtimeInstanceId: 'runtime-1',
      lastError: null,
      port: 3211,
      python: {
        uvInstalled: true,
        interpreterReady: true,
        dependenciesReady: true,
        pythonPath: '/tmp/python3',
        venvPythonPath: '/tmp/.venv/bin/python',
        error: null,
      },
    });
    fetchMock.mockResolvedValue(new Response(
      JSON.stringify({
        defaultFallbackSkinKey: 'lodge-default',
        skins: [
          { key: 'lodge-default', name: 'Lodge Default', enabled: true, selectable: true, isDefaultFallback: true, manifestPath: 'lodge-default/manifest.json' },
        ],
      }),
      {
        status: 200,
        headers: {
          'content-type': 'application/json; charset=utf-8',
        },
      },
    ));

    const { handleStudioRoutes } = await import('@electron/api/routes/studio');
    const recorder = createResponseRecorder();

    const handled = await handleStudioRoutes(
      { method: 'GET', headers: {} } as IncomingMessage,
      recorder.response,
      new URL('http://127.0.0.1:3210/api/studio/skins'),
      {
        studioService: {
          start: studioServiceStartMock,
          retryRuntime: studioServiceRetryRuntimeMock,
          getRuntimeSnapshot: studioServiceGetRuntimeSnapshotMock,
        },
      } as never,
    );

    expect(handled).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:3211/studio/skins',
      expect.objectContaining({
        method: 'GET',
      }),
    );
    expect(recorder.getStatusCode()).toBe(200);
    expect(recorder.getBodyText()).toContain('lodge-default');
  });

  it('forwards studio skin apply requests to the runtime with the posted body', async () => {
    studioServiceGetRuntimeSnapshotMock.mockReturnValue({
      status: 'ready',
      resolvedUrl: 'http://127.0.0.1:3211/electron-standalone?embedded=1&readonly=1',
      runtimeInstanceId: 'runtime-1',
      lastError: null,
      port: 3211,
      python: {
        uvInstalled: true,
        interpreterReady: true,
        dependenciesReady: true,
        pythonPath: '/tmp/python3',
        venvPythonPath: '/tmp/.venv/bin/python',
        error: null,
      },
    });
    fetchMock.mockImplementation(async (requestUrl: string, init?: RequestInit) => {
      expect(requestUrl).toBe('http://127.0.0.1:3211/studio/skins/apply');
      expect(init?.method).toBe('POST');
      expect(Buffer.isBuffer(init?.body)).toBe(true);
      expect((init?.body as Buffer).toString('utf8')).toBe('{"skinKey":"ember-cabin"}');
      return new Response(JSON.stringify({
        ok: true,
        appliedSkinKey: 'ember-cabin',
        fallbackApplied: false,
        reason: null,
        defaultFallbackSkinKey: 'lodge-default',
        skins: [],
      }), {
        status: 200,
        headers: {
          'content-type': 'application/json; charset=utf-8',
        },
      });
    });

    const { handleStudioRoutes } = await import('@electron/api/routes/studio');
    const recorder = createResponseRecorder();
    const req = Readable.from([Buffer.from('{"skinKey":"ember-cabin"}')]) as IncomingMessage;
    req.method = 'POST';
    req.headers = {
      'content-type': 'application/json',
    };

    const handled = await handleStudioRoutes(
      req,
      recorder.response,
      new URL('http://127.0.0.1:3210/api/studio/skins/apply'),
      {
        studioService: {
          start: studioServiceStartMock,
          retryRuntime: studioServiceRetryRuntimeMock,
          getRuntimeSnapshot: studioServiceGetRuntimeSnapshotMock,
        },
      } as never,
    );

    expect(handled).toBe(true);
    expect(recorder.getStatusCode()).toBe(200);
    expect(recorder.getBodyText()).toContain('ember-cabin');
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

  it('proxies the standalone studio frame through the host api and rewrites absolute root paths', async () => {
    studioServiceGetRuntimeSnapshotMock.mockReturnValue({
      status: 'ready',
      resolvedUrl: 'http://127.0.0.1:3211/electron-standalone?embedded=1&readonly=1',
      runtimeInstanceId: 'runtime-1',
      lastError: null,
      port: 3211,
      python: {
        uvInstalled: true,
        interpreterReady: true,
        dependenciesReady: true,
        pythonPath: '/tmp/python3',
        venvPythonPath: '/tmp/.venv/bin/python',
        error: null,
      },
    });
    fetchMock.mockResolvedValue(new Response(
      '<script src="/static/vendor/phaser.js"></script><script>fetch(\'/status\');</script>',
      {
        status: 200,
        headers: {
          'content-type': 'text/html; charset=utf-8',
        },
      },
    ));

    const { handleStudioRoutes } = await import('@electron/api/routes/studio');
    const recorder = createResponseRecorder();

    const handled = await handleStudioRoutes(
      { method: 'GET', headers: {} } as IncomingMessage,
      recorder.response,
      new URL('http://127.0.0.1:3210/api/studio/frame/electron-standalone?embedded=1&readonly=1&focusAgentId=main&skinKey=ember-cabin'),
      {
        studioService: {
          start: studioServiceStartMock,
          retryRuntime: studioServiceRetryRuntimeMock,
          getRuntimeSnapshot: studioServiceGetRuntimeSnapshotMock,
        },
      } as never,
    );

    expect(handled).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:3211/electron-standalone?embedded=1&readonly=1&focusAgentId=main&skinKey=ember-cabin',
      expect.objectContaining({
        method: 'GET',
      }),
    );
    expect(recorder.getStatusCode()).toBe(200);
    expect(recorder.getHeader('content-type')).toContain('text/html');
    expect(recorder.getBodyText()).toContain('/api/studio/frame/static/vendor/phaser.js');
    expect(recorder.getBodyText()).toContain("fetch('/api/studio/frame/status');");
  });

  it('appends the studio skin key to a resolved runtime URL without dropping existing params', () => {
    expect(
      appendStudioSkinQuery(
        'http://127.0.0.1:3211/electron-standalone?embedded=1&readonly=1',
        'ember-cabin',
      ),
    ).toBe('http://127.0.0.1:3211/electron-standalone?embedded=1&readonly=1&skinKey=ember-cabin');
  });
});
