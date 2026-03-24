/**
 * Chat Toolbar
 * Session selector, new session, refresh, and thinking toggle.
 * Rendered in the Header when on the Chat page.
 */
import { Building2, MessageSquareText, RefreshCw, Brain } from 'lucide-react';
import { startTransition } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useChatStore } from '@/stores/chat';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';
import { isStudioRoutePath, resolveLastChatRoute, suspendStudioSurface } from '@/lib/studio';

export function ChatToolbar({ compact = false }: { compact?: boolean }) {
  const location = useLocation();
  const navigate = useNavigate();
  const refresh = useChatStore((s) => s.refresh);
  const loading = useChatStore((s) => s.loading);
  const showThinking = useChatStore((s) => s.showThinking);
  const toggleThinking = useChatStore((s) => s.toggleThinking);
  const { t } = useTranslation('chat');
  const onStudioRoute = isStudioRoutePath(location.pathname);
  const showThinkingToggle = !onStudioRoute;
  const officeButtonLabel = onStudioRoute ? t('toolbar.backToChat') : t('toolbar.office');
  const officeButtonHint = onStudioRoute ? t('toolbar.backToChat') : t('toolbar.office');
  const OfficeButtonIcon = onStudioRoute ? MessageSquareText : Building2;
  const handleOfficeToggle = () => {
    if (!onStudioRoute) {
      navigate('/studio');
      return;
    }

    suspendStudioSurface();
    const navigateToChat = () => {
      startTransition(() => {
        navigate(resolveLastChatRoute());
      });
    };

    if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
      window.requestAnimationFrame(() => {
        navigateToChat();
      });
      return;
    }

    navigateToChat();
  };

  return (
    <div className="app-chat-toolbar-group flex items-center gap-1.5">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            className={cn(
              'app-chat-toolbar-button app-chat-toolbar-button--studio rounded-[10px] text-[12px] font-medium',
              compact ? 'h-7 w-7 px-0' : 'h-8 min-w-[96px] px-2.5',
              onStudioRoute && 'app-chat-toolbar-button--studio-current',
            )}
            onClick={handleOfficeToggle}
            aria-label={officeButtonHint}
          >
            <OfficeButtonIcon className={cn('shrink-0', compact ? 'h-3.5 w-3.5' : 'mr-1.5 h-4 w-4')} />
            {!compact ? officeButtonLabel : null}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>{officeButtonHint}</p>
        </TooltipContent>
      </Tooltip>

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

      {showThinkingToggle ? (
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
      ) : null}
    </div>
  );
}
