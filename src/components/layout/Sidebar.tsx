/**
 * Sidebar Component
 * Primary application navigation.
 */
import { NavLink } from 'react-router-dom';
import {
  Bot,
  Clock,
  Cpu,
  ExternalLink,
  MessageSquareText,
  Network,
  PanelLeft,
  PanelLeftClose,
  Puzzle,
  Settings as SettingsIcon,
  Terminal,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSettingsStore } from '@/stores/settings';
import { hostApiFetch } from '@/lib/host-api';
import { useTranslation } from 'react-i18next';
import logoSvg from '@/assets/logo.svg';

interface SidebarProps {
  railOnly?: boolean;
  className?: string;
}

type SidebarTone =
  | 'chat'
  | 'models'
  | 'agents'
  | 'channels'
  | 'skills'
  | 'cron'
  | 'settings'
  | 'terminal';

interface NavItemProps {
  to: string;
  icon: React.ReactNode;
  label: string;
  collapsed?: boolean;
  tone: SidebarTone;
}

function SidebarToneIcon({
  tone,
  children,
}: {
  tone: SidebarTone;
  children: React.ReactElement;
}) {
  return (
    <span className={cn('app-sidebar-toned-icon', `app-sidebar-toned-icon--${tone}`)}>
      {children}
    </span>
  );
}

function RailTooltip({
  collapsed,
  label,
  children,
}: {
  collapsed?: boolean;
  label: string;
  children: React.ReactElement;
}) {
  if (!collapsed) {
    return children;
  }

  return (
    <div className="group/sidebar-item relative flex w-full justify-center">
      {children}
      <div
        data-testid="sidebar-tooltip-content"
        aria-hidden="true"
        className="pointer-events-none absolute left-full top-1/2 z-20 ml-2 -translate-y-1/2 translate-x-1 opacity-0 transition-[opacity,transform] duration-150 group-hover/sidebar-item:translate-x-0 group-hover/sidebar-item:opacity-100 group-focus-within/sidebar-item:translate-x-0 group-focus-within/sidebar-item:opacity-100"
      >
        <span className="block max-w-[160px] overflow-hidden text-ellipsis whitespace-nowrap rounded-[10px] border border-border/80 bg-[hsl(var(--surface-elevated)/0.995)] px-2.5 py-1.5 text-[12px] font-medium text-popover-foreground shadow-[0_6px_18px_rgba(15,23,42,0.06)]">
          {label}
        </span>
      </div>
    </div>
  );
}

function NavItem({ to, icon, label, collapsed, tone }: NavItemProps) {
  return (
    <RailTooltip collapsed={collapsed} label={label}>
      <NavLink
        to={to}
        aria-label={collapsed ? label : undefined}
        className={({ isActive }) =>
          cn(
            'app-sidebar-nav-link flex w-full items-center rounded-[10px] border border-transparent px-2.5 py-2 text-[13px] font-normal tracking-[0.01em] transition-[background-color,color,border-color,box-shadow,padding,gap] duration-200 ease-out',
            'text-foreground/68',
            collapsed
              ? 'mx-auto h-8 w-8 justify-center gap-0 px-0 hover:border-transparent hover:bg-[hsl(var(--surface-hover)/0.96)] hover:text-foreground hover:shadow-none'
              : 'gap-2 hover:border-transparent hover:bg-[hsl(var(--surface-hover)/0.96)] hover:text-foreground hover:shadow-none',
            isActive
              ? 'border-transparent bg-[hsl(var(--foreground)/0.07)] text-foreground shadow-none'
              : '',
          )
        }
      >
        {() => (
          <>
            <div className="flex shrink-0 items-center justify-center">
              <SidebarToneIcon tone={tone}>
                {icon}
              </SidebarToneIcon>
            </div>
            <span
              className={cn(
                'flex-1 overflow-hidden whitespace-nowrap transition-[max-width,opacity,transform] duration-300 ease-out',
                collapsed ? 'max-w-0 -translate-x-1.5 opacity-0 pointer-events-none' : 'max-w-[160px] translate-x-0 opacity-100',
              )}
            >
              <span className="block overflow-hidden text-ellipsis whitespace-nowrap">{label}</span>
            </span>
          </>
        )}
      </NavLink>
    </RailTooltip>
  );
}

export function Sidebar({ railOnly = false, className }: SidebarProps) {
  const sidebarCollapsed = useSettingsStore((state) => state.sidebarCollapsed);
  const setSidebarCollapsed = useSettingsStore((state) => state.setSidebarCollapsed);
  const { t } = useTranslation('common');
  const collapsed = railOnly || sidebarCollapsed;

  const openDevConsole = async () => {
    try {
      const result = await hostApiFetch<{
        success: boolean;
        url?: string;
        error?: string;
      }>('/api/gateway/control-ui');
      if (result.success && result.url) {
        window.electron.openExternal(result.url);
      } else {
        console.error('Failed to get Dev Console URL:', result.error);
      }
    } catch (err) {
      console.error('Error opening Dev Console:', err);
    }
  };

  const navItems = [
    { to: '/', icon: <MessageSquareText className="h-[18px] w-[18px]" strokeWidth={2} />, label: t('sidebar.chat'), tone: 'chat' as const },
    { to: '/models', icon: <Cpu className="h-[18px] w-[18px]" strokeWidth={2} />, label: t('sidebar.models'), tone: 'models' as const },
    { to: '/agents', icon: <Bot className="h-[18px] w-[18px]" strokeWidth={2} />, label: t('sidebar.agents'), tone: 'agents' as const },
    { to: '/channels', icon: <Network className="h-[18px] w-[18px]" strokeWidth={2} />, label: t('sidebar.channels'), tone: 'channels' as const },
    { to: '/skills', icon: <Puzzle className="h-[18px] w-[18px]" strokeWidth={2} />, label: t('sidebar.skills'), tone: 'skills' as const },
    { to: '/cron', icon: <Clock className="h-[18px] w-[18px]" strokeWidth={2} />, label: t('sidebar.cronTasks'), tone: 'cron' as const },
  ];

  return (
    <aside
      className={cn(
        'desktop-app-sidebar desktop-app-sidebar-surface flex shrink-0 flex-col overflow-hidden border-r border-border/55 [font-family:var(--font-sidebar)] transition-[width,background-color,border-color] duration-300 ease-out',
        railOnly ? 'desktop-app-sidebar-rail' : 'desktop-app-sidebar-panel',
        collapsed ? 'w-11' : 'w-56',
        className,
      )}
    >
      <div className={cn('px-2 pb-2', collapsed ? 'pt-2' : 'pt-3')}>
        <div className={cn('flex items-center overflow-hidden transition-[padding,gap,justify-content] duration-300 ease-out', collapsed ? 'justify-center px-0' : 'gap-2 px-2')}>
          <img src={logoSvg} alt="XClaw" className={cn('sidebar-brand-mark w-auto shrink-0', collapsed ? 'h-[15px]' : 'h-[18px]')} />
          <span
            data-testid="sidebar-brand-wordmark"
            aria-hidden={collapsed}
            className={cn(
              'sidebar-brand-wordmark overflow-hidden whitespace-nowrap transition-[max-width,opacity,transform] duration-300 ease-out',
              collapsed ? 'max-w-0 -translate-x-1.5 opacity-0 pointer-events-none' : 'max-w-[140px] translate-x-0 opacity-100',
            )}
          >
            <span className="sidebar-brand-wordmark-initial">X</span>
            <span className="sidebar-brand-wordmark-rest">Claw</span>
          </span>
        </div>
        {!railOnly ? (
          <div className={cn('mt-2 flex', collapsed ? 'justify-center' : 'justify-end px-1')}>
            <button
              type="button"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] border border-transparent text-muted-foreground transition-[background-color,color,border-color,box-shadow] hover:border-transparent hover:bg-[hsl(var(--surface-hover)/0.96)] hover:text-foreground hover:shadow-none"
              onClick={() => {
                setSidebarCollapsed(!sidebarCollapsed);
              }}
              title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {collapsed ? (
                <PanelLeft className="h-[18px] w-[18px]" />
              ) : (
                <PanelLeftClose className="h-[18px] w-[18px]" />
              )}
            </button>
          </div>
        ) : null}
      </div>

      <nav className="flex flex-col gap-0.5 px-1.5">
        {navItems.map((item) => (
          <NavItem key={item.to} {...item} collapsed={collapsed} />
        ))}
      </nav>

      <div className="mt-auto p-1.5">
        <NavItem
          to="/settings"
          icon={<SettingsIcon className="h-[18px] w-[18px]" strokeWidth={2} />}
          label={t('sidebar.settings')}
          collapsed={collapsed}
          tone="settings"
        />

        <RailTooltip collapsed={collapsed} label={t('sidebar.openClawPage')}>
          <button
            type="button"
            aria-label={collapsed ? t('sidebar.openClawPage') : undefined}
            className={cn(
              'app-sidebar-nav-link mt-1 flex h-auto w-full items-center rounded-[10px] border border-transparent px-2.5 py-2 text-[13px] font-normal tracking-[0.01em] transition-[background-color,color,border-color,box-shadow,padding,gap] duration-200 ease-out',
              'text-foreground/64',
              collapsed
                ? 'mx-auto h-8 w-8 justify-center gap-0 px-0 hover:border-transparent hover:bg-[hsl(var(--surface-hover)/0.96)] hover:text-foreground hover:shadow-none'
                : 'justify-start gap-2 hover:border-transparent hover:bg-[hsl(var(--surface-hover)/0.96)] hover:text-foreground hover:shadow-none',
            )}
            onClick={openDevConsole}
          >
            <div className="flex shrink-0 items-center justify-center">
              <SidebarToneIcon tone="terminal">
                <Terminal className="h-[18px] w-[18px]" strokeWidth={2} />
              </SidebarToneIcon>
            </div>
            <span
              className={cn(
                'flex-1 overflow-hidden text-left whitespace-nowrap transition-[max-width,opacity,transform] duration-300 ease-out',
                collapsed ? 'max-w-0 -translate-x-1.5 opacity-0 pointer-events-none' : 'max-w-[160px] translate-x-0 opacity-100',
              )}
            >
              <span className="block overflow-hidden text-ellipsis whitespace-nowrap">{t('sidebar.openClawPage')}</span>
            </span>
            <ExternalLink
              className={cn(
                'ml-auto h-3 w-3 shrink-0 text-muted-foreground transition-[opacity,transform,max-width] duration-300 ease-out',
                collapsed ? 'max-w-0 translate-x-1 opacity-0 pointer-events-none' : 'max-w-4 opacity-50',
              )}
            />
          </button>
        </RailTooltip>
      </div>
    </aside>
  );
}
