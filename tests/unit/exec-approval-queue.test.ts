import { describe, expect, it } from 'vitest';

import {
  addExecApproval,
  parseExecApprovalRequested,
  parseExecApprovalResolved,
  removeExecApproval,
  resolvePendingExecApproval,
} from '@/lib/exec-approval-queue';

describe('exec approval queue', () => {
  it('parses requested and resolved approval payloads', () => {
    expect(parseExecApprovalRequested({
      id: '242f771b-1111-2222-3333-444444444444',
      createdAtMs: 10,
      expiresAtMs: 20,
      request: {
        command: 'find ~/Downloads -type f',
        sessionKey: 'agent:main:main',
      },
    })).toEqual({
      id: '242f771b-1111-2222-3333-444444444444',
      slug: '242f771b',
      createdAtMs: 10,
      expiresAtMs: 20,
      request: {
        command: 'find ~/Downloads -type f',
        cwd: null,
        host: null,
        security: null,
        ask: null,
        agentId: null,
        resolvedPath: null,
        sessionKey: 'agent:main:main',
      },
    });

    expect(parseExecApprovalResolved({
      id: '242f771b-1111-2222-3333-444444444444',
      decision: 'allow-once',
    })).toEqual({
      id: '242f771b-1111-2222-3333-444444444444',
      decision: 'allow-once',
      resolvedBy: null,
      ts: null,
    });
  });

  it('resolves a short approval slug to the full pending id for the current session', () => {
    const entry = parseExecApprovalRequested({
      id: '242f771b-1111-2222-3333-444444444444',
      createdAtMs: 10,
      expiresAtMs: Date.now() + 60_000,
      request: {
        command: 'find ~/Downloads -type f',
        sessionKey: 'agent:main:main',
      },
    });
    expect(entry).not.toBeNull();

    const match = resolvePendingExecApproval(
      [entry!],
      '242f771b',
      'agent:main:main',
    );

    expect(match).toEqual({
      kind: 'match',
      inferred: false,
      entry,
    });
  });

  it('falls back to the only active session approval when the typed id is stale', () => {
    const entry = parseExecApprovalRequested({
      id: '242f771b-1111-2222-3333-444444444444',
      createdAtMs: 10,
      expiresAtMs: Date.now() + 60_000,
      request: {
        command: 'find ~/Downloads -type f',
        sessionKey: 'agent:main:main',
      },
    });
    expect(entry).not.toBeNull();

    const match = resolvePendingExecApproval(
      [entry!],
      'wrong-slug',
      'agent:main:main',
    );

    expect(match).toEqual({
      kind: 'match',
      inferred: true,
      entry,
    });
  });

  it('adds and removes pending approvals by full id', () => {
    const entry = parseExecApprovalRequested({
      id: '242f771b-1111-2222-3333-444444444444',
      createdAtMs: 10,
      expiresAtMs: Date.now() + 60_000,
      request: {
        command: 'find ~/Downloads -type f',
      },
    });
    expect(entry).not.toBeNull();

    const queue = addExecApproval([], entry!);
    expect(queue).toHaveLength(1);
    expect(removeExecApproval(queue, entry!.id)).toEqual([]);
  });
});
