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
        <Sidebar
          key={isChatRoute ? 'chat-sidebar' : 'app-sidebar'}
          railOnly={isChatRoute}
          className={isChatRoute ? 'desktop-app-shell-sidebar desktop-app-shell-sidebar--rail' : 'desktop-app-shell-sidebar'}
        />
        {isChatRoute && <ChatSessionsPane />}
        <main className={isChatRoute ? 'desktop-app-workspace flex-1 min-w-0 overflow-hidden px-0 py-0' : 'desktop-app-workspace flex-1 min-w-0 overflow-hidden px-3 py-4 xl:px-4'}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
