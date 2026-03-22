/**
 * Chat Toolbar
 * Session selector, new session, refresh, and thinking toggle.
 * Rendered in the Header when on the Chat page.
 */
import { RefreshCw, Brain, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useChatStore } from '@/stores/chat';
import { useGatewayStore } from '@/stores/gateway';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';
import { resolveGatewayUi } from './gateway-ui';

export function ChatToolbar({ compact = false }: { compact?: boolean }) {
  const refresh = useChatStore((s) => s.refresh);
  const loading = useChatStore((s) => s.loading);
  const showThinking = useChatStore((s) => s.showThinking);
  const toggleThinking = useChatStore((s) => s.toggleThinking);
  const gatewayState = useGatewayStore((s) => s.status.state);
  const gatewayUi = resolveGatewayUi(gatewayState);
  const { t } = useTranslation('chat');

  return (
    <div className="app-chat-toolbar-group flex items-center gap-1.5">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={cn('app-chat-toolbar-button rounded-[10px]', compact ? 'h-7 w-7' : 'h-8 w-8')}
            onClick={() => refresh()}
            disabled={loading}
          >
            <RefreshCw className={cn(compact ? 'h-3.5 w-3.5' : 'h-4 w-4', loading && 'animate-spin')} />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>{t('toolbar.refresh')}</p>
        </TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              'app-chat-toolbar-button rounded-[10px]',
              compact ? 'h-7 w-7' : 'h-8 w-8',
              showThinking && 'app-chat-toolbar-button--active',
            )}
            onClick={toggleThinking}
            aria-pressed={showThinking}
            aria-label={showThinking ? t('toolbar.hideThinking') : t('toolbar.showThinking')}
            data-testid="chat-toolbar-thinking-toggle"
          >
            <Brain className={compact ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>{showThinking ? t('toolbar.hideThinking') : t('toolbar.showThinking')}</p>
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
            {!compact && (
              <span className="text-[11px] font-medium text-muted-foreground">{t(gatewayUi.labelKey)}</span>
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
