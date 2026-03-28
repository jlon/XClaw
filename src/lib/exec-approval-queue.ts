export type ExecApprovalRequestPayload = {
  command: string;
  cwd?: string | null;
  host?: string | null;
  security?: string | null;
  ask?: string | null;
  agentId?: string | null;
  resolvedPath?: string | null;
  sessionKey?: string | null;
};

export type ExecApprovalRequest = {
  id: string;
  slug: string;
  request: ExecApprovalRequestPayload;
  createdAtMs: number;
  expiresAtMs: number;
};

export type ExecApprovalResolved = {
  id: string;
  decision?: string | null;
  resolvedBy?: string | null;
  ts?: number | null;
};

type ApprovalMatch =
  | { kind: 'match'; entry: ExecApprovalRequest; inferred: boolean }
  | { kind: 'ambiguous'; entries: ExecApprovalRequest[] }
  | { kind: 'none' };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function normalizeSessionKey(value?: string | null): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

export function parseExecApprovalRequested(payload: unknown): ExecApprovalRequest | null {
  if (!isRecord(payload)) {
    return null;
  }
  const id = typeof payload.id === 'string' ? payload.id.trim() : '';
  const request = payload.request;
  if (!id || !isRecord(request)) {
    return null;
  }
  const command = typeof request.command === 'string' ? request.command.trim() : '';
  if (!command) {
    return null;
  }
  const createdAtMs = typeof payload.createdAtMs === 'number' ? payload.createdAtMs : 0;
  const expiresAtMs = typeof payload.expiresAtMs === 'number' ? payload.expiresAtMs : 0;
  if (!createdAtMs || !expiresAtMs) {
    return null;
  }
  return {
    id,
    slug: id.slice(0, 8),
    request: {
      command,
      cwd: typeof request.cwd === 'string' ? request.cwd : null,
      host: typeof request.host === 'string' ? request.host : null,
      security: typeof request.security === 'string' ? request.security : null,
      ask: typeof request.ask === 'string' ? request.ask : null,
      agentId: typeof request.agentId === 'string' ? request.agentId : null,
      resolvedPath: typeof request.resolvedPath === 'string' ? request.resolvedPath : null,
      sessionKey: typeof request.sessionKey === 'string' ? request.sessionKey : null,
    },
    createdAtMs,
    expiresAtMs,
  };
}

export function parseExecApprovalResolved(payload: unknown): ExecApprovalResolved | null {
  if (!isRecord(payload)) {
    return null;
  }
  const id = typeof payload.id === 'string' ? payload.id.trim() : '';
  if (!id) {
    return null;
  }
  return {
    id,
    decision: typeof payload.decision === 'string' ? payload.decision : null,
    resolvedBy: typeof payload.resolvedBy === 'string' ? payload.resolvedBy : null,
    ts: typeof payload.ts === 'number' ? payload.ts : null,
  };
}

export function pruneExecApprovalQueue(queue: ExecApprovalRequest[], nowMs = Date.now()): ExecApprovalRequest[] {
  return queue.filter((entry) => entry.expiresAtMs > nowMs);
}

function sameApprovalRequest(left: ExecApprovalRequestPayload, right: ExecApprovalRequestPayload): boolean {
  return left.command === right.command
    && (left.cwd ?? null) === (right.cwd ?? null)
    && (left.host ?? null) === (right.host ?? null)
    && (left.security ?? null) === (right.security ?? null)
    && (left.ask ?? null) === (right.ask ?? null)
    && (left.agentId ?? null) === (right.agentId ?? null)
    && (left.resolvedPath ?? null) === (right.resolvedPath ?? null)
    && (left.sessionKey ?? null) === (right.sessionKey ?? null);
}

export function addExecApproval(
  queue: ExecApprovalRequest[],
  entry: ExecApprovalRequest,
  nowMs = Date.now(),
): ExecApprovalRequest[] {
  const next = pruneExecApprovalQueue(queue, nowMs).filter(
    (item) => item.id !== entry.id && !sameApprovalRequest(item.request, entry.request),
  );
  next.push(entry);
  return next;
}

export function removeExecApproval(
  queue: ExecApprovalRequest[],
  id: string,
  nowMs = Date.now(),
): ExecApprovalRequest[] {
  return pruneExecApprovalQueue(queue, nowMs).filter((entry) => entry.id !== id);
}

function matchApprovalGroup(entries: ExecApprovalRequest[], value: string): ApprovalMatch {
  const normalized = value.trim();
  if (!normalized) {
    return { kind: 'none' };
  }
  const exact = entries.find((entry) => entry.id === normalized || entry.slug === normalized);
  if (exact) {
    return { kind: 'match', entry: exact, inferred: false };
  }
  const prefixMatches = entries.filter(
    (entry) => entry.id.startsWith(normalized) || entry.slug.startsWith(normalized),
  );
  if (prefixMatches.length === 1) {
    return { kind: 'match', entry: prefixMatches[0], inferred: false };
  }
  if (prefixMatches.length > 1) {
    return { kind: 'ambiguous', entries: prefixMatches };
  }
  return { kind: 'none' };
}

export function resolvePendingExecApproval(
  queue: ExecApprovalRequest[],
  requestedId: string,
  sessionKey?: string | null,
  nowMs = Date.now(),
): ApprovalMatch {
  const active = pruneExecApprovalQueue(queue, nowMs);
  const normalizedSessionKey = normalizeSessionKey(sessionKey);
  const sessionEntries = normalizedSessionKey
    ? active.filter((entry) => normalizeSessionKey(entry.request.sessionKey) === normalizedSessionKey)
    : [];

  const sessionMatch = matchApprovalGroup(sessionEntries, requestedId);
  if (sessionMatch.kind !== 'none') {
    return sessionMatch;
  }

  const globalMatch = matchApprovalGroup(active, requestedId);
  if (globalMatch.kind !== 'none') {
    return globalMatch;
  }

  if (sessionEntries.length === 1) {
    return { kind: 'match', entry: sessionEntries[0], inferred: true };
  }
  if (active.length === 1) {
    return { kind: 'match', entry: active[0], inferred: true };
  }
  return { kind: 'none' };
}
