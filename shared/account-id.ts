export const DEFAULT_ACCOUNT_ID = 'default';

const VALID_ID_RE = /^[a-z0-9][a-z0-9_-]{0,63}$/i;
const INVALID_CHARS_RE = /[^a-z0-9_-]+/g;
const LEADING_DASH_RE = /^-+/;
const TRAILING_DASH_RE = /-+$/;
const ACCOUNT_ID_CACHE_MAX = 512;
const BLOCKED_OBJECT_KEYS = new Set(['__proto__', 'prototype', 'constructor']);
const normalizeAccountIdCache = new Map<string, string>();

function canonicalizeAccountId(value: string): string {
  if (VALID_ID_RE.test(value)) {
    return value.toLowerCase();
  }

  return value
    .toLowerCase()
    .replace(INVALID_CHARS_RE, '-')
    .replace(LEADING_DASH_RE, '')
    .replace(TRAILING_DASH_RE, '')
    .slice(0, 64);
}

function setNormalizeCache(cache: Map<string, string>, key: string, value: string): void {
  cache.set(key, value);
  if (cache.size <= ACCOUNT_ID_CACHE_MAX) {
    return;
  }

  const oldest = cache.keys().next();
  if (!oldest.done) {
    cache.delete(oldest.value);
  }
}

export function normalizeAccountId(value?: string | null): string {
  const trimmed = (value ?? '').trim();
  if (!trimmed) {
    return DEFAULT_ACCOUNT_ID;
  }

  const cached = normalizeAccountIdCache.get(trimmed);
  if (cached) {
    return cached;
  }

  const canonical = canonicalizeAccountId(trimmed);
  const normalized = canonical && !BLOCKED_OBJECT_KEYS.has(canonical) ? canonical : DEFAULT_ACCOUNT_ID;
  setNormalizeCache(normalizeAccountIdCache, trimmed, normalized);
  return normalized;
}
