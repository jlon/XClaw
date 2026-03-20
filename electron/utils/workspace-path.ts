import { homedir } from 'os';
import { posix, win32 } from 'path';

type NormalizeWorkspacePathOptions = {
  homeDir?: string;
  platform?: NodeJS.Platform;
};

type PathApi = typeof posix | typeof win32;

function trimTrailingSeparators(value: string, pathApi: PathApi): string {
  return value === pathApi.parse(value).root ? value : value.replace(/[\\/]+$/, '');
}

function shouldUseWin32PathApi(value: string, platform: NodeJS.Platform): boolean {
  return platform === 'win32' || /^[a-z]:[\\/]/i.test(value) || value.startsWith('\\\\');
}

function resolvePathContext(
  value: string,
  options: NormalizeWorkspacePathOptions = {},
): {
  trimmed: string;
  pathApi: PathApi;
  effectivePlatform: NodeJS.Platform;
  normalizedHomeDir: string;
} {
  const platform = options.platform ?? process.platform;
  const useWin32PathApi = shouldUseWin32PathApi(value, platform);
  const effectivePlatform = useWin32PathApi ? 'win32' : platform;
  const pathApi = useWin32PathApi ? win32 : posix;
  const homeDir = options.homeDir ?? homedir();
  const normalizedHomeDir = effectivePlatform === 'win32'
    ? homeDir.replace(/\//g, '\\')
    : homeDir.replace(/\\/g, '/');

  return {
    trimmed: value.trim(),
    pathApi,
    effectivePlatform,
    normalizedHomeDir,
  };
}

export function normalizeWorkspacePath(
  value: string,
  options: NormalizeWorkspacePathOptions = {},
): string {
  const { trimmed, pathApi, effectivePlatform, normalizedHomeDir } = resolvePathContext(value, options);

  if (!trimmed) {
    return '';
  }

  const expanded = trimmed.replace(/^~(?=$|[\\/])/, normalizedHomeDir);
  const resolved = trimTrailingSeparators(
    pathApi.normalize(pathApi.resolve(expanded)),
    pathApi,
  );

  return effectivePlatform === 'win32'
    ? resolved.replace(/^([a-z]):/, (_, drive: string) => `${drive.toUpperCase()}:`)
    : resolved;
}

const WINDOWS_RESERVED_SEGMENT = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/i;

export function validateWorkspacePathInput(
  value: string,
  options: NormalizeWorkspacePathOptions = {},
): { normalizedPath: string | null; error: string | null } {
  const { trimmed, pathApi, effectivePlatform, normalizedHomeDir } = resolvePathContext(value, options);

  if (!trimmed) {
    return {
      normalizedPath: null,
      error: '工作区路径不能为空',
    };
  }

  const expanded = trimmed.replace(/^~(?=$|[\\/])/, normalizedHomeDir);
  if (!pathApi.isAbsolute(expanded)) {
    return {
      normalizedPath: null,
      error: '工作区路径必须是绝对路径',
    };
  }

  const normalizedPath = normalizeWorkspacePath(value, options);
  if (effectivePlatform === 'win32') {
    const segments = normalizedPath
      .split(/[\\/]+/)
      .filter((segment) => segment && !/^[a-z]:$/i.test(segment));

    if (segments.some((segment) => WINDOWS_RESERVED_SEGMENT.test(segment))) {
      return {
        normalizedPath: null,
        error: '工作区路径包含 Windows 保留名称',
      };
    }
  }

  return {
    normalizedPath,
    error: null,
  };
}
