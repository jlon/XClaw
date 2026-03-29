import { useCallback, useEffect, useRef, useState, type CSSProperties, type MouseEvent as ReactMouseEvent } from 'react';
import { useLocation, useOutlet } from 'react-router-dom';
import { ChatSessionsPane } from './ChatSessionsPane';
import { Sidebar } from './Sidebar';
import { TitleBar } from './TitleBar';
import { getHostApiBase } from '@/lib/host-api';
import { isChatRoutePath, isChatSurfaceRoutePath, isStudioRoutePath, saveLastChatRoute } from '@/lib/studio';
import { cn } from '@/lib/utils';
import { Studio } from '@/pages/Studio';
import {
  SIDEBAR_RAIL_WIDTH,
  SIDEBAR_WIDTH_MAX,
  SIDEBAR_WIDTH_MIN,
  useSettingsStore,
} from '@/stores/settings';

const MAIN_WORKSPACE_MIN_WIDTH = 480;
const MAC_TRAFFIC_LIGHT_LEADING_WIDTH = 100;

function clampWallpaperLayerValue(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.min(max, Math.max(min, Math.round(value * 100) / 100));
}

export function MainLayout() {
  const location = useLocation();
  const outlet = useOutlet();
  const isMacDesktop = typeof window !== 'undefined' && window.electron?.platform === 'darwin';
  const isChatRoute = isChatRoutePath(location.pathname);
  const isChatSurfaceRoute = isChatSurfaceRoutePath(location.pathname);
  const isStudioRoute = isStudioRoutePath(location.pathname);
  const isSetupRoute = location.pathname.startsWith('/setup');
  const sidebarWidth = useSettingsStore((state) => state.sidebarWidth);
  const setSidebarWidth = useSettingsStore((state) => state.setSidebarWidth);
  const sidebarCollapsed = useSettingsStore((state) => state.sidebarCollapsed);
  const chatFocusMode = useSettingsStore((state) => ('chatFocusMode' in state ? state.chatFocusMode : false));
  const settingsInitialized = useSettingsStore((state) => ('initialized' in state ? state.initialized === true : true));
  const setupComplete = useSettingsStore((state) => ('setupComplete' in state ? state.setupComplete === true : true));
  const globalWallpaperEnabled = useSettingsStore((state) => ('globalWallpaperEnabled' in state ? state.globalWallpaperEnabled === true : false));
  const globalWallpaperOpacity = useSettingsStore((state) => ('globalWallpaperOpacity' in state ? state.globalWallpaperOpacity : 0.36));
  const globalWallpaperAssetKey = useSettingsStore((state) => ('globalWallpaperAssetKey' in state ? state.globalWallpaperAssetKey : ''));
  const syncGlobalWallpaperState = useSettingsStore((state) => ('syncGlobalWallpaperState' in state ? state.syncGlobalWallpaperState : (() => undefined)));
  const cachedChatOutletRef = useRef(outlet);
  const canKeepStudioAlive = settingsInitialized && setupComplete;
  const [sidebarResizing, setSidebarResizing] = useState(false);

  useEffect(() => {
    if (isChatRoute && outlet) {
      cachedChatOutletRef.current = outlet;
    }
  }, [isChatRoute, outlet]);

  const workspaceRadiusClass = isMacDesktop ? 'rounded-bl-[12px]' : 'rounded-l-[12px]';
  const shellSidebarWidth = isChatRoute
    ? (chatFocusMode ? 0 : sidebarWidth)
    : isSetupRoute
      ? 0
      : sidebarCollapsed
        ? SIDEBAR_RAIL_WIDTH
        : sidebarWidth;
  const titlebarLeadingWidth = isMacDesktop
    ? (isChatRoute
      ? (chatFocusMode ? MAC_TRAFFIC_LIGHT_LEADING_WIDTH : sidebarWidth)
      : isSetupRoute
        ? MAC_TRAFFIC_LIGHT_LEADING_WIDTH
        : sidebarCollapsed
          ? MAC_TRAFFIC_LIGHT_LEADING_WIDTH
          : sidebarWidth)
    : shellSidebarWidth;
  const hasGlobalWallpaper = globalWallpaperEnabled && globalWallpaperAssetKey.trim().length > 0;
  const globalWallpaperUrl = hasGlobalWallpaper
    ? `${getHostApiBase()}/api/app/global-wallpaper/asset?v=${encodeURIComponent(globalWallpaperAssetKey)}`
    : '';
  const wallpaperReveal = hasGlobalWallpaper ? globalWallpaperOpacity : 0;
  const shellGlassOpacity = clampWallpaperLayerValue(0.44 - (wallpaperReveal * 0.18), 0.24, 0.44);
  const workspaceOpacity = clampWallpaperLayerValue(0.22 - (wallpaperReveal * 0.14), 0.08, 0.22);
  const paneOpacity = clampWallpaperLayerValue(0.56 - (wallpaperReveal * 0.26), 0.3, 0.56);
  const fieldOpacity = clampWallpaperLayerValue(0.64 - (wallpaperReveal * 0.2), 0.38, 0.64);
  const composerOpacity = clampWallpaperLayerValue(workspaceOpacity + 0.06, 0.14, 0.3);
  const chatStageOpacity = clampWallpaperLayerValue(0.74 - (wallpaperReveal * 0.22), 0.48, 0.74);
  const chatBubbleOpacity = clampWallpaperLayerValue(0.82 - (wallpaperReveal * 0.14), 0.62, 0.82);
  const chatComposerOpacity = clampWallpaperLayerValue(composerOpacity + 0.08, 0.24, 0.4);
  const scrimTopOpacity = clampWallpaperLayerValue(0.06 - (wallpaperReveal * 0.04), 0.02, 0.06);
  const scrimBottomOpacity = clampWallpaperLayerValue(0.14 - (wallpaperReveal * 0.08), 0.05, 0.14);
  const shellStyle = {
    '--desktop-sidebar-width': `${sidebarWidth}px`,
    '--desktop-sidebar-rail-width': `${SIDEBAR_RAIL_WIDTH}px`,
    '--desktop-titlebar-leading-width': `${titlebarLeadingWidth}px`,
    '--app-global-wallpaper-opacity': `${globalWallpaperOpacity}`,
    '--app-global-wallpaper-image': hasGlobalWallpaper ? `url("${globalWallpaperUrl}")` : 'none',
    '--app-global-shell-glass-opacity': `${shellGlassOpacity}`,
    '--app-global-workspace-opacity': `${workspaceOpacity}`,
    '--app-global-pane-opacity': `${paneOpacity}`,
    '--app-global-field-opacity': `${fieldOpacity}`,
    '--app-global-composer-opacity': `${composerOpacity}`,
    '--app-global-chat-stage-opacity': `${chatStageOpacity}`,
    '--app-global-chat-bubble-opacity': `${chatBubbleOpacity}`,
    '--app-global-chat-composer-opacity': `${chatComposerOpacity}`,
    '--app-global-scrim-top-opacity': `${scrimTopOpacity}`,
    '--app-global-scrim-bottom-opacity': `${scrimBottomOpacity}`,
  } as CSSProperties;

  useEffect(() => {
    if (isChatRoute) {
      saveLastChatRoute(location.pathname);
    }
  }, [isChatRoute, location.pathname]);

  useEffect(() => {
    if (!hasGlobalWallpaper || !globalWallpaperUrl) {
      return;
    }
    let cancelled = false;
    const image = new Image();
    image.onerror = () => {
      if (cancelled) {
        return;
      }
      syncGlobalWallpaperState({
        globalWallpaperEnabled: false,
        globalWallpaperAssetKey: '',
      });
    };
    image.src = globalWallpaperUrl;
    return () => {
      cancelled = true;
      image.onload = null;
      image.onerror = null;
      image.src = '';
    };
  }, [globalWallpaperUrl, hasGlobalWallpaper, syncGlobalWallpaperState]);

  const handleSidebarResizeStart = useCallback((event: ReactMouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = sidebarWidth;
    setSidebarResizing(true);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const handlePointerMove = (pointerEvent: MouseEvent) => {
      const nextWidth = Math.round(startWidth + (pointerEvent.clientX - startX));
      const boundedWidth = Math.min(SIDEBAR_WIDTH_MAX, Math.max(SIDEBAR_WIDTH_MIN, nextWidth));

      if (window.innerWidth - boundedWidth >= MAIN_WORKSPACE_MIN_WIDTH) {
        setSidebarWidth(boundedWidth);
      }
    };

    const handlePointerUp = () => {
      setSidebarResizing(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.removeEventListener('mousemove', handlePointerMove);
      document.removeEventListener('mouseup', handlePointerUp);
    };

    document.addEventListener('mousemove', handlePointerMove);
    document.addEventListener('mouseup', handlePointerUp);
  }, [setSidebarWidth, sidebarWidth]);

  return (
    <div
      className={cn(
        'desktop-app-shell relative flex h-screen flex-col overflow-hidden text-foreground mac-vibrancy-shell',
        hasGlobalWallpaper && 'desktop-app-shell--wallpaper',
      )}
      data-sidebar-resizing={sidebarResizing ? 'true' : 'false'}
      style={shellStyle}
    >
      <div aria-hidden="true" className="desktop-app-global-wallpaper-layer" />
      <div aria-hidden="true" className="desktop-app-global-wallpaper-scrim" />
      <div aria-hidden="true" className="desktop-app-shell-material-layer" />
      <div className={isMacDesktop ? 'absolute inset-x-0 top-0 z-30' : 'relative z-[1]'}>
        <TitleBar />
      </div>
      <div className="desktop-app-shell-body relative z-[1] flex flex-1 min-h-0 overflow-hidden">
        {isChatRoute ? (
          <ChatSurfaceNavShell visible={isChatRoute} />
        ) : (
          <Sidebar
            key="app-sidebar"
            className="desktop-app-shell-sidebar"
          />
        )}
        <SidebarResizeHandle
          isChatRoute={isChatRoute}
          onMouseDown={handleSidebarResizeStart}
        />
        <main className={isChatSurfaceRoute ? `desktop-app-workspace flex flex-1 min-w-0 flex-col overflow-hidden ${workspaceRadiusClass} ${isMacDesktop ? 'pt-12' : ''} px-0 py-0 mac-workspace-main` : `desktop-app-workspace flex flex-1 min-w-0 flex-col overflow-hidden ${workspaceRadiusClass} ${isMacDesktop ? 'pt-12' : ''} px-3 py-0 xl:px-4 mac-workspace-main`}>
          <div aria-hidden="true" className="desktop-app-workspace-tint" />
          {isChatSurfaceRoute ? (
            <div className="relative z-[1] min-h-0 flex flex-1 flex-col">
              <div
                aria-hidden={!isChatRoute}
                className={cn(
                  'min-h-0 flex flex-1 flex-col',
                  isChatRoute ? 'relative' : 'hidden',
                )}
              >
                {/* eslint-disable-next-line react-hooks/refs */}
                {isChatRoute ? outlet : cachedChatOutletRef.current}
              </div>
              <div
                aria-hidden={!isStudioRoute}
                className={cn(
                  'min-h-0 flex flex-1 flex-col',
                  isStudioRoute ? 'relative' : 'hidden',
                )}
              >
                {canKeepStudioAlive ? <Studio active={isStudioRoute} /> : null}
              </div>
            </div>
          ) : (
            <div className="relative z-[1] min-h-0 flex-1">
              {outlet}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

function ChatSurfaceNavShell({ visible }: { visible: boolean }) {
  const chatFocusMode = useSettingsStore((state) => ('chatFocusMode' in state ? state.chatFocusMode : false));
  const isVisible = visible && !chatFocusMode;

  return (
    <div
      className="desktop-app-shell-nav relative flex min-h-0 shrink-0 self-stretch"
      data-chat-nav-visible={isVisible ? 'true' : 'false'}
    >
        <div
          aria-hidden={!isVisible}
          className={cn(
          'desktop-app-chat-nav-shell app-sidebar-chrome-surface absolute inset-y-0 left-0 z-20 flex h-full min-h-0 w-[var(--desktop-sidebar-width)] overflow-hidden transition-[transform,opacity] duration-150 ease-out',
          isVisible ? 'translate-x-0 opacity-100' : '-translate-x-full opacity-0 pointer-events-none',
        )}
      >
        <ChatSessionsPane />
      </div>
    </div>
  );
}

function SidebarResizeHandle({
  isChatRoute,
  onMouseDown,
}: {
  isChatRoute: boolean;
  onMouseDown: (event: ReactMouseEvent<HTMLDivElement>) => void;
}) {
  const sidebarCollapsed = useSettingsStore((state) => state.sidebarCollapsed);
  const chatFocusMode = useSettingsStore((state) => ('chatFocusMode' in state ? state.chatFocusMode : false));
  const visible = isChatRoute ? !chatFocusMode : !sidebarCollapsed;

  if (!visible) {
    return null;
  }

  return (
    <div
      data-testid="desktop-shell-resize-handle"
      className={cn(
        'desktop-app-shell-resize-handle',
        isChatRoute && 'absolute inset-y-0 left-[var(--desktop-sidebar-width)] z-[21]',
      )}
      onMouseDown={onMouseDown}
    />
  );
}
