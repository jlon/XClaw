import { ensureStudioPythonEnv, inspectStudioPythonEnv } from '../studio/python-env';
import { logger } from '../utils/logger';
import { checkUvInstalled, installUv, isPythonReady, setupManagedPython } from '../utils/uv-setup';
import { createAbortError, isAbortError } from '../utils/run-child-command';

export type SetupEnvironmentTaskState = 'idle' | 'running' | 'succeeded' | 'failed' | 'cancelled';
export type SetupEnvironmentTaskStep = 'idle' | 'uv' | 'python' | 'studio' | 'verify';

export type SetupEnvironmentTaskLogEntry = {
  id: number;
  level: 'info' | 'error';
  message: string;
};

export type SetupEnvironmentTaskSnapshot = {
  state: SetupEnvironmentTaskState;
  step: SetupEnvironmentTaskStep;
  canCancel: boolean;
  error: string | null;
  startedAt: number | null;
  finishedAt: number | null;
  logs: SetupEnvironmentTaskLogEntry[];
};

type SetupEnvironmentTaskDependencies = {
  checkUvInstalled: typeof checkUvInstalled;
  installUv: typeof installUv;
  isPythonReady: typeof isPythonReady;
  setupManagedPython: typeof setupManagedPython;
  ensureStudioPythonEnv: typeof ensureStudioPythonEnv;
  inspectStudioPythonEnv: typeof inspectStudioPythonEnv;
};

type SetupEnvironmentTaskController = {
  getSnapshot: () => SetupEnvironmentTaskSnapshot;
  start: () => Promise<SetupEnvironmentTaskSnapshot>;
  cancel: () => Promise<{ success: boolean }>;
};

const defaultDependencies: SetupEnvironmentTaskDependencies = {
  checkUvInstalled,
  installUv,
  isPythonReady,
  setupManagedPython,
  ensureStudioPythonEnv,
  inspectStudioPythonEnv,
};

const createIdleSnapshot = (): SetupEnvironmentTaskSnapshot => ({
  state: 'idle',
  step: 'idle',
  canCancel: false,
  error: null,
  startedAt: null,
  finishedAt: null,
  logs: [],
});

const throwIfAborted = (signal?: AbortSignal): void => {
  if (signal?.aborted) {
    throw createAbortError('Environment preparation cancelled');
  }
};

export const createSetupEnvironmentTaskController = (
  dependencies: SetupEnvironmentTaskDependencies = defaultDependencies,
): SetupEnvironmentTaskController => {
  let snapshot = createIdleSnapshot();
  let abortController: AbortController | null = null;
  let taskPromise: Promise<void> | null = null;
  let logId = 0;

  const setSnapshot = (next: Partial<SetupEnvironmentTaskSnapshot>): SetupEnvironmentTaskSnapshot => {
    snapshot = {
      ...snapshot,
      ...next,
    };
    return snapshot;
  };

  const pushLog = (level: 'info' | 'error', message: string): void => {
    const entry = {
      id: logId += 1,
      level,
      message,
    };
    const loggerMethod = level === 'error' ? logger.error.bind(logger) : logger.info.bind(logger);
    loggerMethod(`[setup-environment] ${message}`);
    setSnapshot({
      logs: [...snapshot.logs, entry].slice(-200),
    });
  };

  const finalize = (
    state: Extract<SetupEnvironmentTaskState, 'succeeded' | 'failed' | 'cancelled'>,
    error: string | null,
    step: SetupEnvironmentTaskStep,
  ): void => {
    setSnapshot({
      state,
      step,
      error,
      canCancel: false,
      finishedAt: Date.now(),
    });
  };

  const verifyEnvironment = async (signal: AbortSignal): Promise<void> => {
    throwIfAborted(signal);
    const uvInstalled = await dependencies.checkUvInstalled();
    throwIfAborted(signal);
    const pythonReady = uvInstalled ? await dependencies.isPythonReady() : false;
    throwIfAborted(signal);
    const studio = uvInstalled
      ? await dependencies.inspectStudioPythonEnv()
      : {
        dependenciesReady: false,
      };

    if (!uvInstalled || !pythonReady || !studio.dependenciesReady) {
      throw new Error('Core environment is not ready yet');
    }
  };

  const runTask = async (signal: AbortSignal): Promise<void> => {
    try {
      setSnapshot({
        state: 'running',
        step: 'uv',
        canCancel: true,
        error: null,
        startedAt: Date.now(),
        finishedAt: null,
      });
      pushLog('info', 'Checking uv availability');
      const uvInstalled = await dependencies.checkUvInstalled();
      throwIfAborted(signal);

      if (!uvInstalled) {
        await dependencies.installUv();
        pushLog('info', 'uv is ready');
      } else {
        pushLog('info', 'uv is already available');
      }

      setSnapshot({ step: 'python' });
      pushLog('info', 'Preparing managed Python 3.12');
      await dependencies.setupManagedPython({
        signal,
        onLog: (entry) => {
          pushLog(entry.level === 'error' ? 'error' : 'info', entry.message);
        },
      });

      setSnapshot({ step: 'studio' });
      pushLog('info', 'Preparing Studio Python dependencies');
      const studio = await dependencies.ensureStudioPythonEnv({
        signal,
        onLog: (entry) => {
          pushLog(entry.level === 'error' ? 'error' : 'info', entry.message);
        },
      });

      if (!studio.dependenciesReady) {
        throw new Error(studio.error || 'Studio dependencies are not ready');
      }

      setSnapshot({ step: 'verify' });
      pushLog('info', 'Verifying environment readiness');
      await verifyEnvironment(signal);
      pushLog('info', 'Studio environment is ready');
      finalize('succeeded', null, 'verify');
    } catch (error) {
      if (isAbortError(error)) {
        pushLog('info', 'Environment preparation cancelled');
        finalize('cancelled', null, 'idle');
        return;
      }

      const message = error instanceof Error ? error.message : String(error);
      pushLog('error', message);
      finalize('failed', message, snapshot.step);
    } finally {
      abortController = null;
      taskPromise = null;
    }
  };

  return {
    getSnapshot: () => snapshot,
    start: async () => {
      if (snapshot.state === 'running' && taskPromise) {
        return snapshot;
      }

      abortController = new AbortController();
      snapshot = createIdleSnapshot();
      taskPromise = runTask(abortController.signal);
      void taskPromise;
      return snapshot;
    },
    cancel: async () => {
      if (snapshot.state !== 'running' || !abortController) {
        return { success: false };
      }

      setSnapshot({ canCancel: false });
      pushLog('info', 'Cancelling environment preparation');
      abortController.abort();
      return { success: true };
    },
  };
};
