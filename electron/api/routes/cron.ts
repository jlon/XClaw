import { readFile } from 'node:fs/promises';
import type { IncomingMessage, ServerResponse } from 'http';
import { join } from 'node:path';
import type { HostApiContext } from '../context';
import { parseJsonBody, sendJson } from '../route-utils';
import { getOpenClawConfigDir } from '../../utils/paths';

interface GatewayCronJob {
  id: string;
  agentId?: string;
  name: string;
  description?: string;
  enabled: boolean;
  createdAtMs: number;
  updatedAtMs: number;
  schedule: { kind: string; expr?: string; everyMs?: number; at?: string; tz?: string };
  payload: { kind: string; message?: string; text?: string };
  delivery?: { mode: string; channel?: string; to?: string; accountId?: string };
  sessionTarget?: string;
  state: {
    nextRunAtMs?: number;
    runningAtMs?: number;
    lastRunAtMs?: number;
    lastStatus?: string;
    lastError?: string;
    lastDurationMs?: number;
  };
}

interface CronRunLogEntry {
  jobId?: string;
  action?: string;
  status?: string;
  error?: string;
  summary?: string;
  sessionId?: string;
  sessionKey?: string;
  ts?: number;
  runAtMs?: number;
  durationMs?: number;
  model?: string;
  provider?: string;
}

interface CronSessionKeyParts {
  agentId: string;
  jobId: string;
  runSessionId?: string;
}

interface CronSessionFallbackMessage {
  id: string;
  role: 'assistant' | 'system';
  content: string;
  timestamp: number;
  isError?: boolean;
}

function parseCronSessionKey(sessionKey: string): CronSessionKeyParts | null {
  if (!sessionKey.startsWith('agent:')) return null;
  const parts = sessionKey.split(':');
  if (parts.length < 4 || parts[2] !== 'cron') return null;

  const agentId = parts[1] || 'main';
  const jobId = parts[3];
  if (!jobId) return null;

  if (parts.length === 4) {
    return { agentId, jobId };
  }

  if (parts.length === 6 && parts[4] === 'run' && parts[5]) {
    return { agentId, jobId, runSessionId: parts[5] };
  }

  return null;
}

function normalizeTimestampMs(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value < 1e12 ? value * 1000 : value;
  }
  if (typeof value === 'string' && value.trim()) {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return undefined;
}

function formatDuration(durationMs: number | undefined): string | null {
  if (!durationMs || !Number.isFinite(durationMs)) return null;
  if (durationMs < 1000) return `${Math.round(durationMs)}ms`;
  if (durationMs < 10_000) return `${(durationMs / 1000).toFixed(1)}s`;
  return `${Math.round(durationMs / 1000)}s`;
}

function buildCronRunMessage(entry: CronRunLogEntry, index: number): CronSessionFallbackMessage | null {
  const timestamp = normalizeTimestampMs(entry.ts) ?? normalizeTimestampMs(entry.runAtMs);
  if (!timestamp) return null;

  const status = typeof entry.status === 'string' ? entry.status.toLowerCase() : '';
  const summary = typeof entry.summary === 'string' ? entry.summary.trim() : '';
  const error = typeof entry.error === 'string' ? entry.error.trim() : '';
  let content = summary || error;

  if (!content) {
    content = status === 'error'
      ? 'Scheduled task failed.'
      : 'Scheduled task completed.';
  }

  if (status === 'error' && !content.toLowerCase().startsWith('run failed:')) {
    content = `Run failed: ${content}`;
  }

  const meta: string[] = [];
  const duration = formatDuration(entry.durationMs);
  if (duration) meta.push(`Duration: ${duration}`);
  if (entry.provider && entry.model) {
    meta.push(`Model: ${entry.provider}/${entry.model}`);
  } else if (entry.model) {
    meta.push(`Model: ${entry.model}`);
  }
  if (meta.length > 0) {
    content = `${content}\n\n${meta.join(' | ')}`;
  }

  return {
    id: `cron-run-${entry.sessionId ?? entry.ts ?? index}`,
    role: status === 'error' ? 'system' : 'assistant',
    content,
    timestamp,
    ...(status === 'error' ? { isError: true } : {}),
  };
}

async function readCronRunLog(jobId: string): Promise<CronRunLogEntry[]> {
  const logPath = join(getOpenClawConfigDir(), 'cron', 'runs', `${jobId}.jsonl`);
  const raw = await readFile(logPath, 'utf8').catch(() => '');
  if (!raw.trim()) return [];

  const entries: CronRunLogEntry[] = [];
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const entry = JSON.parse(trimmed) as CronRunLogEntry;
      if (!entry || entry.jobId !== jobId) continue;
      if (entry.action && entry.action !== 'finished') continue;
      entries.push(entry);
    } catch {
      // Ignore malformed log lines so one bad entry does not hide the rest.
    }
  }
  return entries;
}

async function readSessionStoreEntry(
  agentId: string,
  sessionKey: string,
): Promise<Record<string, unknown> | undefined> {
  const storePath = join(getOpenClawConfigDir(), 'agents', agentId, 'sessions', 'sessions.json');
  const raw = await readFile(storePath, 'utf8').catch(() => '');
  if (!raw.trim()) return undefined;

  try {
    const store = JSON.parse(raw) as Record<string, unknown>;
    const directEntry = store[sessionKey];
    if (directEntry && typeof directEntry === 'object') {
      return directEntry as Record<string, unknown>;
    }

    const sessions = (store as { sessions?: unknown }).sessions;
    if (Array.isArray(sessions)) {
      const arrayEntry = sessions.find((entry) => {
        if (!entry || typeof entry !== 'object') return false;
        const record = entry as Record<string, unknown>;
        return record.key === sessionKey || record.sessionKey === sessionKey;
      });
      if (arrayEntry && typeof arrayEntry === 'object') {
        return arrayEntry as Record<string, unknown>;
      }
    }
  } catch {
    return undefined;
  }

  return undefined;
}

export function buildCronSessionFallbackMessages(params: {
  sessionKey: string;
  job?: Pick<GatewayCronJob, 'name' | 'payload' | 'state'>;
  runs: CronRunLogEntry[];
  sessionEntry?: { label?: string; updatedAt?: number };
  limit?: number;
}): CronSessionFallbackMessage[] {
  const parsed = parseCronSessionKey(params.sessionKey);
  if (!parsed) return [];

  const matchingRuns = params.runs
    .filter((entry) => {
      if (!parsed.runSessionId) return true;
      return entry.sessionId === parsed.runSessionId
        || entry.sessionKey === `${params.sessionKey}`;
    })
    .sort((a, b) => {
      const left = normalizeTimestampMs(a.ts) ?? normalizeTimestampMs(a.runAtMs) ?? 0;
      const right = normalizeTimestampMs(b.ts) ?? normalizeTimestampMs(b.runAtMs) ?? 0;
      return left - right;
    });

  const messages: CronSessionFallbackMessage[] = [];
  const prompt = params.job?.payload?.message || params.job?.payload?.text || '';
  const taskName = params.job?.name?.trim()
    || params.sessionEntry?.label?.replace(/^Cron:\s*/, '').trim()
    || '';
  const firstRelevantTimestamp = matchingRuns.length > 0
    ? (normalizeTimestampMs(matchingRuns[0]?.runAtMs) ?? normalizeTimestampMs(matchingRuns[0]?.ts))
    : (normalizeTimestampMs(params.job?.state?.runningAtMs) ?? params.sessionEntry?.updatedAt);

  if (taskName || prompt) {
    const lines = [taskName ? `Scheduled task: ${taskName}` : 'Scheduled task'];
    if (prompt) lines.push(`Prompt: ${prompt}`);
    messages.push({
      id: `cron-meta-${parsed.jobId}`,
      role: 'system',
      content: lines.join('\n'),
      timestamp: Math.max(0, (firstRelevantTimestamp ?? Date.now()) - 1),
    });
  }

  matchingRuns.forEach((entry, index) => {
    const message = buildCronRunMessage(entry, index);
    if (message) messages.push(message);
  });

  if (matchingRuns.length === 0) {
    const runningAt = normalizeTimestampMs(params.job?.state?.runningAtMs);
    if (runningAt) {
      messages.push({
        id: `cron-running-${parsed.jobId}`,
        role: 'system',
        content: 'This scheduled task is still running in OpenClaw, but no chat transcript is available yet.',
        timestamp: runningAt,
      });
    } else if (messages.length === 0) {
      messages.push({
        id: `cron-empty-${parsed.jobId}`,
        role: 'system',
        content: 'No chat transcript is available for this scheduled task yet.',
        timestamp: params.sessionEntry?.updatedAt ?? Date.now(),
      });
    }
  }

  const limit = typeof params.limit === 'number' && Number.isFinite(params.limit)
    ? Math.max(1, Math.floor(params.limit))
    : messages.length;
  return messages.slice(-limit);
}

function transformCronJob(job: GatewayCronJob) {
  const message = job.payload?.message || job.payload?.text || '';
  const channelType = job.delivery?.channel;
  const target = channelType
    ? {
      channelType,
      accountId: job.delivery?.accountId || 'default',
      ...(typeof job.delivery?.to === 'string' && job.delivery.to.trim()
        ? { recipientId: job.delivery.to.trim() }
        : {}),
    }
    : undefined;
  const lastRun = job.state?.lastRunAtMs
    ? {
      time: new Date(job.state.lastRunAtMs).toISOString(),
      success: job.state.lastStatus === 'ok',
      error: job.state.lastError,
      duration: job.state.lastDurationMs,
    }
    : undefined;
  const nextRun = job.state?.nextRunAtMs
    ? new Date(job.state.nextRunAtMs).toISOString()
    : undefined;

  return {
    id: job.id,
    agentId: job.agentId,
    name: job.name,
    message,
    schedule: job.schedule,
    target,
    enabled: job.enabled,
    createdAt: new Date(job.createdAtMs).toISOString(),
    updatedAt: new Date(job.updatedAtMs).toISOString(),
    lastRun,
    nextRun,
  };
}

type CronTargetInput = {
  channelType: string;
  accountId: string;
  recipientId: string;
};

function normalizeCronTarget(input: unknown): CronTargetInput {
  if (!input || typeof input !== 'object') {
    throw new Error('target is required');
  }

  const target = input as Record<string, unknown>;
  const channelType = typeof target.channelType === 'string' ? target.channelType.trim() : '';
  const accountId = typeof target.accountId === 'string' ? target.accountId.trim() : '';
  const recipientId = typeof target.recipientId === 'string' ? target.recipientId.trim() : '';

  if (!channelType) throw new Error('target.channelType is required');
  if (!accountId) throw new Error('target.accountId is required');
  if (!recipientId) throw new Error('target.recipientId is required');

  return {
    channelType,
    accountId,
    recipientId,
  };
}

function buildCronDelivery(target: CronTargetInput | null | undefined) {
  if (!target) {
    return { mode: 'none' as const };
  }

  return {
    mode: 'announce' as const,
    channel: target.channelType,
    accountId: target.accountId,
    to: target.recipientId,
  };
}

export async function handleCronRoutes(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
  ctx: HostApiContext,
): Promise<boolean> {
  if (url.pathname === '/api/cron/session-history' && req.method === 'GET') {
    const sessionKey = url.searchParams.get('sessionKey')?.trim() || '';
    const parsedSession = parseCronSessionKey(sessionKey);
    if (!parsedSession) {
      sendJson(res, 400, { success: false, error: `Invalid cron sessionKey: ${sessionKey}` });
      return true;
    }

    const rawLimit = Number(url.searchParams.get('limit') || '200');
    const limit = Number.isFinite(rawLimit)
      ? Math.min(Math.max(Math.floor(rawLimit), 1), 200)
      : 200;

    try {
      const [jobsResult, runs, sessionEntry] = await Promise.all([
        ctx.gatewayManager.rpc('cron.list', { includeDisabled: true })
          .catch(() => ({ jobs: [] as GatewayCronJob[] })),
        readCronRunLog(parsedSession.jobId),
        readSessionStoreEntry(parsedSession.agentId, sessionKey),
      ]);

      const jobs = (jobsResult as { jobs?: GatewayCronJob[] }).jobs ?? [];
      const job = jobs.find((item) => item.id === parsedSession.jobId);
      const messages = buildCronSessionFallbackMessages({
        sessionKey,
        job,
        runs,
        sessionEntry: sessionEntry ? {
          label: typeof sessionEntry.label === 'string' ? sessionEntry.label : undefined,
          updatedAt: normalizeTimestampMs(sessionEntry.updatedAt),
        } : undefined,
        limit,
      });

      sendJson(res, 200, { messages });
    } catch (error) {
      sendJson(res, 500, { success: false, error: String(error) });
    }
    return true;
  }

  if (url.pathname === '/api/cron/jobs' && req.method === 'GET') {
    try {
      const result = await ctx.gatewayManager.rpc('cron.list', { includeDisabled: true });
      const data = result as { jobs?: GatewayCronJob[] };
      const jobs = data?.jobs ?? [];
      for (const job of jobs) {
        const isIsolatedAgent =
          (job.sessionTarget === 'isolated' || !job.sessionTarget) &&
          job.payload?.kind === 'agentTurn';
        const needsRepair =
          isIsolatedAgent &&
          job.delivery?.mode === 'announce' &&
          !job.delivery?.channel;
        if (needsRepair) {
          try {
            await ctx.gatewayManager.rpc('cron.update', {
              id: job.id,
              patch: { delivery: { mode: 'none' } },
            });
            job.delivery = { mode: 'none' };
            if (job.state?.lastError?.includes('Channel is required')) {
              job.state.lastError = undefined;
              job.state.lastStatus = 'ok';
            }
          } catch {
            // ignore per-job repair failure
          }
        }
      }
      sendJson(res, 200, jobs.map(transformCronJob));
    } catch (error) {
      sendJson(res, 500, { success: false, error: String(error) });
    }
    return true;
  }

  if (url.pathname === '/api/cron/jobs' && req.method === 'POST') {
    try {
      const input = await parseJsonBody<{
        name: string;
        message: string;
        schedule: string;
        enabled?: boolean;
        agentId?: string;
        target?: unknown;
      }>(req);
      const agentId = typeof input.agentId === 'string' ? input.agentId.trim() : '';
      if (!agentId) {
        throw new Error('agentId is required');
      }
      const target = normalizeCronTarget(input.target);
      const result = await ctx.gatewayManager.rpc('cron.add', {
        agentId,
        name: input.name,
        schedule: { kind: 'cron', expr: input.schedule },
        payload: { kind: 'agentTurn', message: input.message },
        enabled: input.enabled ?? true,
        wakeMode: 'next-heartbeat',
        sessionTarget: 'isolated',
        delivery: buildCronDelivery(target),
      });
      sendJson(res, 200, result && typeof result === 'object' ? transformCronJob(result as GatewayCronJob) : result);
    } catch (error) {
      sendJson(res, 500, { success: false, error: String(error) });
    }
    return true;
  }

  if (url.pathname.startsWith('/api/cron/jobs/') && req.method === 'PUT') {
    try {
      const id = decodeURIComponent(url.pathname.slice('/api/cron/jobs/'.length));
      const input = await parseJsonBody<Record<string, unknown>>(req);
      const patch = { ...input };
      if ('agentId' in patch) {
        if (typeof patch.agentId !== 'string' || !patch.agentId.trim()) {
          throw new Error('agentId is required');
        }
        patch.agentId = patch.agentId.trim();
      }
      if (typeof patch.schedule === 'string') {
        patch.schedule = { kind: 'cron', expr: patch.schedule };
      }
      if (typeof patch.message === 'string') {
        patch.payload = { kind: 'agentTurn', message: patch.message };
        delete patch.message;
      }
      if ('target' in patch) {
        const target = patch.target == null ? null : normalizeCronTarget(patch.target);
        patch.delivery = buildCronDelivery(target);
        delete patch.target;
      }
      const result = await ctx.gatewayManager.rpc('cron.update', { id, patch });
      sendJson(res, 200, result && typeof result === 'object' ? transformCronJob(result as GatewayCronJob) : result);
    } catch (error) {
      sendJson(res, 500, { success: false, error: String(error) });
    }
    return true;
  }

  if (url.pathname.startsWith('/api/cron/jobs/') && req.method === 'DELETE') {
    try {
      const id = decodeURIComponent(url.pathname.slice('/api/cron/jobs/'.length));
      sendJson(res, 200, await ctx.gatewayManager.rpc('cron.remove', { id }));
    } catch (error) {
      sendJson(res, 500, { success: false, error: String(error) });
    }
    return true;
  }

  if (url.pathname === '/api/cron/toggle' && req.method === 'POST') {
    try {
      const body = await parseJsonBody<{ id: string; enabled: boolean }>(req);
      sendJson(res, 200, await ctx.gatewayManager.rpc('cron.update', { id: body.id, patch: { enabled: body.enabled } }));
    } catch (error) {
      sendJson(res, 500, { success: false, error: String(error) });
    }
    return true;
  }

  if (url.pathname === '/api/cron/trigger' && req.method === 'POST') {
    try {
      const body = await parseJsonBody<{ id: string }>(req);
      sendJson(res, 200, await ctx.gatewayManager.rpc('cron.run', { id: body.id, mode: 'force' }));
    } catch (error) {
      sendJson(res, 500, { success: false, error: String(error) });
    }
    return true;
  }

  return false;
}
