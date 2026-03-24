import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { ChatSessionsPane } from './ChatSessionsPane';
import { Sidebar } from './Sidebar';
import { TitleBar } from './TitleBar';
import { isChatRoutePath, isChatSurfaceRoutePath, isStudioRoutePath, saveLastChatRoute } from '@/lib/studio';
import { useSettingsStore } from '@/stores/settings';

export function MainLayout() {
  const location = useLocation();
  const isChatRoute = isChatRoutePath(location.pathname);
  const isChatSurfaceRoute = isChatSurfaceRoutePath(location.pathname);
  const isStudioRoute = isStudioRoutePath(location.pathname);
  const chatFocusMode = useSettingsStore((state) => ('chatFocusMode' in state ? state.chatFocusMode : false));

  useEffect(() => {
    if (isChatRoute) {
      saveLastChatRoute(location.pathname);
    }
  }, [isChatRoute, location.pathname]);

  return (
    <div className="desktop-app-shell flex h-screen flex-col overflow-hidden bg-background text-foreground">
      <TitleBar />
      <div className="desktop-app-shell-body flex flex-1 min-h-0 overflow-hidden">
        {isChatRoute && !chatFocusMode ? (
          <div className="desktop-app-chat-nav-shell flex min-h-0 shrink-0">
            <ChatSessionsPane />
          </div>
        ) : !isChatRoute ? (
          <Sidebar
            key="app-sidebar"
            className="desktop-app-shell-sidebar"
          />
        ) : null}
        <main className={isChatSurfaceRoute ? 'desktop-app-workspace flex flex-1 min-w-0 flex-col overflow-hidden px-0 py-0' : 'desktop-app-workspace flex flex-1 min-w-0 flex-col overflow-hidden px-3 py-0 xl:px-4'}>
          <div className={isStudioRoute ? 'min-h-0 flex flex-1 flex-col' : 'min-h-0 flex-1'}>
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
