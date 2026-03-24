import { spawn } from 'child_process';
import { existsSync } from 'fs';
import { mkdir, rm } from 'fs/promises';
import { getUvMirrorEnv } from '../utils/uv-env';
import { logger } from '../utils/logger';
import { needsWinShell, quoteForCmd } from '../utils/paths';
import { checkUvInstalled, resolveUvBin, setupManagedPython } from '../utils/uv-setup';
import { getStudioRequirementsPath, getStudioVenvDir, getStudioVenvPythonPath } from './paths';
import type { StudioPythonReadiness } from './types';

interface EnsureStudioPythonEnvOptions {
  forceReinstall?: boolean;
}

const runCommand = async (
  command: string,
  args: string[],
  options: {
    cwd?: string;
    env?: Record<string, string | undefined>;
  } = {},
): Promise<{ code: number; stdout: string; stderr: string }> => {
  const useShell = needsWinShell(command);
  return await new Promise((resolve) => {
    const child = spawn(useShell ? quoteForCmd(command) : command, args, {
      cwd: options.cwd,
      env: options.env,
      shell: useShell,
      windowsHide: true,
    });
    let stdout = '';
    let stderr = '';
    child.stdout?.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr?.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('error', (error) => {
      resolve({ code: -1, stdout, stderr: error.message });
    });
    child.on('close', (code) => {
      resolve({ code: code ?? -1, stdout: stdout.trim(), stderr: stderr.trim() });
    });
  });
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
    return initial;
  }

  if (!initial.interpreterReady) {
    await setupManagedPython();
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
    await rm(venvDir, { recursive: true, force: true });
  }

  await mkdir(venvDir, { recursive: true });

  const venvResult = await runCommand(uvBin, ['venv', '--python', pythonPath, venvDir], { env });
  if (venvResult.code !== 0) {
    throw new Error(venvResult.stderr || venvResult.stdout || 'Failed to create Studio virtual environment');
  }

  const installResult = await runCommand(
    uvBin,
    ['pip', 'install', '--python', venvPythonPath, '-r', requirementsPath],
    { env },
  );
  if (installResult.code !== 0) {
    logger.error('Studio dependency install failed', installResult);
    throw new Error(installResult.stderr || installResult.stdout || 'Failed to install Studio dependencies');
  }

  return await inspectStudioPythonEnv();
}
