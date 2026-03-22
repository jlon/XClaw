import type { ChatSession } from '@/stores/chat/types';

const OPAQUE_SESSION_ID_RE = /^(session|thread)-[\w-]+$/i;

const normalize = (value?: string | null) => value?.trim() ?? '';

const isMainSessionKey = (sessionKey: string) => sessionKey.endsWith(':main');
const isInternalSessionKey = (sessionKey: string) =>
  sessionKey.includes(':subagent:') || sessionKey.includes(':cron:');

const isGenericMainDisplayName = (value: string, session: ChatSession) =>
  isMainSessionKey(session.key) && ['main', 'main agent'].includes(value.toLowerCase());

const isOpaqueSessionTitle = (value: string, session: ChatSession) =>
  value === session.key || value.startsWith('agent:') || OPAQUE_SESSION_ID_RE.test(value);

export function deriveSessionListTitle(
  session: ChatSession,
  sessionLabel: string | undefined,
  untitledLabel: string,
): { title: string; usedFallbackTitle: boolean } {
  const candidates = [sessionLabel, session.label, session.displayName];
  for (const candidate of candidates) {
    const normalized = normalize(candidate);
    if (!normalized) continue;
    if (isGenericMainDisplayName(normalized, session)) continue;
    if (isOpaqueSessionTitle(normalized, session)) continue;
    return {
      title: normalized,
      usedFallbackTitle: false,
    };
  }

  return {
    title: untitledLabel,
    usedFallbackTitle: true,
  };
}

export function shouldHideSessionFromList(
  session: ChatSession,
  sessionLabel: string | undefined,
  activityMs: number | undefined,
): boolean {
  if (isInternalSessionKey(session.key)) {
    return true;
  }

  const hasMeaningfulLabel = !deriveSessionListTitle(session, sessionLabel, '__untitled__').usedFallbackTitle;
  return isMainSessionKey(session.key) && !hasMeaningfulLabel && !(activityMs && activityMs > 0);
}

export function shouldExcludeSessionFromPrimaryState(session: Pick<ChatSession, 'key'>): boolean {
  return isInternalSessionKey(session.key);
}
