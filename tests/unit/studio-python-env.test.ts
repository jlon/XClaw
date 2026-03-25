import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  existsSyncMock,
  mkdirMock,
  rmMock,
  runChildCommandMock,
  checkUvInstalledMock,
  resolveUvBinMock,
  setupManagedPythonMock,
  getUvMirrorEnvMock,
} = vi.hoisted(() => ({
  existsSyncMock: vi.fn(),
  mkdirMock: vi.fn(),
  rmMock: vi.fn(),
  runChildCommandMock: vi.fn(),
  checkUvInstalledMock: vi.fn(),
  resolveUvBinMock: vi.fn(),
  setupManagedPythonMock: vi.fn(),
  getUvMirrorEnvMock: vi.fn(),
}));

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

vi.mock('fs/promises', async () => {
  const actual = await vi.importActual<typeof import('fs/promises')>('fs/promises');
  return {
    ...actual,
    mkdir: (...args: unknown[]) => mkdirMock(...args),
    rm: (...args: unknown[]) => rmMock(...args),
    default: {
      ...actual,
      mkdir: (...args: unknown[]) => mkdirMock(...args),
      rm: (...args: unknown[]) => rmMock(...args),
    },
  };
});

vi.mock('@electron/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('@electron/utils/paths', () => ({
  needsWinShell: vi.fn(() => false),
  quoteForCmd: vi.fn((value: string) => value),
}));

vi.mock('@electron/utils/run-child-command', () => ({
  createAbortError: (message = 'Operation cancelled') => Object.assign(new Error(message), { name: 'AbortError' }),
  isAbortError: (error: unknown) => error instanceof Error && error.name === 'AbortError',
  runChildCommand: (...args: unknown[]) => runChildCommandMock(...args),
}));

vi.mock('@electron/utils/uv-setup', () => ({
  checkUvInstalled: (...args: unknown[]) => checkUvInstalledMock(...args),
  resolveUvBin: (...args: unknown[]) => resolveUvBinMock(...args),
  setupManagedPython: (...args: unknown[]) => setupManagedPythonMock(...args),
}));

vi.mock('@electron/utils/uv-env', () => ({
  getUvMirrorEnv: (...args: unknown[]) => getUvMirrorEnvMock(...args),
}));

vi.mock('@electron/studio/paths', () => ({
  getStudioRequirementsPath: () => '/tmp/studio/backend/requirements.txt',
  getStudioVenvDir: () => '/tmp/studio/.venv',
  getStudioVenvPythonPath: () => '/tmp/studio/.venv/bin/python',
}));

describe('ensureStudioPythonEnv', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    checkUvInstalledMock.mockResolvedValue(true);
    resolveUvBinMock.mockReturnValue({ bin: '/tmp/bin/uv', source: 'bundled' });
    setupManagedPythonMock.mockResolvedValue(undefined);
    getUvMirrorEnvMock.mockResolvedValue({ UV_INDEX_URL: 'https://mirror.invalid/simple' });
    mkdirMock.mockResolvedValue(undefined);
    rmMock.mockResolvedValue(undefined);
    existsSyncMock.mockImplementation((target: string) => {
      if (target === '/tmp/studio/backend/requirements.txt') {
        return true;
      }
      return false;
    });
  });

  it('uses the managed python interpreter directly for studio venv and dependency installation', async () => {
    let venvCreated = false;
    existsSyncMock.mockImplementation((target: string) => {
      if (target === '/tmp/studio/backend/requirements.txt') {
        return true;
      }
      if (target === '/tmp/studio/.venv/bin/python') {
        return venvCreated;
      }
      return false;
    });

    runChildCommandMock.mockImplementation(async (command: string, args: string[]) => {
      if (command === '/tmp/bin/uv' && args.join(' ') === 'python find 3.12') {
        return { code: 0, stdout: '/tmp/python-3.12', stderr: '' };
      }
      if (command === '/tmp/python-3.12' && args.join(' ') === '-m venv /tmp/studio/.venv') {
        venvCreated = true;
        return { code: 0, stdout: '', stderr: '' };
      }
      if (
        command === '/tmp/studio/.venv/bin/python' &&
        args.join(' ') === '-m pip install -r /tmp/studio/backend/requirements.txt'
      ) {
        const lastCall = runChildCommandMock.mock.calls.at(-1);
        const env = lastCall?.[2]?.env as Record<string, string | undefined> | undefined;
        if (env?.PIP_INDEX_URL) {
          return { code: 1, stdout: '', stderr: 'mirror install failed' };
        }
        return { code: 0, stdout: 'installed', stderr: '' };
      }
      if (command === '/tmp/studio/.venv/bin/python' && args.join(' ') === '-c import flask; from PIL import Image') {
        return { code: 0, stdout: '', stderr: '' };
      }
      throw new Error(`Unexpected command: ${command} ${args.join(' ')}`);
    });

    const { ensureStudioPythonEnv } = await import('@electron/studio/python-env');

    const readiness = await ensureStudioPythonEnv();

    expect(readiness.dependenciesReady).toBe(true);
    const uvFindCalls = runChildCommandMock.mock.calls.filter(
      ([command, args]) => command === '/tmp/bin/uv' && Array.isArray(args) && args.join(' ') === 'python find 3.12',
    );
    expect(uvFindCalls).toHaveLength(1);
    expect(runChildCommandMock).not.toHaveBeenCalledWith(
      '/tmp/bin/uv',
      expect.arrayContaining(['venv']),
      expect.anything(),
    );
    expect(runChildCommandMock).not.toHaveBeenCalledWith(
      '/tmp/bin/uv',
      expect.arrayContaining(['pip']),
      expect.anything(),
    );
    expect(runChildCommandMock).toHaveBeenCalledWith(
      '/tmp/python-3.12',
      ['-m', 'venv', '/tmp/studio/.venv'],
      expect.objectContaining({
        timeoutMs: 60_000,
        windowsHide: true,
      }),
    );
    const installCalls = runChildCommandMock.mock.calls.filter(
      ([command, args]) =>
        command === '/tmp/studio/.venv/bin/python' &&
        Array.isArray(args) &&
        args.join(' ') === '-m pip install -r /tmp/studio/backend/requirements.txt',
    );
    expect(installCalls).toHaveLength(2);
    expect(installCalls[0]?.[2]).toMatchObject({
      env: expect.objectContaining({ PIP_INDEX_URL: 'https://mirror.invalid/simple' }),
    });
    expect(installCalls[1]?.[2]).toMatchObject({
      env: expect.not.objectContaining({ PIP_INDEX_URL: expect.any(String) }),
    });
  });

  it('rebuilds an existing partial studio venv before invoking pip', async () => {
    let venvRebuilt = false;
    existsSyncMock.mockImplementation((target: string) => {
      if (target === '/tmp/studio/backend/requirements.txt') {
        return true;
      }
      if (target === '/tmp/studio/.venv/bin/python') {
        return true;
      }
      return false;
    });

    runChildCommandMock.mockImplementation(async (command: string, args: string[]) => {
      if (command === '/tmp/bin/uv' && args.join(' ') === 'python find 3.12') {
        return { code: 0, stdout: '/tmp/python-3.12', stderr: '' };
      }
      if (command === '/tmp/studio/.venv/bin/python' && args.join(' ') === '-c import flask; from PIL import Image') {
        return venvRebuilt
          ? { code: 0, stdout: '', stderr: '' }
          : { code: 1, stdout: '', stderr: 'missing dependencies' };
      }
      if (command === '/tmp/python-3.12' && args.join(' ') === '-m venv /tmp/studio/.venv') {
        venvRebuilt = true;
        return { code: 0, stdout: '', stderr: '' };
      }
      if (
        command === '/tmp/studio/.venv/bin/python' &&
        args.join(' ') === '-m pip install -r /tmp/studio/backend/requirements.txt'
      ) {
        return venvRebuilt
          ? { code: 0, stdout: 'installed', stderr: '' }
          : { code: 1, stdout: '', stderr: 'No module named pip' };
      }
      throw new Error(`Unexpected command: ${command} ${args.join(' ')}`);
    });

    const { ensureStudioPythonEnv } = await import('@electron/studio/python-env');

    const readiness = await ensureStudioPythonEnv();

    expect(readiness.dependenciesReady).toBe(true);
    expect(runChildCommandMock).toHaveBeenCalledWith(
      '/tmp/python-3.12',
      ['-m', 'venv', '/tmp/studio/.venv'],
      expect.objectContaining({
        timeoutMs: 60_000,
        windowsHide: true,
      }),
    );
    const installCall = runChildCommandMock.mock.calls.find(
      ([command, args]) =>
        command === '/tmp/studio/.venv/bin/python' &&
        Array.isArray(args) &&
        args.join(' ') === '-m pip install -r /tmp/studio/backend/requirements.txt',
    );
    expect(installCall).toBeDefined();
  });
});
