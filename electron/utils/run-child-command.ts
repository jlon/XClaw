import { type ChildProcess, spawn } from 'child_process';

type RunChildCommandOptions = {
  cwd?: string;
  env?: Record<string, string | undefined>;
  shell?: boolean;
  signal?: AbortSignal;
  windowsHide?: boolean;
  onStdout?: (message: string) => void;
  onStderr?: (message: string) => void;
};

type RunChildCommandResult = {
  code: number;
  stdout: string;
  stderr: string;
};

export const createAbortError = (message = 'Operation cancelled'): Error => Object.assign(new Error(message), {
  name: 'AbortError',
});

export const isAbortError = (error: unknown): boolean => error instanceof Error && error.name === 'AbortError';

const emitCommandOutput = (
  output: string,
  handler?: (message: string) => void,
): void => {
  const message = output.trim();
  if (message) {
    handler?.(message);
  }
};

const terminateChildProcess = (child: ChildProcess): void => {
  const { pid } = child;
  if (!pid) {
    return;
  }

  if (process.platform === 'win32') {
    const killer = spawn('taskkill', ['/pid', String(pid), '/t', '/f'], {
      windowsHide: true,
      stdio: 'ignore',
    });
    killer.unref();
    return;
  }

  try {
    child.kill('SIGTERM');
  } catch {
    return;
  }

  const forceKillTimer = setTimeout(() => {
    try {
      child.kill('SIGKILL');
    } catch {
      return;
    }
  }, 1500);

  forceKillTimer.unref();
};

export const runChildCommand = async (
  command: string,
  args: string[],
  options: RunChildCommandOptions = {},
): Promise<RunChildCommandResult> => {
  return await new Promise((resolve, reject) => {
    let settled = false;
    let stdout = '';
    let stderr = '';

    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env,
      shell: options.shell,
      windowsHide: options.windowsHide ?? true,
    });

    const finish = (handler: () => void): void => {
      if (settled) {
        return;
      }
      settled = true;
      options.signal?.removeEventListener('abort', handleAbort);
      handler();
    };

    const handleAbort = (): void => {
      terminateChildProcess(child);
      finish(() => reject(createAbortError()));
    };

    if (options.signal?.aborted) {
      handleAbort();
      return;
    }

    options.signal?.addEventListener('abort', handleAbort, { once: true });

    child.stdout?.on('data', (chunk) => {
      const text = chunk.toString();
      stdout += text;
      emitCommandOutput(text, options.onStdout);
    });

    child.stderr?.on('data', (chunk) => {
      const text = chunk.toString();
      stderr += text;
      emitCommandOutput(text, options.onStderr);
    });

    child.on('error', (error) => {
      finish(() => reject(error));
    });

    child.on('close', (code) => {
      finish(() => resolve({
        code: code ?? -1,
        stdout: stdout.trim(),
        stderr: stderr.trim(),
      }));
    });
  });
};
