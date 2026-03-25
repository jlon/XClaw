import { existsSync } from 'fs';
import { mkdir, rm } from 'fs/promises';
import { getUvMirrorEnv } from '../utils/uv-env';
import { logger } from '../utils/logger';
import { needsWinShell, quoteForCmd } from '../utils/paths';
import { createAbortError, runChildCommand } from '../utils/run-child-command';
import { checkUvInstalled, resolveUvBin, setupManagedPython } from '../utils/uv-setup';
import { getStudioRequirementsPath, getStudioVenvDir, getStudioVenvPythonPath } from './paths';
import type { StudioPythonReadiness } from './types';

interface EnsureStudioPythonEnvOptions {
  forceReinstall?: boolean;
  signal?: AbortSignal;
  onLog?: (entry: { level: 'info' | 'error'; message: string }) => void;
}

const runCommand = async (
  command: string,
  args: string[],
  options: {
    cwd?: string;
    env?: Record<string, string | undefined>;
    signal?: AbortSignal;
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
      windowsHide: true,
      onStdout: options.onStdout,
      onStderr: options.onStderr,
    },
  );
};

export async function getManagedPythonPath(): Promise<string | null> {
  const uvInstalled = await checkUvInstalled();
  if (!uvInstalled) {
    return null;
  }
  const { bin: uvBin } = resolveUvBin();
  const result = await runCommand(uvBin, ['python', 'find', '3.12']);
  return result.code === 0 && result.stdout ? result.stdout.split(/\r?\n/).pop() ?? null : null;
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

  const dependencyProbe = await runCommand(venvPythonPath, ['-c', 'import flask; from PIL import Image']);
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

  const pythonPath = await getManagedPythonPath();
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

  const { bin: uvBin } = resolveUvBin();
  const uvEnv = await getUvMirrorEnv();
  const env = { ...process.env, ...uvEnv };
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
  const venvResult = await runCommand(uvBin, ['venv', '--python', pythonPath, venvDir], {
    env,
    signal: options.signal,
    onStdout: (message) => options.onLog?.({ level: 'info', message }),
    onStderr: (message) => options.onLog?.({ level: 'info', message }),
  });
  if (venvResult.code !== 0) {
    throw new Error(venvResult.stderr || venvResult.stdout || 'Failed to create Studio virtual environment');
  }

  options.onLog?.({ level: 'info', message: 'Installing Studio Python dependencies' });
  const installResult = await runCommand(
    uvBin,
    ['pip', 'install', '--python', venvPythonPath, '-r', requirementsPath],
    {
      env,
      signal: options.signal,
      onStdout: (message) => options.onLog?.({ level: 'info', message }),
      onStderr: (message) => options.onLog?.({ level: 'info', message }),
    },
  );
  if (installResult.code !== 0) {
    logger.error('Studio dependency install failed', installResult);
    throw new Error(installResult.stderr || installResult.stdout || 'Failed to install Studio dependencies');
  }

  return await inspectStudioPythonEnv();
}
