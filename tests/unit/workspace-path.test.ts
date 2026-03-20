import { describe, expect, it } from 'vitest';
import { normalizeWorkspacePath, validateWorkspacePathInput } from '@electron/utils/workspace-path';

describe('normalizeWorkspacePath', () => {
  it('normalizes mac-style paths with home expansion and trailing separators', () => {
    expect(normalizeWorkspacePath('~/project/workspace/', {
      homeDir: '/Users/test',
      platform: 'darwin',
    })).toBe('/Users/test/project/workspace');
  });

  it('normalizes windows-style paths with drive-letter casing and slash cleanup', () => {
    expect(normalizeWorkspacePath('c:/Users/Alice/.openclaw/workspace/', {
      homeDir: 'C:\\Users\\Alice',
      platform: 'win32',
    })).toBe('C:\\Users\\Alice\\.openclaw\\workspace');
  });

  it('keeps UNC roots stable on windows', () => {
    expect(normalizeWorkspacePath('\\\\server\\share\\workspace\\', {
      homeDir: 'C:\\Users\\Alice',
      platform: 'win32',
    })).toBe('\\\\server\\share\\workspace');
  });
});

describe('validateWorkspacePathInput', () => {
  it('rejects relative paths', () => {
    expect(validateWorkspacePathInput('workspace/project', {
      homeDir: '/Users/test',
      platform: 'darwin',
    })).toEqual({
      normalizedPath: null,
      error: '工作区路径必须是绝对路径',
    });
  });

  it('rejects windows reserved device names', () => {
    expect(validateWorkspacePathInput('C:\\Users\\Alice\\CON', {
      homeDir: 'C:\\Users\\Alice',
      platform: 'win32',
    })).toEqual({
      normalizedPath: null,
      error: '工作区路径包含 Windows 保留名称',
    });
  });
});
