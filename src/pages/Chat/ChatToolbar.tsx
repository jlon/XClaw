import { RefreshCw, Brain } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useChatStore } from '@/stores/chat';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';
import { isStudioRoutePath } from '@/lib/studio';

export function ChatToolbar({ compact = false }: { compact?: boolean }) {
  const location = useLocation();
  const refresh = useChatStore((s) => s.refresh);
  const loading = useChatStore((s) => s.loading);
  const showThinking = useChatStore((s) => s.showThinking);
  const toggleThinking = useChatStore((s) => s.toggleThinking);
  const { t } = useTranslation('chat');
  const onStudioRoute = isStudioRoutePath(location.pathname);
  const showThinkingToggle = !onStudioRoute;

  // On Studio route, the chat area is hidden or inactive, so refresh/thinking toggles shouldn't be active
  if (onStudioRoute) {
    return null;
  }

  return (
    <div className="app-chat-toolbar-group flex items-center gap-1.5">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={cn('app-chat-toolbar-button no-drag app-titlebar-utility-surface rounded-md', compact ? 'h-7 w-7' : 'h-8 w-8')}
            type="button"
            onMouseDown={(event) => event.stopPropagation()}
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

      {showThinkingToggle ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                'app-chat-toolbar-button no-drag app-titlebar-utility-surface rounded-md',
                compact ? 'h-7 w-7' : 'h-8 w-8',
                showThinking && 'app-chat-toolbar-button--active',
              )}
              type="button"
              onMouseDown={(event) => event.stopPropagation()}
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
      ) : null}
    </div>
  );
}
