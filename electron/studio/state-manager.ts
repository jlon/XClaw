import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { GatewayStatus } from '../gateway/manager';
import type { JsonRpcNotification } from '../gateway/protocol';
import { listAgentsSnapshot } from '../utils/agent-config';
import { logger } from '../utils/logger';
import { getStudioLastKnownGoodPaths, getStudioSnapshotPaths } from './paths';
import { commitStudioSnapshot, readStudioSnapshot } from './state-store';
import { parseStudioIdentityName } from './identity-name';
import { STUDIO_AGENT_STATUSES } from './types';
import type { StudioAgentSnapshot, StudioAgentStatus, StudioCommittedSnapshot } from './types';

const DEFAULT_DETAIL = '等待任务中...';
const DEFAULT_SYNCING_DETAIL = '正在同步工作室运行时...';
const DEFAULT_AGENT_SYNC_DETAIL = '正在同步智能体状态...';
const DEFAULT_EXECUTING_DETAIL = '正在执行工具...';
const DEFAULT_WRITING_DETAIL = '正在处理聊天消息...';
const STUDIO_AGENT_STATUS_METHOD = 'studio.agent_status';
const STUDIO_AGENT_STATUS_SCHEMA_VERSION = 1 as const;

const DEFAULT_MAIN_AGENT: StudioAgentSnapshot = {
  agentId: 'main',
  displayName: 'Main Agent',
  sceneName: 'Main',
  status: 'idle',
  detail: DEFAULT_DETAIL,
  detailSource: 'default',
  updatedAt: new Date().toISOString(),
};

const DEFAULT_TTL_BY_STATUS: Partial<Record<Exclude<StudioAgentStatus, 'idle' | 'error'>, number>> = {
  writing: 90_000,
  researching: 90_000,
  executing: 120_000,
  syncing: 30_000,
};

type StudioAgentRegistryEntry = {
  agentId: string;
  displayName: string;
  sceneName: string;
  workspace: string;
};

type StudioAgentStatusEvent = {
  agentId: string;
  sessionKey: string;
  sessionStartedAtMs: number;
  sequence: number;
  status: StudioAgentStatus;
  detail: string | null;
  updatedAt: string;
  expiresAtMs: number | null;
  final: boolean;
  source: 'direct' | 'bridge';
  syntheticSequence: boolean;
};

type MainFallbackState = {
  status: StudioAgentStatus;
  detail: string | null;
  updatedAt: string;
};

type StudioStateManagerOptions = {
  readDetailFile?: (workspacePath: string) => Promise<string | null>;
  readIdentityName?: (workspacePath: string) => Promise<string | null>;
};

type BridgeSessionState = {
  sessionKey: string;
  sessionStartedAtIso: string;
  sessionStartedAtMs: number;
  nextSyntheticSequence: number;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

const normalizeText = (value: string): string => value.replace(/\s+/g, ' ').trim().slice(0, 120);

const isStudioAgentStatus = (value: unknown): value is StudioAgentStatus =>
  typeof value === 'string' && STUDIO_AGENT_STATUSES.includes(value as StudioAgentStatus);

const extractText = (value: unknown): string | null => {
  if (typeof value === 'string') {
    const normalized = normalizeText(value);
    return normalized.length > 0 ? normalized : null;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const extracted = extractText(item);
      if (extracted) {
        return extracted;
      }
    }
    return null;
  }
  if (!isRecord(value)) {
    return null;
  }
  for (const key of ['text', 'content', 'message', 'detail', 'summary']) {
    const extracted = extractText(value[key]);
    if (extracted) {
      return extracted;
    }
  }
  return null;
};

const parseIsoTime = (value: unknown): { iso: string; ms: number } | null => {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const parsed = Date.parse(trimmed);
  if (!Number.isFinite(parsed)) {
    return null;
  }
  return {
    iso: new Date(parsed).toISOString(),
    ms: parsed,
  };
};

const coercePositiveInteger = (value: unknown): number | null => {
  if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) {
    return null;
  }
  return value;
};

const normalizeToolName = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null;
  }
  const normalized = value.trim().toLowerCase();
  return normalized ? normalized : null;
};

const collectToolNames = (value: unknown, output = new Set<string>()): Set<string> => {
  if (Array.isArray(value)) {
    for (const item of value) {
      collectToolNames(item, output);
    }
    return output;
  }
  if (!isRecord(value)) {
    return output;
  }
  const type = typeof value.type === 'string' ? value.type.trim().toLowerCase() : '';
  const role = typeof value.role === 'string' ? value.role.trim().toLowerCase() : '';
  if (type === 'tool_use' || type === 'toolcall' || role === 'toolresult' || role === 'tool_result') {
    for (const key of ['name', 'toolName', 'tool']) {
      const toolName = normalizeToolName(value[key]);
      if (toolName) {
        output.add(toolName);
      }
    }
  }
  for (const key of ['content', 'message', 'data', 'result', 'toolUse', 'toolCall']) {
    if (key in value) {
      collectToolNames(value[key], output);
    }
  }
  return output;
};

const isResearchToolName = (toolName: string): boolean =>
  /(search|browser|web|fetch|crawl|scrape|serp|visit|navigate)/i.test(toolName);

const extractAgentIdFromSessionKey = (sessionKey: string): string => {
  if (!sessionKey.startsWith('agent:')) {
    return 'main';
  }
  const parts = sessionKey.split(':');
  return parts[1]?.trim() || 'main';
};

const resolveStatusTtlMs = (status: StudioAgentStatus, requestedTtlMs: unknown): number | null => {
  if (status === 'idle' || status === 'error') {
    return null;
  }
  const defaultTtlMs = DEFAULT_TTL_BY_STATUS[status];
  if (!defaultTtlMs) {
    return null;
  }
  const normalizedRequestedTtlMs = coercePositiveInteger(requestedTtlMs);
  if (normalizedRequestedTtlMs === null) {
    return defaultTtlMs;
  }
  return Math.min(normalizedRequestedTtlMs, defaultTtlMs);
};

const normalizeDisplayName = (value: string | null | undefined): string | null => {
  if (typeof value !== 'string') {
    return null;
  }
  const normalized = value.replace(/\s+/g, ' ').trim();
  return normalized.length > 0 ? normalized : null;
};

const isAsciiText = (value: string): boolean => [...value].every((char) => char.charCodeAt(0) <= 0x7f);

const humanizeAgentId = (agentId: string): string => {
  const normalized = normalizeDisplayName(agentId);
  if (!normalized) {
    return 'Agent';
  }
  if (!/[-_]/.test(normalized)) {
    return normalized.charAt(0).toUpperCase() + normalized.slice(1);
  }
  return normalized
    .split(/[-_]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
};

const resolveAgentDisplayName = (
  agentId: string,
  configuredName: string | null | undefined,
  identityName: string | null,
): string => identityName ?? normalizeDisplayName(configuredName) ?? humanizeAgentId(agentId);

const normalizeSceneName = (value: string | null | undefined): string | null => {
  const normalized = normalizeDisplayName(value);
  if (!normalized) {
    return null;
  }
  const withoutParenthetical = normalized
    .replace(/\s*[（(][^）)]*[）)]\s*$/u, '')
    .trim();
  const compact = withoutParenthetical || normalized;
  if (isAsciiText(compact)) {
    const words = compact.split(/\s+/).filter(Boolean);
    if (words.length > 1 && compact.length > 10) {
      return words[0];
    }
    if (compact.length > 12) {
      return compact.slice(0, 12).trim();
    }
  }
  return compact;
};

const resolveAgentSceneName = (
  agentId: string,
  displayName: string | null | undefined,
): string => normalizeSceneName(displayName) ?? humanizeAgentId(agentId);

const normalizeSnapshotAgent = (agent: StudioAgentSnapshot): StudioAgentSnapshot => ({
  ...agent,
  displayName: normalizeDisplayName(agent.displayName) ?? humanizeAgentId(agent.agentId),
  sceneName: resolveAgentSceneName(agent.agentId, agent.sceneName || agent.displayName),
});

const readStudioDetailFile = async (workspacePath: string): Promise<string | null> => {
  try {
    const content = await readFile(join(workspacePath, 'STAR_OFFICE_DETAIL.txt'), 'utf8');
    return extractText(content);
  } catch {
    return null;
  }
};

const readStudioIdentityName = async (workspacePath: string): Promise<string | null> => {
  try {
    const content = await readFile(join(workspacePath, 'IDENTITY.md'), 'utf8');
    return parseStudioIdentityName(content);
  } catch {
    return null;
  }
};

export class StudioStateManager {
  private mainAgent: StudioAgentSnapshot = { ...DEFAULT_MAIN_AGENT };
  private agentInventory = new Map<string, StudioAgentSnapshot>();
  private readonly registryByAgentId = new Map<string, StudioAgentRegistryEntry>();
  private readonly detailByAgentId = new Map<string, string>();
  private readonly lastSummaryByAgentId = new Map<string, string>();
  private readonly realtimeEventByAgentId = new Map<string, StudioAgentStatusEvent>();
  private readonly bridgeSessionByAgentId = new Map<string, BridgeSessionState>();
  private readonly directProtocolObservedByAgentId = new Set<string>();
  private mainFallback: MainFallbackState = {
    status: 'idle',
    detail: null,
    updatedAt: DEFAULT_MAIN_AGENT.updatedAt,
  };
  private mainRealtimeProtocolObserved = false;
  private expiryTimer: NodeJS.Timeout | null = null;

  constructor(private readonly options: StudioStateManagerOptions = {}) {}

  async bootstrap(): Promise<void> {
    const currentPaths = getStudioSnapshotPaths();
    const lastKnownGoodPaths = getStudioLastKnownGoodPaths();
    const existing = await readStudioSnapshot(currentPaths, lastKnownGoodPaths);
    if (existing) {
      const migratedLegacySceneName = this.loadSnapshot(existing);
      if (migratedLegacySceneName) {
        await this.flush();
      }
      return;
    }
    await this.refreshAgentInventory();
    await this.flush();
  }

  getCurrentSnapshot(): { mainAgent: StudioAgentSnapshot; agents: StudioAgentSnapshot[] } {
    return {
      mainAgent: { ...this.mainAgent },
      agents: [...this.agentInventory.values()].map((agent) => ({ ...agent })),
    };
  }

  async refreshAgentInventory(): Promise<void> {
    const snapshot = await listAgentsSnapshot();
    const agentMetadata = await Promise.all(
      snapshot.agents.map(async (agent) => {
        const [detail, identityName] = await Promise.all([
          this.readDetailFile(agent.workspace),
          this.readIdentityName(agent.workspace),
        ]);
        return { agent, detail, identityName };
      }),
    );

    this.registryByAgentId.clear();
    this.detailByAgentId.clear();

    for (const { agent, detail, identityName } of agentMetadata) {
      this.registryByAgentId.set(agent.id, {
        agentId: agent.id,
        displayName: resolveAgentDisplayName(agent.id, agent.name, identityName),
        sceneName: resolveAgentSceneName(agent.id, identityName ?? agent.name),
        workspace: agent.workspace,
      });
      if (typeof detail === 'string') {
        this.detailByAgentId.set(agent.id, detail);
      }
    }

    const legalAgentIds = new Set(snapshot.agents.map((agent) => agent.id));
    for (const agentId of [...this.realtimeEventByAgentId.keys()]) {
      if (!legalAgentIds.has(agentId)) {
        this.realtimeEventByAgentId.delete(agentId);
      }
    }
    for (const agentId of [...this.lastSummaryByAgentId.keys()]) {
      if (agentId !== 'main' && !legalAgentIds.has(agentId)) {
        this.lastSummaryByAgentId.delete(agentId);
      }
    }

    this.rebuildSnapshots();
    await this.flush();
  }

  private async readDetailFile(workspacePath: string): Promise<string | null> {
    if (this.options.readDetailFile) {
      return await this.options.readDetailFile(workspacePath);
    }
    return await readStudioDetailFile(workspacePath);
  }

  private async readIdentityName(workspacePath: string): Promise<string | null> {
    if (this.options.readIdentityName) {
      return await this.options.readIdentityName(workspacePath);
    }
    return await readStudioIdentityName(workspacePath);
  }

  async handleGatewayStatus(status: GatewayStatus): Promise<void> {
    if (this.mainRealtimeProtocolObserved) {
      return;
    }
    if (status.state === 'starting' || status.state === 'reconnecting') {
      this.updateMainFallback('syncing', DEFAULT_SYNCING_DETAIL);
    } else if (status.state === 'running') {
      this.updateMainFallback('idle', null);
    } else if (status.state === 'failed' || status.state === 'error') {
      this.updateMainFallback('error', status.error || '运行时异常');
    } else if (status.state === 'stopped') {
      this.updateMainFallback('idle', null);
    }
    this.rebuildSnapshots();
    await this.flush();
  }

  async handleGatewayNotification(notification: JsonRpcNotification): Promise<void> {
    if (notification.method === STUDIO_AGENT_STATUS_METHOD) {
      const changed = this.applyRealtimeNotification(notification.params, 'direct');
      if (changed) {
        this.rebuildSnapshots();
        await this.flush();
      }
      return;
    }

    if (notification.method === 'agent') {
      const changed = this.applyBridgedGatewayAgentNotification(notification.params);
      if (changed) {
        this.rebuildSnapshots();
        await this.flush();
      }
      if (this.mainRealtimeProtocolObserved || changed) {
        return;
      }
    }

    if (this.mainRealtimeProtocolObserved) {
      return;
    }

    const method = notification.method || '';
    if (method.includes('tool')) {
      this.updateMainFallback('executing', extractText(notification.params) || DEFAULT_EXECUTING_DETAIL);
    } else if (method.includes('agent')) {
      this.updateMainFallback('syncing', extractText(notification.params) || DEFAULT_AGENT_SYNC_DETAIL);
    }
    this.rebuildSnapshots();
    await this.flush();
  }

  async handleChatMessage(message: unknown): Promise<void> {
    if (this.mainRealtimeProtocolObserved) {
      return;
    }
    this.updateMainFallback('writing', extractText(message) || DEFAULT_WRITING_DETAIL);
    this.rebuildSnapshots();
    await this.flush();
  }

  private updateMainFallback(status: StudioAgentStatus, detail: string | null): void {
    const updatedAt = new Date().toISOString();
    this.mainFallback = {
      status,
      detail,
      updatedAt,
    };
    if (detail) {
      this.lastSummaryByAgentId.set('main', detail);
    }
  }

  private loadSnapshot(snapshot: StudioCommittedSnapshot): boolean {
    let migratedLegacySceneName = false;
    const mainAgent = normalizeSnapshotAgent(snapshot.main.agent);
    if (mainAgent.sceneName !== snapshot.main.agent.sceneName) {
      migratedLegacySceneName = true;
    }
    const agents = snapshot.agents.agents.map((agent) => {
      const normalized = normalizeSnapshotAgent(agent);
      if (normalized.sceneName !== agent.sceneName) {
        migratedLegacySceneName = true;
      }
      return normalized;
    });
    this.mainAgent = mainAgent;
    this.agentInventory = new Map(agents.map((agent) => [agent.agentId, { ...agent }]));
    if (mainAgent.detailSource === 'event-summary' && mainAgent.detail) {
      this.mainFallback = {
        status: mainAgent.status,
        detail: mainAgent.detail,
        updatedAt: mainAgent.updatedAt,
      };
      this.lastSummaryByAgentId.set('main', mainAgent.detail);
    }
    for (const agent of agents) {
      if (agent.detailSource === 'event-summary' && agent.detail) {
        this.lastSummaryByAgentId.set(agent.agentId, agent.detail);
      }
    }
    return migratedLegacySceneName;
  }

  private applyRealtimeNotification(params: unknown, source: 'direct' | 'bridge'): boolean {
    const event = this.parseRealtimeNotification(params, source);
    if (!event) {
      return false;
    }
    return this.applyRealtimeEvent(event);
  }

  private applyBridgedGatewayAgentNotification(params: unknown): boolean {
    const event = this.parseBridgedGatewayAgentNotification(params);
    if (!event) {
      return false;
    }
    return this.applyRealtimeEvent(event);
  }

  private applyRealtimeEvent(event: StudioAgentStatusEvent): boolean {
    if (event.source === 'bridge' && this.directProtocolObservedByAgentId.has(event.agentId)) {
      return false;
    }
    const current = this.realtimeEventByAgentId.get(event.agentId);
    if (current?.source === 'direct' && event.source === 'bridge') {
      return false;
    }
    if (current && current.sessionKey !== event.sessionKey) {
      const currentIdentity = `${current.sessionStartedAtMs}:${current.sessionKey}`;
      const nextIdentity = `${event.sessionStartedAtMs}:${event.sessionKey}`;
      if (nextIdentity <= currentIdentity) {
        logger.debug(`Ignoring stale Studio agent status session for ${event.agentId}`);
        return false;
      }
    } else if (
      current
      && event.sequence <= current.sequence
      && !(current.syntheticSequence && !event.syntheticSequence && current.source !== 'direct')
    ) {
      logger.debug(`Ignoring stale Studio agent status sequence for ${event.agentId}`);
      return false;
    }

    if (event.source === 'direct') {
      this.directProtocolObservedByAgentId.add(event.agentId);
    }
    if (event.agentId === 'main') {
      this.mainRealtimeProtocolObserved = true;
    }
    if (event.detail) {
      this.lastSummaryByAgentId.set(event.agentId, event.detail);
    }
    if (event.final) {
      this.realtimeEventByAgentId.delete(event.agentId);
    } else {
      this.realtimeEventByAgentId.set(event.agentId, event);
    }
    return true;
  }

  private parseRealtimeNotification(params: unknown, source: 'direct' | 'bridge'): StudioAgentStatusEvent | null {
    if (!isRecord(params) || params.schemaVersion !== STUDIO_AGENT_STATUS_SCHEMA_VERSION) {
      return null;
    }

    const agentId = typeof params.agentId === 'string' ? params.agentId.trim() : '';
    const sessionKey = typeof params.sessionKey === 'string' ? params.sessionKey.trim() : '';
    const sessionStartedAt = parseIsoTime(params.sessionStartedAt);
    const timestamp = parseIsoTime(params.timestamp);
    const sequence = coercePositiveInteger(params.sequence);
    const status = params.status;
    const final = params.final === true;

    if (!agentId || !this.isKnownAgentId(agentId) || !sessionKey || !sessionStartedAt || !timestamp || sequence === null || !isStudioAgentStatus(status)) {
      return null;
    }
    if (final && status !== 'idle') {
      return null;
    }

    const ttlMs = final ? null : resolveStatusTtlMs(status, params.ttlMs);
    return {
      agentId,
      sessionKey,
      sessionStartedAtMs: sessionStartedAt.ms,
      sequence,
      status,
      detail: final ? null : extractText(params.detail),
      updatedAt: timestamp.iso,
      expiresAtMs: ttlMs === null ? null : timestamp.ms + ttlMs,
      final,
      source,
      syntheticSequence: false,
    };
  }

  private parseBridgedGatewayAgentNotification(params: unknown): StudioAgentStatusEvent | null {
    if (!isRecord(params)) {
      return null;
    }

    const data = isRecord(params.data) ? params.data : null;
    const sessionKey = typeof (params.sessionKey ?? data?.sessionKey) === 'string'
      ? String(params.sessionKey ?? data?.sessionKey).trim()
      : '';
    if (!sessionKey) {
      return null;
    }

    const agentId = typeof (params.agentId ?? data?.agentId) === 'string'
      ? String(params.agentId ?? data?.agentId).trim()
      : extractAgentIdFromSessionKey(sessionKey);
    if (!agentId || !this.isKnownAgentId(agentId)) {
      return null;
    }

    const now = new Date();
    const timestamp = parseIsoTime(params.timestamp ?? data?.timestamp) ?? {
      iso: now.toISOString(),
      ms: now.getTime(),
    };
    const bridgeSession = this.resolveBridgeSession(
      agentId,
      sessionKey,
      params.startedAt ?? data?.startedAt ?? params.sessionStartedAt ?? data?.sessionStartedAt,
      timestamp,
    );
    const phase = typeof (params.phase ?? data?.phase) === 'string'
      ? String(params.phase ?? data?.phase).trim().toLowerCase()
      : '';
    const stateValue = typeof (params.state ?? data?.state) === 'string'
      ? String(params.state ?? data?.state).trim().toLowerCase()
      : '';
    const message = params.message ?? data?.message;
    const explicitSequence = coercePositiveInteger(params.seq ?? data?.seq ?? params.sequence ?? data?.sequence);
    const { sequence, syntheticSequence } = this.resolveBridgeSequence(bridgeSession, explicitSequence);

    if (phase === 'completed' || phase === 'done' || phase === 'finished' || phase === 'end') {
      return {
        agentId,
        sessionKey,
        sessionStartedAtMs: bridgeSession.sessionStartedAtMs,
        sequence,
        status: 'idle',
        detail: null,
        updatedAt: timestamp.iso,
        expiresAtMs: null,
        final: true,
        source: 'bridge',
        syntheticSequence,
      };
    }

    const toolNames = [...collectToolNames(message)];
    const status = this.resolveBridgedStatus(phase, stateValue, message, toolNames);
    if (!status) {
      return null;
    }

    return {
      agentId,
      sessionKey,
      sessionStartedAtMs: bridgeSession.sessionStartedAtMs,
      sequence,
      status,
      detail: this.resolveBridgedDetail(status, message, params, toolNames),
      updatedAt: timestamp.iso,
      expiresAtMs: (() => {
        const ttlMs = resolveStatusTtlMs(status, null);
        return ttlMs === null ? null : timestamp.ms + ttlMs;
      })(),
      final: false,
      source: 'bridge',
      syntheticSequence,
    };
  }

  private resolveBridgeSession(
    agentId: string,
    sessionKey: string,
    candidateStartedAt: unknown,
    timestamp: { iso: string; ms: number },
  ): BridgeSessionState {
    const current = this.bridgeSessionByAgentId.get(agentId);
    if (current && current.sessionKey === sessionKey) {
      return current;
    }
    const startedAt = parseIsoTime(candidateStartedAt) ?? timestamp;
    const next = {
      sessionKey,
      sessionStartedAtIso: startedAt.iso,
      sessionStartedAtMs: startedAt.ms,
      nextSyntheticSequence: 1,
    };
    this.bridgeSessionByAgentId.set(agentId, next);
    return next;
  }

  private resolveBridgeSequence(
    bridgeSession: BridgeSessionState,
    explicitSequence: number | null,
  ): { sequence: number; syntheticSequence: boolean } {
    if (explicitSequence !== null) {
      bridgeSession.nextSyntheticSequence = Math.max(bridgeSession.nextSyntheticSequence, explicitSequence + 1);
      return { sequence: explicitSequence, syntheticSequence: false };
    }
    const sequence = bridgeSession.nextSyntheticSequence;
    bridgeSession.nextSyntheticSequence += 1;
    return { sequence, syntheticSequence: true };
  }

  private resolveBridgedStatus(
    phase: string,
    stateValue: string,
    message: unknown,
    toolNames: string[],
  ): StudioAgentStatus | null {
    if (stateValue === 'error' || stateValue === 'aborted' || stateValue === 'failed') {
      return 'error';
    }
    if (toolNames.length > 0) {
      return toolNames.some(isResearchToolName) ? 'researching' : 'executing';
    }
    if (stateValue === 'delta' || stateValue === 'final') {
      return extractText(message) ? 'writing' : 'syncing';
    }
    if (stateValue === 'started' || phase === 'started') {
      return 'syncing';
    }
    return null;
  }

  private resolveBridgedDetail(
    status: StudioAgentStatus,
    message: unknown,
    params: Record<string, unknown>,
    toolNames: string[],
  ): string | null {
    const explicit = extractText(message) ?? extractText(params);
    if (explicit) {
      return explicit;
    }
    if (status === 'researching' && toolNames.length > 0) {
      return `正在使用 ${toolNames[0]} 调研资料`;
    }
    if (status === 'executing' && toolNames.length > 0) {
      return `正在执行 ${toolNames[0]}`;
    }
    if (status === 'writing') {
      return DEFAULT_WRITING_DETAIL;
    }
    if (status === 'syncing') {
      return '正在处理新任务...';
    }
    if (status === 'error') {
      return '运行时异常';
    }
    return null;
  }

  private isKnownAgentId(agentId: string): boolean {
    return agentId === 'main' || this.registryByAgentId.has(agentId) || this.agentInventory.has(agentId);
  }

  private rebuildSnapshots(now = Date.now()): void {
    this.purgeExpiredRealtimeEvents(now);
    this.scheduleExpiryRefresh(now);

    const fallbackTimestamp = new Date(now).toISOString();
    this.mainAgent = this.buildMainSnapshot(fallbackTimestamp);

    const nextInventory = new Map<string, StudioAgentSnapshot>();
    for (const [agentId, entry] of this.registryByAgentId.entries()) {
      if (agentId === this.mainAgent.agentId) {
        continue;
      }
      nextInventory.set(agentId, this.buildSecondaryAgentSnapshot(agentId, entry.displayName, fallbackTimestamp));
    }
    this.agentInventory = nextInventory;
  }

  private purgeExpiredRealtimeEvents(now = Date.now()): void {
    for (const [agentId, event] of this.realtimeEventByAgentId.entries()) {
      if (event.expiresAtMs !== null && event.expiresAtMs <= now) {
        this.realtimeEventByAgentId.delete(agentId);
      }
    }
  }

  private scheduleExpiryRefresh(now = Date.now()): void {
    if (this.expiryTimer) {
      clearTimeout(this.expiryTimer);
      this.expiryTimer = null;
    }
    const nextExpiryAtMs = [...this.realtimeEventByAgentId.values()]
      .map((event) => event.expiresAtMs)
      .filter((value): value is number => typeof value === 'number' && value > now)
      .sort((left, right) => left - right)[0];
    if (!nextExpiryAtMs) {
      return;
    }
    this.expiryTimer = setTimeout(() => {
      void this.handleExpiryTick();
    }, Math.max(nextExpiryAtMs - now, 0));
    this.expiryTimer.unref?.();
  }

  private async handleExpiryTick(): Promise<void> {
    this.rebuildSnapshots();
    await this.flush();
  }

  private buildMainSnapshot(fallbackTimestamp: string): StudioAgentSnapshot {
    const registryEntry = this.registryByAgentId.get('main');
    const activeRealtime = this.realtimeEventByAgentId.get('main');
    if (activeRealtime) {
      return this.buildSnapshotFromStatus({
        agentId: 'main',
        displayName: registryEntry?.displayName || this.mainAgent.displayName || 'Main Agent',
        sceneName: registryEntry?.sceneName || this.mainAgent.sceneName || 'Main',
        status: activeRealtime.status,
        detail: activeRealtime.detail,
        updatedAt: activeRealtime.updatedAt,
      });
    }
    if (this.mainRealtimeProtocolObserved) {
      return this.buildSnapshotFromStatus({
        agentId: 'main',
        displayName: registryEntry?.displayName || this.mainAgent.displayName || 'Main Agent',
        sceneName: registryEntry?.sceneName || this.mainAgent.sceneName || 'Main',
        status: 'idle',
        detail: null,
        updatedAt: this.mainAgent.updatedAt || this.mainFallback.updatedAt || fallbackTimestamp,
      });
    }
    return this.buildSnapshotFromStatus({
      agentId: this.mainAgent.agentId,
      displayName: registryEntry?.displayName || this.mainAgent.displayName || 'Main Agent',
      sceneName: registryEntry?.sceneName || this.mainAgent.sceneName || 'Main',
      status: this.mainFallback.status,
      detail: this.mainFallback.detail,
      updatedAt: this.mainFallback.updatedAt || this.mainAgent.updatedAt || fallbackTimestamp,
    });
  }

  private buildSecondaryAgentSnapshot(agentId: string, displayName: string, fallbackTimestamp: string): StudioAgentSnapshot {
    const activeRealtime = this.realtimeEventByAgentId.get(agentId);
    const registryEntry = this.registryByAgentId.get(agentId);
    return this.buildSnapshotFromStatus({
      agentId,
      displayName,
      sceneName: registryEntry?.sceneName || resolveAgentSceneName(agentId, displayName),
      status: activeRealtime?.status ?? 'idle',
      detail: activeRealtime?.detail ?? null,
      updatedAt: activeRealtime?.updatedAt ?? this.agentInventory.get(agentId)?.updatedAt ?? fallbackTimestamp,
    });
  }

  private buildSnapshotFromStatus(input: {
    agentId: string;
    displayName: string;
    sceneName: string;
    status: StudioAgentStatus;
    detail: string | null;
    updatedAt: string;
  }): StudioAgentSnapshot {
    const detailFile = this.detailByAgentId.get(input.agentId);
    const summary = this.lastSummaryByAgentId.get(input.agentId);
    const detail = input.detail ?? detailFile ?? summary ?? DEFAULT_DETAIL;
    const detailSource = input.detail
      ? 'event-summary'
      : detailFile
        ? 'detail-file'
        : summary
          ? 'event-summary'
          : 'default';
    return {
      agentId: input.agentId,
      displayName: input.displayName,
      sceneName: resolveAgentSceneName(input.agentId, input.sceneName || input.displayName),
      status: input.status,
      detail,
      detailSource,
      updatedAt: input.updatedAt,
    };
  }

  private async flush(): Promise<void> {
    try {
      await commitStudioSnapshot({
        currentPaths: getStudioSnapshotPaths(),
        lastKnownGoodPaths: getStudioLastKnownGoodPaths(),
        mainAgent: this.mainAgent,
        agents: [...this.agentInventory.values()],
      });
    } catch (error) {
      logger.warn('Failed to flush Studio snapshot', error);
    }
  }
}
