import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';
import { spawn, type ChildProcessWithoutNullStreams } from 'child_process';
import { createServer } from 'net';
import { listAgentsSnapshot } from '../utils/agent-config';
import { getSetting, setSetting } from '../utils/store';
import { logger } from '../utils/logger';
import { ensureStudioPythonEnv, inspectStudioPythonEnv } from './python-env';
import {
  getStudioBackendDir,
  getStudioBackendEntryPath,
  getStudioDataDir,
  getStudioRuntimeDir,
} from './paths';
import { STUDIO_DEFAULT_PORT, type StudioRuntimeSnapshot } from './types';

const HEALTHCHECK_TIMEOUT_MS = 15_000;
const HEALTHCHECK_INTERVAL_MS = 350;

const isPortOpen = async (port: number): Promise<boolean> =>
  await new Promise((resolve) => {
    const server = createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => {
      server.close(() => resolve(true));
    });
    server.listen(port, '127.0.0.1');
  });

const allocatePort = async (preferredPort: number): Promise<number> => {
  if (preferredPort > 0 && await isPortOpen(preferredPort)) {
    return preferredPort;
  }
  return await new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        server.close(() => reject(new Error('Failed to allocate Studio port')));
        return;
      }
      const { port } = address;
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(port);
      });
    });
  });
};

const waitForHealth = async (port: number): Promise<void> => {
  const deadline = Date.now() + HEALTHCHECK_TIMEOUT_MS;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/health`, { method: 'GET' });
      if (response.ok) {
        return;
      }
    } catch {
      // ignore
    }
    await new Promise((resolve) => setTimeout(resolve, HEALTHCHECK_INTERVAL_MS));
  }
  throw new Error(`Studio health check timed out on port ${port}`);
};

const resolveMainWorkspacePath = async (): Promise<string | null> => {
  try {
    return (await listAgentsSnapshot()).agents.find((agent) => agent.id === 'main')?.workspace ?? null;
  } catch (error) {
    logger.warn('Failed to resolve Studio workspace path', error);
    return null;
  }
};

export class StudioRuntimeManager extends EventEmitter {
  private process: ChildProcessWithoutNullStreams | null = null;
  private startPromise: Promise<StudioRuntimeSnapshot> | null = null;
  private stopPromise: Promise<void> | null = null;
  private snapshot: StudioRuntimeSnapshot = {
    status: 'starting',
    resolvedUrl: null,
    runtimeInstanceId: null,
    lastError: null,
    port: null,
    python: {
      uvInstalled: false,
      interpreterReady: false,
      dependenciesReady: false,
      pythonPath: null,
      venvPythonPath: null,
      error: null,
    },
  };

  getSnapshot(): StudioRuntimeSnapshot {
    return { ...this.snapshot, python: { ...this.snapshot.python } };
  }

  private updateSnapshot(patch: Partial<StudioRuntimeSnapshot>): StudioRuntimeSnapshot {
    this.snapshot = {
      ...this.snapshot,
      ...patch,
      python: patch.python ? { ...patch.python } : { ...this.snapshot.python },
    };
    this.emit('snapshot', this.getSnapshot());
    return this.getSnapshot();
  }

  private attachProcessLogging(child: ChildProcessWithoutNullStreams): void {
    child.stdout.on('data', (chunk) => {
      const line = chunk.toString().trim();
      if (line) {
        logger.info(`[studio-runtime] ${line}`);
      }
    });
    child.stderr.on('data', (chunk) => {
      const line = chunk.toString().trim();
      if (line) {
        logger.warn(`[studio-runtime] ${line}`);
      }
    });
    child.once('exit', (code) => {
      this.process = null;
      if (this.snapshot.status === 'ready' || this.snapshot.status === 'starting') {
        this.updateSnapshot({
          status: 'runtime-error',
          resolvedUrl: null,
          runtimeInstanceId: null,
          lastError: `Studio runtime exited with code ${code ?? -1}`,
        });
      }
    });
  }

  async start(options: { repairEnvironment?: boolean } = {}): Promise<StudioRuntimeSnapshot> {
    if (this.startPromise) {
      return await this.startPromise;
    }
    if (!options.repairEnvironment && this.process && this.snapshot.status === 'ready') {
      return this.getSnapshot();
    }
    this.startPromise = this.startInternal(options).finally(() => {
      this.startPromise = null;
    });
    return await this.startPromise;
  }

  async retry(options: { repairEnvironment?: boolean } = {}): Promise<StudioRuntimeSnapshot> {
    this.updateSnapshot({
      status: 'restarting',
      resolvedUrl: null,
      runtimeInstanceId: null,
      lastError: null,
    });
    await this.stop();
    return await this.start(options);
  }

  async stop(): Promise<void> {
    if (this.stopPromise) {
      await this.stopPromise;
      return;
    }
    if (!this.process) {
      return;
    }
    const child = this.process;
    this.stopPromise = new Promise((resolve) => {
      child.once('exit', () => {
        this.process = null;
        resolve();
      });
      try {
        child.kill();
      } catch {
        resolve();
      }
    }).finally(() => {
      this.stopPromise = null;
    });
    await this.stopPromise;
  }

  private async startInternal(options: { repairEnvironment?: boolean } = {}): Promise<StudioRuntimeSnapshot> {
    const readiness = await inspectStudioPythonEnv();
    this.updateSnapshot({
      status: 'starting',
      resolvedUrl: null,
      runtimeInstanceId: null,
      lastError: null,
      python: readiness,
    });

    const prepared = await ensureStudioPythonEnv({
      forceReinstall: options.repairEnvironment === true,
    }).catch((error) => ({
      ...readiness,
      error: error instanceof Error ? error.message : String(error),
    }));

    if (!prepared.dependenciesReady || !prepared.venvPythonPath) {
      return this.updateSnapshot({
        status: 'python-missing',
        resolvedUrl: null,
        runtimeInstanceId: null,
        lastError: prepared.error,
        python: prepared,
      });
    }

    const storedPort = await getSetting('studioPort').catch(() => STUDIO_DEFAULT_PORT);
    const port = await allocatePort(typeof storedPort === 'number' ? storedPort : STUDIO_DEFAULT_PORT);
    if (port !== storedPort) {
      await setSetting('studioPort', port);
    }

    const openclawWorkspace = await resolveMainWorkspacePath();
    const child = spawn(prepared.venvPythonPath, [getStudioBackendEntryPath()], {
      cwd: getStudioBackendDir(),
      env: {
        ...process.env,
        PYTHONUNBUFFERED: '1',
        STAR_BACKEND_PORT: String(port),
        STAR_OFFICE_DATA_DIR: getStudioDataDir(),
        STAR_OFFICE_RUNTIME_DIR: getStudioRuntimeDir(),
        STAR_OFFICE_READONLY: '1',
        STAR_OFFICE_EMBEDDED: '1',
        ...(openclawWorkspace ? { OPENCLAW_WORKSPACE: openclawWorkspace } : {}),
      },
      windowsHide: true,
    });

    this.process = child;
    this.attachProcessLogging(child);

    try {
      await waitForHealth(port);
    } catch (error) {
      await this.stop();
      return this.updateSnapshot({
        status: 'runtime-error',
        resolvedUrl: null,
        runtimeInstanceId: null,
        lastError: error instanceof Error ? error.message : String(error),
        port,
        python: prepared,
      });
    }

    return this.updateSnapshot({
      status: 'ready',
      resolvedUrl: `http://127.0.0.1:${port}/electron-standalone?embedded=1&readonly=1`,
      runtimeInstanceId: randomUUID(),
      lastError: null,
      port,
      python: prepared,
    });
  }
}
