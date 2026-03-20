import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('applyUserDataDirOverride', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('does nothing when CLAWX_USER_DATA_DIR is not set', async () => {
    const ensureDirMock = vi.fn();
    const setPathMock = vi.fn();
    const infoMock = vi.fn();
    const warnMock = vi.fn();
    const { applyUserDataDirOverride } = await import('@electron/main/user-data-override');

    const result = applyUserDataDirOverride({
      env: {},
      ensureDir: ensureDirMock,
      app: {
        setPath: setPathMock,
      },
      logger: {
        info: infoMock,
        warn: warnMock,
      },
    });

    expect(result).toBeNull();
    expect(ensureDirMock).not.toHaveBeenCalled();
    expect(setPathMock).not.toHaveBeenCalled();
    expect(infoMock).not.toHaveBeenCalled();
    expect(warnMock).not.toHaveBeenCalled();
  });

  it('overrides userData when CLAWX_USER_DATA_DIR is provided', async () => {
    const ensureDirMock = vi.fn();
    const setPathMock = vi.fn();
    const infoMock = vi.fn();
    const warnMock = vi.fn();
    const { applyUserDataDirOverride } = await import('@electron/main/user-data-override');

    const result = applyUserDataDirOverride({
      env: {
        CLAWX_USER_DATA_DIR: '/tmp/clawx-e2e-user-data',
      },
      ensureDir: ensureDirMock,
      app: {
        setPath: setPathMock,
      },
      logger: {
        info: infoMock,
        warn: warnMock,
      },
    });

    expect(result).toBe('/tmp/clawx-e2e-user-data');
    expect(ensureDirMock).toHaveBeenCalledWith('/tmp/clawx-e2e-user-data');
    expect(setPathMock).toHaveBeenCalledWith('userData', '/tmp/clawx-e2e-user-data');
    expect(infoMock).toHaveBeenCalledWith('Overriding userData directory: /tmp/clawx-e2e-user-data');
    expect(warnMock).not.toHaveBeenCalled();
  });
});
