import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, Loader2, RotateCcw, Shuffle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  appendStudioSkinQuery,
  applyStudioSkin,
  fetchStudioSkinRegistry,
  fetchStudioSkins,
  fetchStudioRuntime,
  startStudioRuntime,
  retryStudioRuntime,
  subscribeStudioRuntimeChanged,
  type StudioSkinRegistryResponse,
} from '@/lib/studio';
import {
  confirmStudioSkinApplied,
  createStudioSkinSession,
  recordStudioSkinOnLeave,
  selectEntryStudioSkin,
  selectManualStudioSkin,
} from '@/lib/studio-skins';
import { useChatStore } from '@/stores/chat';
import type { StudioRuntimeSnapshot } from '@/types/studio';

const statusCopyMap: Record<string, string> = {
  idle: 'idle',
  starting: 'starting',
  ready: 'ready',
  error: 'error',
  'python-missing': 'error',
  'runtime-error': 'error',
  restarting: 'restarting',
  stopping: 'stopping',
};

type StudioWebViewElement = HTMLElement & {
  executeJavaScript: (code: string, userGesture?: boolean) => Promise<unknown>;
  setAutoResize?: (options: {
    width?: boolean;
    height?: boolean;
    horizontal?: boolean;
    vertical?: boolean;
  }) => void;
};

type StudioBrowserFrameWindow = Window & {
  __applyStudioSkinRuntimeResult?: (result: unknown) => Promise<boolean> | boolean;
};

const STUDIO_FRAME_PROXY_PREFIX = '/api/studio/frame';

function resolveBrowserStudioFrameUrl(resolvedUrl: string, focusedAgentId: string): string {
  const trimmedUrl = resolvedUrl.trim();
  if (!trimmedUrl) {
    return '';
  }

  try {
    const runtimeUrl = new URL(trimmedUrl);
    const proxyUrl = new URL(`${STUDIO_FRAME_PROXY_PREFIX}${runtimeUrl.pathname}`, window.location.origin);
    runtimeUrl.searchParams.forEach((value, key) => {
      proxyUrl.searchParams.set(key, value);
    });
    if (focusedAgentId) {
      proxyUrl.searchParams.set('focusAgentId', focusedAgentId);
    } else {
      proxyUrl.searchParams.delete('focusAgentId');
    }
    return `${proxyUrl.pathname}${proxyUrl.search}`;
  } catch {
    return trimmedUrl;
  }
}

export function Studio({ active = true }: { active?: boolean }) {
  const { t } = useTranslation('studio');
  const currentAgentId = useChatStore((s) => s.currentAgentId);
  const [runtime, setRuntime] = useState<StudioRuntimeSnapshot | null>(null);
  const [skinRegistry, setSkinRegistry] = useState<StudioSkinRegistryResponse>(() => ({
    defaultFallbackSkinKey: 'lodge-default',
    currentAppliedSkinKey: 'lodge-default',
    skins: [
      {
        key: 'lodge-default',
        name: 'Lodge Default',
        manifestPath: 'lodge-default/manifest.json',
        enabled: true,
        selectable: true,
        isDefaultFallback: true,
      },
    ],
  }));
  const [skinRegistryReady, setSkinRegistryReady] = useState(false);
  const skinSessionRef = useRef(createStudioSkinSession(skinRegistry.skins));
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const skinSyncKeyRef = useRef<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState(false);
  const [switchingSkin, setSwitchingSkin] = useState(false);
  const [syncingSkin, setSyncingSkin] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const runtimeShellRef = useRef<HTMLDivElement | null>(null);
  const webviewRef = useRef<StudioWebViewElement | null>(null);
  const webviewDomReadyRef = useRef(false);
  const focusedAgentIdRef = useRef('');
  const [studioSkinKey, setStudioSkinKey] = useState<string | null>(null);
  const [surfaceReady, setSurfaceReady] = useState(active);
  const [surfaceNonce, setSurfaceNonce] = useState(0);

  const loadRuntime = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const snapshot = await fetchStudioRuntime();
      if (snapshot.status === 'idle') {
        setRuntime({
          ...snapshot,
          status: 'starting',
          lastError: null,
        });
        setRuntime(await startStudioRuntime());
      } else {
        setRuntime(snapshot);
      }
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : String(caughtError));
      setRuntime(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRuntime();
  }, [loadRuntime]);

  useEffect(() => subscribeStudioRuntimeChanged((snapshot) => {
    setRuntime(snapshot);
    setError(null);
    setLoading(false);
  }), []);

  useEffect(() => {
    let cancelled = false;

    void fetchStudioSkinRegistry()
      .then((registry) => {
        if (cancelled) {
          return;
        }
        setSkinRegistry(registry);
        skinSessionRef.current = createStudioSkinSession(registry.skins);
        setSkinRegistryReady(true);
      })
      .catch(() => {
        if (cancelled) {
          return;
        }
        skinSessionRef.current = createStudioSkinSession(skinRegistry.skins);
        setSkinRegistryReady(true);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const session = skinSessionRef.current;
    if (!session || !skinRegistryReady) {
      return;
    }

    if (!active) {
      if (session.currentSkinKey) {
        recordStudioSkinOnLeave(session);
        session.currentSkinKey = null;
      }
      skinSyncKeyRef.current = null;
      setStudioSkinKey(null);
      return;
    }

    if (!studioSkinKey) {
      const nextSkinKey = selectEntryStudioSkin(session);
      if (nextSkinKey) {
        setStudioSkinKey(nextSkinKey);
      }
      skinSyncKeyRef.current = null;
    }
  }, [active, skinRegistryReady, studioSkinKey, skinRegistry.defaultFallbackSkinKey]);

  const resolvedUrl = typeof runtime?.resolvedUrl === 'string' ? runtime.resolvedUrl.trim() : '';
  const focusedAgentId = typeof currentAgentId === 'string' ? currentAgentId.trim() : '';
  focusedAgentIdRef.current = focusedAgentId;
  const runtimeStatus = typeof runtime?.status === 'string'
    ? runtime.status.trim().toLowerCase()
    : '';
  const runtimeIssueText = [
    typeof runtime?.lastError === 'string' ? runtime.lastError.trim() : '',
    typeof runtime?.error === 'string' ? runtime.error.trim() : '',
    typeof runtime?.message === 'string' ? runtime.message.trim() : '',
  ].find((value) => value.length > 0) ?? '';
  const resolvedStudioRuntimeUrl = appendStudioSkinQuery(resolvedUrl, studioSkinKey);
  const runtimeInstanceKey = runtime?.runtimeInstanceId != null
    ? `${String(runtime.runtimeInstanceId)}:${studioSkinKey ?? 'fallback'}:${surfaceNonce}`
    : `${resolvedStudioRuntimeUrl || 'studio-runtime'}:${surfaceNonce}`;
  const hasElectronRenderer = Boolean(window.electron?.ipcRenderer);
  const browserFrameUrl = resolveBrowserStudioFrameUrl(resolvedStudioRuntimeUrl, focusedAgentId);
  const selectableSkinCount = useMemo(
    () => skinRegistry.skins.filter((skin) => skin.enabled && skin.selectable).length,
    [skinRegistry.skins],
  );
  const activeSkinName =
    skinRegistry.skins.find((skin) => skin.key === studioSkinKey)?.name
      ?? skinRegistry.skins.find((skin) => skin.key === skinRegistry.currentAppliedSkinKey)?.name
      ?? null;
  const canRenderRuntimeSurface = skinRegistryReady && runtimeStatus === 'ready' && resolvedUrl.length > 0 && Boolean(studioSkinKey);
  const canRenderWebview = active && surfaceReady && canRenderRuntimeSurface && hasElectronRenderer;
  const canRenderBrowserFrame = active && surfaceReady && canRenderRuntimeSurface && !hasElectronRenderer;
  const showSurfacePrimingMask = active && !surfaceReady && canRenderRuntimeSurface;
  const showInitializingMask = retrying || runtimeStatus === 'starting' || runtimeStatus === 'restarting';

  const dispatchStudioSkinRuntimeResult = useCallback(async (result: unknown): Promise<boolean> => {
    const runtimePayload = JSON.stringify(result);

    if (hasElectronRenderer && webviewRef.current && webviewDomReadyRef.current) {
      try {
        const response = await webviewRef.current.executeJavaScript(
          `window.__applyStudioSkinRuntimeResult ? window.__applyStudioSkinRuntimeResult(${runtimePayload}) : false;`,
          false,
        );
        return response === true;
      } catch {
        return false;
      }
    }

    const frameWindow = iframeRef.current?.contentWindow as StudioBrowserFrameWindow | null;
    if (frameWindow && typeof frameWindow.__applyStudioSkinRuntimeResult === 'function') {
      try {
        const response = await frameWindow.__applyStudioSkinRuntimeResult(result);
        return response === true;
      } catch {
        return false;
      }
    }

    if (frameWindow) {
      frameWindow.postMessage({ type: 'xclaw:studio-skin-apply-result', result }, window.location.origin);
      return true;
    }

    return false;
  }, [hasElectronRenderer]);

  const syncRuntimeSkinSelection = useCallback(async () => {
    const requestedSkinKey = typeof studioSkinKey === 'string' ? studioSkinKey.trim() : '';
    if (!requestedSkinKey || skinSyncKeyRef.current === requestedSkinKey) {
      return;
    }

    setSyncingSkin(true);
    try {
      const snapshot = await fetchStudioSkins();
      const session = skinSessionRef.current;
      if (!session) {
        return;
      }
      const currentAppliedSkinKey =
        typeof snapshot.currentAppliedSkinKey === 'string' && snapshot.currentAppliedSkinKey.trim()
          ? snapshot.currentAppliedSkinKey.trim()
          : '';
      const fallbackOrRequestedSkinKey = currentAppliedSkinKey || snapshot.defaultFallbackSkinKey || requestedSkinKey;
      const runtimeNeedsApply = currentAppliedSkinKey !== requestedSkinKey;
      const result = runtimeNeedsApply
        ? await applyStudioSkin({ skinKey: requestedSkinKey })
        : {
            ok: true,
            appliedSkinKey: fallbackOrRequestedSkinKey,
            currentAppliedSkinKey: fallbackOrRequestedSkinKey,
            fallbackApplied: false,
            refreshedAssets: [],
            reason: null,
            defaultFallbackSkinKey: snapshot.defaultFallbackSkinKey,
            skins: snapshot.skins,
          };
      if (runtimeNeedsApply) {
        const runtimeUpdated = await dispatchStudioSkinRuntimeResult(result);
        if (!runtimeUpdated) {
          setSurfaceNonce((value) => value + 1);
        }
      }
      confirmStudioSkinApplied(session, result);
      const normalizedSkinKey = session.currentSkinKey || result.currentAppliedSkinKey || snapshot.currentAppliedSkinKey || snapshot.defaultFallbackSkinKey || requestedSkinKey;
      setStudioSkinKey(normalizedSkinKey);
      setSkinRegistry((previous) => ({
        ...previous,
        currentAppliedSkinKey:
          result.currentAppliedSkinKey ?? result.appliedSkinKey ?? snapshot.currentAppliedSkinKey ?? normalizedSkinKey,
        defaultFallbackSkinKey: result.defaultFallbackSkinKey || snapshot.defaultFallbackSkinKey || previous.defaultFallbackSkinKey,
        skins: result.skins.length > 0 ? result.skins : snapshot.skins.length > 0 ? snapshot.skins : previous.skins,
      }));
      skinSyncKeyRef.current = normalizedSkinKey;
    } catch {
      return;
    } finally {
      setSyncingSkin(false);
    }
  }, [dispatchStudioSkinRuntimeResult, studioSkinKey]);

  useEffect(() => {
    if (!active) {
      setSurfaceReady(false);
      return;
    }

    let firstFrame = 0;
    let secondFrame = 0;
    firstFrame = window.requestAnimationFrame(() => {
      secondFrame = window.requestAnimationFrame(() => {
        setSurfaceReady(true);
      });
    });

    return () => {
      window.cancelAnimationFrame(firstFrame);
      window.cancelAnimationFrame(secondFrame);
    };
  }, [active, runtimeInstanceKey]);

  const statusLabel = (() => {
    if (loading && !runtime) {
      return t('runtime.loading');
    }
    if (error) {
      return t('runtime.error');
    }
    if (runtimeIssueText) {
      return t('runtime.error');
    }
    const statusKey = statusCopyMap[runtimeStatus];
    if (statusKey) {
      return t(`runtime.${statusKey}`);
    }
    return runtimeStatus ? runtimeStatus : t('runtime.unknown');
  })();

  const handleRetry = useCallback(async () => {
    setRetrying(true);
    setError(null);
    try {
      const nextRuntime = await retryStudioRuntime({ repairEnvironment: true });
      setRuntime(nextRuntime);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : String(caughtError));
    } finally {
      setRetrying(false);
      setLoading(false);
    }
  }, []);

  const syncEmbeddedBounds = useCallback(() => {
    const shell = runtimeShellRef.current;
    const webview = webviewRef.current;
    if (!shell || !webview) {
      return;
    }

    const width = Math.max(Math.round(shell.clientWidth), 0);
    const height = Math.max(Math.round(shell.clientHeight), 0);
    if (width > 0) {
      webview.style.width = `${width}px`;
    }
    if (height > 0) {
      webview.style.height = `${height}px`;
    }
    webview.setAutoResize?.({
      width: true,
      height: true,
      horizontal: true,
      vertical: true,
    });
  }, []);

  const syncFocusedAgentMarker = useCallback(() => {
    const webview = webviewRef.current;
    if (!webview || !webviewDomReadyRef.current || typeof webview.executeJavaScript !== 'function') {
      return;
    }

    const script = `window.__setFocusedAgentId && window.__setFocusedAgentId(${JSON.stringify(focusedAgentIdRef.current)});`;
    void webview.executeJavaScript(script, false).catch(() => {});
  }, []);

  useEffect(() => {
    if (!canRenderWebview) {
      webviewDomReadyRef.current = false;
      return;
    }
    const shell = runtimeShellRef.current;
    const webview = webviewRef.current;
    if (!shell || !webview) {
      return;
    }
    webviewDomReadyRef.current = false;

    const syncWithDelay = () => {
      syncEmbeddedBounds();
      syncFocusedAgentMarker();
      void syncRuntimeSkinSelection();
      window.setTimeout(() => {
        syncEmbeddedBounds();
        syncFocusedAgentMarker();
        void syncRuntimeSkinSelection();
      }, 250);
    };

    const handleDomReady = () => {
      webviewDomReadyRef.current = true;
      syncWithDelay();
    };

    webview.addEventListener('dom-ready', handleDomReady);
    webview.addEventListener('did-stop-loading', handleDomReady);
    const observer = typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(() => {
        syncEmbeddedBounds();
      });
    observer?.observe(shell);

    syncEmbeddedBounds();

    return () => {
      webviewDomReadyRef.current = false;
      webview.removeEventListener('dom-ready', handleDomReady);
      webview.removeEventListener('did-stop-loading', handleDomReady);
      observer?.disconnect();
    };
  }, [canRenderWebview, runtimeInstanceKey, syncEmbeddedBounds, syncFocusedAgentMarker, syncRuntimeSkinSelection]);

  useEffect(() => {
    if (!canRenderWebview) {
      return;
    }
    syncFocusedAgentMarker();
  }, [canRenderWebview, runtimeInstanceKey, focusedAgentId, syncFocusedAgentMarker]);

  const handleManualSkinSwitch = useCallback(async () => {
    const session = skinSessionRef.current;
    if (!session || switchingSkin) {
      return;
    }

    const nextSkinKey = selectManualStudioSkin(session, Math.random, studioSkinKey);
    if (!nextSkinKey) {
      return;
    }

    setSwitchingSkin(true);
    setError(null);
    try {
      const result = await applyStudioSkin({ skinKey: nextSkinKey });
      const runtimeUpdated = await dispatchStudioSkinRuntimeResult(result);
      if (!runtimeUpdated) {
        setSurfaceNonce((value) => value + 1);
      }
      confirmStudioSkinApplied(session, result);
      setStudioSkinKey(session.currentSkinKey);
      setSkinRegistry((previous) => ({
        ...previous,
        currentAppliedSkinKey:
          result.currentAppliedSkinKey ?? result.appliedSkinKey ?? previous.currentAppliedSkinKey ?? previous.defaultFallbackSkinKey,
        defaultFallbackSkinKey: result.defaultFallbackSkinKey || previous.defaultFallbackSkinKey,
        skins: result.skins.length > 0 ? result.skins : previous.skins,
      }));
      skinSyncKeyRef.current = session.currentSkinKey;
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : String(caughtError));
    } finally {
      setSwitchingSkin(false);
    }
  }, [dispatchStudioSkinRuntimeResult, switchingSkin]);

  return (
    <div className="app-chat-shell relative flex h-full min-h-0 flex-1 flex-col bg-background transition-colors duration-500">
      <div className="flex min-h-0 flex-1 flex-col p-3 md:p-4 lg:p-5">
        <div
          ref={runtimeShellRef}
          className="studio-runtime-shell relative flex min-h-0 flex-1 overflow-hidden rounded-xl border border-border/70 bg-[hsl(var(--surface-elevated))] shadow-sm"
        >
          {active && selectableSkinCount > 1 ? (
            <div className="absolute right-3 top-3 z-20 flex items-center gap-2">
              {activeSkinName ? (
                <div className="hidden rounded-full border border-border/70 bg-[hsl(var(--surface-elevated)/0.92)] px-3 py-1 text-[12px] font-medium text-foreground/64 shadow-sm md:block">
                  {activeSkinName}
                </div>
              ) : null}
              <button
                type="button"
                onClick={() => {
                  void handleManualSkinSwitch();
                }}
                disabled={switchingSkin || syncingSkin || showInitializingMask || showSurfacePrimingMask}
                className="inline-flex h-9 items-center gap-2 rounded-full border border-border/70 bg-[hsl(var(--surface-elevated)/0.96)] px-3 text-[12px] font-medium text-foreground shadow-sm transition-colors hover:bg-[hsl(var(--surface-hover)/0.55)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {switchingSkin ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shuffle className="h-4 w-4" />}
                <span>{switchingSkin || syncingSkin ? t('actions.switchingSkin') : t('actions.shuffleSkin')}</span>
              </button>
            </div>
          ) : null}

          {showInitializingMask || showSurfacePrimingMask ? (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-[hsl(var(--background)/0.9)] px-6">
              <div className="w-full max-w-[360px] rounded-xl border border-border/70 bg-[hsl(var(--surface-elevated))] p-5 text-center shadow-lg">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-border/70 bg-[hsl(var(--surface-elevated)/0.94)] text-foreground/72">
                  <Loader2 className="h-5 w-5 animate-spin" />
                </div>
                <h2 className="mt-4 text-[18px] font-semibold tracking-tight text-foreground">
                  {showSurfacePrimingMask ? t('runtime.loading') : t('initializing.title')}
                </h2>
                <p className="mt-2 text-[13px] font-medium leading-[1.7] text-foreground/62">
                  {showSurfacePrimingMask ? t('empty.description') : t('initializing.description')}
                </p>
              </div>
            </div>
          ) : null}

          {canRenderWebview ? (
            <webview
              ref={(node) => {
                webviewRef.current = node as StudioWebViewElement | null;
              }}
              key={runtimeInstanceKey}
              src={resolvedStudioRuntimeUrl}
              partition="xclaw-studio"
              webpreferences="contextIsolation=yes,sandbox=yes"
              className="h-full w-full"
              style={{
                width: '100%',
                height: '100%',
                flex: '1 1 auto',
              }}
            />
          ) : canRenderBrowserFrame ? (
            <iframe
              ref={iframeRef}
              key={`${runtimeInstanceKey}:${browserFrameUrl}`}
              title={t('runtime.frameTitle', 'studio.runtimeFrame')}
              src={browserFrameUrl}
              className="h-full w-full border-0"
              onLoad={() => {
                void syncRuntimeSkinSelection();
              }}
              data-testid="studio-runtime-frame"
            />
          ) : active ? (
            <div data-testid="studio-empty-state" className="grid h-full min-h-[520px] w-full place-items-center px-6 py-8">
              <div className="mx-auto w-full max-w-[560px] rounded-xl border border-border/70 bg-[hsl(var(--surface-elevated))] p-5 text-center shadow-md">
                <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl border border-border/70 bg-[hsl(var(--surface-elevated)/0.94)] text-foreground/72">
                  {loading && !runtime ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <AlertCircle className="h-5 w-5" />
                  )}
                </div>
                <h1 className="mt-4 text-[20px] font-semibold tracking-tight text-foreground">
                  {t('empty.title')}
                </h1>
                <p className="mt-2 text-[13px] font-medium leading-[1.7] text-foreground/62">
                  {t('empty.description')}
                </p>
                <div className="mt-4 space-y-2 text-[12px] font-medium text-foreground/56">
                  <div>{statusLabel}</div>
                  {resolvedUrl ? (
                    <div className="truncate rounded-md border border-border/60 bg-background/60 px-3 py-2 font-mono text-[11px] text-foreground/66">
                      {resolvedUrl}
                    </div>
                  ) : null}
                  {error ? (
                    <div className="rounded-md border border-rose-200/80 bg-rose-500/6 px-3 py-2 text-rose-700">
                      {error}
                    </div>
                  ) : null}
                  {runtimeIssueText ? (
                    <div className="rounded-md border border-rose-200/80 bg-rose-500/6 px-3 py-2 text-rose-700">
                      {runtimeIssueText}
                    </div>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    void handleRetry();
                  }}
                  disabled={retrying}
                  className="mt-5 inline-flex h-8 items-center gap-2 rounded-md border border-border/70 bg-[hsl(var(--surface-elevated)/0.88)] px-4 text-[13px] font-medium text-foreground shadow-sm transition-colors hover:bg-[hsl(var(--surface-hover)/0.5)] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {retrying ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
                  <span>{t('actions.retry')}</span>
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default Studio;
