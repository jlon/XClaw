import { join } from 'path';
import { getDataDir, getResourcesDir } from '../utils/paths';

const STUDIO_RUNTIME_DIRNAME = 'star-office-runtime';
const STUDIO_DATA_DIRNAME = 'studio';
const LAST_KNOWN_GOOD_DIRNAME = 'last-known-good';

export const getStudioRuntimeDir = (): string => join(getResourcesDir(), STUDIO_RUNTIME_DIRNAME);
export const getStudioBackendDir = (): string => join(getStudioRuntimeDir(), 'backend');
export const getStudioFrontendDir = (): string => join(getStudioRuntimeDir(), 'frontend');
export const getStudioBackendEntryPath = (): string => join(getStudioBackendDir(), 'app.py');
export const getStudioRequirementsPath = (): string => join(getStudioBackendDir(), 'requirements.txt');
export const getStudioStandaloneHtmlPath = (): string => join(getStudioFrontendDir(), 'electron-standalone.html');
export const getStudioDataDir = (): string => join(getDataDir(), STUDIO_DATA_DIRNAME);
export const getStudioSnapshotDir = (): string => getStudioDataDir();
export const getStudioLastKnownGoodDir = (): string => join(getStudioSnapshotDir(), LAST_KNOWN_GOOD_DIRNAME);
export const getStudioRuntimeConfigPath = (): string => join(getStudioDataDir(), 'runtime-config.json');
export const getStudioJoinKeysPath = (): string => join(getStudioDataDir(), 'join-keys.json');
export const getStudioVenvDir = (): string => join(getStudioDataDir(), '.venv');
export const getStudioVenvPythonPath = (): string => join(
  getStudioVenvDir(),
  process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python',
);

export interface StudioSnapshotPaths {
  rootDir: string;
  stateFilePath: string;
  agentsStateFilePath: string;
  manifestFilePath: string;
}

export const getStudioSnapshotPaths = (rootDir = getStudioSnapshotDir()): StudioSnapshotPaths => ({
  rootDir,
  stateFilePath: join(rootDir, 'state.json'),
  agentsStateFilePath: join(rootDir, 'agents-state.json'),
  manifestFilePath: join(rootDir, 'manifest.json'),
});

export const getStudioLastKnownGoodPaths = (): StudioSnapshotPaths =>
  getStudioSnapshotPaths(getStudioLastKnownGoodDir());
