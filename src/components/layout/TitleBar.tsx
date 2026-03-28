/**
 * TitleBar Component
 * macOS: empty drag region (native traffic lights handled by hiddenInset).
 * Windows/Linux: drag region on left, minimize/maximize/close on right.
 */
import { useState, useEffect, type CSSProperties, type ReactNode } from 'react';
import { Minus, Square, X, Copy } from 'lucide-react';
import { invokeIpc } from '@/lib/api-client';
import { useLocation, useInRouterContext } from 'react-router-dom';
import { ChatToolbar } from '@/pages/Chat/ChatToolbar';
import { ChatSessionHeaderControls } from './ChatSessionHeaderControls';
import { isChatRoutePath, isStudioRoutePath } from '@/lib/studio';
import { useSettingsStore } from '@/stores/settings';
import { WorkspaceSidebarToggleButton } from './WorkspaceSidebarToggleButton';
import { GlobalTitleBarUtilities } from './GlobalTitleBarUtilities';
import { AppBrandLockup } from './AppBrandLockup';

function resolvePlatform() {
  if (typeof window === 'undefined') {
    return undefined;
  }

  return window.electron?.platform;
}

function hasNativeElectronShell() {
  if (typeof window === 'undefined') {
    return false;
  }

  return !!window.electron?.ipcRenderer && /\bElectron\//i.test(window.navigator.userAgent || '');
}

type TitleBarProps = {
  pathname?: string;
};

const MAC_TRAFFIC_LIGHT_CLEARANCE_PX = 100;
const MAC_CONTROL_RAIL_LEFT_PX = 80;
const MAC_TITLEBAR_HEIGHT_CLASS = 'h-12';
const macTrafficLightClearanceStyle: CSSProperties = {
  width: `${MAC_TRAFFIC_LIGHT_CLEARANCE_PX}px`,
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
  const isChatRoute = isChatRoutePath(pathname);
  const isStudioRoute = isStudioRoutePath(pathname);
  const isChatSurfaceRoute = isChatRoute || isStudioRoute;
  const isSetupRoute = pathname.startsWith('/setup');
  const chatFocusMode = useSettingsStore((state) => ('chatFocusMode' in state ? state.chatFocusMode : false));
  const sidebarCollapsed = useSettingsStore((state) => state.sidebarCollapsed);
  const setSidebarCollapsed = useSettingsStore((state) => state.setSidebarCollapsed);
  const hasDesktopBridge = !!window.electron?.ipcRenderer;
  const chatSidebarVisible = isChatRoute && !chatFocusMode;
  const workspaceSidebarExpanded = !isChatSurfaceRoute && !sidebarCollapsed;
  const workspaceSidebarLabel = sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar';
  const handleWorkspaceSidebarToggle = () => {
    setSidebarCollapsed(!sidebarCollapsed);
  };

  if (!hasDesktopBridge) {
    return (
      <BrowserTitleBar
        isChatRoute={isChatRoute}
        isStudioRoute={isStudioRoute}
        isSetupRoute={isSetupRoute}
        chatSidebarVisible={chatSidebarVisible}
        workspaceSidebarExpanded={workspaceSidebarExpanded}
        workspaceSidebarLabel={workspaceSidebarLabel}
        onToggleSidebar={handleWorkspaceSidebarToggle}
      />
    );
  }

  if (platform === 'darwin') {
    return isChatRoute ? (
      <MacChatTitleBar chatSidebarVisible={chatSidebarVisible} />
    ) : isStudioRoute ? (
      <MacStudioTitleBar />
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
      isStudioRoute={isStudioRoute}
      isSetupRoute={isSetupRoute}
      chatSidebarVisible={chatSidebarVisible}
      workspaceSidebarExpanded={workspaceSidebarExpanded}
      workspaceSidebarLabel={workspaceSidebarLabel}
      onToggleSidebar={handleWorkspaceSidebarToggle}
    />
  );
}

function MacWindowDragBar() {
  if (!hasNativeElectronShell()) {
    return null;
  }

  return <div aria-hidden="true" className="window-drag-bar" />;
}

function MacTitlebarControlRail({
  children,
  testId,
}: {
  children: ReactNode;
  testId: string;
}) {
  return (
    <div
      data-testid={testId}
      className="pointer-events-none no-drag absolute top-[12px] z-20 flex h-8 items-center"
      style={{ left: `${MAC_CONTROL_RAIL_LEFT_PX}px` }}
    >
      <div className="pointer-events-auto no-drag flex items-center">{children}</div>
    </div>
  );
}

function MacTitlebarLeadingSpace({
  className,
}: {
  className?: string;
}) {
  return (
    <div
      aria-hidden="true"
      className={className ? `desktop-app-titlebar-leading-space shrink-0 ${className}` : 'desktop-app-titlebar-leading-space shrink-0'}
      style={macTrafficLightClearanceStyle}
    />
  );
}

function MacTitlebarMainSurface({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="desktop-app-titlebar-main-surface flex flex-1 min-w-0 items-center pr-2.5">
      {children}
    </div>
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
    <div className={`desktop-app-titlebar desktop-app-titlebar--chat desktop-app-titlebar--mac relative flex ${MAC_TITLEBAR_HEIGHT_CLASS} shrink-0`}>
      <MacWindowDragBar />
      <div className="pointer-events-none flex h-full w-full">
        {chatSidebarVisible ? (
          <div
            data-testid="chat-titlebar-session-slot"
            className="desktop-app-titlebar-sidebar-slot desktop-app-titlebar-sidebar-slot--chat flex h-full w-[var(--desktop-sidebar-width)] shrink-0 items-center justify-end pr-3"
          >
            <div className="pointer-events-auto no-drag z-10 flex items-center">
              <ChatSessionHeaderControls compact surface="titlebar" />
            </div>
          </div>
        ) : (
          <>
            <MacTitlebarLeadingSpace />
            <MacTitlebarControlRail testId="chat-titlebar-control-rail">
              <ChatSessionHeaderControls compact surface="titlebar" showNewChat={false} />
            </MacTitlebarControlRail>
          </>
        )}
        <MacTitlebarMainSurface>
          <div className="min-w-0 flex-1 h-full" />
          <div className="pointer-events-auto no-drag z-10 flex shrink-0 items-center gap-1.5">
            <ChatToolbar compact />
            <GlobalTitleBarUtilities compact />
          </div>
        </MacTitlebarMainSurface>
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
    <div className={`desktop-app-titlebar desktop-app-titlebar--mac relative flex ${MAC_TITLEBAR_HEIGHT_CLASS} shrink-0 w-full`}>
      <MacWindowDragBar />
      <MacTitlebarControlRail testId="workspace-titlebar-control-rail">
        <WorkspaceSidebarToggleButton
          aria-label={sidebarLabel}
          title={sidebarLabel}
          data-testid="workspace-sidebar-toggle-titlebar"
          onClick={onToggleSidebar}
        />
      </MacTitlebarControlRail>
      <div className="pointer-events-none flex h-full w-full">
        {sidebarExpanded ? (
          <div
            aria-hidden="true"
            className="desktop-app-titlebar-sidebar-slot desktop-app-titlebar-sidebar-slot--workspace w-[var(--desktop-sidebar-width)] shrink-0"
          />
        ) : (
          <MacTitlebarLeadingSpace />
        )}
        <MacTitlebarMainSurface>
          <div className="min-w-0 flex-1 h-full" />
          <div className="pointer-events-auto no-drag z-10 shrink-0">
            <GlobalTitleBarUtilities compact />
          </div>
        </MacTitlebarMainSurface>
      </div>
    </div>
  );
}

function MacSetupTitleBar() {
  return (
    <div className={`desktop-app-titlebar desktop-app-titlebar--mac relative flex ${MAC_TITLEBAR_HEIGHT_CLASS} shrink-0`}>
      <MacWindowDragBar />
      <div className="pointer-events-none flex h-full w-full">
        <MacTitlebarLeadingSpace />
        <MacTitlebarMainSurface>
          <div className="min-w-0 flex-1 h-full" />
        </MacTitlebarMainSurface>
      </div>
    </div>
  );
}

function MacStudioTitleBar() {
  return (
    <div className={`desktop-app-titlebar desktop-app-titlebar--chat desktop-app-titlebar--mac relative flex ${MAC_TITLEBAR_HEIGHT_CLASS} shrink-0`}>
      <MacWindowDragBar />
      <div className="pointer-events-none flex h-full w-full">
        <MacTitlebarLeadingSpace />
        <MacTitlebarMainSurface>
          <div className="min-w-0 flex-1 h-full" />
          <div className="pointer-events-auto no-drag z-10 flex shrink-0 items-center gap-1.5">
            <GlobalTitleBarUtilities compact />
          </div>
        </MacTitlebarMainSurface>
      </div>
    </div>
  );
}

function BrowserTitleBar({
  isChatRoute,
  isStudioRoute,
  isSetupRoute,
  chatSidebarVisible,
  workspaceSidebarExpanded,
  workspaceSidebarLabel,
  onToggleSidebar,
}: {
  isChatRoute: boolean;
  isStudioRoute: boolean;
  isSetupRoute: boolean;
  chatSidebarVisible: boolean;
  workspaceSidebarExpanded: boolean;
  workspaceSidebarLabel: string;
  onToggleSidebar: () => void;
}) {
  const isChatSurfaceRoute = isChatRoute || isStudioRoute;
  return (
    <div className={`desktop-app-titlebar desktop-app-titlebar--browser ${isChatSurfaceRoute ? 'desktop-app-titlebar--chat' : ''} flex h-14 shrink-0 items-center pl-3 pr-4 bg-background border-b border-[hsl(var(--border-subtle))]`}>
      {isChatSurfaceRoute ? (
        <div
          data-testid="chat-titlebar-session-slot"
          className={
            chatSidebarVisible
              ? 'flex h-full w-[var(--desktop-sidebar-width)] shrink-0 items-center justify-end pr-3'
              : 'flex h-full w-auto shrink-0 items-center justify-start pl-24 pr-2'
          }
        >
          <div className="z-10 flex items-center">
            {isChatRoute ? (
              chatSidebarVisible
                ? <ChatSessionHeaderControls compact={false} surface="titlebar" />
                : <ChatSessionHeaderControls compact={false} surface="titlebar" showNewChat={false} />
            ) : isStudioRoute ? (
              <WorkspaceSidebarToggleButton
                aria-label={workspaceSidebarLabel}
                title={workspaceSidebarLabel}
                data-testid="workspace-sidebar-toggle-titlebar"
                onClick={onToggleSidebar}
              />
            ) : null}
          </div>
        </div>
      ) : isSetupRoute ? (
        <div className="h-full w-0 shrink-0" />
      ) : (
        <div
          data-testid="workspace-titlebar-sidebar-slot"
          className={
            workspaceSidebarExpanded
              ? 'flex h-full w-[var(--desktop-sidebar-width)] shrink-0 items-center justify-between pr-3'
              : 'flex h-full w-[var(--desktop-sidebar-rail-width)] shrink-0 items-center justify-center'
          }
        >
          {workspaceSidebarExpanded && (
             <AppBrandLockup compact className="min-h-8 shrink-0" testIdPrefix="browser-titlebar-brand" />
          )}
          <div className="flex items-center z-10">
            <WorkspaceSidebarToggleButton
              aria-label={workspaceSidebarLabel}
              title={workspaceSidebarLabel}
              data-testid="workspace-sidebar-toggle-titlebar"
              onClick={onToggleSidebar}
            />
          </div>
        </div>
      )}
      <div className="min-w-0 flex-1" />
      <div className="flex h-full items-center">
        {isChatRoute || isStudioRoute ? (
          <div className="mr-3 flex items-center h-full">
            <ChatToolbar compact={false} />
          </div>
        ) : null}
        {!isSetupRoute ? (
          <div className="flex items-center h-full">
            <GlobalTitleBarUtilities compact={false} studioIconOnly />
          </div>
        ) : null}
      </div>
    </div>
  );
}

function WindowsTitleBar({
  isChatRoute,
  isStudioRoute,
  isSetupRoute,
  chatSidebarVisible,
  workspaceSidebarExpanded,
  workspaceSidebarLabel,
  onToggleSidebar,
}: {
  isChatRoute: boolean;
  isStudioRoute: boolean;
  isSetupRoute: boolean;
  chatSidebarVisible: boolean;
  workspaceSidebarExpanded: boolean;
  workspaceSidebarLabel: string;
  onToggleSidebar: () => void;
}) {
  const dragRegionClassName = hasNativeElectronShell() ? 'drag-region' : '';
  const noDragStyle = hasNativeElectronShell()
    ? ({ WebkitAppRegion: 'no-drag' } as CSSProperties)
    : undefined;
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
    <div className={`${dragRegionClassName} desktop-app-titlebar desktop-app-titlebar--chat desktop-app-titlebar--win flex h-9 shrink-0 items-center pl-2`}>
      {isChatRoute ? (
        <div
          data-testid="chat-titlebar-session-slot"
          className={
            chatSidebarVisible
              ? `${dragRegionClassName} flex h-full w-[var(--desktop-sidebar-width)] shrink-0 items-center justify-end pr-3`
              : `${dragRegionClassName} flex h-full w-auto shrink-0 items-center justify-start pl-1 pr-2`
          }
        >
          <div className="z-10" style={noDragStyle}>
            {chatSidebarVisible
              ? <ChatSessionHeaderControls compact surface="titlebar" />
              : <ChatSessionHeaderControls compact surface="titlebar" showNewChat={false} />}
          </div>
        </div>
      ) : isStudioRoute ? (
        <div className="h-full w-0 shrink-0" />
      ) : isSetupRoute ? (
        <div className="h-full w-0 shrink-0" />
      ) : (
        <div
          data-testid="workspace-titlebar-sidebar-slot"
          className={
            workspaceSidebarExpanded
              ? `${dragRegionClassName} flex h-full w-[var(--desktop-sidebar-width)] shrink-0 items-center justify-end pr-3`
              : `${dragRegionClassName} flex h-full w-[var(--desktop-sidebar-rail-width)] shrink-0 items-center justify-center`
          }
        >
          <div className="z-10 flex items-center" style={noDragStyle}>
            <WorkspaceSidebarToggleButton
              aria-label={workspaceSidebarLabel}
              title={workspaceSidebarLabel}
              data-testid="workspace-sidebar-toggle-titlebar"
              onClick={onToggleSidebar}
            />
          </div>
        </div>
      )}
      <div className="min-w-0 flex-1" />
      <div className="flex h-full items-center" style={noDragStyle}>
        {isChatRoute ? (
          <div className="mr-1.5">
            <ChatToolbar compact />
          </div>
        ) : null}
        {!isSetupRoute ? (
          <div className="mr-2">
            <GlobalTitleBarUtilities compact />
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
