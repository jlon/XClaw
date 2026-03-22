import { shouldExcludeSessionFromPrimaryState } from '@/lib/chat-session-list';
import type { ChatSession } from './types';

type NormalizeLoadedSessionsParams = {
  sessions: ChatSession[];
  currentSessionKey: string;
  localSessions: ChatSession[];
  defaultSessionKey: string;
};

export function normalizeLoadedSessions({
  sessions,
  currentSessionKey,
  localSessions,
  defaultSessionKey,
}: NormalizeLoadedSessionsParams): {
  sessions: ChatSession[];
  nextSessionKey: string;
  discoveredActivity: Record<string, number>;
} {
  const visibleSessions = sessions
    .filter((session) => session.key)
    .filter((session) => !shouldExcludeSessionFromPrimaryState(session));

  const canonicalBySuffix = new Map<string, string>();
  for (const session of visibleSessions) {
    if (!session.key.startsWith('agent:')) continue;
    const parts = session.key.split(':');
    if (parts.length < 3) continue;
    const suffix = parts.slice(2).join(':');
    if (suffix && !canonicalBySuffix.has(suffix)) {
      canonicalBySuffix.set(suffix, session.key);
    }
  }

  const seen = new Set<string>();
  const dedupedSessions = visibleSessions.filter((session) => {
    if (!session.key.startsWith('agent:') && canonicalBySuffix.has(session.key)) return false;
    if (seen.has(session.key)) return false;
    seen.add(session.key);
    return true;
  });

  let nextSessionKey = currentSessionKey || defaultSessionKey;
  if (!nextSessionKey.startsWith('agent:')) {
    const canonicalMatch = canonicalBySuffix.get(nextSessionKey);
    if (canonicalMatch) {
      nextSessionKey = canonicalMatch;
    }
  }
  if (!dedupedSessions.find((session) => session.key === nextSessionKey) && dedupedSessions.length > 0) {
    const hasLocalPendingSession = localSessions.some((session) => session.key === nextSessionKey);
    if (!hasLocalPendingSession) {
      nextSessionKey = dedupedSessions[0].key;
    }
  }

  const sessionsWithCurrent = !dedupedSessions.find((session) => session.key === nextSessionKey) && nextSessionKey
    ? [...dedupedSessions, { key: nextSessionKey, displayName: nextSessionKey }]
    : dedupedSessions;

  const discoveredActivity = Object.fromEntries(
    sessionsWithCurrent
      .filter((session) => typeof session.updatedAt === 'number' && Number.isFinite(session.updatedAt))
      .map((session) => [session.key, session.updatedAt!]),
  );

  return {
    sessions: sessionsWithCurrent,
    nextSessionKey,
    discoveredActivity,
  };
}
