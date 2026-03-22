import { useGatewayStore } from '@/stores/gateway';
import { formatApprovalCommandReply, parseApprovalCommand } from './approval-command';
import {
  buildSlashHelpText,
  isStopCommand,
  normalizeThinkLevel,
  normalizeVerboseLevel,
  parseFastMode,
  parseSlashCommand,
  resolveKillTargets,
  shouldQueueLocalSlashCommand,
} from './slash-commands';
import type { ChatGet, ChatSet } from './store-api';
import type { ChatSession, ChatState, PendingSlashAction, RawMessage } from './types';

type ExecuteLocalChatCommandOptions = {
  allowQueue?: boolean;
  isBusy?: boolean;
  queueLocalCommand?: (text: string, targetAgentId?: string | null) => void;
  dispatchGatewaySlashCommand?: (text: string, targetAgentId?: string | null) => Promise<void>;
};

function buildLocalAssistantMessage(content: string): RawMessage {
  return {
    role: 'assistant',
    content,
    timestamp: Date.now() / 1000,
    id: crypto.randomUUID(),
  };
}

function buildPendingSlashAction(kind: PendingSlashAction['kind']): PendingSlashAction {
  return {
    kind,
    token: crypto.randomUUID(),
  };
}

function appendLocalAssistantReply(
  state: ChatState,
  content: string,
  overrides?: Partial<ChatState>,
): Partial<ChatState> {
  return {
    ...overrides,
    messages: [...state.messages, buildLocalAssistantMessage(content)],
    error: null,
  };
}

function formatDirectiveOptions(text: string, options: string): string {
  return `${text}\nOptions: ${options}.`;
}

function clearSessionEntryFromMap<T extends Record<string, unknown>>(entries: T, sessionKey: string): T {
  return Object.fromEntries(Object.entries(entries).filter(([key]) => key !== sessionKey)) as T;
}

function clearComposerAndRuntimeState(): Pick<
  ChatState,
  | 'sending'
  | 'messages'
  | 'streamingText'
  | 'streamingMessage'
  | 'streamingTools'
  | 'activeRunId'
  | 'error'
  | 'pendingFinal'
  | 'lastUserMessageAt'
  | 'pendingToolImages'
> {
  return {
    sending: false,
    messages: [],
    streamingText: '',
    streamingMessage: null,
    streamingTools: [],
    activeRunId: null,
    error: null,
    pendingFinal: false,
    lastUserMessageAt: null,
    pendingToolImages: [],
  };
}

function resolveCurrentSessionRow(
  sessions: Array<Record<string, unknown>>,
  sessionKey: string,
): Record<string, unknown> | null {
  return sessions.find((session) => String(session.key || '') === sessionKey) ?? null;
}

function normalizeSessionModelRef(
  model: unknown,
  modelProvider?: unknown,
): string | undefined {
  const trimmedModel = typeof model === 'string' ? model.trim() : '';
  if (!trimmedModel) {
    return undefined;
  }
  if (trimmedModel.includes('/')) {
    return trimmedModel;
  }
  const trimmedProvider = typeof modelProvider === 'string' ? modelProvider.trim() : '';
  return trimmedProvider ? `${trimmedProvider}/${trimmedModel}` : trimmedModel;
}

function formatTokenCount(value: unknown): string {
  const count = typeof value === 'number' && Number.isFinite(value) ? value : 0;
  return new Intl.NumberFormat('en-US').format(count);
}

export async function executeLocalChatCommand(
  text: string,
  set: ChatSet,
  get: ChatGet,
  targetAgentId?: string | null,
  options?: ExecuteLocalChatCommandOptions,
): Promise<boolean> {
  const trimmed = text.trim();
  if (!trimmed) {
    return false;
  }

  if (isStopCommand(trimmed)) {
    await get().abortRun();
    return true;
  }

  const approvalCommand = parseApprovalCommand(trimmed);
  if (approvalCommand) {
    if ('error' in approvalCommand) {
      set((state) => appendLocalAssistantReply(state, approvalCommand.error));
      return true;
    }
    set({
      sending: true,
      error: null,
      streamingText: '',
      streamingMessage: null,
      streamingTools: [],
      pendingFinal: false,
      activeRunId: null,
      lastUserMessageAt: null,
      pendingToolImages: [],
    });
    try {
      await useGatewayStore.getState().rpc('exec.approval.resolve', {
        id: approvalCommand.id,
        decision: approvalCommand.decision,
      });
      set((state) => appendLocalAssistantReply(
        state,
        formatApprovalCommandReply(approvalCommand.id, approvalCommand.decision),
        { sending: false },
      ));
    } catch (error) {
      set((state) => appendLocalAssistantReply(
        state,
        `Failed to submit approval: ${String(error)}`,
        { sending: false },
      ));
    }
    return true;
  }

  const parsedSlash = parseSlashCommand(trimmed);
  if (!parsedSlash?.command.executeLocal) {
    return false;
  }

  if (
    options?.allowQueue !== false
    && options?.isBusy
    && shouldQueueLocalSlashCommand(parsedSlash.command.name)
  ) {
    options.queueLocalCommand?.(trimmed, targetAgentId);
    return true;
  }

  const { command, args } = parsedSlash;
  const currentSessionKey = get().currentSessionKey;

  switch (command.name) {
    case 'help': {
      set((state) => appendLocalAssistantReply(state, buildSlashHelpText()));
      return true;
    }
    case 'new': {
      if (!options?.dispatchGatewaySlashCommand) {
        return false;
      }
      await options.dispatchGatewaySlashCommand('/new', targetAgentId ?? get().currentAgentId);
      return true;
    }
    case 'reset': {
      if (!options?.dispatchGatewaySlashCommand) {
        return false;
      }
      await options.dispatchGatewaySlashCommand('/reset', targetAgentId ?? get().currentAgentId);
      return true;
    }
    case 'clear': {
      try {
        await useGatewayStore.getState().rpc('sessions.reset', { key: currentSessionKey });
        set((state) => ({
          ...clearComposerAndRuntimeState(),
          sessionLabels: clearSessionEntryFromMap(state.sessionLabels, currentSessionKey),
          pendingSlashAction: null,
        }));
      } catch (error) {
        set((state) => appendLocalAssistantReply(state, `Failed to reset session: ${String(error)}`));
      }
      return true;
    }
    case 'focus': {
      set({ pendingSlashAction: buildPendingSlashAction('toggle-focus'), error: null });
      return true;
    }
    case 'export': {
      set({ pendingSlashAction: buildPendingSlashAction('export'), error: null });
      return true;
    }
    case 'usage': {
      try {
        const sessionsResult = await useGatewayStore.getState().rpc<Record<string, unknown>>('sessions.list', {});
        const currentRow = resolveCurrentSessionRow(
          Array.isArray(sessionsResult.sessions) ? sessionsResult.sessions as Array<Record<string, unknown>> : [],
          currentSessionKey,
        );
        if (!currentRow) {
          set((state) => appendLocalAssistantReply(state, 'No active session.'));
          return true;
        }
        const input = typeof currentRow.inputTokens === 'number' ? currentRow.inputTokens : 0;
        const output = typeof currentRow.outputTokens === 'number' ? currentRow.outputTokens : 0;
        const total = typeof currentRow.totalTokens === 'number' ? currentRow.totalTokens : input + output;
        const context = typeof currentRow.contextTokens === 'number' ? currentRow.contextTokens : 0;
        const pct = context > 0 ? Math.round((input / context) * 100) : null;
        const lines = [
          '**Session Usage**',
          `Input: **${formatTokenCount(input)}** tokens`,
          `Output: **${formatTokenCount(output)}** tokens`,
          `Total: **${formatTokenCount(total)}** tokens`,
        ];
        if (pct !== null) {
          lines.push(`Context: **${pct}%** of ${formatTokenCount(context)}`);
        }
        const model = normalizeSessionModelRef(currentRow.model, currentRow.modelProvider);
        if (model) {
          lines.push(`Model: \`${model}\``);
        }
        set((state) => appendLocalAssistantReply(state, lines.join('\n')));
      } catch (error) {
        set((state) => appendLocalAssistantReply(state, `Failed to get session usage: ${String(error)}`));
      }
      return true;
    }
    case 'compact': {
      try {
        await useGatewayStore.getState().rpc('sessions.compact', { key: currentSessionKey });
        set((state) => appendLocalAssistantReply(state, 'Context compacted successfully.'));
      } catch (error) {
        set((state) => appendLocalAssistantReply(state, `Compaction failed: ${String(error)}`));
      }
      return true;
    }
    case 'model': {
      if (!args) {
        try {
          const [sessionsResult, modelsResult] = await Promise.all([
            useGatewayStore.getState().rpc<Record<string, unknown>>('sessions.list', {}),
            useGatewayStore.getState().rpc<Record<string, unknown>>('models.list', {}),
          ]);
          const currentRow = resolveCurrentSessionRow(
            Array.isArray(sessionsResult.sessions) ? sessionsResult.sessions as Array<Record<string, unknown>> : [],
            currentSessionKey,
          );
          const currentModel = normalizeSessionModelRef(currentRow?.model, currentRow?.modelProvider)
            ?? get().sessions.find((session) => session.key === currentSessionKey)?.model
            ?? 'default';
          const available = (Array.isArray(modelsResult.models) ? modelsResult.models : [])
            .map((model) => {
              if (!model || typeof model !== 'object') return '';
              const raw = model as Record<string, unknown>;
              return normalizeSessionModelRef(raw.id ?? raw.model, raw.provider ?? raw.vendorId);
            })
            .filter((model): model is string => Boolean(model));
          const lines = [`**Current model:** \`${currentModel}\``];
          if (available.length > 0) {
            lines.push(`**Available:** ${available.slice(0, 10).map((model) => `\`${model}\``).join(', ')}${available.length > 10 ? ` +${available.length - 10} more` : ''}`);
          }
          set((state) => appendLocalAssistantReply(state, lines.join('\n')));
        } catch (error) {
          set((state) => appendLocalAssistantReply(state, `Failed to get model info: ${String(error)}`));
        }
        return true;
      }
      try {
        await get().setSessionModel(args.trim());
        set((state) => appendLocalAssistantReply(state, `Model set to \`${args.trim()}\`.`));
      } catch (error) {
        set((state) => appendLocalAssistantReply(state, `Failed to set model: ${String(error)}`));
      }
      return true;
    }
    case 'think': {
      if (!args) {
        try {
          const sessionsResult = await useGatewayStore.getState().rpc<Record<string, unknown>>('sessions.list', {});
          const currentRow = resolveCurrentSessionRow(
            Array.isArray(sessionsResult.sessions) ? sessionsResult.sessions as Array<Record<string, unknown>> : [],
            currentSessionKey,
          );
          const currentLevel = typeof currentRow?.thinkingLevel === 'string'
            ? currentRow.thinkingLevel
            : (get().thinkingLevel ?? 'default');
          set((state) => appendLocalAssistantReply(
            state,
            formatDirectiveOptions(`Current thinking level: ${currentLevel}.`, 'off, low, medium, high'),
          ));
        } catch (error) {
          set((state) => appendLocalAssistantReply(state, `Failed to get thinking level: ${String(error)}`));
        }
        return true;
      }
      const level = normalizeThinkLevel(args);
      if (!level) {
        set((state) => appendLocalAssistantReply(state, `Unrecognized thinking level "${args.trim()}". Valid levels: off, low, medium, high.`));
        return true;
      }
      try {
        await useGatewayStore.getState().rpc('sessions.patch', { key: currentSessionKey, thinkingLevel: level });
        set((state) => appendLocalAssistantReply(state, `Thinking level set to **${level}**.`, { thinkingLevel: level }));
      } catch (error) {
        set((state) => appendLocalAssistantReply(state, `Failed to set thinking level: ${String(error)}`));
      }
      return true;
    }
    case 'verbose': {
      if (!args) {
        try {
          const sessionsResult = await useGatewayStore.getState().rpc<Record<string, unknown>>('sessions.list', {});
          const currentRow = resolveCurrentSessionRow(
            Array.isArray(sessionsResult.sessions) ? sessionsResult.sessions as Array<Record<string, unknown>> : [],
            currentSessionKey,
          );
          const currentLevel = normalizeVerboseLevel(String(currentRow?.verboseLevel ?? 'off')) ?? 'off';
          set((state) => appendLocalAssistantReply(
            state,
            formatDirectiveOptions(`Current verbose level: ${currentLevel}.`, 'on, full, off'),
          ));
        } catch (error) {
          set((state) => appendLocalAssistantReply(state, `Failed to get verbose level: ${String(error)}`));
        }
        return true;
      }
      const level = normalizeVerboseLevel(args);
      if (!level) {
        set((state) => appendLocalAssistantReply(state, `Unrecognized verbose level "${args.trim()}". Valid levels: off, on, full.`));
        return true;
      }
      try {
        await useGatewayStore.getState().rpc('sessions.patch', { key: currentSessionKey, verboseLevel: level });
        set((state) => appendLocalAssistantReply(state, `Verbose mode set to **${level}**.`));
      } catch (error) {
        set((state) => appendLocalAssistantReply(state, `Failed to set verbose mode: ${String(error)}`));
      }
      return true;
    }
    case 'fast': {
      const fastMode = parseFastMode(args);
      if (fastMode === null) {
        set((state) => appendLocalAssistantReply(state, `Unrecognized fast mode "${args.trim()}". Valid levels: status, on, off.`));
        return true;
      }
      if (fastMode === 'status') {
        try {
          const sessionsResult = await useGatewayStore.getState().rpc<Record<string, unknown>>('sessions.list', {});
          const currentRow = resolveCurrentSessionRow(
            Array.isArray(sessionsResult.sessions) ? sessionsResult.sessions as Array<Record<string, unknown>> : [],
            currentSessionKey,
          );
          const currentStatus = currentRow?.fastMode === true ? 'on' : 'off';
          set((state) => appendLocalAssistantReply(
            state,
            formatDirectiveOptions(`Current fast mode: ${currentStatus}.`, 'status, on, off'),
          ));
        } catch (error) {
          set((state) => appendLocalAssistantReply(state, `Failed to get fast mode: ${String(error)}`));
        }
        return true;
      }
      try {
        await useGatewayStore.getState().rpc('sessions.patch', { key: currentSessionKey, fastMode });
        set((state) => appendLocalAssistantReply(state, `Fast mode ${fastMode ? 'enabled' : 'disabled'}.`));
      } catch (error) {
        set((state) => appendLocalAssistantReply(state, `Failed to set fast mode: ${String(error)}`));
      }
      return true;
    }
    case 'agents': {
      try {
        const result = await useGatewayStore.getState().rpc<Record<string, unknown>>('agents.list', {});
        const agents = Array.isArray(result.agents) ? result.agents as Array<Record<string, unknown>> : [];
        if (agents.length === 0) {
          set((state) => appendLocalAssistantReply(state, 'No agents configured.'));
          return true;
        }
        const defaultId = typeof result.defaultId === 'string' ? result.defaultId : '';
        const lines = [`**Agents** (${agents.length})\n`];
        for (const agent of agents) {
          const id = String(agent.id || '');
          const name = typeof agent.name === 'string'
            ? agent.name
            : (typeof (agent.identity as Record<string, unknown> | undefined)?.name === 'string'
              ? String((agent.identity as Record<string, unknown>).name)
              : id);
          lines.push(`- \`${id}\` — ${name}${id === defaultId ? ' *(default)*' : ''}`);
        }
        set((state) => appendLocalAssistantReply(state, lines.join('\n')));
      } catch (error) {
        set((state) => appendLocalAssistantReply(state, `Failed to list agents: ${String(error)}`));
      }
      return true;
    }
    case 'kill': {
      if (!args.trim()) {
        set((state) => appendLocalAssistantReply(state, 'Usage: `/kill <id|all>`'));
        return true;
      }
      try {
        const sessionsResult = await useGatewayStore.getState().rpc<Record<string, unknown>>('sessions.list', {});
        const sessions = Array.isArray(sessionsResult.sessions) ? sessionsResult.sessions as Array<Record<string, unknown>> : [];
        const killCandidates: ChatSession[] = sessions
          .map((session) => {
            const key = typeof session.key === 'string' ? session.key : '';
            if (!key) {
              return null;
            }
            return {
              key,
              spawnedBy: typeof session.spawnedBy === 'string' ? session.spawnedBy : undefined,
            } as ChatSession & { spawnedBy?: string };
          })
          .filter((session): session is ChatSession & { spawnedBy?: string } => Boolean(session));
        const matched = resolveKillTargets(killCandidates, currentSessionKey, args);
        if (matched.length === 0) {
          set((state) => appendLocalAssistantReply(
            state,
            args.trim().toLowerCase() === 'all'
              ? 'No active sub-agent sessions found.'
              : `No matching sub-agent sessions found for \`${args.trim()}\`.`,
          ));
          return true;
        }
        const results = await Promise.allSettled(
          matched.map((sessionKey) => useGatewayStore.getState().rpc('chat.abort', { sessionKey })),
        );
        const successCount = results.filter((result) => result.status === 'fulfilled').length;
        if (successCount === 0) {
          set((state) => appendLocalAssistantReply(state, `Failed to abort: ${String(results.find((result) => result.status === 'rejected')?.reason ?? 'unknown error')}`));
          return true;
        }
        set((state) => appendLocalAssistantReply(
          state,
          args.trim().toLowerCase() === 'all'
            ? `Aborted ${successCount} sub-agent session${successCount === 1 ? '' : 's'}.`
            : `Aborted ${successCount} matching sub-agent session${successCount === 1 ? '' : 's'} for \`${args.trim()}\`.`,
        ));
      } catch (error) {
        set((state) => appendLocalAssistantReply(state, `Failed to abort: ${String(error)}`));
      }
      return true;
    }
    default:
      return false;
  }
}
