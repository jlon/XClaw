import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle, Loader2, RotateCcw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  fetchStudioRuntime,
  retryStudioRuntime,
  subscribeStudioRuntimeChanged,
} from '@/lib/studio';
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

export function Studio() {
  const { t } = useTranslation('studio');
  const currentAgentId = useChatStore((s) => s.currentAgentId);
  const [runtime, setRuntime] = useState<StudioRuntimeSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const runtimeShellRef = useRef<HTMLDivElement | null>(null);
  const webviewRef = useRef<StudioWebViewElement | null>(null);
  const webviewDomReadyRef = useRef(false);
  const focusedAgentIdRef = useRef('');

  const loadRuntime = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRuntime(await fetchStudioRuntime());
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
  const runtimeInstanceKey = runtime?.runtimeInstanceId != null
    ? String(runtime.runtimeInstanceId)
    : resolvedUrl || 'studio-runtime';
  const canRenderWebview = runtimeStatus === 'ready' && resolvedUrl.length > 0;
  const showInitializingMask = retrying || runtimeStatus === 'starting' || runtimeStatus === 'restarting';

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
      window.setTimeout(() => {
        syncEmbeddedBounds();
        syncFocusedAgentMarker();
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
  }, [canRenderWebview, runtimeInstanceKey, syncEmbeddedBounds, syncFocusedAgentMarker]);

  useEffect(() => {
    if (!canRenderWebview) {
      return;
    }
    syncFocusedAgentMarker();
  }, [canRenderWebview, runtimeInstanceKey, focusedAgentId, syncFocusedAgentMarker]);

  return (
    <div className="app-chat-shell relative flex h-full min-h-0 flex-1 flex-col bg-[radial-gradient(circle_at_top_left,rgba(15,23,42,0.04),transparent_42%),linear-gradient(180deg,hsl(var(--background))_0%,hsl(var(--background))_100%)] transition-colors duration-500">
      <div className="flex min-h-0 flex-1 flex-col p-3 md:p-4 lg:p-5">
        <div
          ref={runtimeShellRef}
          className="studio-runtime-shell relative flex min-h-0 flex-1 overflow-hidden rounded-[30px] border border-border/70 bg-transparent shadow-[0_18px_48px_rgba(15,23,42,0.07),inset_0_1px_0_rgba(255,255,255,0.72)]"
        >
          {showInitializingMask ? (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-[hsl(var(--background)/0.72)] px-6 backdrop-blur-sm">
              <div className="w-full max-w-[360px] rounded-[24px] border border-border/70 bg-[hsl(var(--surface-base)/0.96)] p-6 text-center shadow-[0_18px_44px_rgba(15,23,42,0.08)]">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-border/70 bg-[hsl(var(--surface-elevated)/0.94)] text-foreground/72">
                  <Loader2 className="h-5 w-5 animate-spin" />
                </div>
                <h2 className="mt-4 text-[18px] font-semibold tracking-tight text-foreground">
                  {t('initializing.title')}
                </h2>
                <p className="mt-2 text-[13px] font-medium leading-[1.7] text-foreground/62">
                  {t('initializing.description')}
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
              src={resolvedUrl}
              partition="xclaw-studio"
              webpreferences="contextIsolation=yes,sandbox=yes"
              className="h-full w-full"
              style={{
                width: '100%',
                height: '100%',
                flex: '1 1 auto',
              }}
            />
          ) : (
            <div data-testid="studio-empty-state" className="grid h-full min-h-[520px] w-full place-items-center px-6 py-8">
              <div className="mx-auto w-full max-w-[560px] rounded-[24px] border border-border/70 bg-[hsl(var(--surface-base)/0.9)] p-6 text-center shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
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
                    <div className="truncate rounded-[14px] border border-border/60 bg-background/60 px-3 py-2 font-mono text-[11px] text-foreground/66">
                      {resolvedUrl}
                    </div>
                  ) : null}
                  {error ? (
                    <div className="rounded-[14px] border border-rose-200/80 bg-rose-500/6 px-3 py-2 text-rose-700">
                      {error}
                    </div>
                  ) : null}
                  {runtimeIssueText ? (
                    <div className="rounded-[14px] border border-rose-200/80 bg-rose-500/6 px-3 py-2 text-rose-700">
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
                  className="mt-5 inline-flex h-10 items-center gap-2 rounded-[14px] border border-border/70 bg-[hsl(var(--surface-elevated)/0.88)] px-4 text-[13px] font-medium text-foreground transition-colors hover:bg-[hsl(var(--surface-hover)/0.5)] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {retrying ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
                  <span>{t('actions.retry')}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Studio;
