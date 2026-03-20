import { useEffect, useMemo, useState } from 'react';
import { Plus, Search, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useAgentsStore } from '@/stores/agents';
import { useChatStore } from '@/stores/chat';
import { useGatewayStore } from '@/stores/gateway';
import { useTranslation } from 'react-i18next';

type SessionBucketKey =
  | 'today'
  | 'yesterday'
  | 'withinWeek'
  | 'withinTwoWeeks'
  | 'withinMonth'
  | 'older';

const INITIAL_NOW_MS = Date.now();
const AVATAR_STYLES = [
  'from-sky-500 to-indigo-500',
  'from-rose-500 to-orange-500',
  'from-emerald-500 to-lime-500',
  'from-fuchsia-500 to-pink-500',
  'from-amber-500 to-red-500',
  'from-cyan-500 to-blue-500',
];

function getSessionBucket(activityMs: number, nowMs: number): SessionBucketKey {
  if (!activityMs || activityMs <= 0) return 'older';

  const now = new Date(nowMs);
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfYesterday = startOfToday - 24 * 60 * 60 * 1000;

  if (activityMs >= startOfToday) return 'today';
  if (activityMs >= startOfYesterday) return 'yesterday';

  const daysAgo = (startOfToday - activityMs) / (24 * 60 * 60 * 1000);
  if (daysAgo <= 7) return 'withinWeek';
  if (daysAgo <= 14) return 'withinTwoWeeks';
  if (daysAgo <= 30) return 'withinMonth';
  return 'older';
}

function getAgentIdFromSessionKey(sessionKey: string): string {
  if (!sessionKey.startsWith('agent:')) return 'main';
  const [, agentId] = sessionKey.split(':');
  return agentId || 'main';
}

function getAvatarIndex(value: string): number {
  return Array.from(value).reduce((sum, char) => sum + char.charCodeAt(0), 0) % AVATAR_STYLES.length;
}

function getSessionTimeLabel(activityMs: number | undefined, nowMs: number): string {
  if (!activityMs || !Number.isFinite(activityMs)) {
    return '';
  }

  const activity = new Date(activityMs);
  const now = new Date(nowMs);
  const sameYear = activity.getFullYear() === now.getFullYear();
  const sameMonth = activity.getMonth() === now.getMonth();
  const sameDate = activity.getDate() === now.getDate();

  if (sameYear && sameMonth && sameDate) {
    return activity.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  return activity.toLocaleDateString([], {
    month: 'numeric',
    day: 'numeric',
  });
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
  const [nowMs, setNowMs] = useState(INITIAL_NOW_MS);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNowMs(Date.now());
    }, 60 * 1000);
    return () => window.clearInterval(timer);
  }, []);

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
    { key: 'yesterday', label: t('chat:historyBuckets.yesterday'), sessions: [] },
    { key: 'withinWeek', label: t('chat:historyBuckets.withinWeek'), sessions: [] },
    { key: 'withinTwoWeeks', label: t('chat:historyBuckets.withinTwoWeeks'), sessions: [] },
    { key: 'withinMonth', label: t('chat:historyBuckets.withinMonth'), sessions: [] },
    { key: 'older', label: t('chat:historyBuckets.older'), sessions: [] },
  ];

  const sessionBucketMap = Object.fromEntries(sessionBuckets.map((bucket) => [bucket.key, bucket])) as Record<
    SessionBucketKey,
    (typeof sessionBuckets)[number]
  >;
  const normalizedQuery = searchQuery.trim().toLowerCase();

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
    const bucketKey = getSessionBucket(sessionLastActivity[session.key] ?? 0, nowMs);
    sessionBucketMap[bucketKey].sessions.push(session);
  }

  const hasVisibleSessions = sessionBuckets.some((bucket) => bucket.sessions.length > 0);

  return (
    <aside className="flex w-[320px] shrink-0 flex-col border-r border-black/5 bg-[#f4f1ea]/80 dark:bg-background/80">
      <div className="border-b border-black/5 px-4 py-3 dark:border-white/10">
        <div className="flex items-center justify-between">
          <h2 className="text-[18px] font-semibold tracking-tight text-foreground">
            {t('sidebar.chat')}
          </h2>
          <Button
            variant="ghost"
            size="icon"
            title={t('sidebar.newChat')}
            className="h-9 w-9 rounded-full text-foreground/70 hover:bg-black/5 dark:hover:bg-white/10"
            onClick={() => {
              const { messages } = useChatStore.getState();
              if (messages.length > 0) {
                newSession();
              }
              navigate('/');
            }}
          >
            <Plus className="h-[18px] w-[18px]" strokeWidth={2} />
          </Button>
        </div>
        <div className="relative mt-3">
          <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" />
          <Input
            aria-label={t('chat:sessionPane.searchLabel')}
            value={searchQuery}
            placeholder={t('chat:sessionPane.searchPlaceholder')}
            onChange={(event) => setSearchQuery(event.target.value)}
            className="h-9 rounded-xl border-black/5 bg-white/65 pl-9 pr-3 text-[13px] shadow-none placeholder:text-muted-foreground/55 focus-visible:ring-black/10 focus-visible:ring-offset-0 dark:border-white/10 dark:bg-white/5"
          />
        </div>
      </div>

      <div
        data-testid="chat-sessions-scroll-area"
        className={cn(
          'flex-1 overflow-y-auto overflow-x-hidden px-2 py-3',
          isWindows ? 'subtle-scrollbar-win' : 'subtle-scrollbar',
        )}
      >
        {hasVisibleSessions ? (
          sessionBuckets.map((bucket) => (
            bucket.sessions.length > 0 ? (
              <div key={bucket.key} className="pt-2 first:pt-0">
                <div className="px-3 pb-1.5 text-[11px] font-medium text-muted-foreground/60 tracking-tight">
                  {bucket.label}
                </div>
                <div className="space-y-1">
                  {bucket.sessions.map((session) => {
                    const agentId = getAgentIdFromSessionKey(session.key);
                    const agentName = agentNameById[agentId] || agentId;
                    const label = getSessionLabel(session.key, session.displayName, session.label);
                    const avatarStyle = AVATAR_STYLES[getAvatarIndex(`${agentId}:${label}`)];
                    const timeLabel = getSessionTimeLabel(sessionLastActivity[session.key], nowMs);

                    return (
                      <div key={session.key} className="group relative">
                        <button
                          aria-label={label === agentName ? agentName : `${agentName} ${label}`}
                          onClick={() => {
                            switchSession(session.key);
                            navigate('/');
                          }}
                          className={cn(
                            'flex w-full items-start gap-3 rounded-2xl px-3 py-2.5 text-left transition-colors pr-10',
                            currentSessionKey === session.key
                              ? 'bg-white/90 shadow-sm ring-1 ring-black/5 dark:bg-white/10 dark:ring-white/10'
                              : 'hover:bg-white/60 dark:hover:bg-white/5',
                          )}
                        >
                          <div
                            aria-hidden="true"
                            className={cn('mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-sm font-semibold text-white', avatarStyle)}
                          >
                            {agentName.slice(0, 1).toUpperCase()}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="truncate text-[14px] font-semibold text-foreground">
                                {agentName}
                              </span>
                              {timeLabel && (
                                <span aria-hidden="true" className="ml-auto shrink-0 text-[11px] text-muted-foreground">
                                  {timeLabel}
                                </span>
                              )}
                            </div>
                            <div className="mt-1 truncate text-[12px] text-muted-foreground">
                              {label}
                            </div>
                          </div>
                        </button>

                        <button
                          aria-label="Delete session"
                          onClick={(event) => {
                            event.stopPropagation();
                            setSessionToDelete({ key: session.key, label });
                          }}
                          className={cn(
                            'absolute right-3 top-3 flex items-center justify-center rounded-full p-1 transition-opacity',
                            currentSessionKey === session.key ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
                            'text-muted-foreground hover:text-destructive hover:bg-destructive/10',
                          )}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
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
            <div className="flex min-h-[180px] items-center justify-center px-6 text-center text-[13px] text-muted-foreground">
              {t('chat:sessionPane.emptySearch')}
            </div>
          ) : null
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
