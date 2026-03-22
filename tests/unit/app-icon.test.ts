import { beforeEach, describe, expect, it, vi } from 'vitest';

const createFromPathMock = vi.fn();
const dockSetIconMock = vi.fn();

vi.mock('electron', () => ({
  app: {
    isPackaged: false,
    dock: {
      setIcon: (...args: unknown[]) => dockSetIconMock(...args),
    },
  },
  nativeImage: {
    createFromPath: (...args: unknown[]) => createFromPathMock(...args),
  },
}));

describe('app icon wiring', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    createFromPathMock.mockReturnValue({
      isEmpty: () => false,
    });
  });

  it('applies the dock icon on macOS in development', async () => {
    const { applyPlatformAppIcon } = await import('@electron/main/app-icon');

    applyPlatformAppIcon('darwin');

    expect(createFromPathMock).toHaveBeenCalled();
    expect(dockSetIconMock).toHaveBeenCalledTimes(1);
  });

  it('does not touch the dock icon on Windows', async () => {
    const { applyPlatformAppIcon } = await import('@electron/main/app-icon');

    applyPlatformAppIcon('win32');

    expect(dockSetIconMock).not.toHaveBeenCalled();
  });
});
