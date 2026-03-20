import type { ChatGet, ChatSet, RuntimeActions } from './store-api';
import { useGatewayStore } from '@/stores/gateway';

function ensureSessionEntryModel(
  sessions: Array<{ key: string; model?: string }>,
  sessionKey: string,
  model: string | undefined,
): Array<{ key: string; model?: string }> {
  if (sessions.some((session) => session.key === sessionKey)) {
    return sessions.map((session) => (
      session.key === sessionKey
        ? { ...session, model }
        : session
    ));
  }
  return [...sessions, { key: sessionKey, model }];
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

export function createRuntimeUiActions(set: ChatSet, get: ChatGet): Pick<RuntimeActions, 'toggleThinking' | 'setSessionModel' | 'refresh' | 'clearError'> {
  return {
    toggleThinking: () => set((s) => ({ showThinking: !s.showThinking })),

    setSessionModel: async (model) => {
      const { currentSessionKey } = get();
      try {
        const response = await useGatewayStore.getState().rpc<{
          resolved?: { modelProvider?: string | null; model?: string | null };
        }>('sessions.patch', {
          key: currentSessionKey,
          model,
        });
        const nextModel = normalizeSessionModelRef(
          response?.resolved?.model,
          response?.resolved?.modelProvider,
        ) ?? (model?.trim() || undefined);
        set((state) => ({
          sessions: ensureSessionEntryModel(state.sessions, currentSessionKey, nextModel),
          error: null,
        }));
        return nextModel;
      } catch (error) {
        set({ error: String(error) });
        throw error;
      }
    },

    refresh: async () => {
      const { loadHistory, loadSessions } = get();
      await Promise.all([loadHistory(), loadSessions()]);
    },

    clearError: () => set({ error: null }),
  };
}
