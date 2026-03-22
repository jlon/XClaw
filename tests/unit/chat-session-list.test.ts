import { describe, expect, it } from 'vitest';
import { deriveSessionListTitle, shouldExcludeSessionFromPrimaryState, shouldHideSessionFromList } from '@/lib/chat-session-list';
import type { ChatSession } from '@/stores/chat/types';

describe('chat session list helpers', () => {
  it('prefers meaningful session labels over agent-flavored defaults', () => {
    const session: ChatSession = {
      key: 'agent:main:main',
      displayName: 'Main',
    };

    expect(deriveSessionListTitle(session, '修 SSH 配置', 'New Chat')).toEqual({
      title: '修 SSH 配置',
      usedFallbackTitle: false,
    });
  });

  it('falls back to a generic conversation title for opaque main-session names', () => {
    const session: ChatSession = {
      key: 'agent:main:main',
      displayName: 'Main Agent',
    };

    expect(deriveSessionListTitle(session, undefined, 'New Chat')).toEqual({
      title: 'New Chat',
      usedFallbackTitle: true,
    });
  });

  it('treats branded main-session display names as fallback metadata instead of conversation titles', () => {
    const session: ChatSession = {
      key: 'agent:main:main',
      displayName: 'XClaw',
    };

    expect(deriveSessionListTitle(session, undefined, 'New Chat')).toEqual({
      title: 'New Chat',
      usedFallbackTitle: true,
    });
  });

  it('hides empty main placeholders and subagent transcripts from the session list', () => {
    expect(
      shouldHideSessionFromList(
        { key: 'agent:main:main', displayName: 'Main' },
        undefined,
        undefined,
      ),
    ).toBe(true);

    expect(
      shouldHideSessionFromList(
        { key: 'agent:main:main', displayName: 'Main', updatedAt: Date.now() },
        undefined,
        Date.now(),
      ),
    ).toBe(false);

    expect(
      shouldHideSessionFromList(
        { key: 'agent:main:session-1:subagent:worker-1', displayName: 'Worker' },
        'Worker',
        Date.now(),
      ),
    ).toBe(true);

    expect(
      shouldHideSessionFromList(
        { key: 'agent:main:cron:job-1:run:abc', displayName: 'Cron job' },
        'Cron job',
        Date.now(),
      ),
    ).toBe(true);
  });

  it('excludes internal automation sessions from the primary chat state', () => {
    expect(shouldExcludeSessionFromPrimaryState({ key: 'agent:main:cron:job-1:run:abc' })).toBe(true);
    expect(shouldExcludeSessionFromPrimaryState({ key: 'agent:main:subagent:worker-1' })).toBe(true);
    expect(shouldExcludeSessionFromPrimaryState({ key: 'agent:main:telegram:direct:12345' })).toBe(false);
  });
});
