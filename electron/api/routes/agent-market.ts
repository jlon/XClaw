import type { IncomingMessage, ServerResponse } from 'http';
import { installAgentFromCatalog, listAgentMarketCatalog } from '../../utils/agent-market';
import { deleteAgentConfig, removeAgentWorkspaceDirectory } from '../../utils/agent-config';
import { syncAllProviderAuthToRuntime } from '../../services/providers/provider-runtime-sync';
import type { HostApiContext } from '../context';
import { parseJsonBody, sendJson } from '../route-utils';

async function ensureAgentRuntimeApplied(ctx: HostApiContext): Promise<void> {
  const wasRunning = ctx.gatewayManager.getStatus().state !== 'stopped';
  await ctx.gatewayRuntimeController.requestStart();
  if (wasRunning) {
    await ctx.gatewayRuntimeController.restartRuntime();
  }
}

async function rollbackCreatedAgent(agentId: string): Promise<void> {
  const rollback = await deleteAgentConfig(agentId).catch(() => null);
  if (rollback) {
    await removeAgentWorkspaceDirectory(rollback.removedEntry).catch(() => undefined);
  }
}

async function finalizeMarketInstall(ctx: HostApiContext): Promise<void> {
  await syncAllProviderAuthToRuntime();
  await ensureAgentRuntimeApplied(ctx);
}

export async function handleAgentMarketRoutes(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
  ctx: HostApiContext,
): Promise<boolean> {
  if (url.pathname === '/api/agent-market/catalog' && req.method === 'GET') {
    try {
      sendJson(res, 200, { success: true, ...(await listAgentMarketCatalog()) });
    } catch (error) {
      sendJson(res, 500, { success: false, error: String(error) });
    }
    return true;
  }

  if (url.pathname === '/api/agent-market/install' && req.method === 'POST') {
    try {
      const body = await parseJsonBody<{ catalogItemId?: string; name?: string }>(req);
      const result = await installAgentFromCatalog(body.catalogItemId || '', body.name);
      try {
        await finalizeMarketInstall(ctx);
      } catch (error) {
        await rollbackCreatedAgent(result.createdAgentId).catch(() => undefined);
        throw error;
      }
      sendJson(res, 200, { success: true, ...result.snapshot, createdAgentId: result.createdAgentId });
    } catch (error) {
      sendJson(res, 500, { success: false, error: String(error) });
    }
    return true;
  }

  return false;
}
