import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, '..');
const viteBin = resolve(repoRoot, 'node_modules', 'vite', 'bin', 'vite.js');
const watcherLimitPattern = /ENOSPC: System limit for number of file watchers reached/i;
const defaultPollingInterval = '1000';
const lowWatcherLimitCeiling = 65536;

export function shouldRetryWithPolling({ exitCode, alreadyPolling, stderr }) {
  return exitCode !== 0 && !alreadyPolling && watcherLimitPattern.test(stderr);
}

export function buildViteDevEnv({ baseEnv, usePolling }) {
  if (!usePolling) {
    return { ...baseEnv };
  }

  return {
    ...baseEnv,
    CHOKIDAR_USEPOLLING: '1',
    CHOKIDAR_INTERVAL: baseEnv.CHOKIDAR_INTERVAL || defaultPollingInterval,
  };
}

export function normalizeViteDevArgs(args) {
  if (args[0] === '--') {
    return args.slice(1);
  }
  return [...args];
}

function parseWatcherLimit(value) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return null;
  }
  const parsed = Number.parseInt(value.trim(), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function readLinuxWatcherLimit() {
  try {
    return readFileSync('/proc/sys/fs/inotify/max_user_watches', 'utf8');
  } catch {
    return null;
  }
}

export function shouldPreferPollingFirst({ platform, env, watcherLimitRaw }) {
  if (env.CHOKIDAR_USEPOLLING === '1') {
    return true;
  }
  if (platform !== 'linux') {
    return false;
  }
  const watcherLimit = parseWatcherLimit(watcherLimitRaw);
  return watcherLimit !== null && watcherLimit <= lowWatcherLimitCeiling;
}

function normalizeExitCode(code, signal) {
  if (typeof code === 'number') {
    return code;
  }
  if (signal === 'SIGINT') {
    return 130;
  }
  if (signal === 'SIGTERM') {
    return 143;
  }
  return 1;
}

function runVite({ usePolling }) {
  return new Promise((resolveRun) => {
    let stderr = '';
    const child = spawn(process.execPath, [viteBin, ...normalizeViteDevArgs(process.argv.slice(2))], {
      cwd: repoRoot,
      env: buildViteDevEnv({ baseEnv: process.env, usePolling }),
      stdio: ['inherit', 'pipe', 'pipe'],
    });

    const forwardSignal = (signal) => {
      if (!child.killed && child.exitCode === null) {
        child.kill(signal);
      }
    };

    const handleSigint = () => forwardSignal('SIGINT');
    const handleSigterm = () => forwardSignal('SIGTERM');

    process.once('SIGINT', handleSigint);
    process.once('SIGTERM', handleSigterm);

    child.stdout.on('data', (chunk) => {
      process.stdout.write(chunk);
    });

    child.stderr.on('data', (chunk) => {
      const text = chunk.toString();
      stderr += text;
      process.stderr.write(text);
    });

    child.on('error', (error) => {
      process.removeListener('SIGINT', handleSigint);
      process.removeListener('SIGTERM', handleSigterm);
      resolveRun({ exitCode: 1, stderr: `${stderr}${error instanceof Error ? error.message : String(error)}` });
    });

    child.on('exit', (code, signal) => {
      process.removeListener('SIGINT', handleSigint);
      process.removeListener('SIGTERM', handleSigterm);
      resolveRun({ exitCode: normalizeExitCode(code, signal), stderr });
    });
  });
}

export async function runDevVite() {
  const preferPollingFirst = shouldPreferPollingFirst({
    platform: process.platform,
    env: process.env,
    watcherLimitRaw: readLinuxWatcherLimit(),
  });
  if (preferPollingFirst) {
    console.error('[dev] Linux watcher capacity is constrained. Starting Vite with Chokidar polling.');
    const pollingAttempt = await runVite({ usePolling: true });
    process.exit(pollingAttempt.exitCode);
  }

  const firstAttempt = await runVite({ usePolling: false });
  if (!shouldRetryWithPolling({
    exitCode: firstAttempt.exitCode,
    alreadyPolling: false,
    stderr: firstAttempt.stderr,
  })) {
    process.exit(firstAttempt.exitCode);
  }

  console.error('[dev] Vite hit the Linux file-watcher limit. Retrying with Chokidar polling.');
  const secondAttempt = await runVite({ usePolling: true });
  process.exit(secondAttempt.exitCode);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void runDevVite();
}
