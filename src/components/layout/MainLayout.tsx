import { useCallback, useEffect, useRef, useState, type CSSProperties, type MouseEvent as ReactMouseEvent } from 'react';
import { useLocation, useOutlet } from 'react-router-dom';
import { ChatSessionsPane } from './ChatSessionsPane';
import { Sidebar } from './Sidebar';
import { TitleBar } from './TitleBar';
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

export function MainLayout() {
  const location = useLocation();
  const outlet = useOutlet();
  const isMacDesktop = typeof window !== 'undefined' && window.electron?.platform === 'darwin';
  const isChatRoute = isChatRoutePath(location.pathname);
  const isChatSurfaceRoute = isChatSurfaceRoutePath(location.pathname);
  const isStudioRoute = isStudioRoutePath(location.pathname);
  const sidebarWidth = useSettingsStore((state) => state.sidebarWidth);
  const setSidebarWidth = useSettingsStore((state) => state.setSidebarWidth);
  const chatFocusMode = useSettingsStore((state) => ('chatFocusMode' in state ? state.chatFocusMode : false));
  const settingsInitialized = useSettingsStore((state) => ('initialized' in state ? state.initialized === true : true));
  const setupComplete = useSettingsStore((state) => ('setupComplete' in state ? state.setupComplete === true : true));
  const cachedChatOutletRef = useRef(outlet);
  const canKeepStudioAlive = settingsInitialized && setupComplete;
  const [sidebarResizing, setSidebarResizing] = useState(false);

  useEffect(() => {
    if (isChatRoute && outlet) {
      cachedChatOutletRef.current = outlet;
    }
  }, [isChatRoute, outlet]);

  const showChatSessionsPane = isChatSurfaceRoute && !chatFocusMode;
  const showWorkspaceSidebar = !isChatSurfaceRoute;
  const workspaceRadiusClass = isMacDesktop ? 'rounded-bl-[12px]' : 'rounded-l-[12px]';
  const shellStyle = {
    '--desktop-sidebar-width': `${sidebarWidth}px`,
    '--desktop-sidebar-rail-width': `${SIDEBAR_RAIL_WIDTH}px`,
  } as CSSProperties;

  useEffect(() => {
    if (isChatRoute) {
      saveLastChatRoute(location.pathname);
    }
  }, [isChatRoute, location.pathname]);

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
      className="desktop-app-shell relative flex h-screen flex-col overflow-hidden text-foreground mac-vibrancy-shell"
      data-sidebar-resizing={sidebarResizing ? 'true' : 'false'}
      style={shellStyle}
    >
      <div className={isMacDesktop ? 'absolute inset-x-0 top-0 z-30' : ''}>
        <TitleBar />
      </div>
      <div className="desktop-app-shell-body flex flex-1 min-h-0 overflow-hidden">
        {isChatSurfaceRoute ? (
          <div className="desktop-app-shell-nav relative flex min-h-0 shrink-0 self-stretch">
            <div
              aria-hidden={!showChatSessionsPane}
              style={showChatSessionsPane ? undefined : { display: 'none' }}
              className="desktop-app-chat-nav-shell flex h-full min-h-0"
            >
              <ChatSessionsPane />
            </div>
            <div
              aria-hidden={!showWorkspaceSidebar}
              style={showWorkspaceSidebar ? undefined : { display: 'none' }}
              className="flex h-full min-h-0"
            >
              <Sidebar
                key="app-sidebar"
                className="desktop-app-shell-sidebar"
              />
            </div>
          </div>
        ) : (
          <Sidebar
            key="app-sidebar"
            className="desktop-app-shell-sidebar"
          />
        )}
        <SidebarResizeHandle
          showChatSessionsPane={showChatSessionsPane}
          showWorkspaceSidebar={showWorkspaceSidebar}
          onMouseDown={handleSidebarResizeStart}
        />
        <main className={isChatSurfaceRoute ? `desktop-app-workspace flex flex-1 min-w-0 flex-col overflow-hidden ${workspaceRadiusClass} ${isMacDesktop ? 'pt-12' : ''} px-0 py-0 bg-background mac-workspace-main` : `desktop-app-workspace flex flex-1 min-w-0 flex-col overflow-hidden ${workspaceRadiusClass} ${isMacDesktop ? 'pt-12' : ''} px-3 py-0 xl:px-4 bg-background mac-workspace-main`}>
          <div aria-hidden="true" className="desktop-app-workspace-tint" />
          {isChatSurfaceRoute ? (
            <div className="relative z-[1] min-h-0 flex flex-1 flex-col">
              <div
                aria-hidden={!isChatRoute}
                className={cn(
                  'min-h-0 flex flex-1 flex-col',
                  isChatRoute ? 'relative' : 'pointer-events-none absolute inset-0 opacity-0',
                )}
              >
                {/* eslint-disable-next-line react-hooks/refs */}
                {isChatRoute ? outlet : cachedChatOutletRef.current}
              </div>
              <div
                aria-hidden={!isStudioRoute}
                className={cn(
                  'min-h-0 flex flex-1 flex-col',
                  isStudioRoute ? 'relative' : 'pointer-events-none absolute inset-0 opacity-0',
                )}
              >
                {canKeepStudioAlive ? <Studio /> : null}
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

function SidebarResizeHandle({
  showChatSessionsPane,
  showWorkspaceSidebar,
  onMouseDown,
}: {
  showChatSessionsPane: boolean;
  showWorkspaceSidebar: boolean;
  onMouseDown: (event: ReactMouseEvent<HTMLDivElement>) => void;
}) {
  const sidebarCollapsed = useSettingsStore((state) => state.sidebarCollapsed);
  const visible = !sidebarCollapsed && (showChatSessionsPane || showWorkspaceSidebar);

  if (!visible) {
    return null;
  }

  return (
    <div
      data-testid="desktop-shell-resize-handle"
      className="desktop-app-shell-resize-handle"
      onMouseDown={onMouseDown}
    />
  );
}
