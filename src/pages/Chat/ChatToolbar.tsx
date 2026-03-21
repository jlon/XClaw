/**
 * Chat Toolbar
 * Session selector, new session, refresh, and thinking toggle.
 * Rendered in the Header when on the Chat page.
 */
import { RefreshCw, Brain } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useChatStore } from '@/stores/chat';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';

export function ChatToolbar({ compact = false }: { compact?: boolean }) {
  const refresh = useChatStore((s) => s.refresh);
  const loading = useChatStore((s) => s.loading);
  const showThinking = useChatStore((s) => s.showThinking);
  const toggleThinking = useChatStore((s) => s.toggleThinking);
  const { t } = useTranslation('chat');

  return (
    <div className="app-chat-toolbar-group flex items-center gap-1.5">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={cn('app-chat-toolbar-button rounded-full', compact ? 'h-7.5 w-7.5' : 'h-8 w-8')}
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
              'app-chat-toolbar-button rounded-full',
              compact ? 'h-7.5 w-7.5' : 'h-8 w-8',
              showThinking && 'bg-primary/10 text-primary shadow-sm',
            )}
            onClick={toggleThinking}
          >
            <Brain className={compact ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>{showThinking ? t('toolbar.hideThinking') : t('toolbar.showThinking')}</p>
        </TooltipContent>
      </Tooltip>
    </div>
  );
}
