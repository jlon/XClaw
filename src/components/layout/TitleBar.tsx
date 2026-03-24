/**
 * TitleBar Component
 * macOS: empty drag region (native traffic lights handled by hiddenInset).
 * Windows/Linux: drag region on left, minimize/maximize/close on right.
 */
import { useState, useEffect } from 'react';
import { Minus, Square, X, Copy } from 'lucide-react';
import { invokeIpc } from '@/lib/api-client';
import { useLocation, useInRouterContext } from 'react-router-dom';
import { ChatToolbar } from '@/pages/Chat/ChatToolbar';
import { ChatSessionHeaderControls } from './ChatSessionHeaderControls';
import { useSettingsStore } from '@/stores/settings';
import { WorkspaceSidebarToggleButton } from './WorkspaceSidebarToggleButton';

function resolvePlatform() {
  if (typeof window === 'undefined') {
    return undefined;
  }

  return window.electron?.platform;
}

type TitleBarProps = {
  pathname?: string;
};

function resolveFallbackPathname() {
  if (typeof window === 'undefined') {
    return '/';
  }

  const hashPath = window.location.hash.replace(/^#/, '').trim();
  if (hashPath.startsWith('/')) {
    return hashPath;
  }

  return window.location.pathname || '/';
}

function TitleBarChrome({ pathname }: { pathname: string }) {
  const platform = resolvePlatform();
  const isChatRoute = pathname === '/' || pathname.startsWith('/new');
  const isSetupRoute = pathname.startsWith('/setup');
  const chatFocusMode = useSettingsStore((state) => ('chatFocusMode' in state ? state.chatFocusMode : false));
  const sidebarCollapsed = useSettingsStore((state) => state.sidebarCollapsed);
  const setSidebarCollapsed = useSettingsStore((state) => state.setSidebarCollapsed);
  const hasDesktopBridge = !!window.electron?.ipcRenderer;
  const chatSidebarVisible = isChatRoute && !chatFocusMode;
  const workspaceSidebarExpanded = !isChatRoute && !sidebarCollapsed;
  const workspaceSidebarLabel = sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar';
  const handleWorkspaceSidebarToggle = () => {
    setSidebarCollapsed(!sidebarCollapsed);
  };

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
      <MacChatTitleBar chatSidebarVisible={chatSidebarVisible} />
    ) : isSetupRoute ? (
      <MacSetupTitleBar />
    ) : (
      <MacWorkspaceTitleBar
        sidebarExpanded={workspaceSidebarExpanded}
        sidebarLabel={workspaceSidebarLabel}
        onToggleSidebar={handleWorkspaceSidebarToggle}
      />
    );
  }

  return (
    <WindowsTitleBar
      isChatRoute={isChatRoute}
      isSetupRoute={isSetupRoute}
      chatSidebarVisible={chatSidebarVisible}
      workspaceSidebarExpanded={workspaceSidebarExpanded}
      workspaceSidebarLabel={workspaceSidebarLabel}
      onToggleSidebar={handleWorkspaceSidebarToggle}
    />
  );
}

function RoutedTitleBar() {
  const location = useLocation();
  return <TitleBarChrome pathname={location.pathname} />;
}

export function TitleBar({ pathname }: TitleBarProps = {}) {
  const inRouterContext = useInRouterContext();

  if (typeof pathname === 'string' && pathname.trim()) {
    return <TitleBarChrome pathname={pathname} />;
  }

  if (inRouterContext) {
    return <RoutedTitleBar />;
  }

  return <TitleBarChrome pathname={resolveFallbackPathname()} />;
}

function MacChatTitleBar({ chatSidebarVisible }: { chatSidebarVisible: boolean }) {
  return (
    <div className="drag-region desktop-app-titlebar desktop-app-titlebar--chat desktop-app-titlebar--mac flex h-9 shrink-0 items-center pr-2.5">
      <div
        data-testid="chat-titlebar-session-slot"
        className={
          chatSidebarVisible
            ? 'no-drag flex h-full w-[250px] shrink-0 items-center justify-end pr-3'
            : 'no-drag flex h-full w-auto shrink-0 items-center justify-start pl-24 pr-2'
        }
      >
        <ChatSessionHeaderControls compact surface="titlebar" />
      </div>
      <div className="min-w-0 flex-1" />
      <div className="no-drag shrink-0">
        <ChatToolbar compact />
      </div>
    </div>
  );
}

function MacWorkspaceTitleBar({
  sidebarExpanded,
  sidebarLabel,
  onToggleSidebar,
}: {
  sidebarExpanded: boolean;
  sidebarLabel: string;
  onToggleSidebar: () => void;
}) {
  return (
    <div className="drag-region desktop-app-titlebar desktop-app-titlebar--mac flex h-9 shrink-0 items-center pr-2.5">
      <div
        data-testid="workspace-titlebar-sidebar-slot"
        className={
          sidebarExpanded
            ? 'no-drag flex h-full w-56 shrink-0 items-center justify-end pr-3'
            : 'no-drag flex h-full w-auto shrink-0 items-center justify-start pl-24 pr-2'
        }
      >
        <WorkspaceSidebarToggleButton
          aria-label={sidebarLabel}
          title={sidebarLabel}
          data-testid="workspace-sidebar-toggle-titlebar"
          onClick={onToggleSidebar}
        />
      </div>
      <div className="min-w-0 flex-1" />
    </div>
  );
}

function MacSetupTitleBar() {
  return <div className="drag-region desktop-app-titlebar desktop-app-titlebar--mac flex h-9 shrink-0" />;
}

function WindowsTitleBar({
  isChatRoute,
  isSetupRoute,
  chatSidebarVisible,
  workspaceSidebarExpanded,
  workspaceSidebarLabel,
  onToggleSidebar,
}: {
  isChatRoute: boolean;
  isSetupRoute: boolean;
  chatSidebarVisible: boolean;
  workspaceSidebarExpanded: boolean;
  workspaceSidebarLabel: string;
  onToggleSidebar: () => void;
}) {
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
    <div className="drag-region desktop-app-titlebar desktop-app-titlebar--chat desktop-app-titlebar--win flex h-9 shrink-0 items-center pl-2">
      {isChatRoute ? (
        <div
          data-testid="chat-titlebar-session-slot"
          className={
            chatSidebarVisible
              ? 'no-drag flex h-full w-[250px] shrink-0 items-center justify-end pr-3'
              : 'no-drag flex h-full w-auto shrink-0 items-center justify-start pl-1 pr-2'
          }
        >
          <ChatSessionHeaderControls compact surface="titlebar" />
        </div>
      ) : isSetupRoute ? (
        <div className="h-full w-0 shrink-0" />
      ) : (
        <div
          data-testid="workspace-titlebar-sidebar-slot"
          className={
            workspaceSidebarExpanded
              ? 'no-drag flex h-full w-56 shrink-0 items-center justify-end pr-3'
              : 'no-drag flex h-full w-11 shrink-0 items-center justify-center'
          }
        >
          <WorkspaceSidebarToggleButton
            aria-label={workspaceSidebarLabel}
            title={workspaceSidebarLabel}
            data-testid="workspace-sidebar-toggle-titlebar"
            onClick={onToggleSidebar}
          />
        </div>
      )}
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
