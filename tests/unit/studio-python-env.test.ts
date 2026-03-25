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
      if (target === '/tmp/studio/.venv/bin/python') {
        return runChildCommandMock.mock.calls.length >= 5;
      }
      return false;
    });
  });

  it('retries studio dependency installation without mirror env after the mirrored install fails', async () => {
    runChildCommandMock
      .mockResolvedValueOnce({ code: 0, stdout: '/tmp/python-3.12', stderr: '' })
      .mockResolvedValueOnce({ code: 0, stdout: '/tmp/python-3.12', stderr: '' })
      .mockResolvedValueOnce({ code: 0, stdout: '', stderr: '' })
      .mockResolvedValueOnce({ code: 1, stdout: '', stderr: 'mirror install failed' })
      .mockResolvedValueOnce({ code: 0, stdout: 'installed', stderr: '' })
      .mockResolvedValueOnce({ code: 0, stdout: '/tmp/python-3.12', stderr: '' })
      .mockResolvedValueOnce({ code: 0, stdout: '', stderr: '' });

    const { ensureStudioPythonEnv } = await import('@electron/studio/python-env');

    const readiness = await ensureStudioPythonEnv();

    expect(readiness.dependenciesReady).toBe(true);
    const installCalls = runChildCommandMock.mock.calls.filter(
      ([command, args]) => command === '/tmp/bin/uv' && Array.isArray(args) && args[0] === 'pip',
    );
    expect(installCalls).toHaveLength(2);
    expect(installCalls[0]?.[2]).toMatchObject({
      env: expect.objectContaining({ UV_INDEX_URL: 'https://mirror.invalid/simple' }),
    });
    expect(installCalls[1]?.[2]).toMatchObject({
      env: expect.not.objectContaining({ UV_INDEX_URL: expect.any(String) }),
    });
  });
});
