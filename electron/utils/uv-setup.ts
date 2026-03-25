import { app } from 'electron';
import { execSync, spawn } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';
import { getUvMirrorEnv } from './uv-env';
import { logger } from './logger';
import { quoteForCmd, needsWinShell } from './paths';
import { createAbortError, isAbortError, runChildCommand } from './run-child-command';

let setupManagedPythonFlight: Promise<void> | null = null;

type SetupProgressEntry = {
  level: 'info' | 'error';
  message: string;
};

type SetupManagedPythonOptions = {
  signal?: AbortSignal;
  onLog?: (entry: SetupProgressEntry) => void;
};

/**
 * Get the path to the bundled uv binary
 */
function getBundledUvPath(): string {
  const platform = process.platform;
  const arch = process.arch;
  const target = `${platform}-${arch}`;
  const binName = platform === 'win32' ? 'uv.exe' : 'uv';

  if (app.isPackaged) {
    return join(process.resourcesPath, 'bin', binName);
  } else {
    return join(process.cwd(), 'resources', 'bin', target, binName);
  }
}

/**
 * Resolve the best uv binary to use.
 *
 * In packaged mode we always prefer the bundled binary so we never accidentally
 * pick up a system-wide uv that may be a different (possibly broken) version.
 * In dev we fall through to the system PATH for convenience.
 */
export function resolveUvBin(): { bin: string; source: 'bundled' | 'path' | 'bundled-fallback' } {
  const bundled = getBundledUvPath();

  if (app.isPackaged) {
    if (existsSync(bundled)) {
      return { bin: bundled, source: 'bundled' };
    }
    logger.warn(`Bundled uv binary not found at ${bundled}, falling back to system PATH`);
  }

  // Dev mode or missing bundled binary — check system PATH
  const found = findUvInPathSync();
  if (found) return { bin: 'uv', source: 'path' };

  if (existsSync(bundled)) {
    return { bin: bundled, source: 'bundled-fallback' };
  }

  return { bin: 'uv', source: 'path' };
}

function findUvInPathSync(): boolean {
  try {
    const cmd = process.platform === 'win32' ? 'where.exe uv' : 'which uv';
    execSync(cmd, { stdio: 'ignore', timeout: 5000, windowsHide: true });
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if uv is available (either bundled or in system PATH)
 */
export async function checkUvInstalled(): Promise<boolean> {
  const { bin, source } = resolveUvBin();
  if (source === 'bundled' || source === 'bundled-fallback') {
    return existsSync(bin);
  }
  return findUvInPathSync();
}

/**
 * "Install" uv - now just verifies that uv is available somewhere.
 * Kept for API compatibility with frontend.
 */
export async function installUv(): Promise<void> {
  const isAvailable = await checkUvInstalled();
  if (!isAvailable) {
    const bin = getBundledUvPath();
    throw new Error(`uv not found in system PATH and bundled binary missing at ${bin}`);
  }
  logger.info('uv is available and ready to use');
}

/**
 * Check if a managed Python 3.12 is ready and accessible
 */
export async function isPythonReady(): Promise<boolean> {
  const { bin: uvBin } = resolveUvBin();
  const useShell = needsWinShell(uvBin);

  return new Promise<boolean>((resolve) => {
    try {
      const child = spawn(useShell ? quoteForCmd(uvBin) : uvBin, ['python', 'find', '3.12'], {
        shell: useShell,
        windowsHide: true,
      });
      child.on('close', (code) => resolve(code === 0));
      child.on('error', () => resolve(false));
    } catch {
      resolve(false);
    }
  });
}

/**
 * Run `uv python install 3.12` once with the given environment.
 * Returns on success, throws with captured stderr on failure.
 */
async function runPythonInstall(
  uvBin: string,
  env: Record<string, string | undefined>,
  label: string,
  options: SetupManagedPythonOptions = {},
): Promise<void> {
  const useShell = needsWinShell(uvBin);
  const stdoutChunks: string[] = [];
  const stderrChunks: string[] = [];

  const result = await runChildCommand(
    useShell ? quoteForCmd(uvBin) : uvBin,
    ['python', 'install', '3.12'],
    {
      shell: useShell,
      env,
      signal: options.signal,
      windowsHide: true,
      onStdout: (line) => {
        stdoutChunks.push(line);
        logger.debug(`[python-setup:${label}] stdout: ${line}`);
        options.onLog?.({ level: 'info', message: line });
      },
      onStderr: (line) => {
        stderrChunks.push(line);
        logger.info(`[python-setup:${label}] stderr: ${line}`);
        options.onLog?.({ level: 'info', message: line });
      },
    },
  );

  if (result.code === 0) {
    return;
  }

  const detail = result.stderr || result.stdout || stderrChunks.join('\n') || stdoutChunks.join('\n') || '(no output captured)';
  throw new Error(
    `Python installation failed with code ${result.code} [${label}]\n` +
    `  uv binary: ${uvBin}\n` +
    `  platform: ${process.platform}/${process.arch}\n` +
    `  output: ${detail}`
  );
}

/**
 * Use bundled uv to install a managed Python version (default 3.12).
 *
 * Tries with mirror env first (for CN region), then retries without mirror
 * if the first attempt fails, to rule out mirror-specific issues.
 */
export async function setupManagedPython(options: SetupManagedPythonOptions = {}): Promise<void> {
  if (options.signal?.aborted) {
    throw createAbortError('Environment preparation cancelled');
  }

  if (setupManagedPythonFlight) {
    logger.info('Reusing in-flight managed Python setup');
    return await setupManagedPythonFlight;
  }

  setupManagedPythonFlight = (async () => {
    const { bin: uvBin, source } = resolveUvBin();
    const uvEnv = await getUvMirrorEnv();
    const hasMirror = Object.keys(uvEnv).length > 0;

    logger.info(
      `Setting up managed Python 3.12 ` +
      `(uv=${uvBin}, source=${source}, arch=${process.arch}, mirror=${hasMirror})`
    );

    const baseEnv: Record<string, string | undefined> = { ...process.env };

    try {
      await runPythonInstall(uvBin, { ...baseEnv, ...uvEnv }, hasMirror ? 'mirror' : 'default', options);
    } catch (firstError) {
      if (isAbortError(firstError)) {
        throw firstError;
      }
      logger.warn('Python install attempt 1 failed:', firstError);

      if (hasMirror) {
        logger.info('Retrying Python install without mirror...');
        try {
          await runPythonInstall(uvBin, baseEnv, 'no-mirror', options);
        } catch (secondError) {
          if (isAbortError(secondError)) {
            throw secondError;
          }
          logger.error('Python install attempt 2 (no mirror) also failed:', secondError);
          throw secondError;
        }
      } else {
        throw firstError;
      }
    }

    const verifyShell = needsWinShell(uvBin);
    try {
      const findResult = await runChildCommand(
        verifyShell ? quoteForCmd(uvBin) : uvBin,
        ['python', 'find', '3.12'],
        {
          shell: verifyShell,
          env: { ...process.env, ...uvEnv },
          signal: options.signal,
          windowsHide: true,
        },
      );
      const findPath = findResult.stdout.trim();

      if (findPath) {
        logger.info(`Managed Python 3.12 installed at: ${findPath}`);
      }
    } catch (err) {
      if (isAbortError(err)) {
        throw err;
      }
      logger.warn('Could not determine Python path after install:', err);
    }
  })();

  try {
    await setupManagedPythonFlight;
  } finally {
    setupManagedPythonFlight = null;
  }
}
