import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useChatStore } from '@/stores/chat';
import { useAgentsStore } from '@/stores/agents';
import { useSettingsStore } from '@/stores/settings';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';
import {
  WorkspaceSidebarToggleButton,
} from './WorkspaceSidebarToggleButton';

function QClawNewChatIcon({ className }: { className?: string }) {
  return (
    <svg
      data-testid="qclaw-new-chat-icon"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M12 4.40039C13.3792 4.40039 15.1014 4.52731 16.542 4.66211C18.5884 4.8536 20.2351 6.43593 20.4414 8.49805C20.5294 9.37882 20.5996 10.3304 20.5996 11.1338C20.5996 11.9371 20.5294 12.888 20.4414 13.7686C20.2351 15.8308 18.5884 17.413 16.542 17.6045C15.8012 17.6738 14.9889 17.7402 14.1885 17.7891C14.2005 17.7879 14.1618 17.795 14.0537 17.8535C13.9375 17.9164 13.7901 18.0124 13.6133 18.1387C13.2597 18.3913 12.8421 18.7279 12.4092 19.0791C11.985 19.4232 11.5435 19.7819 11.167 20.0537C10.9791 20.1894 10.793 20.315 10.6221 20.4082C10.4788 20.4863 10.2467 20.5996 10 20.5996C9.68732 20.5996 9.43086 20.4469 9.27539 20.21C9.1471 20.0144 9.10627 19.7914 9.08887 19.6289C9.05374 19.3006 9.08924 18.884 9.1123 18.5605C9.13772 18.204 9.14926 17.9302 9.12305 17.7422C8.552 17.7008 7.98683 17.654 7.45801 17.6045C5.41158 17.413 3.76488 15.8307 3.55859 13.7686C3.47058 12.888 3.40042 11.9371 3.40039 11.1338C3.40039 10.3304 3.47057 9.37882 3.55859 8.49805C3.76491 6.43593 5.41156 4.8536 7.45801 4.66211C8.89862 4.52731 10.6208 4.40039 12 4.40039Z"
        stroke="currentColor"
        strokeWidth="1.2"
      />
      <path
        d="M12 8V14"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
      <path
        d="M15 11H9"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function ChatSessionHeaderControls({
  compact = false,
  surface = 'titlebar',
}: {
  compact?: boolean;
  surface?: 'pane' | 'titlebar';
}) {
  const navigate = useNavigate();
  const currentAgentId = useChatStore((s) => ('currentAgentId' in s ? s.currentAgentId : ''));
  const agents = useAgentsStore((s) => s.agents);
  const fetchAgents = useAgentsStore((s) => s.fetchAgents);
  const chatFocusMode = useSettingsStore((s) => ('chatFocusMode' in s ? s.chatFocusMode : false));
  const setChatFocusMode = useSettingsStore((s) => ('setChatFocusMode' in s ? s.setChatFocusMode : (() => undefined)));
  const { t } = useTranslation(['chat', 'common']);
  const [newMenuOpen, setNewMenuOpen] = useState(false);
  const newMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    void fetchAgents();
  }, [fetchAgents]);

  useEffect(() => {
    if (!newMenuOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setNewMenuOpen(false);
      }
    };
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!newMenuRef.current?.contains(target)) {
        setNewMenuOpen(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handlePointerDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handlePointerDown);
    };
  }, [newMenuOpen]);

  const orderedAgents = useMemo(() => {
    const list = agents ?? [];
    const current = list.find((agent) => agent.id === currentAgentId) ?? null;
    const rest = list.filter((agent) => agent.id !== currentAgentId);
    return current ? [current, ...rest] : rest;
  }, [agents, currentAgentId]);

  const handleCreateNewChat = (agentId?: string | null) => {
    setNewMenuOpen(false);
    if (agentId && agentId !== currentAgentId) {
      navigate(`/new/${agentId}`);
      return;
    }
    navigate('/new');
  };

  const sessionPaneLabel = chatFocusMode ? t('toolbar.showSessionPane') : t('toolbar.hideSessionPane');
  const newChatLabel = t('common:sidebar.newChat');
  const buttonClassName = surface === 'pane'
    ? 'inline-flex h-6 w-6 items-center justify-center rounded-[7px] p-0 leading-none text-foreground/90 transition-colors duration-150 hover:bg-transparent hover:text-foreground'
    : 'inline-flex h-6 w-6 items-center justify-center rounded-[7px] p-0 leading-none text-foreground/90 transition-colors duration-150 hover:bg-[hsl(var(--foreground)/0.04)] hover:text-foreground';
  const iconClassName = compact ? 'block h-6 w-6 shrink-0' : 'block h-6 w-6 shrink-0';

  return (
    <div
      data-testid={`chat-session-header-controls-${surface}`}
      className={cn(
        'flex h-full items-center leading-none',
        surface === 'titlebar' && 'gap-2',
        surface === 'pane' && 'ml-auto',
      )}
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <WorkspaceSidebarToggleButton
            className={buttonClassName}
            iconClassName={iconClassName}
            onClick={() => setChatFocusMode(!chatFocusMode)}
            aria-pressed={chatFocusMode}
            aria-label={sessionPaneLabel}
            data-testid={`chat-session-pane-toggle-${surface}`}
          />
        </TooltipTrigger>
        <TooltipContent>
          <p>{sessionPaneLabel}</p>
        </TooltipContent>
      </Tooltip>

      <div ref={newMenuRef} className="relative flex h-full shrink-0 items-center">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              className={buttonClassName}
              onClick={() => {
                if (orderedAgents.length <= 1) {
                  handleCreateNewChat(currentAgentId);
                  return;
                }
                setNewMenuOpen((open) => !open);
              }}
              aria-label={newChatLabel}
              data-testid={`chat-new-chat-${surface}`}
            >
              <QClawNewChatIcon className={iconClassName} />
            </button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{newChatLabel}</p>
          </TooltipContent>
        </Tooltip>

        {newMenuOpen ? (
          <div className="absolute right-0 top-[calc(100%+6px)] z-30 min-w-[168px] rounded-[12px] border border-border/80 bg-[hsl(var(--surface-elevated)/0.995)] p-1 shadow-[0_10px_28px_rgba(15,23,42,0.08)]">
            <div className="px-2 py-1 text-[10px] font-medium tracking-tight text-muted-foreground/56">
              {t('chat:sessionPane.newAgentTitle')}
            </div>
            <div className="space-y-0.5">
              {orderedAgents.map((agent) => (
                <button
                  key={agent.id}
                  type="button"
                  className="flex w-full items-center justify-between rounded-[9px] px-2 py-1.5 text-left text-[12px] text-foreground/88 transition-[background-color,color] duration-150 hover:bg-[hsl(var(--foreground)/0.032)] hover:text-foreground"
                  onClick={() => handleCreateNewChat(agent.id)}
                >
                  <span className="truncate">{agent.name}</span>
                  {agent.id === currentAgentId ? (
                    <span className="ml-2 shrink-0 text-[10px] text-muted-foreground/52">
                      {t('chat:sessionPane.currentAgent')}
                    </span>
                  ) : null}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
