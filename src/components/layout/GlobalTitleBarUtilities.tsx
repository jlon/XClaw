import { Loader2, Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useGatewayStore } from '@/stores/gateway';
import { useSettingsStore } from '@/stores/settings';
import { resolveGatewayUi } from '@/pages/Chat/gateway-ui';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';
import { StudioToggleButton } from './StudioToggleButton';

function resolveAppliedTheme(theme: 'light' | 'dark' | 'system') {
  if (theme !== 'system') {
    return theme;
  }
  if (typeof window === 'undefined') {
    return 'light';
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function GlobalTitleBarUtilities({
  compact = false,
  studioIconOnly = false,
}: {
  compact?: boolean;
  studioIconOnly?: boolean;
}) {
  const { t } = useTranslation('chat');
  const theme = useSettingsStore((state) => state.theme);
  const setTheme = useSettingsStore((state) => state.setTheme);
  const gatewayState = useGatewayStore((state) => state.status.state);
  const gatewayUi = resolveGatewayUi(gatewayState);
  const appliedTheme = resolveAppliedTheme(theme);
  const themeToggleLabel = appliedTheme === 'dark' ? t('toolbar.switchToLight') : t('toolbar.switchToDark');
  const ThemeIcon = appliedTheme === 'dark' ? Sun : Moon;

  return (
    <div className="flex items-center gap-1.5">
      <StudioToggleButton compact={compact} iconOnly={studioIconOnly} />

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={cn('app-chat-toolbar-button rounded-[10px]', compact ? 'h-7 w-7' : 'h-8 w-8')}
            aria-label={themeToggleLabel}
            onClick={() => setTheme(appliedTheme === 'dark' ? 'light' : 'dark')}
          >
            <ThemeIcon className={compact ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>{themeToggleLabel}</p>
        </TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <div
            aria-label={t(gatewayUi.labelKey)}
            className={cn(
              'app-chat-runtime-pill app-chat-connection-indicator flex items-center justify-center gap-1 rounded-[9px]',
              compact ? 'h-6 min-w-[1.5rem] px-1.5' : 'h-7 px-2',
            )}
          >
            {gatewayUi.spinning ? (
              <Loader2 className={cn(compact ? 'h-3 w-3' : 'h-3.5 w-3.5', 'animate-spin text-[hsl(var(--warning))]')} />
            ) : (
              <span className={cn('status-indicator h-2 w-2 rounded-full status-indicator-glow', gatewayUi.toneClass)} />
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>{t(gatewayUi.labelKey)}</p>
        </TooltipContent>
      </Tooltip>
    </div>
  );
}
