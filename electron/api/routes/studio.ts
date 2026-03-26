import type { IncomingMessage, ServerResponse } from 'http';
import type { HostApiContext } from '../context';
import { parseJsonBody, sendJson, sendNoContent } from '../route-utils';

export async function handleStudioRoutes(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
  ctx: HostApiContext,
): Promise<boolean> {
  if (url.pathname === '/api/studio/runtime' && req.method === 'GET') {
    sendJson(res, 200, ctx.studioService.getRuntimeSnapshot());
    return true;
  }

  if (url.pathname === '/api/studio/runtime/start' && req.method === 'POST') {
    sendJson(res, 200, await ctx.studioService.start());
    return true;
  }

  if (url.pathname === '/api/studio/runtime/retry' && req.method === 'POST') {
    const body = await parseJsonBody<{ repairEnvironment?: boolean }>(req);
    sendJson(res, 200, await ctx.studioService.retryRuntime({
      repairEnvironment: body.repairEnvironment === true,
    }));
    return true;
  }

  if (req.method === 'OPTIONS' && url.pathname.startsWith('/api/studio/')) {
    sendNoContent(res);
    return true;
  }

  return false;
}
