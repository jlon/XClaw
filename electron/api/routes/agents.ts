import type { IncomingMessage, ServerResponse } from 'http';
import {
  assignChannelToAgent,
  clearChannelBinding,
  createAgent,
  deleteAgentConfig,
  listAgentsSnapshot,
  removeAgentWorkspaceDirectory,
  resolveAccountIdForAgent,
  updateAgentName,
} from '../../utils/agent-config';
import { deleteChannelAccountConfig } from '../../utils/channel-config';
import { syncAllProviderAuthToRuntime } from '../../services/providers/provider-runtime-sync';
import type { HostApiContext } from '../context';
import { parseJsonBody, sendJson } from '../route-utils';

function scheduleGatewayReload(ctx: HostApiContext): void {
  void ctx.gatewayRuntimeController.requestRuntimeRefresh({ mode: 'reload' });
}

async function replaceGatewayForAgentDeletion(ctx: HostApiContext): Promise<void> {
  await ctx.gatewayRuntimeController.replaceRuntime();
}

export async function handleAgentRoutes(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
  ctx: HostApiContext,
): Promise<boolean> {
  if (url.pathname === '/api/agents' && req.method === 'GET') {
    sendJson(res, 200, { success: true, ...(await listAgentsSnapshot()) });
    return true;
  }

  if (url.pathname === '/api/agents' && req.method === 'POST') {
    try {
      const body = await parseJsonBody<{ name: string }>(req);
      const snapshot = await createAgent(body.name);
      // Sync provider API keys to the new agent's auth-profiles.json so the
      // embedded runner can authenticate with LLM providers when messages
      // arrive via channel bots (e.g. Feishu). Without this, the copied
      // auth-profiles.json may contain a stale key → 401 from the LLM.
      syncAllProviderAuthToRuntime().catch((err) => {
        console.warn('[agents] Failed to sync provider auth after agent creation:', err);
      });
      scheduleGatewayReload(ctx);
      sendJson(res, 200, { success: true, ...snapshot });
    } catch (error) {
      sendJson(res, 500, { success: false, error: String(error) });
    }
    return true;
  }

  if (url.pathname.startsWith('/api/agents/') && req.method === 'PUT') {
    const suffix = url.pathname.slice('/api/agents/'.length);
    const parts = suffix.split('/').filter(Boolean);

    if (parts.length === 1) {
      try {
        const body = await parseJsonBody<{ name: string }>(req);
        const agentId = decodeURIComponent(parts[0]);
        const snapshot = await updateAgentName(agentId, body.name);
        scheduleGatewayReload(ctx);
        sendJson(res, 200, { success: true, ...snapshot });
      } catch (error) {
        sendJson(res, 500, { success: false, error: String(error) });
      }
      return true;
    }

    if (parts.length === 3 && parts[1] === 'channels') {
      try {
        const agentId = decodeURIComponent(parts[0]);
        const channelType = decodeURIComponent(parts[2]);
        const snapshot = await assignChannelToAgent(agentId, channelType);
        scheduleGatewayReload(ctx);
        sendJson(res, 200, { success: true, ...snapshot });
      } catch (error) {
        sendJson(res, 500, { success: false, error: String(error) });
      }
      return true;
    }
  }

  if (url.pathname.startsWith('/api/agents/') && req.method === 'DELETE') {
    const suffix = url.pathname.slice('/api/agents/'.length);
    const parts = suffix.split('/').filter(Boolean);

    if (parts.length === 1) {
      try {
        const agentId = decodeURIComponent(parts[0]);
        const { snapshot, removedEntry } = await deleteAgentConfig(agentId);
        // Await reload synchronously BEFORE responding to the client.
        // This ensures the Feishu plugin has disconnected the deleted bot
        // before the UI shows "delete success" and the user tries chatting.
        await replaceGatewayForAgentDeletion(ctx);
        // Delete workspace after reload so the new config is already live.
        await removeAgentWorkspaceDirectory(removedEntry).catch((err) => {
          console.warn('[agents] Failed to remove workspace after agent deletion:', err);
        });
        sendJson(res, 200, { success: true, ...snapshot });
      } catch (error) {
        sendJson(res, 500, { success: false, error: String(error) });
      }
      return true;
    }

    if (parts.length === 3 && parts[1] === 'channels') {
      try {
        const agentId = decodeURIComponent(parts[0]);
        const channelType = decodeURIComponent(parts[2]);
        const ownerId = agentId.trim().toLowerCase();
        const snapshotBefore = await listAgentsSnapshot();
        const ownedAccountIds = Object.entries(snapshotBefore.channelAccountOwners)
          .filter(([channelAccountKey, owner]) => {
            if (owner !== ownerId) return false;
            return channelAccountKey.startsWith(`${channelType}:`);
          })
          .map(([channelAccountKey]) => channelAccountKey.slice(channelAccountKey.indexOf(':') + 1));
        // Backward compatibility for legacy agentId->accountId mapping.
        if (ownedAccountIds.length === 0) {
          const legacyAccountId = resolveAccountIdForAgent(agentId);
          if (snapshotBefore.channelAccountOwners[`${channelType}:${legacyAccountId}`] === ownerId) {
            ownedAccountIds.push(legacyAccountId);
          }
        }

        for (const accountId of ownedAccountIds) {
          await deleteChannelAccountConfig(channelType, accountId);
          await clearChannelBinding(channelType, accountId);
        }
        const snapshot = await listAgentsSnapshot();
        scheduleGatewayReload(ctx);
        sendJson(res, 200, { success: true, ...snapshot });
      } catch (error) {
        sendJson(res, 500, { success: false, error: String(error) });
      }
      return true;
    }
  }

  return false;
}
