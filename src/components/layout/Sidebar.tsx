/**
 * Sidebar Component
 * Primary application navigation.
 */
import { NavLink } from 'react-router-dom';
import {
  Bot,
  Clock,
  Cpu,
  MessageSquareText,
  Network,
  Puzzle,
  Settings as SettingsIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSettingsStore } from '@/stores/settings';
import { useTranslation } from 'react-i18next';
import { AppBrandLockup } from './AppBrandLockup';

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
  | 'settings';

interface NavItemProps {
  to: string;
  icon: React.ReactNode;
  label: string;
  collapsed?: boolean;
  tone: SidebarTone;
}

interface UtilityItemProps {
  label: string;
  icon: React.ReactNode;
  collapsed?: boolean;
  tone: SidebarTone;
  to?: string;
  onClick?: () => void;
  trailing?: React.ReactNode;
}

function SidebarToneIcon({
  tone,
  children,
}: {
  tone: SidebarTone;
  children: React.ReactNode;
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
        <span className="block max-w-[160px] overflow-hidden text-ellipsis whitespace-nowrap rounded-md border border-border/80 bg-[hsl(var(--surface-elevated)/0.995)] px-2.5 py-1.5 text-[12px] font-medium text-popover-foreground shadow-[0_6px_18px_rgba(15,23,42,0.06)]">
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
            'app-sidebar-nav-link workbench-motion-nav flex w-full items-center rounded-md border border-transparent px-2.5 py-1.5 text-[13px] font-normal tracking-wide select-none',
            'text-foreground/72',
            collapsed
              ? 'mx-auto h-8 w-8 justify-center gap-0 px-0 hover:border-border/55 hover:bg-[hsl(var(--surface-hover)/0.9)] hover:text-foreground hover:shadow-none'
              : 'gap-2 hover:border-border/55 hover:bg-[hsl(var(--surface-hover)/0.9)] hover:text-foreground hover:shadow-none',
            isActive
              ? 'border-border/65 bg-[hsl(var(--surface-elevated)/0.92)] text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.46)]'
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

function UtilityItem({ label, icon, collapsed, tone, to, onClick, trailing }: UtilityItemProps) {
  const baseClass = cn(
    'app-sidebar-nav-link app-sidebar-utility-link workbench-motion-nav flex w-full items-center rounded-md border border-transparent px-2.5 py-1.5 text-[13px] font-normal tracking-wide select-none',
    'text-foreground/70',
    collapsed
      ? 'mx-auto h-8 w-8 justify-center gap-0 px-0 hover:border-border/55 hover:bg-[hsl(var(--surface-hover)/0.9)] hover:text-foreground hover:shadow-none'
      : 'min-h-11 gap-2.5 hover:border-border/50 hover:bg-[hsl(var(--surface-hover)/0.84)] hover:text-foreground hover:shadow-none',
  );
  const content = (
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
      {!collapsed && trailing ? (
        <span className="app-sidebar-utility-trailing flex shrink-0 items-center justify-center text-muted-foreground/46">
          {trailing}
        </span>
      ) : null}
    </>
  );

  if (to) {
    return (
      <RailTooltip collapsed={collapsed} label={label}>
        <NavLink
          to={to}
          aria-label={collapsed ? label : undefined}
          className={({ isActive }) => cn(baseClass, isActive && 'border-border/65 bg-[hsl(var(--surface-elevated)/0.92)] text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.46)]')}
        >
          {content}
        </NavLink>
      </RailTooltip>
    );
  }

  return (
    <RailTooltip collapsed={collapsed} label={label}>
      <button
        type="button"
        aria-label={collapsed ? label : undefined}
        className={baseClass}
        onClick={onClick}
      >
        {content}
      </button>
    </RailTooltip>
  );
}

export function Sidebar({ railOnly = false, className }: SidebarProps) {
  const sidebarCollapsed = useSettingsStore((state) => state.sidebarCollapsed);
  const { t } = useTranslation('common');
  const collapsed = railOnly || sidebarCollapsed;

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
      <div className={cn('px-2 pb-1.5', collapsed ? 'pt-2' : 'pt-2.5')}>
        <AppBrandLockup collapsed={collapsed} testIdPrefix="sidebar-brand" />
      </div>

      <nav className="flex flex-col gap-0.5 px-1.5">
        {navItems.map((item) => (
          <NavItem key={item.to} {...item} collapsed={collapsed} />
        ))}
      </nav>

      <div className="mt-auto px-1.5 pb-1.5 pt-2">
        <div className={cn('border-t border-border/55 pt-2', collapsed ? 'space-y-1.5' : 'space-y-1')}>
          <UtilityItem
            to="/settings"
            icon={<SettingsIcon className="h-[18px] w-[18px]" strokeWidth={2} />}
            label={t('sidebar.settings')}
            collapsed={collapsed}
            tone="settings"
          />
        </div>
      </div>
    </aside>
  );
}
