import { describe, expect, it, vi } from 'vitest';
import { createSetupEnvironmentTaskController } from '@electron/main/setup-environment-task';

describe('createSetupEnvironmentTaskController', () => {
  it('skips managed Python setup when Python is already reusable and only Studio deps are missing', async () => {
    const dependencies = {
      checkUvInstalled: vi.fn().mockResolvedValue(true),
      installUv: vi.fn().mockResolvedValue(undefined),
      isPythonReady: vi.fn().mockResolvedValue(true),
      setupManagedPython: vi.fn().mockResolvedValue(undefined),
      inspectStudioPythonEnv: vi.fn()
        .mockResolvedValueOnce({
          uvInstalled: true,
          interpreterReady: true,
          dependenciesReady: false,
          pythonPath: 'C:\\Users\\tester\\AppData\\Local\\uv\\python.exe',
          venvPythonPath: null,
          error: 'Studio virtual environment is missing',
        })
        .mockResolvedValueOnce({
          uvInstalled: true,
          interpreterReady: true,
          dependenciesReady: true,
          pythonPath: 'C:\\Users\\tester\\AppData\\Local\\uv\\python.exe',
          venvPythonPath: 'C:\\Users\\tester\\AppData\\Roaming\\XClaw\\studio\\.venv\\Scripts\\python.exe',
          error: null,
        }),
      ensureStudioPythonEnv: vi.fn().mockResolvedValue({
        uvInstalled: true,
        interpreterReady: true,
        dependenciesReady: true,
        pythonPath: 'C:\\Users\\tester\\AppData\\Local\\uv\\python.exe',
        venvPythonPath: 'C:\\Users\\tester\\AppData\\Roaming\\XClaw\\studio\\.venv\\Scripts\\python.exe',
        error: null,
      }),
    };

    const controller = createSetupEnvironmentTaskController(dependencies);

    await controller.start();

    await vi.waitFor(() => {
      expect(controller.getSnapshot()).toMatchObject({
        state: 'succeeded',
        step: 'verify',
        error: null,
      });
    });

    expect(dependencies.setupManagedPython).not.toHaveBeenCalled();
    expect(dependencies.ensureStudioPythonEnv).toHaveBeenCalledTimes(1);
  });
});
