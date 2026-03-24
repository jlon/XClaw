import { useEffect, useRef } from 'react';
import { useLocation, useOutlet } from 'react-router-dom';
import { ChatSessionsPane } from './ChatSessionsPane';
import { Sidebar } from './Sidebar';
import { TitleBar } from './TitleBar';
import { isChatRoutePath, isChatSurfaceRoutePath, isStudioRoutePath, saveLastChatRoute } from '@/lib/studio';
import { cn } from '@/lib/utils';
import { Studio } from '@/pages/Studio';
import { useSettingsStore } from '@/stores/settings';

export function MainLayout() {
  const location = useLocation();
  const outlet = useOutlet();
  const isChatRoute = isChatRoutePath(location.pathname);
  const isChatSurfaceRoute = isChatSurfaceRoutePath(location.pathname);
  const isStudioRoute = isStudioRoutePath(location.pathname);
  const chatFocusMode = useSettingsStore((state) => ('chatFocusMode' in state ? state.chatFocusMode : false));
  const cachedChatOutletRef = useRef(outlet);

  if (isChatRoute && outlet) {
    cachedChatOutletRef.current = outlet;
  }

  const showChatSessionsPane = isChatRoute && !chatFocusMode;
  const showWorkspaceSidebar = !isChatRoute;

  useEffect(() => {
    if (isChatRoute) {
      saveLastChatRoute(location.pathname);
    }
  }, [isChatRoute, location.pathname]);

  return (
    <div className="desktop-app-shell flex h-screen flex-col overflow-hidden bg-background text-foreground">
      <TitleBar />
      <div className="desktop-app-shell-body flex flex-1 min-h-0 overflow-hidden">
        {isChatSurfaceRoute ? (
          <div className="relative flex min-h-0 shrink-0 self-stretch">
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
        <main className={isChatSurfaceRoute ? 'desktop-app-workspace flex flex-1 min-w-0 flex-col overflow-hidden px-0 py-0' : 'desktop-app-workspace flex flex-1 min-w-0 flex-col overflow-hidden px-3 py-0 xl:px-4'}>
          {isChatSurfaceRoute ? (
            <div className="relative min-h-0 flex flex-1 flex-col">
              <div
                aria-hidden={!isChatRoute}
                className={cn(
                  'min-h-0 flex flex-1 flex-col',
                  isChatRoute ? 'relative' : 'pointer-events-none absolute inset-0 opacity-0',
                )}
              >
                {cachedChatOutletRef.current}
              </div>
              <div
                aria-hidden={!isStudioRoute}
                className={cn(
                  'min-h-0 flex flex-1 flex-col',
                  isStudioRoute ? 'relative' : 'pointer-events-none absolute inset-0 opacity-0',
                )}
              >
                <Studio />
              </div>
            </div>
          ) : (
            <div className="min-h-0 flex-1">
              {outlet}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
