import type { IncomingMessage, ServerResponse } from 'http';
import {
  assignChannelToAgent,
  createAgentWorkspaceFile,
  clearChannelBinding,
  createAgentWithId,
  deleteAgentConfig,
  deleteAgentWorkspaceFile,
  listAgentWorkspaceFiles,
  listAgentsSnapshot,
  readAgentWorkspaceFileContent,
  renameAgentWorkspaceFile,
  removeAgentWorkspaceDirectory,
  resolveAccountIdForAgent,
  updateAgentSettings,
  uploadAgentWorkspaceFile,
  writeAgentWorkspaceFileContent,
} from '../../utils/agent-config';
import { deleteChannelAccountConfig } from '../../utils/channel-config';
import { syncAllProviderAuthToRuntime } from '../../services/providers/provider-runtime-sync';
import type { HostApiContext } from '../context';
import { parseJsonBody, sendJson } from '../route-utils';

async function refreshAgentRuntime(ctx: HostApiContext): Promise<void> {
  await ctx.gatewayRuntimeController.restartRuntime();
}

async function finalizeAgentCreation(ctx: HostApiContext): Promise<void> {
  await syncAllProviderAuthToRuntime();
  await refreshAgentRuntime(ctx);
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

  if (url.pathname.startsWith('/api/agents/') && req.method === 'GET') {
    const suffix = url.pathname.slice('/api/agents/'.length);
    const parts = suffix.split('/').filter(Boolean);

    if (parts.length === 2 && parts[1] === 'files') {
      try {
        const agentId = decodeURIComponent(parts[0]);
        const root = url.searchParams.get('root');
        if (root !== 'workspace') {
          sendJson(res, 400, { success: false, error: 'Unsupported file root' });
          return true;
        }
        const files = await listAgentWorkspaceFiles(agentId);
        sendJson(res, 200, { success: true, files });
      } catch (error) {
        sendJson(res, 500, { success: false, error: String(error) });
      }
      return true;
    }

    if (parts.length === 3 && parts[1] === 'files' && parts[2] === 'content') {
      try {
        const agentId = decodeURIComponent(parts[0]);
        const root = url.searchParams.get('root');
        const relativePath = url.searchParams.get('relativePath') || '';
        if (root !== 'workspace') {
          sendJson(res, 400, { success: false, error: 'Unsupported file root' });
          return true;
        }
        const content = await readAgentWorkspaceFileContent(agentId, relativePath);
        sendJson(res, 200, { success: true, content });
      } catch (error) {
        sendJson(res, 500, { success: false, error: String(error) });
      }
      return true;
    }
  }

  if (url.pathname.startsWith('/api/agents/') && req.method === 'PUT') {
    const suffix = url.pathname.slice('/api/agents/'.length);
    const parts = suffix.split('/').filter(Boolean);

    if (parts.length === 3 && parts[1] === 'files' && parts[2] === 'content') {
      try {
        const agentId = decodeURIComponent(parts[0]);
        const body = await parseJsonBody<{ root?: string; relativePath?: string; content?: string }>(req);
        if (body.root !== 'workspace') {
          sendJson(res, 400, { success: false, error: 'Unsupported file root' });
          return true;
        }
        await writeAgentWorkspaceFileContent(agentId, body.relativePath || '', body.content ?? '');
        await refreshAgentRuntime(ctx);
        sendJson(res, 200, { success: true });
      } catch (error) {
        sendJson(res, 500, { success: false, error: String(error) });
      }
      return true;
    }
  }

  if (url.pathname.startsWith('/api/agents/') && req.method === 'POST') {
    const suffix = url.pathname.slice('/api/agents/'.length);
    const parts = suffix.split('/').filter(Boolean);

    if (parts.length === 2 && parts[1] === 'files') {
      try {
        const agentId = decodeURIComponent(parts[0]);
        const body = await parseJsonBody<{ root?: string; relativePath?: string; content?: string }>(req);
        if (body.root !== 'workspace') {
          sendJson(res, 400, { success: false, error: 'Unsupported file root' });
          return true;
        }
        await createAgentWorkspaceFile(agentId, body.relativePath || '', body.content ?? '');
        await refreshAgentRuntime(ctx);
        sendJson(res, 200, { success: true, relativePath: body.relativePath || '' });
      } catch (error) {
        sendJson(res, 500, { success: false, error: String(error) });
      }
      return true;
    }

    if (parts.length === 3 && parts[1] === 'files' && parts[2] === 'upload') {
      try {
        const agentId = decodeURIComponent(parts[0]);
        const body = await parseJsonBody<{ root?: string; fileName?: string; content?: string }>(req);
        if (body.root !== 'workspace') {
          sendJson(res, 400, { success: false, error: 'Unsupported file root' });
          return true;
        }
        await uploadAgentWorkspaceFile(agentId, body.fileName || '', body.content ?? '');
        await refreshAgentRuntime(ctx);
        sendJson(res, 200, { success: true, relativePath: body.fileName || '' });
      } catch (error) {
        sendJson(res, 500, { success: false, error: String(error) });
      }
      return true;
    }

    if (parts.length === 3 && parts[1] === 'files' && parts[2] === 'rename') {
      try {
        const agentId = decodeURIComponent(parts[0]);
        const body = await parseJsonBody<{ root?: string; relativePath?: string; nextRelativePath?: string }>(req);
        if (body.root !== 'workspace') {
          sendJson(res, 400, { success: false, error: 'Unsupported file root' });
          return true;
        }
        await renameAgentWorkspaceFile(agentId, body.relativePath || '', body.nextRelativePath || '');
        await refreshAgentRuntime(ctx);
        sendJson(res, 200, { success: true, relativePath: body.nextRelativePath || '' });
      } catch (error) {
        sendJson(res, 500, { success: false, error: String(error) });
      }
      return true;
    }
  }

  if (url.pathname === '/api/agents' && req.method === 'POST') {
    try {
      const body = await parseJsonBody<{ name: string }>(req);
      const result = await createAgentWithId(body.name);
      await finalizeAgentCreation(ctx);
      sendJson(res, 200, { success: true, ...result.snapshot, createdAgentId: result.createdAgentId });
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
        const body = await parseJsonBody<{ name: string; modelRef?: string | null }>(req);
        const agentId = decodeURIComponent(parts[0]);
        const result = await updateAgentSettings(agentId, {
          name: body.name,
          modelRef: body.modelRef,
        });
        if (result.modelChanged) {
          void ctx.gatewayRuntimeController.requestRuntimeRefresh({ mode: 'restart' });
        }
        sendJson(res, 200, { success: true, applyingRuntime: result.modelChanged, ...result.snapshot });
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
        await refreshAgentRuntime(ctx);
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

    if (parts.length === 2 && parts[1] === 'files') {
      try {
        const agentId = decodeURIComponent(parts[0]);
        const body = await parseJsonBody<{ root?: string; relativePath?: string }>(req);
        if (body.root !== 'workspace') {
          sendJson(res, 400, { success: false, error: 'Unsupported file root' });
          return true;
        }
        await deleteAgentWorkspaceFile(agentId, body.relativePath || '');
        await refreshAgentRuntime(ctx);
        sendJson(res, 200, { success: true });
      } catch (error) {
        sendJson(res, 500, { success: false, error: String(error) });
      }
      return true;
    }

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
