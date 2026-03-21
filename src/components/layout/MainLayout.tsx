import { Outlet, useLocation } from 'react-router-dom';
import { ChatSessionsPane } from './ChatSessionsPane';
import { Sidebar } from './Sidebar';
import { TitleBar } from './TitleBar';

export function MainLayout() {
  const location = useLocation();
  const isChatRoute = location.pathname === '/';

  return (
    <div className="desktop-app-shell flex h-screen flex-col overflow-hidden bg-background text-foreground">
      <TitleBar />
      <div className="desktop-app-shell-body flex flex-1 min-h-0 overflow-hidden">
        {isChatRoute ? (
          <div className="desktop-app-chat-nav-shell flex min-h-0 shrink-0">
            <Sidebar
              key="chat-sidebar"
              railOnly
              className="desktop-app-shell-sidebar desktop-app-shell-sidebar--rail !border-r-0 !shadow-none"
            />
            <ChatSessionsPane />
          </div>
        ) : (
          <Sidebar
            key="app-sidebar"
            className="desktop-app-shell-sidebar"
          />
        )}
        <main className={isChatRoute ? 'desktop-app-workspace flex-1 min-w-0 overflow-hidden px-0 py-0' : 'desktop-app-workspace flex-1 min-w-0 overflow-hidden px-3 py-4 xl:px-4'}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
