const MULTI_INSTANCE_PROVIDER_TYPES = new Set(['custom', 'ollama']);
const RESERVED_PROVIDER_KEYS = new Set([
  'anthropic',
  'openai',
  'openai-codex',
  'google',
  'google-gemini-cli',
  'openrouter',
  'ark',
  'moonshot',
  'siliconflow',
  'minimax-portal',
  'qwen-portal',
  'custom',
  'ollama',
]);

export const OPENCLAW_PROVIDER_KEY_MINIMAX = 'minimax-portal';
export const OPENCLAW_PROVIDER_KEY_QWEN = 'qwen-portal';
export const OPENCLAW_PROVIDER_KEY_MOONSHOT = 'moonshot';
export const OAUTH_PROVIDER_TYPES = ['qwen-portal', 'minimax-portal', 'minimax-portal-cn'] as const;
export const OPENCLAW_OAUTH_PLUGIN_PROVIDER_KEYS = [
  OPENCLAW_PROVIDER_KEY_MINIMAX,
  OPENCLAW_PROVIDER_KEY_QWEN,
] as const;

const OAUTH_PROVIDER_TYPE_SET = new Set<string>(OAUTH_PROVIDER_TYPES);
const OPENCLAW_OAUTH_PLUGIN_PROVIDER_KEY_SET = new Set<string>(OPENCLAW_OAUTH_PLUGIN_PROVIDER_KEYS);
const UUID_SUFFIX_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const PROVIDER_KEY_ALIASES: Record<string, string> = {
  'minimax-portal-cn': OPENCLAW_PROVIDER_KEY_MINIMAX,
};

export function normalizeProviderRuntimeKey(type: string, runtimeKey?: string | null): string | undefined {
  if (!MULTI_INSTANCE_PROVIDER_TYPES.has(type) || !runtimeKey) {
    return undefined;
  }
  const normalized = runtimeKey
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '');
  if (!normalized || RESERVED_PROVIDER_KEYS.has(normalized)) {
    return undefined;
  }
  return normalized;
}

export function getLegacyDerivedProviderKey(type: string, providerId: string): string {
  if (MULTI_INSTANCE_PROVIDER_TYPES.has(type)) {
    const legacyPrefix = `${type}-`;
    if (providerId.startsWith(legacyPrefix)) {
      const suffix = providerId.slice(legacyPrefix.length);
      if (suffix && !UUID_SUFFIX_PATTERN.test(suffix)) {
        return providerId;
      }
    }
    const suffix = providerId.replace(/-/g, '').slice(0, 8);
    return `${type}-${suffix}`;
  }
  return PROVIDER_KEY_ALIASES[type] ?? type;
}

export function getOpenClawProviderKeyForType(
  type: string,
  providerId: string,
  runtimeKey?: string | null,
): string {
  const explicitRuntimeKey = normalizeProviderRuntimeKey(type, runtimeKey);
  return explicitRuntimeKey ?? getLegacyDerivedProviderKey(type, providerId);
}

export function isOAuthProviderType(type: string): boolean {
  return OAUTH_PROVIDER_TYPE_SET.has(type);
}

export function isMiniMaxProviderType(type: string): boolean {
  return type === OPENCLAW_PROVIDER_KEY_MINIMAX || type === 'minimax-portal-cn';
}

export function getOAuthProviderTargetKey(type: string): string | undefined {
  if (!isOAuthProviderType(type)) return undefined;
  return isMiniMaxProviderType(type) ? OPENCLAW_PROVIDER_KEY_MINIMAX : OPENCLAW_PROVIDER_KEY_QWEN;
}

export function getOAuthProviderApi(type: string): 'anthropic-messages' | 'openai-completions' | undefined {
  if (!isOAuthProviderType(type)) return undefined;
  return isMiniMaxProviderType(type) ? 'anthropic-messages' : 'openai-completions';
}

export function getOAuthProviderDefaultBaseUrl(type: string): string | undefined {
  if (!isOAuthProviderType(type)) return undefined;
  if (type === OPENCLAW_PROVIDER_KEY_MINIMAX) return 'https://api.minimax.io/anthropic';
  if (type === 'minimax-portal-cn') return 'https://api.minimaxi.com/anthropic';
  return 'https://portal.qwen.ai/v1';
}

export function normalizeOAuthBaseUrl(type: string, baseUrl?: string): string | undefined {
  if (!baseUrl) return undefined;
  if (isMiniMaxProviderType(type)) {
    return baseUrl.replace(/\/v1$/, '').replace(/\/anthropic$/, '').replace(/\/$/, '') + '/anthropic';
  }
  return baseUrl;
}

export function usesOAuthAuthHeader(providerKey: string): boolean {
  return providerKey === OPENCLAW_PROVIDER_KEY_MINIMAX;
}

export function getOAuthApiKeyEnv(providerKey: string): string | undefined {
  if (providerKey === OPENCLAW_PROVIDER_KEY_MINIMAX) return 'minimax-oauth';
  if (providerKey === OPENCLAW_PROVIDER_KEY_QWEN) return 'qwen-oauth';
  return undefined;
}

export function isOpenClawOAuthPluginProviderKey(provider: string): boolean {
  return OPENCLAW_OAUTH_PLUGIN_PROVIDER_KEY_SET.has(provider);
}
