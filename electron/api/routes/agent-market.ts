import type { IncomingMessage, ServerResponse } from 'http';
import { installAgentFromCatalog, listAgentMarketCatalog } from '../../utils/agent-market';
import { syncAllProviderAuthToRuntime } from '../../services/providers/provider-runtime-sync';
import type { HostApiContext } from '../context';
import { parseJsonBody, sendJson } from '../route-utils';

async function finalizeMarketInstall(ctx: HostApiContext): Promise<void> {
  await syncAllProviderAuthToRuntime();
  await ctx.gatewayRuntimeController.restartRuntime();
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
      await finalizeMarketInstall(ctx);
      sendJson(res, 200, { success: true, ...result });
    } catch (error) {
      sendJson(res, 500, { success: false, error: String(error) });
    }
    return true;
  }

  return false;
}
