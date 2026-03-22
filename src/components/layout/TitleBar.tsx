/**
 * TitleBar Component
 * macOS: empty drag region (native traffic lights handled by hiddenInset).
 * Windows/Linux: drag region on left, minimize/maximize/close on right.
 */
import { useState, useEffect } from 'react';
import { Minus, Square, X, Copy } from 'lucide-react';
import { invokeIpc } from '@/lib/api-client';
import { useLocation } from 'react-router-dom';
import { ChatToolbar } from '@/pages/Chat/ChatToolbar';

function resolvePlatform() {
  if (typeof window === 'undefined') {
    return undefined;
  }

  return window.electron?.platform;
}

export function TitleBar() {
  const location = useLocation();
  const platform = resolvePlatform();
  const isChatRoute = location.pathname === '/' || location.pathname.startsWith('/new');
  const hasDesktopBridge = !!window.electron?.ipcRenderer;

  if (!hasDesktopBridge) {
    return (
      <div
        className={
          isChatRoute
            ? 'desktop-app-titlebar desktop-app-titlebar--browser desktop-app-titlebar--chat h-9 shrink-0'
            : 'desktop-app-titlebar desktop-app-titlebar--browser h-9 shrink-0'
        }
      />
    );
  }

  if (platform === 'darwin') {
    return isChatRoute ? (
      <MacChatTitleBar />
    ) : (
      <div className="drag-region desktop-app-titlebar desktop-app-titlebar--mac h-9 shrink-0" />
    );
  }

  return <WindowsTitleBar isChatRoute={isChatRoute} />;
}

function MacChatTitleBar() {
  return (
    <div className="drag-region desktop-app-titlebar desktop-app-titlebar--chat desktop-app-titlebar--mac flex h-9 shrink-0 items-center justify-end pl-20 pr-2.5">
      <div className="no-drag shrink-0">
        <ChatToolbar compact />
      </div>
    </div>
  );
}

function WindowsTitleBar({ isChatRoute }: { isChatRoute: boolean }) {
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    invokeIpc('window:isMaximized').then((val) => {
      setMaximized(val as boolean);
    });
  }, []);

  const handleMinimize = () => {
    invokeIpc('window:minimize');
  };

  const handleMaximize = () => {
    invokeIpc('window:maximize').then(() => {
      invokeIpc('window:isMaximized').then((val) => {
        setMaximized(val as boolean);
      });
    });
  };

  const handleClose = () => {
    invokeIpc('window:close');
  };

  return (
    <div className="drag-region desktop-app-titlebar desktop-app-titlebar--chat desktop-app-titlebar--win flex h-9 shrink-0 items-center justify-between pl-2">
      <div className="min-w-0 flex-1" />
      <div className="no-drag flex h-full items-center">
        {isChatRoute ? (
          <div className="mr-2">
            <ChatToolbar compact />
          </div>
        ) : null}
        <div className="flex h-full desktop-app-titlebar-controls">
        <button
          onClick={handleMinimize}
          className="flex h-full w-10 items-center justify-center text-muted-foreground transition-colors hover:bg-[hsl(var(--foreground)/0.05)] hover:text-foreground"
          title="Minimize"
        >
          <Minus className="h-4 w-4" />
        </button>
        <button
          onClick={handleMaximize}
          className="flex h-full w-10 items-center justify-center text-muted-foreground transition-colors hover:bg-[hsl(var(--foreground)/0.05)] hover:text-foreground"
          title={maximized ? 'Restore' : 'Maximize'}
        >
          {maximized ? <Copy className="h-3.5 w-3.5" /> : <Square className="h-3.5 w-3.5" />}
        </button>
        <button
          onClick={handleClose}
          className="flex h-full w-10 items-center justify-center text-muted-foreground transition-colors hover:bg-destructive hover:text-destructive-foreground"
          title="Close"
        >
          <X className="h-4 w-4" />
        </button>
        </div>
      </div>
    </div>
  );
}
