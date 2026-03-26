import { inspectStudioPythonEnv } from '../studio/python-env';
import { checkUvInstalled } from '../utils/uv-setup';
import {
  createSetupEnvironmentTaskController,
  type SetupEnvironmentTaskSnapshot,
} from './setup-environment-task';

export type SetupEnvironmentStatus = {
  uvInstalled: boolean;
  pythonReady: boolean;
  studioDependenciesReady: boolean;
  studioInterpreterReady: boolean;
  studioError: string | null;
};

const setupEnvironmentTaskController = createSetupEnvironmentTaskController();

export function getSetupEnvironmentTaskSnapshot(): SetupEnvironmentTaskSnapshot {
  return setupEnvironmentTaskController.getSnapshot();
}

export async function startSetupEnvironmentTask(): Promise<SetupEnvironmentTaskSnapshot> {
  return await setupEnvironmentTaskController.start();
}

export async function cancelSetupEnvironmentTask(): Promise<{ success: boolean }> {
  return await setupEnvironmentTaskController.cancel();
}

export async function resolveSetupEnvironmentStatus(): Promise<SetupEnvironmentStatus> {
  const uvInstalled = await checkUvInstalled();
  const studio = uvInstalled
    ? await inspectStudioPythonEnv().catch((error) => ({
      uvInstalled,
      interpreterReady: false,
      dependenciesReady: false,
      pythonPath: null,
      venvPythonPath: null,
      error: error instanceof Error ? error.message : String(error),
    }))
    : {
      uvInstalled: false,
      interpreterReady: false,
      dependenciesReady: false,
      pythonPath: null,
      venvPythonPath: null,
      error: null,
    };

  return {
    uvInstalled,
    pythonReady: studio.interpreterReady,
    studioDependenciesReady: studio.dependenciesReady,
    studioInterpreterReady: studio.interpreterReady,
    studioError: studio.error,
  };
}
