/**
 * Sidebar Component
 * Primary application navigation.
 */
import { useState } from 'react';
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
import { Button } from '@/components/ui/button';
import { hostApiFetch } from '@/lib/host-api';
import { useTranslation } from 'react-i18next';
import logoSvg from '@/assets/logo.svg';

interface SidebarProps {
  railOnly?: boolean;
  className?: string;
}

interface NavItemProps {
  to: string;
  icon: React.ReactNode;
  label: string;
  collapsed?: boolean;
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
        <span className="block max-w-[160px] overflow-hidden text-ellipsis whitespace-nowrap rounded-xl border border-border/70 bg-popover/95 px-3 py-1.5 text-[12px] font-medium text-popover-foreground shadow-[0_10px_30px_rgba(15,23,42,0.10)]">
          {label}
        </span>
      </div>
    </div>
  );
}

function NavItem({ to, icon, label, collapsed }: NavItemProps) {
  return (
    <RailTooltip collapsed={collapsed} label={label}>
      <NavLink
        to={to}
        aria-label={collapsed ? label : undefined}
        className={({ isActive }) =>
          cn(
            'flex w-full items-center rounded-lg px-2.5 py-2 text-[14px] font-medium transition-[background-color,color,padding,gap,border-color,box-shadow] duration-300 ease-out',
            'text-foreground/80',
            collapsed
              ? 'mx-auto h-10 w-10 justify-center gap-0 rounded-2xl border border-transparent px-0 hover:bg-accent hover:text-foreground hover:shadow-sm'
              : 'gap-2.5 hover:bg-accent/80',
            isActive
              ? 'bg-accent text-accent-foreground shadow-sm ring-1 ring-border/70'
              : '',
          )
        }
      >
        {({ isActive }) => (
          <>
            <div className={cn('flex shrink-0 items-center justify-center', isActive ? 'text-foreground' : 'text-muted-foreground')}>
              {icon}
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
  const [railExpanded, setRailExpanded] = useState(false);

  const collapsed = railOnly ? !railExpanded : sidebarCollapsed;

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
    { to: '/', icon: <MessageSquareText className="h-[18px] w-[18px]" strokeWidth={2} />, label: t('sidebar.chat') },
    { to: '/models', icon: <Cpu className="h-[18px] w-[18px]" strokeWidth={2} />, label: t('sidebar.models') },
    { to: '/agents', icon: <Bot className="h-[18px] w-[18px]" strokeWidth={2} />, label: t('sidebar.agents') },
    { to: '/channels', icon: <Network className="h-[18px] w-[18px]" strokeWidth={2} />, label: t('sidebar.channels') },
    { to: '/skills', icon: <Puzzle className="h-[18px] w-[18px]" strokeWidth={2} />, label: t('sidebar.skills') },
    { to: '/cron', icon: <Clock className="h-[18px] w-[18px]" strokeWidth={2} />, label: t('sidebar.cronTasks') },
  ];

  return (
    <aside
      className={cn(
        'desktop-app-sidebar desktop-app-sidebar-surface flex shrink-0 flex-col overflow-hidden border-r border-border/70 bg-background/85 shadow-[inset_-1px_0_0_hsl(var(--border)/0.35)] transition-[width,background-color,border-color] duration-300 ease-out',
        railOnly ? 'desktop-app-sidebar-rail' : 'desktop-app-sidebar-panel',
        collapsed ? 'w-16' : 'w-64',
        className,
      )}
    >
      <div className="px-2 pb-2 pt-3">
        <div className={cn('flex items-center overflow-hidden transition-[padding,gap,justify-content] duration-300 ease-out', collapsed ? 'justify-center px-0' : 'gap-2 px-2')}>
          <img src={logoSvg} alt="XClaw" className="sidebar-brand-mark h-5 w-auto shrink-0" />
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
        <div className={cn('mt-2 flex', collapsed ? 'justify-center' : 'justify-end px-1')}>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 text-muted-foreground hover:bg-accent"
            onClick={() => {
              if (railOnly) {
                setRailExpanded((value) => !value);
                return;
              }
              setSidebarCollapsed(!sidebarCollapsed);
            }}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? (
              <PanelLeft className="h-[18px] w-[18px]" />
            ) : (
              <PanelLeftClose className="h-[18px] w-[18px]" />
            )}
          </Button>
        </div>
      </div>

      <nav className="flex flex-col gap-0.5 px-2">
        {navItems.map((item) => (
          <NavItem key={item.to} {...item} collapsed={collapsed} />
        ))}
      </nav>

      <div className="mt-auto p-2">
        <NavItem
          to="/settings"
          icon={<SettingsIcon className="h-[18px] w-[18px]" strokeWidth={2} />}
          label={t('sidebar.settings')}
          collapsed={collapsed}
        />

        <RailTooltip collapsed={collapsed} label={t('sidebar.openClawPage')}>
          <Button
            variant="ghost"
            aria-label={collapsed ? t('sidebar.openClawPage') : undefined}
            className={cn(
              'flex items-center rounded-lg px-2.5 py-2 h-auto text-[14px] font-medium transition-[background-color,color,padding,gap,border-color,box-shadow] duration-300 ease-out w-full mt-1',
              'text-foreground/80',
              collapsed
                ? 'mx-auto h-10 w-10 justify-center gap-0 rounded-2xl border border-transparent px-0 hover:bg-accent hover:text-foreground hover:shadow-sm'
                : 'justify-start gap-2.5 hover:bg-accent/80',
            )}
            onClick={openDevConsole}
          >
            <div className="flex shrink-0 items-center justify-center text-muted-foreground">
              <Terminal className="h-[18px] w-[18px]" strokeWidth={2} />
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
                'h-3 w-3 shrink-0 ml-auto text-muted-foreground transition-[opacity,transform,max-width] duration-300 ease-out',
                collapsed ? 'max-w-0 translate-x-1 opacity-0 pointer-events-none' : 'max-w-4 opacity-50',
              )}
            />
          </Button>
        </RailTooltip>
      </div>
    </aside>
  );
}
