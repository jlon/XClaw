import { Outlet, useLocation } from 'react-router-dom';
import { ChatSessionsPane } from './ChatSessionsPane';
import { Sidebar } from './Sidebar';
import { TitleBar } from './TitleBar';

export function MainLayout() {
  const location = useLocation();
  const isChatRoute = location.pathname === '/';

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      <TitleBar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar key={isChatRoute ? 'chat-sidebar' : 'app-sidebar'} railOnly={isChatRoute} />
        {isChatRoute && <ChatSessionsPane />}
        <main className="flex-1 min-w-0 overflow-hidden px-3 py-4 xl:px-4">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
