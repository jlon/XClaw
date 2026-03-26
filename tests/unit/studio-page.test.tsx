import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import { Studio } from '@/pages/Studio';

const {
  chatState,
  studioRuntimeState,
  executeJavaScriptMock,
  startStudioRuntimeMock,
} = vi.hoisted(() => ({
  chatState: {
    currentAgentId: 'planner',
  },
  studioRuntimeState: {
    status: 'ready',
    resolvedUrl: 'http://127.0.0.1:3211/electron-standalone?embedded=1&readonly=1',
    runtimeInstanceId: 'runtime-1',
    lastError: null,
  },
  executeJavaScriptMock: vi.fn(() => Promise.resolve(undefined)),
  startStudioRuntimeMock: vi.fn(async () => studioRuntimeState),
}));

vi.mock('@/stores/chat', () => ({
  useChatStore: (selector: (state: typeof chatState) => unknown) => selector(chatState),
}));

vi.mock('@/lib/studio', () => ({
  fetchStudioRuntime: vi.fn(async () => studioRuntimeState),
  startStudioRuntime: (...args: unknown[]) => startStudioRuntimeMock(...args),
  retryStudioRuntime: vi.fn(),
  subscribeStudioSurfaceSuspend: vi.fn(() => () => {}),
  subscribeStudioRuntimeChanged: vi.fn(() => () => {}),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

beforeAll(() => {
  class ResizeObserverMock {
    observe() {}
    disconnect() {}
  }

  global.ResizeObserver = ResizeObserverMock as typeof ResizeObserver;
  const originalCreateElement = document.createElement.bind(document);
  vi.spyOn(document, 'createElement').mockImplementation(((tagName: string, options?: ElementCreationOptions) => {
    const element = originalCreateElement(tagName, options);
    if (tagName.toLowerCase() === 'webview') {
      Object.assign(element, {
        executeJavaScript: executeJavaScriptMock,
        setAutoResize: () => {},
      });
    }
    return element;
  }) as typeof document.createElement);
});

describe('studio page', () => {
  beforeEach(() => {
    executeJavaScriptMock.mockClear();
    startStudioRuntimeMock.mockReset();
    startStudioRuntimeMock.mockImplementation(async () => studioRuntimeState);
    chatState.currentAgentId = 'planner';
    studioRuntimeState.status = 'ready';
    studioRuntimeState.resolvedUrl = 'http://127.0.0.1:3211/electron-standalone?embedded=1&readonly=1';
    studioRuntimeState.runtimeInstanceId = 'runtime-1';
    studioRuntimeState.lastError = null;
  });

  it('centers the empty-state card when the runtime is unavailable', async () => {
    studioRuntimeState.status = 'runtime-error';
    studioRuntimeState.resolvedUrl = null;
    studioRuntimeState.lastError = 'Studio runtime exited with code 1';

    render(<Studio />);

    await waitFor(() => {
      expect(screen.getByTestId('studio-empty-state')).toBeInTheDocument();
    });

    expect(screen.getByTestId('studio-empty-state')).toHaveClass('grid', 'w-full', 'place-items-center');
  });

  it('does not execute the focused-agent marker script before webview dom-ready', async () => {
    render(<Studio />);

    await waitFor(() => {
      expect(document.querySelector('webview')).toBeTruthy();
    });

    expect(executeJavaScriptMock).not.toHaveBeenCalled();
  });

  it('injects the focused-agent marker script after webview dom-ready and on agent changes', async () => {
    const { rerender } = render(<Studio />);

    await waitFor(() => {
      expect(document.querySelector('webview')).toBeTruthy();
    });

    const webview = document.querySelector('webview');
    expect(webview).toBeTruthy();

    await act(async () => {
      webview?.dispatchEvent(new Event('dom-ready'));
    });

    await waitFor(() => {
      expect(executeJavaScriptMock).toHaveBeenCalledWith(
        expect.stringContaining('__setFocusedAgentId("planner")'),
        false,
      );
    });

    executeJavaScriptMock.mockClear();
    chatState.currentAgentId = 'main';
    rerender(<Studio />);

    await waitFor(() => {
      expect(executeJavaScriptMock).toHaveBeenCalledWith(
        expect.stringContaining('__setFocusedAgentId("main")'),
        false,
      );
    });
  });

  it('surfaces startup errors when studio is idle and explicit start fails', async () => {
    studioRuntimeState.status = 'idle';
    studioRuntimeState.resolvedUrl = null;
    studioRuntimeState.lastError = null;
    startStudioRuntimeMock.mockRejectedValueOnce(new Error('studio bootstrap failed'));

    render(<Studio />);

    await waitFor(() => {
      expect(screen.getByText('studio bootstrap failed')).toBeInTheDocument();
    });
  });
});
