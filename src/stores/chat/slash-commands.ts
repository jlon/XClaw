export type SlashCommandCategory = 'session' | 'model' | 'agents' | 'tools';
export type SlashCommandIcon =
  | 'plus'
  | 'refresh'
  | 'loader'
  | 'stop'
  | 'trash'
  | 'eye'
  | 'brain'
  | 'terminal'
  | 'zap'
  | 'book'
  | 'barChart'
  | 'download'
  | 'monitor'
  | 'x'
  | 'send';

export type SlashCommandDef = {
  name: string;
  description: string;
  args?: string;
  icon?: SlashCommandIcon;
  category?: SlashCommandCategory;
  executeLocal?: boolean;
  argOptions?: string[];
  dispatchStrategy?: 'local' | 'gateway-chat' | 'agent';
};

export type ParsedSlashCommand = {
  command: SlashCommandDef;
  args: string;
};

export type PendingSlashActionKind = 'toggle-focus' | 'export';

type SessionLike = {
  key?: string | null;
  spawnedBy?: string | null;
};

const DEFAULT_MAIN_KEY = 'main';
const DEFAULT_AGENT_ID = 'main';

export const SLASH_COMMANDS: SlashCommandDef[] = [
  { name: 'new', description: 'Start a new session', icon: 'plus', category: 'session', executeLocal: true, dispatchStrategy: 'gateway-chat' },
  { name: 'reset', description: 'Reset current session', icon: 'refresh', category: 'session', executeLocal: true, dispatchStrategy: 'gateway-chat' },
  { name: 'compact', description: 'Compact session context', icon: 'loader', category: 'session', executeLocal: true, dispatchStrategy: 'local' },
  { name: 'stop', description: 'Stop current run', icon: 'stop', category: 'session', executeLocal: true, dispatchStrategy: 'local' },
  { name: 'clear', description: 'Clear chat history', icon: 'trash', category: 'session', executeLocal: true, dispatchStrategy: 'local' },
  { name: 'focus', description: 'Toggle focus mode', icon: 'eye', category: 'session', executeLocal: true, dispatchStrategy: 'local' },
  { name: 'model', description: 'Show or set model', args: '<name>', icon: 'brain', category: 'model', executeLocal: true, dispatchStrategy: 'local' },
  { name: 'think', description: 'Set thinking level', args: '<level>', icon: 'brain', category: 'model', executeLocal: true, dispatchStrategy: 'local', argOptions: ['off', 'low', 'medium', 'high'] },
  { name: 'verbose', description: 'Toggle verbose mode', args: '<on|off|full>', icon: 'terminal', category: 'model', executeLocal: true, dispatchStrategy: 'local', argOptions: ['on', 'off', 'full'] },
  { name: 'fast', description: 'Toggle fast mode', args: '<status|on|off>', icon: 'zap', category: 'model', executeLocal: true, dispatchStrategy: 'local', argOptions: ['status', 'on', 'off'] },
  { name: 'help', description: 'Show available commands', icon: 'book', category: 'tools', executeLocal: true, dispatchStrategy: 'local' },
  { name: 'status', description: 'Show session status', icon: 'barChart', category: 'tools', dispatchStrategy: 'agent' },
  { name: 'export', description: 'Export session to Markdown', icon: 'download', category: 'tools', executeLocal: true, dispatchStrategy: 'local' },
  { name: 'usage', description: 'Show token usage', icon: 'barChart', category: 'tools', executeLocal: true, dispatchStrategy: 'local' },
  { name: 'agents', description: 'List agents', icon: 'monitor', category: 'agents', executeLocal: true, dispatchStrategy: 'local' },
  { name: 'kill', description: 'Abort sub-agents', args: '<id|all>', icon: 'x', category: 'agents', executeLocal: true, dispatchStrategy: 'local' },
  { name: 'skill', description: 'Run a skill', args: '<name>', icon: 'zap', category: 'tools', dispatchStrategy: 'agent' },
  { name: 'steer', description: 'Steer a sub-agent', args: '<id> <msg>', icon: 'send', category: 'agents', dispatchStrategy: 'agent' },
];

const STOP_ALIASES = new Set(['/stop', 'stop', 'esc', 'abort', 'wait', 'exit']);
const THINK_LEVELS = new Set(['off', 'low', 'medium', 'high']);
const VERBOSE_LEVELS = new Set(['off', 'on', 'full']);
const CATEGORY_ORDER: SlashCommandCategory[] = ['session', 'model', 'tools', 'agents'];

export const CATEGORY_LABELS: Record<SlashCommandCategory, string> = {
  session: 'Session',
  model: 'Model',
  agents: 'Agents',
  tools: 'Tools',
};

const buildCategoryLabel = (value: SlashCommandCategory) =>
  `${value.charAt(0).toUpperCase()}${value.slice(1)}`;

export function parseSlashCommand(text: string): ParsedSlashCommand | null {
  const trimmed = text.trim();
  if (!trimmed.startsWith('/')) {
    return null;
  }
  const body = trimmed.slice(1);
  const firstSeparator = body.search(/[\s:]/u);
  const name = firstSeparator === -1 ? body : body.slice(0, firstSeparator);
  let remainder = firstSeparator === -1 ? '' : body.slice(firstSeparator).trimStart();
  if (remainder.startsWith(':')) {
    remainder = remainder.slice(1).trimStart();
  }
  const command = SLASH_COMMANDS.find((entry) => entry.name === name.toLowerCase());
  if (!command) {
    return null;
  }
  return {
    command,
    args: remainder.trim(),
  };
}

export function getSlashCommandCompletions(filter: string): SlashCommandDef[] {
  const lower = filter.toLowerCase();
  const commands = lower
    ? SLASH_COMMANDS.filter(
        (command) => command.name.startsWith(lower) || command.description.toLowerCase().includes(lower),
      )
    : SLASH_COMMANDS;
  return [...commands].sort((left, right) => {
    const leftIndex = CATEGORY_ORDER.indexOf(left.category ?? 'session');
    const rightIndex = CATEGORY_ORDER.indexOf(right.category ?? 'session');
    if (leftIndex !== rightIndex) {
      return leftIndex - rightIndex;
    }
    if (lower) {
      const leftExact = left.name.startsWith(lower) ? 0 : 1;
      const rightExact = right.name.startsWith(lower) ? 0 : 1;
      if (leftExact !== rightExact) {
        return leftExact - rightExact;
      }
    }
    return 0;
  });
}

export function isStopCommand(text: string): boolean {
  return STOP_ALIASES.has(text.trim().toLowerCase());
}

export function shouldQueueLocalSlashCommand(name: string): boolean {
  return !['stop', 'focus', 'export'].includes(name);
}

export function buildSlashHelpText(): string {
  const lines = ['**Available Commands**\n'];
  let currentCategory = '';
  for (const command of SLASH_COMMANDS) {
    const category = command.category ?? 'session';
    if (category !== currentCategory) {
      currentCategory = category;
      lines.push(`**${buildCategoryLabel(category)}**`);
    }
    const argText = command.args ? ` ${command.args}` : '';
    const remoteSuffix = command.executeLocal ? '' : ' *(agent)*';
    lines.push(`\`/${command.name}${argText}\` — ${command.description}${remoteSuffix}`);
  }
  lines.push('\nType `/` to open the command menu.');
  return lines.join('\n');
}

export function normalizeThinkLevel(value: string): 'off' | 'low' | 'medium' | 'high' | null {
  const normalized = value.trim().toLowerCase();
  return THINK_LEVELS.has(normalized) ? normalized as 'off' | 'low' | 'medium' | 'high' : null;
}

export function normalizeVerboseLevel(value: string): 'off' | 'on' | 'full' | null {
  const normalized = value.trim().toLowerCase();
  return VERBOSE_LEVELS.has(normalized) ? normalized as 'off' | 'on' | 'full' : null;
}

export function parseFastMode(value: string): 'status' | boolean | null {
  const normalized = value.trim().toLowerCase();
  if (!normalized || normalized === 'status') {
    return 'status';
  }
  if (normalized === 'on') {
    return true;
  }
  if (normalized === 'off') {
    return false;
  }
  return null;
}

function normalizeSessionKey(key?: string | null): string | undefined {
  const normalized = key?.trim().toLowerCase();
  return normalized || undefined;
}

function isSubagentSessionKey(key: string): boolean {
  return key.includes(':subagent:') || key.startsWith('subagent:');
}

function parseAgentSessionKey(key: string): { agentId?: string } | null {
  if (key === DEFAULT_MAIN_KEY) {
    return { agentId: DEFAULT_AGENT_ID };
  }
  if (!key.startsWith('agent:')) {
    return null;
  }
  const parts = key.split(':');
  return parts.length >= 2 ? { agentId: parts[1] || undefined } : null;
}

function buildSessionIndex(sessions: SessionLike[]): Map<string, SessionLike> {
  const index = new Map<string, SessionLike>();
  for (const session of sessions) {
    const normalizedKey = normalizeSessionKey(session?.key);
    if (normalizedKey) {
      index.set(normalizedKey, session);
    }
  }
  return index;
}

function resolveEquivalentSessionKeys(currentSessionKey: string, currentAgentId: string | undefined): Set<string> {
  const keys = new Set<string>([currentSessionKey]);
  const canonicalDefaultMain = `agent:${DEFAULT_AGENT_ID}:main`;
  if (currentAgentId === DEFAULT_AGENT_ID) {
    if (currentSessionKey === DEFAULT_MAIN_KEY) {
      keys.add(canonicalDefaultMain);
    } else if (currentSessionKey === canonicalDefaultMain) {
      keys.add(DEFAULT_MAIN_KEY);
    }
  }
  return keys;
}

function isWithinCurrentSessionSubtree(
  candidateSessionKey: string,
  currentSessionKey: string,
  sessionIndex: Map<string, SessionLike>,
  currentAgentId: string | undefined,
  candidateAgentId: string | undefined,
): boolean {
  if (!currentAgentId || candidateAgentId !== currentAgentId) {
    return false;
  }
  const currentAliases = resolveEquivalentSessionKeys(currentSessionKey, currentAgentId);
  const seen = new Set<string>();
  let parentSessionKey = normalizeSessionKey(sessionIndex.get(candidateSessionKey)?.spawnedBy);
  while (parentSessionKey && !seen.has(parentSessionKey)) {
    if (currentAliases.has(parentSessionKey)) {
      return true;
    }
    seen.add(parentSessionKey);
    parentSessionKey = normalizeSessionKey(sessionIndex.get(parentSessionKey)?.spawnedBy);
  }
  return isSubagentSessionKey(currentSessionKey)
    ? candidateSessionKey.startsWith(`${currentSessionKey}:subagent:`)
    : false;
}

export function resolveKillTargets(
  sessions: SessionLike[],
  currentSessionKey: string,
  target: string,
): string[] {
  const normalizedTarget = target.trim().toLowerCase();
  if (!normalizedTarget) {
    return [];
  }
  const keys = new Set<string>();
  const normalizedCurrentSessionKey = currentSessionKey.trim().toLowerCase();
  const currentParsed = parseAgentSessionKey(normalizedCurrentSessionKey);
  const currentAgentId =
    currentParsed?.agentId ??
    (normalizedCurrentSessionKey === DEFAULT_MAIN_KEY ? DEFAULT_AGENT_ID : undefined);
  const sessionIndex = buildSessionIndex(sessions);
  for (const session of sessions) {
    const rawKey = session?.key?.trim();
    if (!rawKey || !isSubagentSessionKey(rawKey)) {
      continue;
    }
    const normalizedKey = rawKey.toLowerCase();
    const parsed = parseAgentSessionKey(normalizedKey);
    const belongsToCurrentSession = isWithinCurrentSessionSubtree(
      normalizedKey,
      normalizedCurrentSessionKey,
      sessionIndex,
      currentAgentId,
      parsed?.agentId,
    );
    const isMatch =
      (normalizedTarget === 'all' && belongsToCurrentSession) ||
      (belongsToCurrentSession && normalizedKey === normalizedTarget) ||
      (belongsToCurrentSession &&
        ((parsed?.agentId ?? '') === normalizedTarget ||
          normalizedKey.endsWith(`:subagent:${normalizedTarget}`) ||
          normalizedKey === `subagent:${normalizedTarget}`));
    if (isMatch) {
      keys.add(rawKey);
    }
  }
  return [...keys];
}
