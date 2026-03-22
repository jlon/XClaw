import type { ChatGet } from './store-api';

type QueuedLocalCommand = {
  text: string;
  targetAgentId?: string | null;
};

const localCommandQueues = new WeakMap<ChatGet, QueuedLocalCommand[]>();

function getQueue(get: ChatGet): QueuedLocalCommand[] {
  const existing = localCommandQueues.get(get);
  if (existing) {
    return existing;
  }
  const created: QueuedLocalCommand[] = [];
  localCommandQueues.set(get, created);
  return created;
}

export function enqueueLocalChatCommand(get: ChatGet, command: QueuedLocalCommand): void {
  getQueue(get).push(command);
}

export function shiftLocalChatCommand(get: ChatGet): QueuedLocalCommand | undefined {
  return getQueue(get).shift();
}

export function hasQueuedLocalChatCommands(get: ChatGet): boolean {
  return getQueue(get).length > 0;
}

export async function flushQueuedLocalChatCommands(
  get: ChatGet,
  execute: (text: string, targetAgentId?: string | null) => Promise<void>,
): Promise<void> {
  if (get().sending || get().activeRunId) {
    return;
  }
  const next = shiftLocalChatCommand(get);
  if (!next) {
    return;
  }
  await execute(next.text, next.targetAgentId);
  if (!get().sending && !get().activeRunId && hasQueuedLocalChatCommands(get)) {
    await flushQueuedLocalChatCommands(get, execute);
  }
}
