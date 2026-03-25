import { existsSync } from 'fs';
import { mkdir, rm } from 'fs/promises';
import { getUvMirrorEnv } from '../utils/uv-env';
import { logger } from '../utils/logger';
import { needsWinShell, quoteForCmd } from '../utils/paths';
import { createAbortError, isAbortError, runChildCommand } from '../utils/run-child-command';
import { checkUvInstalled, resolveUvBin, setupManagedPython } from '../utils/uv-setup';
import { getStudioRequirementsPath, getStudioVenvDir, getStudioVenvPythonPath } from './paths';
import type { StudioPythonReadiness } from './types';

interface EnsureStudioPythonEnvOptions {
  forceReinstall?: boolean;
  signal?: AbortSignal;
  onLog?: (entry: { level: 'info' | 'error'; message: string }) => void;
}

const PYTHON_FIND_TIMEOUT_MS = 15_000;
const STUDIO_PROBE_TIMEOUT_MS = 15_000;
const STUDIO_VENV_CREATE_TIMEOUT_MS = 60_000;
const STUDIO_DEPENDENCY_INSTALL_TIMEOUT_MS = 120_000;
let managedPythonPathCache: string | null | undefined;

const runCommand = async (
  command: string,
  args: string[],
  options: {
    cwd?: string;
    env?: Record<string, string | undefined>;
    signal?: AbortSignal;
    timeoutMs?: number;
    onStdout?: (message: string) => void;
    onStderr?: (message: string) => void;
  } = {},
): Promise<{ code: number; stdout: string; stderr: string }> => {
  const useShell = needsWinShell(command);
  return await runChildCommand(
    useShell ? quoteForCmd(command) : command,
    args,
    {
      cwd: options.cwd,
      env: options.env,
      shell: useShell,
      signal: options.signal,
      timeoutMs: options.timeoutMs,
      windowsHide: true,
      onStdout: options.onStdout,
      onStderr: options.onStderr,
    },
  );
};

const getPipMirrorEnv = (uvEnv: Record<string, string | undefined>): Record<string, string> =>
  uvEnv.UV_INDEX_URL ? { PIP_INDEX_URL: uvEnv.UV_INDEX_URL } : {};

const probeStudioDependencies = async (venvPythonPath: string): Promise<{ code: number; stdout: string; stderr: string }> =>
  await runCommand(
    venvPythonPath,
    ['-c', 'import flask; from PIL import Image'],
    { timeoutMs: STUDIO_PROBE_TIMEOUT_MS },
  );

const installStudioDependencies = async (
  venvPythonPath: string,
  requirementsPath: string,
  env: Record<string, string | undefined>,
  label: string,
  options: EnsureStudioPythonEnvOptions,
): Promise<void> => {
  options.onLog?.({ level: 'info', message: 'Installing Studio Python dependencies' });
  const installResult = await runCommand(
    venvPythonPath,
    ['-m', 'pip', 'install', '-r', requirementsPath],
    {
      env,
      signal: options.signal,
      timeoutMs: STUDIO_DEPENDENCY_INSTALL_TIMEOUT_MS,
      onStdout: (message) => options.onLog?.({ level: 'info', message }),
      onStderr: (message) => options.onLog?.({ level: 'info', message }),
    },
  );
  if (installResult.code === 0) {
    return;
  }
  const detail = installResult.stderr || installResult.stdout || `Failed to install Studio dependencies [${label}]`;
  throw new Error(detail);
};

export async function getManagedPythonPath(options: { forceRefresh?: boolean } = {}): Promise<string | null> {
  if (!options.forceRefresh && managedPythonPathCache !== undefined) {
    return managedPythonPathCache;
  }
  const uvInstalled = await checkUvInstalled();
  if (!uvInstalled) {
    managedPythonPathCache = null;
    return null;
  }
  const { bin: uvBin } = resolveUvBin();
  const result = await runCommand(uvBin, ['python', 'find', '3.12'], { timeoutMs: PYTHON_FIND_TIMEOUT_MS });
  managedPythonPathCache = result.code === 0 && result.stdout ? result.stdout.split(/\r?\n/).pop() ?? null : null;
  return managedPythonPathCache;
}

export async function inspectStudioPythonEnv(): Promise<StudioPythonReadiness> {
  const uvInstalled = await checkUvInstalled();
  if (!uvInstalled) {
    return {
      uvInstalled: false,
      interpreterReady: false,
      dependenciesReady: false,
      pythonPath: null,
      venvPythonPath: null,
      error: 'uv is not available',
    };
  }

  const pythonPath = await getManagedPythonPath();
  if (!pythonPath) {
    return {
      uvInstalled: true,
      interpreterReady: false,
      dependenciesReady: false,
      pythonPath: null,
      venvPythonPath: null,
      error: 'Managed Python 3.12 is not ready',
    };
  }

  const venvPythonPath = getStudioVenvPythonPath();
  if (!existsSync(venvPythonPath)) {
    return {
      uvInstalled: true,
      interpreterReady: true,
      dependenciesReady: false,
      pythonPath,
      venvPythonPath: null,
      error: 'Studio virtual environment is missing',
    };
  }

  const dependencyProbe = await probeStudioDependencies(venvPythonPath);
  return {
    uvInstalled: true,
    interpreterReady: true,
    dependenciesReady: dependencyProbe.code === 0,
    pythonPath,
    venvPythonPath,
    error: dependencyProbe.code === 0 ? null : dependencyProbe.stderr || dependencyProbe.stdout || 'Studio dependencies are missing',
  };
}

export async function ensureStudioPythonEnv(
  options: EnsureStudioPythonEnvOptions = {},
): Promise<StudioPythonReadiness> {
  const forceReinstall = options.forceReinstall === true;
  const initial = await inspectStudioPythonEnv();
  if (initial.dependenciesReady && !forceReinstall) {
    options.onLog?.({ level: 'info', message: 'Studio dependencies already available' });
    return initial;
  }

  if (!initial.interpreterReady) {
    await setupManagedPython({
      signal: options.signal,
      onLog: options.onLog,
    });
  }

  if (options.signal?.aborted) {
    throw createAbortError('Environment preparation cancelled');
  }

  let pythonPath = initial.pythonPath;
  if (!pythonPath) {
    pythonPath = await getManagedPythonPath({ forceRefresh: true });
  }
  if (!pythonPath) {
    return {
      uvInstalled: true,
      interpreterReady: false,
      dependenciesReady: false,
      pythonPath: null,
      venvPythonPath: null,
      error: 'Managed Python 3.12 could not be resolved after setup',
    };
  }

  const uvEnv = await getUvMirrorEnv();
  const baseEnv = { ...process.env };
  const pipMirrorEnv = getPipMirrorEnv(uvEnv);
  const hasMirror = Object.keys(pipMirrorEnv).length > 0;
  const preferredEnv = { ...baseEnv, ...pipMirrorEnv };
  const venvDir = getStudioVenvDir();
  const venvPythonPath = getStudioVenvPythonPath();
  const requirementsPath = getStudioRequirementsPath();

  if (!existsSync(requirementsPath)) {
    throw new Error(`File not found: \`${requirementsPath}\``);
  }

  if (forceReinstall) {
    options.onLog?.({ level: 'info', message: 'Removing existing Studio virtual environment' });
    await rm(venvDir, { recursive: true, force: true });
  }

  await mkdir(venvDir, { recursive: true });

  options.onLog?.({ level: 'info', message: 'Creating Studio virtual environment' });
  const venvResult = await runCommand(pythonPath, ['-m', 'venv', venvDir], {
    env: baseEnv,
    signal: options.signal,
    timeoutMs: STUDIO_VENV_CREATE_TIMEOUT_MS,
    onStdout: (message) => options.onLog?.({ level: 'info', message }),
    onStderr: (message) => options.onLog?.({ level: 'info', message }),
  });
  if (venvResult.code !== 0) {
    throw new Error(venvResult.stderr || venvResult.stdout || 'Failed to create Studio virtual environment');
  }

  try {
    await installStudioDependencies(
      venvPythonPath,
      requirementsPath,
      preferredEnv,
      hasMirror ? 'mirror' : 'default',
      options,
    );
  } catch (error) {
    if (isAbortError(error)) {
      throw error;
    }
    if (!hasMirror) {
      logger.error('Studio dependency install failed', error);
      throw error;
    }
    logger.warn('Studio dependency install failed with mirror, retrying without mirror:', error);
    options.onLog?.({ level: 'info', message: 'Retrying Studio dependency install without mirror' });
    try {
      await installStudioDependencies(
        venvPythonPath,
        requirementsPath,
        baseEnv,
        'no-mirror',
        options,
      );
    } catch (retryError) {
      logger.error('Studio dependency install failed after mirror fallback', retryError);
      throw retryError;
    }
  }

  const dependencyProbe = await probeStudioDependencies(venvPythonPath);
  return {
    uvInstalled: true,
    interpreterReady: true,
    dependenciesReady: dependencyProbe.code === 0,
    pythonPath,
    venvPythonPath,
    error: dependencyProbe.code === 0 ? null : dependencyProbe.stderr || dependencyProbe.stdout || 'Studio dependencies are missing',
  };
}
