import { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Search, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getAgentIdFromSessionKey } from '@/lib/chat-avatar';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { cn } from '@/lib/utils';
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
  const sessionLabels = useChatStore((s) => s.sessionLabels);
  const sessionLastActivity = useChatStore((s) => s.sessionLastActivity);
  const switchSession = useChatStore((s) => s.switchSession);
  const newSession = useChatStore((s) => s.newSession);
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
  const searchInputRef = useRef<HTMLInputElement | null>(null);

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

  const getSessionLabel = (key: string, displayName?: string, label?: string) =>
    sessionLabels[key] ?? label ?? displayName ?? key;

  const agentNameById = useMemo(
    () => Object.fromEntries((agents ?? []).map((agent) => [agent.id, agent.name])),
    [agents],
  );

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

  for (const session of [...sessions].sort((a, b) =>
    (sessionLastActivity[b.key] ?? 0) - (sessionLastActivity[a.key] ?? 0)
  )) {
    const agentId = getAgentIdFromSessionKey(session.key);
    const agentName = agentNameById[agentId] || agentId;
    const label = getSessionLabel(session.key, session.displayName, session.label);
    const searchableText = `${agentName} ${label}`.toLowerCase();
    if (normalizedQuery && !searchableText.includes(normalizedQuery)) {
      continue;
    }
    visibleLabelCounts[label] = (visibleLabelCounts[label] ?? 0) + 1;
    const bucketKey = getSessionBucket(sessionLastActivity[session.key] ?? 0, nowMs);
    sessionBucketMap[bucketKey].sessions.push(session);
  }

  const hasVisibleSessions = sessionBuckets.some((bucket) => bucket.sessions.length > 0);

  return (
    <aside className="flex w-[236px] shrink-0 flex-col bg-transparent">
      <div className="px-1.5 pb-1 pt-1.5">
        <div className="flex h-7 items-center justify-end px-1">
          <button
            type="button"
            aria-label={t('sidebar.newChat')}
            title={t('sidebar.newChat')}
            className="flex h-6 w-6 items-center justify-center rounded-[8px] text-foreground/54 transition-[background-color,color] duration-150 hover:bg-[hsl(var(--foreground)/0.035)] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/18 focus-visible:ring-offset-0"
            onClick={() => {
              const { messages } = useChatStore.getState();
              if (messages.length > 0) {
                newSession();
              }
              navigate('/');
            }}
          >
            <Plus className="h-[17px] w-[17px]" strokeWidth={2} />
          </button>
        </div>
        {searchOpen || searchQuery ? (
          <div className="relative mt-1 flex h-9 items-center rounded-full border border-transparent bg-[hsl(var(--foreground)/0.035)] px-3.5 transition-[background-color,border-color] duration-150 hover:bg-[hsl(var(--foreground)/0.04)] focus-within:border-[hsl(var(--border-strong)/0.32)] focus-within:bg-[hsl(var(--surface-elevated)/0.98)]">
            <Search aria-hidden="true" className="pointer-events-none h-[15px] w-[15px] shrink-0 text-muted-foreground/44" />
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
              className="h-full min-w-0 flex-1 bg-transparent pl-2 pr-1 text-[12.5px] text-foreground/84 outline-none placeholder:text-muted-foreground/42"
            />
          </div>
        ) : (
          <button
            type="button"
            aria-label={t('chat:sessionPane.searchLabel')}
            className="mt-1 flex h-9 w-full items-center gap-2 rounded-full border border-transparent bg-[hsl(var(--foreground)/0.035)] px-3.5 text-left text-[12.5px] text-muted-foreground/44 transition-[background-color,color,border-color] duration-150 hover:bg-[hsl(var(--foreground)/0.04)] hover:text-muted-foreground/58 focus-visible:border-[hsl(var(--border-strong)/0.32)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/18 focus-visible:ring-offset-0"
            onClick={() => setSearchOpen(true)}
          >
            <Search aria-hidden="true" className="h-[15px] w-[15px] shrink-0" />
            <span>{t('chat:sessionPane.searchPlaceholder')}</span>
          </button>
        )}
      </div>

      <div
        data-testid="chat-sessions-scroll-area"
        className={cn(
          'flex-1 overflow-y-auto overflow-x-hidden px-1.5 pb-3',
          isWindows ? 'subtle-scrollbar-win' : 'subtle-scrollbar',
        )}
      >
        {hasVisibleSessions ? (
          sessionBuckets.map((bucket) => (
            bucket.sessions.length > 0 ? (
              <div key={bucket.key} className="pt-2 first:pt-0">
                <div className="px-3 pb-1 text-[10.5px] font-medium tracking-tight text-muted-foreground/48">
                  {bucket.label}
                </div>
                <div className="space-y-1">
                  {bucket.sessions.map((session) => {
                    const agentId = getAgentIdFromSessionKey(session.key);
                    const agentName = agentNameById[agentId] || agentId;
                    const label = getSessionLabel(session.key, session.displayName, session.label);
                    const shouldShowAgentSuffix = (visibleLabelCounts[label] ?? 0) > 1 && agentName && agentName !== label;
                    const isCurrent = currentSessionKey === session.key;
                    return (
                      <div key={session.key} className="group relative">
                        <button
                          aria-label={label === agentName ? agentName : `${label} ${agentName}`}
                          onClick={() => {
                            switchSession(session.key);
                            navigate('/');
                          }}
                          className={cn(
                            'flex h-9 w-full items-center rounded-[10px] px-3 pr-8 text-left transition-[background-color,color] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/18 focus-visible:ring-offset-0',
                            isCurrent
                              ? 'bg-[hsl(var(--foreground)/0.052)] text-foreground'
                              : 'hover:bg-[hsl(var(--foreground)/0.038)]',
                          )}
                        >
                          <div className="min-w-0 flex-1 truncate text-[13px] font-medium leading-5 tracking-[-0.012em]">
                            <span className="truncate text-foreground/92">{label}</span>
                            {shouldShowAgentSuffix ? (
                              <span className="truncate text-muted-foreground/46">{` · ${agentName}`}</span>
                            ) : null}
                          </div>
                        </button>

                        <button
                          aria-label={t('actions.delete')}
                          onClick={(event) => {
                            event.stopPropagation();
                            setSessionToDelete({ key: session.key, label });
                          }}
                          className={cn(
                            'absolute right-1.5 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-md p-0 text-muted-foreground/36 opacity-0 pointer-events-none transition-[opacity,color,background-color] duration-150 group-hover:opacity-100 group-hover:pointer-events-auto group-focus-within:opacity-100 group-focus-within:pointer-events-auto hover:bg-[hsl(var(--foreground)/0.045)] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/18 focus-visible:ring-offset-0',
                          )}
                        >
                          <Trash2 className="h-3 w-3" />
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
            <div className="flex min-h-[220px] flex-col items-center justify-center gap-1.5 px-6 text-center">
              <div className="text-[12.5px] font-medium text-foreground/72">{t('chat:sessionPane.empty')}</div>
              <div className="max-w-[168px] text-[12px] leading-5 text-muted-foreground/68">
                {t('chat:sessionPane.emptyHint')}
              </div>
            </div>
          )
        )}
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
