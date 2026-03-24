import { createHostEventSource, hostApiFetch } from './host-api';
import type { StudioRuntimeEventPayload, StudioRuntimeSnapshot } from '@/types/studio';

const LAST_CHAT_ROUTE_KEY = 'XClaw:lastChatRoute';
const STUDIO_RUNTIME_CHANGED_EVENT = 'studioRuntimeChanged';
const STUDIO_SURFACE_SUSPEND_EVENT = 'studioSurfaceSuspend';

let studioRuntimeEventSource: EventSource | null = null;
let memoryLastChatRoute: string | null = null;

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function normalizeRoutePath(pathname: string): string {
  const trimmed = pathname.trim();
  return trimmed || '/';
}

function getLocalStorage(): Storage | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function isChatRoutePath(pathname: string): boolean {
  const normalized = normalizeRoutePath(pathname);
  return normalized === '/' || normalized.startsWith('/new');
}

export function isStudioRoutePath(pathname: string): boolean {
  return normalizeRoutePath(pathname).startsWith('/studio');
}

export function isChatSurfaceRoutePath(pathname: string): boolean {
  return isChatRoutePath(pathname) || isStudioRoutePath(pathname);
}

export function saveLastChatRoute(pathname: string): void {
  if (!isChatRoutePath(pathname)) {
    return;
  }

  const normalized = normalizeRoutePath(pathname);
  memoryLastChatRoute = normalized;

  const storage = getLocalStorage();
  storage?.setItem(LAST_CHAT_ROUTE_KEY, normalized);
}

export function resolveLastChatRoute(): string {
  const storage = getLocalStorage();
  const stored = storage?.getItem(LAST_CHAT_ROUTE_KEY);
  if (stored && isChatRoutePath(stored)) {
    return normalizeRoutePath(stored);
  }

  return memoryLastChatRoute && isChatRoutePath(memoryLastChatRoute)
    ? normalizeRoutePath(memoryLastChatRoute)
    : '/';
}

export function suspendStudioSurface(): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.dispatchEvent(new CustomEvent(STUDIO_SURFACE_SUSPEND_EVENT));
}

export function subscribeStudioSurfaceSuspend(handler: () => void): () => void {
  if (typeof window === 'undefined') {
    return () => {};
  }

  const listener = () => {
    handler();
  };

  window.addEventListener(STUDIO_SURFACE_SUSPEND_EVENT, listener);
  return () => {
    window.removeEventListener(STUDIO_SURFACE_SUSPEND_EVENT, listener);
  };
}

function normalizeRuntimeSnapshot(value: unknown): StudioRuntimeSnapshot | null {
  if (!isRecord(value)) {
    return null;
  }

  const nested = value.runtime ?? value.snapshot ?? value.data;
  if (nested !== undefined) {
    const normalizedNested = normalizeRuntimeSnapshot(nested);
    if (normalizedNested) {
      return normalizedNested;
    }
  }

  const hasKnownField =
    'status' in value
    || 'resolvedUrl' in value
    || 'runtimeInstanceId' in value
    || 'lastError' in value
    || 'error' in value
    || 'message' in value;

  if (!hasKnownField) {
    return null;
  }

  const status = typeof value.status === 'string'
    ? value.status.trim().toLowerCase() || undefined
    : undefined;
  const resolvedUrl = typeof value.resolvedUrl === 'string'
    ? value.resolvedUrl.trim()
    : value.resolvedUrl == null
      ? value.resolvedUrl
      : String(value.resolvedUrl).trim();
  const runtimeInstanceId =
    typeof value.runtimeInstanceId === 'string' || typeof value.runtimeInstanceId === 'number'
      ? value.runtimeInstanceId
      : value.runtimeInstanceId == null
        ? value.runtimeInstanceId
        : String(value.runtimeInstanceId);

  return {
    ...value,
    ...(status ? { status } : {}),
    ...(resolvedUrl !== undefined ? { resolvedUrl } : {}),
    ...(runtimeInstanceId !== undefined ? { runtimeInstanceId } : {}),
    ...(value.lastError !== undefined ? { lastError: value.lastError == null ? null : String(value.lastError) } : {}),
    ...(value.error !== undefined ? { error: value.error == null ? null : String(value.error) } : {}),
    ...(value.message !== undefined ? { message: value.message == null ? null : String(value.message) } : {}),
  } as StudioRuntimeSnapshot;
}

function normalizeRuntimeResponse(value: unknown): StudioRuntimeSnapshot {
  const normalized = normalizeRuntimeSnapshot(value);
  if (normalized) {
    return normalized;
  }

  if (isRecord(value)) {
    const fallback = normalizeRuntimeSnapshot(value.runtime ?? value.snapshot ?? value.data);
    if (fallback) {
      return fallback;
    }
  }

  return {};
}

function getStudioRuntimeEventSource(): EventSource {
  if (!studioRuntimeEventSource) {
    studioRuntimeEventSource = createHostEventSource();
  }
  return studioRuntimeEventSource;
}

export async function fetchStudioRuntime(): Promise<StudioRuntimeSnapshot> {
  const response = await hostApiFetch<unknown>('/api/studio/runtime');
  return normalizeRuntimeResponse(response);
}

export async function retryStudioRuntime(
  options: { repairEnvironment?: boolean } = {},
): Promise<StudioRuntimeSnapshot> {
  const response = await hostApiFetch<unknown>('/api/studio/runtime/retry', {
    method: 'POST',
    body: JSON.stringify({
      repairEnvironment: options.repairEnvironment === true,
    }),
  });
  return normalizeRuntimeResponse(response);
}

export function subscribeStudioRuntimeChanged(
  handler: (snapshot: StudioRuntimeSnapshot) => void,
): () => void {
  const source = getStudioRuntimeEventSource();
  const listener = (event: Event) => {
    try {
      const payload = JSON.parse((event as MessageEvent).data) as StudioRuntimeEventPayload;
      const snapshot = normalizeRuntimeSnapshot(payload);
      if (snapshot) {
        handler(snapshot);
      }
    } catch {
      return;
    }
  };

  source.addEventListener(STUDIO_RUNTIME_CHANGED_EVENT, listener);
  return () => {
    source.removeEventListener(STUDIO_RUNTIME_CHANGED_EVENT, listener);
  };
}
