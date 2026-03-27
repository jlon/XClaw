import { Building2, MessageSquareText } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { isStudioRoutePath, resolveLastChatRoute } from '@/lib/studio';
import { useTranslation } from 'react-i18next';

export function StudioToggleButton({
  compact = false,
  iconOnly = false,
}: {
  compact?: boolean;
  iconOnly?: boolean;
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useTranslation('chat');
  const onStudioRoute = isStudioRoutePath(location.pathname);
  const buttonLabel = onStudioRoute ? t('toolbar.backToChat') : t('toolbar.office');
  const Icon = onStudioRoute ? MessageSquareText : Building2;
  const handleToggle = () => {
    if (!onStudioRoute) {
      navigate('/studio');
      return;
    }

    navigate(resolveLastChatRoute());
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          className={cn(
            'app-chat-toolbar-button app-chat-toolbar-button--studio rounded-[10px] text-[12px] font-medium',
            compact || iconOnly ? 'h-7 w-7 px-0' : 'h-8 min-w-[96px] px-2.5',
            onStudioRoute && 'app-chat-toolbar-button--studio-current',
          )}
          onClick={handleToggle}
          aria-label={buttonLabel}
        >
          <Icon className={cn('shrink-0', compact || iconOnly ? 'h-3.5 w-3.5' : 'mr-1.5 h-4 w-4')} />
          {!compact && !iconOnly ? buttonLabel : null}
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        <p>{buttonLabel}</p>
      </TooltipContent>
    </Tooltip>
  );
}
