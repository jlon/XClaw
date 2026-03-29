import { createHostEventSource, hostApiFetch } from './host-api';
import type {
  StudioRuntimeEventPayload,
  StudioRuntimeSnapshot,
  StudioSkinApplyResult,
  StudioSkinDescriptor,
} from '@/types/studio';

const LAST_CHAT_ROUTE_KEY = 'XClaw:lastChatRoute';
const STUDIO_RUNTIME_CHANGED_EVENT = 'studioRuntimeChanged';

let studioRuntimeEventSource: EventSource | null = null;
let memoryLastChatRoute: string | null = null;

export interface StudioSkinRegistryEntry extends StudioSkinDescriptor {
  name: string;
  manifestPath: string;
}

export interface StudioSkinRegistryResponse {
  defaultFallbackSkinKey: string;
  currentAppliedSkinKey?: string | null;
  skins: StudioSkinRegistryEntry[];
}

export interface StudioSkinApplyResponse extends StudioSkinApplyResult, StudioSkinRegistryResponse {}

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

function normalizeStudioSkinRegistryResponse(value: unknown): StudioSkinRegistryResponse {
  if (!isRecord(value)) {
    return {
      defaultFallbackSkinKey: 'lodge-default',
      skins: [],
    };
  }

  const skins = Array.isArray(value.skins)
    ? value.skins
        .filter((entry): entry is StudioSkinRegistryEntry => isRecord(entry) && typeof entry.key === 'string')
        .map((entry) => ({
          key: entry.key.trim(),
          name: typeof entry.name === 'string' && entry.name.trim() ? entry.name.trim() : entry.key.trim(),
          manifestPath: typeof entry.manifestPath === 'string' && entry.manifestPath.trim()
            ? entry.manifestPath.trim()
            : `${entry.key.trim()}/manifest.json`,
          enabled: entry.enabled === true,
          selectable: entry.selectable === true,
          isDefaultFallback: entry.isDefaultFallback === true,
        }))
    : [];

  return {
    defaultFallbackSkinKey:
      typeof value.defaultFallbackSkinKey === 'string' && value.defaultFallbackSkinKey.trim()
        ? value.defaultFallbackSkinKey.trim()
        : skins.find((skin) => skin.isDefaultFallback)?.key || 'lodge-default',
    currentAppliedSkinKey:
      typeof value.currentAppliedSkinKey === 'string' && value.currentAppliedSkinKey.trim()
        ? value.currentAppliedSkinKey.trim()
        : null,
    skins,
  };
}

function normalizeStudioSkinApplyResponse(value: unknown): StudioSkinApplyResponse {
  if (!isRecord(value)) {
    return {
      ok: false,
      appliedSkinKey: null,
      fallbackApplied: false,
      reason: 'invalid_response',
      defaultFallbackSkinKey: 'lodge-default',
      skins: [],
    };
  }

  const registry = normalizeStudioSkinRegistryResponse(value);
  return {
    ok: value.ok === true,
    appliedSkinKey:
      typeof value.appliedSkinKey === 'string' && value.appliedSkinKey.trim()
        ? value.appliedSkinKey.trim()
        : null,
    currentAppliedSkinKey:
      typeof value.currentAppliedSkinKey === 'string' && value.currentAppliedSkinKey.trim()
        ? value.currentAppliedSkinKey.trim()
        : null,
    fallbackApplied: value.fallbackApplied === true,
    reason:
      typeof value.reason === 'string'
        ? value.reason.trim() || null
        : value.reason == null
          ? null
          : String(value.reason),
    refreshedAssets: Array.isArray(value.refreshedAssets)
      ? value.refreshedAssets.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
      : [],
    ...registry,
  };
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

export async function startStudioRuntime(): Promise<StudioRuntimeSnapshot> {
  const response = await hostApiFetch<unknown>('/api/studio/runtime/start', {
    method: 'POST',
  });
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

export async function fetchStudioSkinRegistry(): Promise<StudioSkinRegistryResponse> {
  const response = await hostApiFetch<unknown>('/api/studio/skins/registry');
  return normalizeStudioSkinRegistryResponse(response);
}

export async function fetchStudioSkins(): Promise<StudioSkinRegistryResponse> {
  const response = await hostApiFetch<unknown>('/api/studio/skins');
  return normalizeStudioSkinRegistryResponse(response);
}

export async function applyStudioSkin(payload: { skinKey: string }): Promise<StudioSkinApplyResponse> {
  const response = await hostApiFetch<unknown>('/api/studio/skins/apply', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return normalizeStudioSkinApplyResponse(response);
}

export function appendStudioSkinQuery(resolvedUrl: string, skinKey?: string | null): string {
  const normalizedSkinKey = typeof skinKey === 'string' ? skinKey.trim() : '';
  if (!normalizedSkinKey) {
    return resolvedUrl;
  }

  try {
    const url = new URL(resolvedUrl);
    url.searchParams.set('skinKey', normalizedSkinKey);
    return url.toString();
  } catch {
    return resolvedUrl;
  }
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
