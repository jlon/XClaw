import { create } from 'zustand';
import { hostApiFetch } from '@/lib/host-api';
import type { ChannelType } from '@/types/channel';
import type { AgentSummary, AgentsSnapshot } from '@/types/agent';

let fetchAgentsInFlight: Promise<void> | null = null;

interface AgentsState {
  agents: AgentSummary[];
  defaultAgentId: string;
  configuredChannelTypes: string[];
  channelOwners: Record<string, string>;
  channelAccountOwners: Record<string, string>;
  loading: boolean;
  error: string | null;
  applySnapshot: (snapshot: AgentsSnapshot) => void;
  fetchAgents: () => Promise<void>;
  createAgent: (name: string, modelRef?: string | null) => Promise<{ createdAgentId: string; warning: string | null }>;
  updateAgent: (agentId: string, updates: { name: string; modelRef?: string | null }) => Promise<{ applyingRuntime: boolean }>;
  deleteAgent: (agentId: string) => Promise<void>;
  assignChannel: (agentId: string, channelType: ChannelType) => Promise<void>;
  removeChannel: (agentId: string, channelType: ChannelType) => Promise<void>;
  clearError: () => void;
}

function applySnapshot(snapshot: AgentsSnapshot | undefined) {
  return snapshot ? {
    agents: snapshot.agents ?? [],
    defaultAgentId: snapshot.defaultAgentId ?? 'main',
    configuredChannelTypes: snapshot.configuredChannelTypes ?? [],
    channelOwners: snapshot.channelOwners ?? {},
    channelAccountOwners: snapshot.channelAccountOwners ?? {},
  } : {};
}

export const useAgentsStore = create<AgentsState>((set) => ({
  agents: [],
  defaultAgentId: 'main',
  configuredChannelTypes: [],
  channelOwners: {},
  channelAccountOwners: {},
  loading: false,
  error: null,

  applySnapshot: (snapshot: AgentsSnapshot) => {
    set(applySnapshot(snapshot));
  },

  fetchAgents: async () => {
    if (fetchAgentsInFlight) {
      return fetchAgentsInFlight;
    }

    set({ loading: true, error: null });
    fetchAgentsInFlight = (async () => {
      try {
        const snapshot = await hostApiFetch<AgentsSnapshot & { success?: boolean }>('/api/agents');
        set({
          ...applySnapshot(snapshot),
          loading: false,
        });
      } catch (error) {
        set({ loading: false, error: String(error) });
      } finally {
        fetchAgentsInFlight = null;
      }
    })();

    return fetchAgentsInFlight;
  },

  createAgent: async (name: string, modelRef?: string | null) => {
    set({ error: null });
    try {
      const snapshot = await hostApiFetch<AgentsSnapshot & { success?: boolean; createdAgentId?: string; warning?: string | null }>('/api/agents', {
        method: 'POST',
        body: JSON.stringify({ name, modelRef }),
      });
      set(applySnapshot(snapshot));
      return {
        createdAgentId: snapshot.createdAgentId ?? '',
        warning: snapshot.warning ?? null,
      };
    } catch (error) {
      set({ error: String(error) });
      throw error;
    }
  },

  updateAgent: async (agentId: string, updates: { name: string; modelRef?: string | null }) => {
    set({ error: null });
    try {
      const snapshot = await hostApiFetch<AgentsSnapshot & { success?: boolean; applyingRuntime?: boolean }>(
        `/api/agents/${encodeURIComponent(agentId)}`,
        {
          method: 'PUT',
          body: JSON.stringify(updates),
        }
      );
      set(applySnapshot(snapshot));
      return { applyingRuntime: Boolean(snapshot.applyingRuntime) };
    } catch (error) {
      set({ error: String(error) });
      throw error;
    }
  },

  deleteAgent: async (agentId: string) => {
    set({ error: null });
    try {
      const snapshot = await hostApiFetch<AgentsSnapshot & { success?: boolean }>(
        `/api/agents/${encodeURIComponent(agentId)}`,
        { method: 'DELETE' }
      );
      set(applySnapshot(snapshot));
    } catch (error) {
      set({ error: String(error) });
      throw error;
    }
  },

  assignChannel: async (agentId: string, channelType: ChannelType) => {
    set({ error: null });
    try {
      const snapshot = await hostApiFetch<AgentsSnapshot & { success?: boolean }>(
        `/api/agents/${encodeURIComponent(agentId)}/channels/${encodeURIComponent(channelType)}`,
        { method: 'PUT' }
      );
      set(applySnapshot(snapshot));
    } catch (error) {
      set({ error: String(error) });
      throw error;
    }
  },

  removeChannel: async (agentId: string, channelType: ChannelType) => {
    set({ error: null });
    try {
      const snapshot = await hostApiFetch<AgentsSnapshot & { success?: boolean }>(
        `/api/agents/${encodeURIComponent(agentId)}/channels/${encodeURIComponent(channelType)}`,
        { method: 'DELETE' }
      );
      set(applySnapshot(snapshot));
    } catch (error) {
      set({ error: String(error) });
      throw error;
    }
  },

  clearError: () => set({ error: null }),
}));
