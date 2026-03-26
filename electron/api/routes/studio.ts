import type { IncomingMessage, ServerResponse } from 'http';
import type { HostApiContext } from '../context';
import { parseJsonBody, sendJson, sendNoContent, sendText } from '../route-utils';

const STUDIO_FRAME_ROUTE_PREFIX = '/api/studio/frame';
const STUDIO_FRAME_DEFAULT_PATH = '/electron-standalone';

const copyRequestHeaders = (headers: IncomingMessage['headers']): Headers => {
  const forwardedHeaders = new Headers();
  for (const [key, value] of Object.entries(headers)) {
    if (typeof value === 'undefined' || key.toLowerCase() === 'host') {
      continue;
    }
    if (Array.isArray(value)) {
      for (const item of value) {
        forwardedHeaders.append(key, item);
      }
      continue;
    }
    forwardedHeaders.set(key, value);
  }
  return forwardedHeaders;
};

const readRequestBody = async (req: IncomingMessage): Promise<Buffer | undefined> => {
  if (req.method === 'GET' || req.method === 'HEAD') {
    return undefined;
  }
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return chunks.length > 0 ? Buffer.concat(chunks) : undefined;
};

const resolveStudioRuntimePort = (ctx: HostApiContext): number | null => {
  const snapshot = ctx.studioService.getRuntimeSnapshot();
  if (typeof snapshot.port === 'number' && snapshot.port > 0) {
    return snapshot.port;
  }
  if (typeof snapshot.resolvedUrl !== 'string' || !snapshot.resolvedUrl.trim()) {
    return null;
  }
  try {
    const resolvedUrl = new URL(snapshot.resolvedUrl);
    const port = Number(resolvedUrl.port);
    return Number.isFinite(port) && port > 0 ? port : null;
  } catch {
    return null;
  }
};

const rewriteStudioHtmlForHostProxy = (html: string): string => {
  const replacements: Array<[string, string]> = [
    ['src="/', `src="${STUDIO_FRAME_ROUTE_PREFIX}/`],
    ["src='/", `src='${STUDIO_FRAME_ROUTE_PREFIX}/`],
    ['href="/', `href="${STUDIO_FRAME_ROUTE_PREFIX}/`],
    ["href='/", `href='${STUDIO_FRAME_ROUTE_PREFIX}/`],
    [`url("/`, `url("${STUDIO_FRAME_ROUTE_PREFIX}/`],
    [`url('/`, `url('${STUDIO_FRAME_ROUTE_PREFIX}/`],
    ['fetch("/', `fetch("${STUDIO_FRAME_ROUTE_PREFIX}/`],
    ["fetch('/", `fetch('${STUDIO_FRAME_ROUTE_PREFIX}/`],
    ['EventSource("/', `EventSource("${STUDIO_FRAME_ROUTE_PREFIX}/`],
    ["EventSource('/", `EventSource('${STUDIO_FRAME_ROUTE_PREFIX}/`],
    ['"/static/', `"${STUDIO_FRAME_ROUTE_PREFIX}/static/`],
    ["'/static/", `'${STUDIO_FRAME_ROUTE_PREFIX}/static/`],
  ];
  return replacements.reduce(
    (output, [from, to]) => output.split(from).join(to),
    html,
  );
};

const isHtmlResponse = (contentType: string | null, pathname: string): boolean =>
  contentType?.includes('text/html') === true || pathname.endsWith('/electron-standalone');

const buildStudioFrameTargetUrl = (port: number, url: URL): string => {
  const runtimePath = url.pathname.startsWith(STUDIO_FRAME_ROUTE_PREFIX)
    ? url.pathname.slice(STUDIO_FRAME_ROUTE_PREFIX.length) || STUDIO_FRAME_DEFAULT_PATH
    : STUDIO_FRAME_DEFAULT_PATH;
  const normalizedPath = runtimePath.startsWith('/') ? runtimePath : `/${runtimePath}`;
  return `http://127.0.0.1:${port}${normalizedPath}${url.search}`;
};

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

  if (url.pathname === STUDIO_FRAME_ROUTE_PREFIX || url.pathname.startsWith(`${STUDIO_FRAME_ROUTE_PREFIX}/`)) {
    const port = resolveStudioRuntimePort(ctx);
    if (!port) {
      sendText(res, 503, 'Studio runtime is not ready');
      return true;
    }

    const proxyResponse = await fetch(buildStudioFrameTargetUrl(port, url), {
      method: req.method,
      headers: copyRequestHeaders(req.headers),
      body: await readRequestBody(req),
      redirect: 'manual',
    });

    res.statusCode = proxyResponse.status;
    proxyResponse.headers.forEach((value, key) => {
      if (key.toLowerCase() === 'content-length') {
        return;
      }
      res.setHeader(key, value);
    });

    if (isHtmlResponse(proxyResponse.headers.get('content-type'), url.pathname)) {
      const html = rewriteStudioHtmlForHostProxy(await proxyResponse.text());
      res.end(html);
      return true;
    }

    const payload = Buffer.from(await proxyResponse.arrayBuffer());
    res.end(payload);
    return true;
  }

  return false;
}
