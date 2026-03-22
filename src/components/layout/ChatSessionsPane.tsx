import { useEffect, useMemo, useRef, useState } from 'react';
import { Bot, Clock, Cpu, LayoutGrid, MessageCirclePlus, Network, Puzzle, Search, Settings, Terminal, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getAgentIdFromSessionKey } from '@/lib/chat-avatar';
import { deriveSessionListTitle, shouldHideSessionFromList } from '@/lib/chat-session-list';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { cn } from '@/lib/utils';
import { hostApiFetch } from '@/lib/host-api';
import { useAgentsStore } from '@/stores/agents';
import { useChatStore } from '@/stores/chat';
import { useGatewayStore } from '@/stores/gateway';
import { useTranslation } from 'react-i18next';

type SessionBucketKey =
  | 'today'
  | 'withinWeek'
  | 'withinMonth'
  | 'older';

function getSessionBucket(activityMs: number, nowMs: number): SessionBucketKey {
  if (!activityMs || activityMs <= 0) return 'older';

  const now = new Date(nowMs);
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  startOfWeek.setHours(0, 0, 0, 0);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

  if (activityMs >= startOfToday) return 'today';
  if (activityMs >= startOfWeek.getTime()) return 'withinWeek';
  if (activityMs >= startOfMonth) return 'withinMonth';
  return 'older';
}

export function ChatSessionsPane() {
  const { t } = useTranslation(['common', 'chat']);
  const navigate = useNavigate();
  const isWindows = window.electron?.platform === 'win32';
  const sessions = useChatStore((s) => s.sessions);
  const currentSessionKey = useChatStore((s) => s.currentSessionKey);
  const currentAgentId = useChatStore((s) => s.currentAgentId);
  const sessionLabels = useChatStore((s) => s.sessionLabels);
  const sessionLastActivity = useChatStore((s) => s.sessionLastActivity);
  const switchSession = useChatStore((s) => s.switchSession);
  const deleteSession = useChatStore((s) => s.deleteSession);
  const loadSessions = useChatStore((s) => s.loadSessions);
  const loadHistory = useChatStore((s) => s.loadHistory);
  const gatewayStatus = useGatewayStore((s) => s.status);
  const agents = useAgentsStore((s) => s.agents);
  const fetchAgents = useAgentsStore((s) => s.fetchAgents);

  const isGatewayRunning = gatewayStatus.state === 'running';
  const [sessionToDelete, setSessionToDelete] = useState<{ key: string; label: string } | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [newMenuOpen, setNewMenuOpen] = useState(false);
  const [workspaceMenuOpen, setWorkspaceMenuOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const newMenuRef = useRef<HTMLDivElement | null>(null);
  const workspaceMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNowMs(Date.now());
    }, 60 * 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!searchOpen) return;
    searchInputRef.current?.focus();
  }, [searchOpen]);

  useEffect(() => {
    if (!newMenuOpen) return;
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!newMenuRef.current?.contains(target)) {
        setNewMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
    };
  }, [newMenuOpen]);

  useEffect(() => {
    if (!workspaceMenuOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setWorkspaceMenuOpen(false);
      }
    };
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!workspaceMenuRef.current?.contains(target)) {
        setWorkspaceMenuOpen(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handlePointerDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handlePointerDown);
    };
  }, [workspaceMenuOpen]);

  useEffect(() => {
    void fetchAgents();
  }, [fetchAgents]);

  useEffect(() => {
    if (!isGatewayRunning) return;
    let cancelled = false;
    const hasExistingMessages = useChatStore.getState().messages.length > 0;
    void (async () => {
      await loadSessions();
      if (cancelled) return;
      await loadHistory(hasExistingMessages);
    })();
    return () => {
      cancelled = true;
    };
  }, [isGatewayRunning, loadHistory, loadSessions]);

  const agentNameById = useMemo(
    () => Object.fromEntries((agents ?? []).map((agent) => [agent.id, agent.name])),
    [agents],
  );
  const orderedAgents = useMemo(() => {
    const list = agents ?? [];
    const current = list.find((agent) => agent.id === currentAgentId) ?? null;
    const rest = list.filter((agent) => agent.id !== currentAgentId);
    return current ? [current, ...rest] : rest;
  }, [agents, currentAgentId]);
  const workspaceItems = useMemo(() => ([
    { to: '/models', label: t('common:sidebar.models'), icon: Cpu },
    { to: '/agents', label: t('common:sidebar.agents'), icon: Bot },
    { to: '/channels', label: t('common:sidebar.channels'), icon: Network },
    { to: '/skills', label: t('common:sidebar.skills'), icon: Puzzle },
    { to: '/cron', label: t('common:sidebar.cronTasks'), icon: Clock },
  ]), [t]);

  const sessionBuckets: Array<{ key: SessionBucketKey; label: string; sessions: typeof sessions }> = [
    { key: 'today', label: t('chat:historyBuckets.today'), sessions: [] },
    { key: 'withinWeek', label: t('chat:historyBuckets.withinWeek'), sessions: [] },
    { key: 'withinMonth', label: t('chat:historyBuckets.withinMonth'), sessions: [] },
    { key: 'older', label: t('chat:historyBuckets.older'), sessions: [] },
  ];

  const sessionBucketMap = Object.fromEntries(sessionBuckets.map((bucket) => [bucket.key, bucket])) as Record<
    SessionBucketKey,
    (typeof sessionBuckets)[number]
  >;
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const visibleLabelCounts: Record<string, number> = {};
  const untitledSessionLabel = t('sidebar.newChat');

  for (const session of [...sessions].sort((a, b) =>
    (sessionLastActivity[b.key] ?? 0) - (sessionLastActivity[a.key] ?? 0)
  )) {
    const agentId = getAgentIdFromSessionKey(session.key);
    const agentName = agentNameById[agentId] || agentId;
    const sessionLabel = sessionLabels[session.key];
    if (shouldHideSessionFromList(session, sessionLabel, sessionLastActivity[session.key])) {
      continue;
    }
    const { title } = deriveSessionListTitle(session, sessionLabel, untitledSessionLabel);
    const searchableText = `${title} ${agentName}`.toLowerCase();
    if (normalizedQuery && !searchableText.includes(normalizedQuery)) {
      continue;
    }
    visibleLabelCounts[title] = (visibleLabelCounts[title] ?? 0) + 1;
    const bucketKey = getSessionBucket(sessionLastActivity[session.key] ?? 0, nowMs);
    sessionBucketMap[bucketKey].sessions.push(session);
  }

  const hasVisibleSessions = sessionBuckets.some((bucket) => bucket.sessions.length > 0);
  const handleCreateNewChat = (agentId?: string | null) => {
    setNewMenuOpen(false);
    if (agentId && agentId !== currentAgentId) {
      navigate(`/new/${agentId}`);
      return;
    }
    navigate('/new');
  };
  const openDevConsole = async () => {
    try {
      const result = await hostApiFetch<{ success: boolean; url?: string }>('/api/gateway/control-ui');
      if (result.success && result.url) {
        window.electron.openExternal(result.url);
      }
    } catch {
      return undefined;
    }
  };

  return (
    <aside className="flex w-[250px] shrink-0 flex-col bg-transparent [font-family:var(--font-ui)]">
      <div className="px-3 pb-2 pt-3">
        <div className="flex min-h-9 items-center gap-1.5">
          {searchOpen || searchQuery ? (
            <div className="app-chat-session-control app-chat-session-control--search relative flex h-9 min-w-0 flex-1 items-center rounded-full px-4 transition-[background-color,border-color,box-shadow] duration-150">
              <Search aria-hidden="true" className="pointer-events-none h-[14px] w-[14px] shrink-0 text-[#9ca3af]" />
              <input
                ref={searchInputRef}
                aria-label={t('chat:sessionPane.searchLabel')}
                value={searchQuery}
                placeholder={t('chat:sessionPane.searchPlaceholder')}
                onBlur={() => {
                  if (!searchQuery.trim()) {
                    setSearchOpen(false);
                  }
                }}
                onChange={(event) => setSearchQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Escape' && !searchQuery.trim()) {
                    setSearchOpen(false);
                  }
                }}
                className="h-full min-w-0 flex-1 bg-transparent pl-2 pr-0 text-[14px] font-normal leading-5 text-[#333] outline-none placeholder:text-[#bbb]"
              />
            </div>
          ) : (
            <button
              type="button"
              aria-label={t('chat:sessionPane.searchLabel')}
              className="app-chat-session-control app-chat-session-control--search flex h-9 min-w-0 flex-1 items-center gap-2 rounded-full px-4 text-left text-[14px] font-normal leading-5 text-[#bbb] transition-[background-color,color,border-color,box-shadow] duration-150 focus-visible:outline-none"
              onClick={() => setSearchOpen(true)}
            >
              <Search aria-hidden="true" className="h-[14px] w-[14px] shrink-0 text-[#9ca3af]" />
              <span className="truncate">{t('chat:sessionPane.searchPlaceholder')}</span>
            </button>
          )}
          <div ref={newMenuRef} className="relative shrink-0">
            <button
              type="button"
              aria-label={t('sidebar.newChat')}
              title={t('sidebar.newChat')}
              className="app-chat-session-utility-button flex h-7 w-7 items-center justify-center rounded-full text-[#70757d] transition-[background-color,color,border-color,box-shadow] duration-150 hover:text-[#24292f] focus-visible:outline-none"
              onClick={() => {
                if (orderedAgents.length <= 1) {
                  handleCreateNewChat(currentAgentId);
                  return;
                }
                setNewMenuOpen((open) => !open);
              }}
            >
              <MessageCirclePlus className="h-[15px] w-[15px]" strokeWidth={1.9} />
            </button>
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
      </div>

      <div
        data-testid="chat-sessions-scroll-area"
        className={cn(
          'flex-1 overflow-y-auto overflow-x-hidden px-2 pb-4 pt-0',
          isWindows ? 'subtle-scrollbar-win' : 'subtle-scrollbar',
        )}
      >
        {hasVisibleSessions ? (
          sessionBuckets.map((bucket) => (
            bucket.sessions.length > 0 ? (
              <div key={bucket.key} className="pt-1 first:pt-0">
                <div className="px-3 pb-1 text-[12px] font-normal leading-4 tracking-normal text-[#999]">
                  {bucket.label}
                </div>
                <div className="space-y-1">
                  {bucket.sessions.map((session) => {
                    const agentId = getAgentIdFromSessionKey(session.key);
                    const agentName = agentNameById[agentId] || agentId;
                    const { title, usedFallbackTitle } = deriveSessionListTitle(
                      session,
                      sessionLabels[session.key],
                      untitledSessionLabel,
                    );
                    const shouldShowAgentSuffix = ((visibleLabelCounts[title] ?? 0) > 1 || usedFallbackTitle)
                      && agentName
                      && agentName !== title;
                    const isCurrent = currentSessionKey === session.key;
                    const accessibleLabel = shouldShowAgentSuffix ? `${title} ${agentName}` : title;
                    return (
                      <div key={session.key} className="group relative">
                        <button
                          aria-label={accessibleLabel}
                          title={accessibleLabel}
                          onClick={() => {
                            switchSession(session.key);
                            navigate('/');
                          }}
                          className={cn(
                            'app-chat-session-row flex h-10 w-full items-center rounded-full px-4 pr-8 text-left transition-[background-color,color,border-color,box-shadow] duration-150 focus-visible:outline-none',
                            isCurrent
                              ? 'app-chat-session-row--active text-foreground'
                              : 'text-[#222]',
                          )}
                        >
                          <div className="min-w-0 flex-1 truncate text-[14px] font-normal leading-5 tracking-normal text-[#333]">
                            <span className="truncate text-[#333]">{title}</span>
                          </div>
                        </button>

                        <button
                          aria-label={t('actions.delete')}
                          onClick={(event) => {
                            event.stopPropagation();
                            setSessionToDelete({ key: session.key, label: title });
                          }}
                          className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md p-0 text-[#9ca3af] opacity-0 pointer-events-none transition-[opacity,color,background-color] duration-150 group-hover:opacity-100 group-hover:pointer-events-auto group-focus-within:opacity-100 group-focus-within:pointer-events-auto hover:bg-[#0000000f] hover:text-[#4b5563] focus-visible:outline-none"
                        >
                          <Trash2 className="h-[12px] w-[12px]" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null
          ))
        ) : (
          normalizedQuery ? (
            <div className="flex min-h-[180px] items-center justify-center px-6 text-center text-[12.5px] text-muted-foreground/76">
              {t('chat:sessionPane.emptySearch')}
            </div>
          ) : (
            <div className="px-3 py-6">
              <div className="text-[11.5px] font-medium tracking-tight text-foreground/52">{t('chat:sessionPane.empty')}</div>
              <div className="mt-1 max-w-[172px] text-[11px] leading-5 text-muted-foreground/56">
                {t('chat:sessionPane.emptyHint')}
              </div>
            </div>
          )
        )}
      </div>

      <div className="border-t border-[#f0f0f0] px-2 py-2">
        <div className="flex items-center gap-1.5">
          <div ref={workspaceMenuRef} className="relative min-w-0 flex-1">
            <button
              type="button"
              className="app-chat-session-footer-action flex h-8 w-full items-center gap-2.5 rounded-[10px] px-3 text-left text-[13px] font-normal leading-5 text-[#4b5563] transition-[background-color,color] duration-150 hover:text-[#1f2937]"
              onClick={() => setWorkspaceMenuOpen((open) => !open)}
            >
              <LayoutGrid className="h-[14px] w-[14px] shrink-0" strokeWidth={1.9} />
              <span className="truncate">{t('chat:sessionPane.workspaceLauncher')}</span>
            </button>
            {workspaceMenuOpen ? (
              <div className="absolute bottom-[calc(100%+8px)] left-0 z-30 w-[188px] rounded-[15px] border border-[#ececee] bg-white p-1.5 shadow-[0_10px_24px_rgba(15,23,42,0.08)]">
                <div className="space-y-0.5">
                  {workspaceItems.map((item) => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.to}
                        type="button"
                        className="app-chat-session-workspace-item flex h-8 w-full items-center gap-2.5 rounded-[10px] px-2.5 text-left text-[12.5px] text-[#333] transition-[background-color,color] duration-150 hover:text-[#1f2937]"
                        onClick={() => {
                          setWorkspaceMenuOpen(false);
                          navigate(item.to);
                        }}
                      >
                        <Icon className="h-[14px] w-[14px] shrink-0" strokeWidth={1.9} />
                        <span className="truncate">{item.label}</span>
                      </button>
                    );
                  })}
                  <div className="my-1 border-t border-[#f0f0f0]" />
                  <button
                    type="button"
                    className="app-chat-session-workspace-item flex h-8 w-full items-center gap-2.5 rounded-[10px] px-2.5 text-left text-[12.5px] text-[#4b5563] transition-[background-color,color] duration-150 hover:text-[#1f2937]"
                    onClick={() => {
                      setWorkspaceMenuOpen(false);
                      void openDevConsole();
                    }}
                  >
                    <Terminal className="h-[14px] w-[14px] shrink-0" strokeWidth={1.9} />
                    <span className="truncate">{t('common:sidebar.openClawPage')}</span>
                  </button>
                </div>
              </div>
            ) : null}
          </div>

          <button
            type="button"
            aria-label={t('common:sidebar.settings')}
            title={t('common:sidebar.settings')}
            className="app-chat-session-utility-button flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] text-[#70757d] transition-[background-color,color,border-color,box-shadow] duration-150 hover:text-[#1f2937] focus-visible:outline-none"
            onClick={() => navigate('/settings')}
          >
            <Settings className="h-[14px] w-[14px]" strokeWidth={1.9} />
          </button>
        </div>
      </div>

      <ConfirmDialog
        open={!!sessionToDelete}
        title={t('actions.confirm')}
        message={t('sidebar.deleteSessionConfirm', { label: sessionToDelete?.label })}
        confirmLabel={t('actions.delete')}
        cancelLabel={t('actions.cancel')}
        variant="destructive"
        onConfirm={async () => {
          if (!sessionToDelete) return;
          await deleteSession(sessionToDelete.key);
          if (currentSessionKey === sessionToDelete.key) {
            navigate('/');
          }
          setSessionToDelete(null);
        }}
        onCancel={() => setSessionToDelete(null)}
      />
    </aside>
  );
}
