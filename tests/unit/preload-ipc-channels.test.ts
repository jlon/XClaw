import { beforeEach, describe, expect, it, vi } from 'vitest';

const exposeInMainWorldMock = vi.fn();
const invokeMock = vi.fn();

vi.mock('electron', () => ({
  contextBridge: {
    exposeInMainWorld: (...args: unknown[]) => exposeInMainWorldMock(...args),
  },
  ipcRenderer: {
    invoke: (...args: unknown[]) => invokeMock(...args),
    on: vi.fn(),
    once: vi.fn(),
    removeListener: vi.fn(),
    removeAllListeners: vi.fn(),
  },
}));

describe('preload IPC allowlist', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('allows renderer calls to the setup environment IPC channels', async () => {
    await import('@electron/preload/index');

    const [, electronApi] = exposeInMainWorldMock.mock.calls.find(([name]) => name === 'electron') as [string, {
      ipcRenderer: { invoke: (channel: string, ...args: unknown[]) => unknown };
    }];

    electronApi.ipcRenderer.invoke('setup:environment-status');
    electronApi.ipcRenderer.invoke('setup:prepare-environment', { repair: true });

    expect(invokeMock).toHaveBeenNthCalledWith(1, 'setup:environment-status');
    expect(invokeMock).toHaveBeenNthCalledWith(2, 'setup:prepare-environment', { repair: true });
  });

  it('still blocks channels outside the preload allowlist', async () => {
    await import('@electron/preload/index');

    const [, electronApi] = exposeInMainWorldMock.mock.calls.find(([name]) => name === 'electron') as [string, {
      ipcRenderer: { invoke: (channel: string, ...args: unknown[]) => unknown };
    }];

    expect(() => {
      electronApi.ipcRenderer.invoke('setup:raw-internal');
    }).toThrow('Invalid IPC channel: setup:raw-internal');
  });
});
