import { invokeIpc } from '@/lib/api-client';
import { generateUuid } from '@/lib/uuid';
import { useAgentsStore } from '@/stores/agents';
import {
  clearErrorRecoveryTimer,
  clearHistoryPoll,
  getLastChatEventAt,
  setHistoryPollTimer,
  setLastChatEventAt,
  upsertImageCacheEntry,
} from './helpers';
import { enqueueLocalChatCommand, flushQueuedLocalChatCommands } from './local-command-queue';
import { executeLocalChatCommand } from './local-command-router';
import type { ChatSession, RawMessage } from './types';
import type { ChatGet, ChatSet, RuntimeActions } from './store-api';

function normalizeAgentId(value: string | undefined | null): string {
  return (value ?? '').trim().toLowerCase() || 'main';
}

function getAgentIdFromSessionKey(sessionKey: string): string {
  if (!sessionKey.startsWith('agent:')) return 'main';
  const [, agentId] = sessionKey.split(':');
  return agentId || 'main';
}

function buildFallbackMainSessionKey(agentId: string): string {
  return `agent:${normalizeAgentId(agentId)}:main`;
}

function resolveMainSessionKeyForAgent(agentId: string | undefined | null): string | null {
  if (!agentId) return null;
  const normalizedAgentId = normalizeAgentId(agentId);
  const summary = useAgentsStore.getState().agents.find((agent) => agent.id === normalizedAgentId);
  return summary?.mainSessionKey || buildFallbackMainSessionKey(normalizedAgentId);
}

function ensureSessionEntry(sessions: ChatSession[], sessionKey: string): ChatSession[] {
  if (sessions.some((session) => session.key === sessionKey)) {
    return sessions;
  }
  return [...sessions, { key: sessionKey, displayName: sessionKey }];
}

type ComposerAttachment = Array<{
  fileName: string;
  mimeType: string;
  fileSize: number;
  stagedPath: string;
  preview: string | null;
}>;

async function sendGatewayRuntimeMessage(
  set: ChatSet,
  get: ChatGet,
  text: string,
  attachments?: ComposerAttachment,
  targetAgentId?: string | null,
): Promise<void> {
  const trimmed = text.trim();
  if (!trimmed && (!attachments || attachments.length === 0)) return;

  const targetSessionKey = resolveMainSessionKeyForAgent(targetAgentId) ?? get().currentSessionKey;
  if (targetSessionKey !== get().currentSessionKey) {
    const current = get();
    const leavingEmpty = !current.currentSessionKey.endsWith(':main') && current.messages.length === 0;
    set((state) => ({
      currentSessionKey: targetSessionKey,
      currentAgentId: getAgentIdFromSessionKey(targetSessionKey),
      sessions: ensureSessionEntry(
        leavingEmpty ? state.sessions.filter((session) => session.key !== current.currentSessionKey) : state.sessions,
        targetSessionKey,
      ),
      sessionLabels: leavingEmpty
        ? Object.fromEntries(Object.entries(state.sessionLabels).filter(([key]) => key !== current.currentSessionKey))
        : state.sessionLabels,
      sessionLastActivity: leavingEmpty
        ? Object.fromEntries(Object.entries(state.sessionLastActivity).filter(([key]) => key !== current.currentSessionKey))
        : state.sessionLastActivity,
      messages: [],
      streamingText: '',
      streamingMessage: null,
      streamingTools: [],
      activeRunId: null,
      error: null,
      pendingFinal: false,
      lastUserMessageAt: null,
      pendingToolImages: [],
    }));
    await get().loadHistory(true);
  }

  const currentSessionKey = targetSessionKey;
  const nowMs = Date.now();
  const userMsg: RawMessage = {
    role: 'user',
    content: trimmed || (attachments?.length ? '(file attached)' : ''),
    timestamp: nowMs / 1000,
    id: generateUuid(),
    _attachedFiles: attachments?.map((attachment) => ({
      fileName: attachment.fileName,
      mimeType: attachment.mimeType,
      fileSize: attachment.fileSize,
      preview: attachment.preview,
      filePath: attachment.stagedPath,
    })),
  };
  set((state) => ({
    messages: [...state.messages, userMsg],
    sending: true,
    error: null,
    streamingText: '',
    streamingMessage: null,
    streamingTools: [],
    pendingFinal: false,
    lastUserMessageAt: nowMs,
  }));

  const { sessionLabels, messages } = get();
  const isFirstMessage = !messages.slice(0, -1).some((message) => message.role === 'user');
  if (isFirstMessage && !sessionLabels[currentSessionKey] && trimmed) {
    const truncated = trimmed.length > 50 ? `${trimmed.slice(0, 50)}…` : trimmed;
    set((state) => ({ sessionLabels: { ...state.sessionLabels, [currentSessionKey]: truncated } }));
  }

  set((state) => ({ sessionLastActivity: { ...state.sessionLastActivity, [currentSessionKey]: nowMs } }));

  setLastChatEventAt(Date.now());
  clearHistoryPoll();
  clearErrorRecoveryTimer();

  const POLL_START_DELAY = 3_000;
  const POLL_INTERVAL = 4_000;
  const pollHistory = () => {
    const state = get();
    if (!state.sending) { clearHistoryPoll(); return; }
    if (state.streamingMessage) {
      setHistoryPollTimer(setTimeout(pollHistory, POLL_INTERVAL));
      return;
    }
    state.loadHistory(true);
    setHistoryPollTimer(setTimeout(pollHistory, POLL_INTERVAL));
  };
  setHistoryPollTimer(setTimeout(pollHistory, POLL_START_DELAY));

  const SAFETY_TIMEOUT_MS = 90_000;
  const checkStuck = () => {
    const state = get();
    if (!state.sending) return;
    if (state.streamingMessage || state.streamingText) return;
    if (state.pendingFinal) {
      setTimeout(checkStuck, 10_000);
      return;
    }
    if (Date.now() - getLastChatEventAt() < SAFETY_TIMEOUT_MS) {
      setTimeout(checkStuck, 10_000);
      return;
    }
    clearHistoryPoll();
    set({
      error: 'No response received from the model. The provider may be unavailable or the API key may have insufficient quota. Please check your provider settings.',
      sending: false,
      activeRunId: null,
      lastUserMessageAt: null,
    });
  };
  setTimeout(checkStuck, 30_000);

  try {
    const idempotencyKey = generateUuid();
    const hasMedia = Boolean(attachments && attachments.length > 0);
    if (hasMedia) {
      console.log('[sendMessage] Media paths:', attachments!.map((attachment) => attachment.stagedPath));
      for (const attachment of attachments ?? []) {
        upsertImageCacheEntry(attachment.stagedPath, {
          fileName: attachment.fileName,
          mimeType: attachment.mimeType,
          fileSize: attachment.fileSize,
          preview: attachment.preview,
        });
      }
    }

    let result: { success: boolean; result?: { runId?: string }; error?: string };
    const CHAT_SEND_TIMEOUT_MS = 120_000;

    if (hasMedia) {
      result = await invokeIpc(
        'chat:sendWithMedia',
        {
          sessionKey: currentSessionKey,
          message: trimmed || 'Process the attached file(s).',
          deliver: false,
          idempotencyKey,
          media: attachments!.map((attachment) => ({
            filePath: attachment.stagedPath,
            mimeType: attachment.mimeType,
            fileName: attachment.fileName,
          })),
        },
      ) as { success: boolean; result?: { runId?: string }; error?: string };
    } else {
      result = await invokeIpc(
        'gateway:rpc',
        'chat.send',
        {
          sessionKey: currentSessionKey,
          message: trimmed,
          deliver: false,
          idempotencyKey,
        },
        CHAT_SEND_TIMEOUT_MS,
      ) as { success: boolean; result?: { runId?: string }; error?: string };
    }

    console.log(`[sendMessage] RPC result: success=${result.success}, runId=${result.result?.runId || 'none'}`);

    if (!result.success) {
      clearHistoryPoll();
      set({ error: result.error || 'Failed to send message', sending: false });
      return;
    }
    if (result.result?.runId) {
      set({ activeRunId: result.result.runId });
    }
  } catch (error) {
    clearHistoryPoll();
    set({ error: String(error), sending: false });
  }
}

async function flushQueuedRuntimeCommands(set: ChatSet, get: ChatGet): Promise<void> {
  await flushQueuedLocalChatCommands(get, async (text, targetAgentId) => {
    const handled = await executeLocalChatCommand(text, set, get, targetAgentId, {
      allowQueue: false,
      isBusy: false,
      dispatchGatewaySlashCommand: (commandText, commandTargetAgentId) =>
        sendGatewayRuntimeMessage(set, get, commandText, undefined, commandTargetAgentId),
    });
    if (!handled) {
      await sendGatewayRuntimeMessage(set, get, text, undefined, targetAgentId);
    }
  });
}

export function scheduleQueuedRuntimeCommandFlush(set: ChatSet, get: ChatGet): void {
  queueMicrotask(() => {
    void flushQueuedRuntimeCommands(set, get);
  });
}

export function createRuntimeSendActions(set: ChatSet, get: ChatGet): Pick<RuntimeActions, 'sendMessage' | 'abortRun'> {
  return {
    sendMessage: async (
      text: string,
      attachments?: Array<{ fileName: string; mimeType: string; fileSize: number; stagedPath: string; preview: string | null }>,
      targetAgentId?: string | null,
    ) => {
      const trimmed = text.trim();
      if (!trimmed && (!attachments || attachments.length === 0)) return;
      if (
        !attachments?.length
        && await executeLocalChatCommand(trimmed, set, get, targetAgentId, {
          isBusy: get().sending || Boolean(get().activeRunId),
          queueLocalCommand: (queuedText, queuedTargetAgentId) =>
            enqueueLocalChatCommand(get, { text: queuedText, targetAgentId: queuedTargetAgentId }),
          dispatchGatewaySlashCommand: (commandText, commandTargetAgentId) =>
            sendGatewayRuntimeMessage(set, get, commandText, undefined, commandTargetAgentId),
        })
      ) {
        return;
      }

      await sendGatewayRuntimeMessage(set, get, text, attachments, targetAgentId);
    },

    // ── Abort active run ──

    abortRun: async () => {
      clearHistoryPoll();
      clearErrorRecoveryTimer();
      const { currentSessionKey } = get();
      set({ sending: false, streamingText: '', streamingMessage: null, pendingFinal: false, lastUserMessageAt: null, pendingToolImages: [] });
      set({ streamingTools: [] });

      try {
        await invokeIpc(
          'gateway:rpc',
          'chat.abort',
          { sessionKey: currentSessionKey },
        );
      } catch (err) {
        set({ error: String(err) });
      }
    },

    // ── Handle incoming chat events from Gateway ──

  };
}
