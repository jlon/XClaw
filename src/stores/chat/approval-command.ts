export type ApprovalDecision = 'allow-once' | 'allow-always' | 'deny';

const USAGE_TEXT = 'Usage: /approve <id> allow-once|allow-always|deny';
const COMMAND_REGEX = /^\/approve(?:\s|$)/i;
const TYPO_COMMAND_REGEX = /^\/aprove(?:\s|$)/i;
const DECISION_ALIASES: Record<string, ApprovalDecision> = {
  allow: 'allow-once',
  once: 'allow-once',
  'allow-once': 'allow-once',
  allowonce: 'allow-once',
  always: 'allow-always',
  'allow-always': 'allow-always',
  allowalways: 'allow-always',
  deny: 'deny',
  reject: 'deny',
  block: 'deny',
};

export function parseApprovalCommand(
  raw: string,
): { id: string; decision: ApprovalDecision } | { error: string } | null {
  const trimmed = raw.trim();
  const commandMatch = trimmed.match(COMMAND_REGEX) ?? trimmed.match(TYPO_COMMAND_REGEX);
  if (!commandMatch) {
    return null;
  }
  const rest = trimmed.slice(commandMatch[0].length).trim();
  if (!rest) {
    return { error: USAGE_TEXT };
  }
  const tokens = rest.split(/\s+/).filter(Boolean);
  if (tokens.length < 2) {
    return { error: USAGE_TEXT };
  }
  const first = tokens[0]?.toLowerCase();
  const second = tokens[1]?.toLowerCase();
  if (first && DECISION_ALIASES[first]) {
    const id = tokens.slice(1).join(' ').trim();
    return id ? { id, decision: DECISION_ALIASES[first] } : { error: USAGE_TEXT };
  }
  if (second && DECISION_ALIASES[second]) {
    return { id: tokens[0], decision: DECISION_ALIASES[second] };
  }
  return { error: USAGE_TEXT };
}

export function formatApprovalCommandReply(id: string, decision: ApprovalDecision): string {
  return `Exec approval ${decision} submitted for ${id}.`;
}

export function getApprovalCommandUsageText(): string {
  return USAGE_TEXT;
}
