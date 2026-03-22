import { spawn } from 'node:child_process';
import process from 'node:process';
import { setTimeout as delay } from 'node:timers/promises';

const repoRoot = process.cwd();
const baseUrl = 'http://127.0.0.1:4173';
const pnpmBin = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';

async function isServerReady(url) {
  try {
    const response = await fetch(url);
    return response.ok || response.status < 500;
  } catch {
    return false;
  }
}

async function waitForServer(url, timeoutMs) {
  const startedAt = Date.now();
  while ((Date.now() - startedAt) < timeoutMs) {
    if (await isServerReady(url)) {
      return;
    }
    await delay(500);
  }
  throw new Error(`Timed out waiting for ${url}`);
}

async function stopProcess(child) {
  if (!child || child.killed || child.exitCode !== null) {
    return;
  }
  child.kill('SIGTERM');
  await delay(1000);
  if (child.exitCode === null) {
    child.kill('SIGKILL');
  }
}

async function run() {
  let serverProcess = null;

  if (!(await isServerReady(baseUrl))) {
    const buildExitCode = await new Promise((resolve) => {
      const buildProcess = spawn(
        pnpmBin,
        ['exec', 'vite', 'build', '--config', 'vite.e2e.config.ts'],
        {
          cwd: repoRoot,
          env: process.env,
          stdio: 'inherit',
        },
      );

      buildProcess.on('exit', (code) => {
        resolve(code ?? 1);
      });
    });

    if (buildExitCode !== 0) {
      process.exit(buildExitCode);
    }

    serverProcess = spawn(
      process.execPath,
      ['./scripts/serve-dist.mjs'],
      {
        cwd: repoRoot,
        env: process.env,
        stdio: 'inherit',
      },
    );

    await waitForServer(baseUrl, 120_000);
  }

  const exitCode = await new Promise((resolve) => {
    const testProcess = spawn(
      pnpmBin,
      ['dlx', '@playwright/test@1.58.0', 'test', '--config=playwright.config.cjs'],
      {
        cwd: repoRoot,
        env: process.env,
        stdio: 'inherit',
      },
    );

    testProcess.on('exit', (code) => {
      resolve(code ?? 1);
    });
  });

  await stopProcess(serverProcess);
  process.exit(exitCode);
}

run().catch(async (error) => {
  console.error(error);
  process.exit(1);
});
