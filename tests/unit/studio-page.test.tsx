import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import { Studio } from '@/pages/Studio';

const {
  chatState,
  studioRuntimeState,
  executeJavaScriptMock,
  startStudioRuntimeMock,
  fetchStudioSkinRegistryMock,
  fetchStudioSkinsMock,
  applyStudioSkinMock,
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
  fetchStudioSkinRegistryMock: vi.fn(async () => ({
    defaultFallbackSkinKey: 'lodge-default',
    currentAppliedSkinKey: 'lodge-default',
    skins: [
      { key: 'lodge-default', name: 'Lodge Default', manifestPath: 'lodge-default/manifest.json', enabled: true, selectable: true, isDefaultFallback: true },
      { key: 'ember-cabin', name: 'Ember Cabin', manifestPath: 'ember-cabin/manifest.json', enabled: true, selectable: true, isDefaultFallback: false },
      { key: 'frost-ops', name: 'Frost Ops', manifestPath: 'frost-ops/manifest.json', enabled: true, selectable: true, isDefaultFallback: false },
    ],
  })),
  fetchStudioSkinsMock: vi.fn(async () => ({
    defaultFallbackSkinKey: 'lodge-default',
    currentAppliedSkinKey: 'ember-cabin',
    skins: [
      { key: 'lodge-default', name: 'Lodge Default', manifestPath: 'lodge-default/manifest.json', enabled: true, selectable: true, isDefaultFallback: true },
      { key: 'ember-cabin', name: 'Ember Cabin', manifestPath: 'ember-cabin/manifest.json', enabled: true, selectable: true, isDefaultFallback: false },
      { key: 'frost-ops', name: 'Frost Ops', manifestPath: 'frost-ops/manifest.json', enabled: true, selectable: true, isDefaultFallback: false },
    ],
  })),
  applyStudioSkinMock: vi.fn(async ({ skinKey }: { skinKey: string }) => ({
    ok: true,
    appliedSkinKey: skinKey,
    currentAppliedSkinKey: skinKey,
    fallbackApplied: false,
    refreshedAssets: ['office_bg_small.webp'],
    reason: null,
    defaultFallbackSkinKey: 'lodge-default',
    skins: [
      { key: 'lodge-default', name: 'Lodge Default', manifestPath: 'lodge-default/manifest.json', enabled: true, selectable: true, isDefaultFallback: true },
      { key: 'ember-cabin', name: 'Ember Cabin', manifestPath: 'ember-cabin/manifest.json', enabled: true, selectable: true, isDefaultFallback: false },
      { key: 'frost-ops', name: 'Frost Ops', manifestPath: 'frost-ops/manifest.json', enabled: true, selectable: true, isDefaultFallback: false },
    ],
  })),
}));

vi.mock('@/stores/chat', () => ({
  useChatStore: (selector: (state: typeof chatState) => unknown) => selector(chatState),
}));

vi.mock('@/lib/studio', () => ({
  appendStudioSkinQuery: vi.fn((url: string, skinKey?: string | null) => {
    if (!url || !skinKey) {
      return url;
    }
    const nextUrl = new URL(url);
    nextUrl.searchParams.set('skinKey', skinKey);
    return nextUrl.toString();
  }),
  applyStudioSkin: (...args: unknown[]) => applyStudioSkinMock(...args),
  fetchStudioSkinRegistry: (...args: unknown[]) => fetchStudioSkinRegistryMock(...args),
  fetchStudioSkins: (...args: unknown[]) => fetchStudioSkinsMock(...args),
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
    fetchStudioSkinRegistryMock.mockClear();
    fetchStudioSkinsMock.mockClear();
    applyStudioSkinMock.mockClear();
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

  it('encodes the selected studio skin into the initial webview URL', async () => {
    render(<Studio />);

    await waitFor(() => {
      expect(document.querySelector('webview')).toBeTruthy();
    });

    expect(document.querySelector('webview')).toHaveAttribute(
      'src',
      expect.stringContaining('skinKey='),
    );
  });

  it('injects the focused-agent marker script after webview dom-ready', async () => {
    render(<Studio />);

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

  });

  it('renders a browser iframe fallback with the focused agent encoded in the URL when Electron is unavailable', async () => {
    const previousElectron = window.electron;
    // @ts-expect-error test explicitly simulates browser-only studio mode
    window.electron = undefined;

    try {
      render(<Studio />);

      await waitFor(() => {
        expect(screen.getByTitle('runtime.frameTitle')).toBeInTheDocument();
      });

      const frame = screen.getByTitle('runtime.frameTitle');
      expect(frame.tagName.toLowerCase()).toBe('iframe');
      expect(frame).toHaveAttribute('src', expect.stringContaining('/api/studio/frame/electron-standalone?'));
      expect(frame).toHaveAttribute('src', expect.stringContaining('focusAgentId=planner'));
      expect(frame).toHaveAttribute('src', expect.stringContaining('skinKey='));
      expect(frame).not.toHaveAttribute('src', expect.stringContaining('127.0.0.1:3211'));
      expect(document.querySelector('webview')).toBeNull();
    } finally {
      window.electron = previousElectron;
    }
  });

  it('shows the skin switch button and applies a new skin on click', async () => {
    render(<Studio />);

    const button = await screen.findByRole('button', { name: 'actions.shuffleSkin' });
    expect(button).toBeInTheDocument();

    await act(async () => {
      button.click();
    });

    await waitFor(() => {
      expect(applyStudioSkinMock).toHaveBeenCalledTimes(1);
    });
  });

  it('applies the selected entry skin when runtime assets are out of sync', async () => {
    const previousElectron = window.electron;
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0);
    // @ts-expect-error test explicitly simulates browser-only studio mode
    window.electron = undefined;

    try {
      render(<Studio />);

      const frame = await screen.findByTitle('runtime.frameTitle');

      await act(async () => {
        frame.dispatchEvent(new Event('load'));
      });

      await waitFor(() => {
        expect(applyStudioSkinMock).toHaveBeenCalledWith({ skinKey: 'lodge-default' });
      });
    } finally {
      randomSpy.mockRestore();
      window.electron = previousElectron;
    }
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
