import type { ProviderAccount, ProviderConfig, ProviderType } from '../../shared/providers/types';
import { getProviderDefinition } from '../../shared/providers/registry';
import { getXClawProviderStore } from './store-instance';

const PROVIDER_STORE_SCHEMA_VERSION = 1;

function inferAuthMode(type: ProviderType): ProviderAccount['authMode'] {
  if (type === 'ollama') {
    return 'local';
  }

  const definition = getProviderDefinition(type);
  if (definition?.defaultAuthMode) {
    return definition.defaultAuthMode;
  }

  return 'api_key';
}

export function providerConfigToAccount(
  config: ProviderConfig,
  options?: { isDefault?: boolean },
): ProviderAccount {
  return {
    id: config.id,
    vendorId: config.type,
    label: config.name,
    runtimeKey: config.runtimeKey,
    authMode: inferAuthMode(config.type),
    baseUrl: config.baseUrl,
    apiProtocol: config.apiProtocol || (config.type === 'custom' || config.type === 'ollama'
      ? 'openai-completions'
      : getProviderDefinition(config.type)?.providerConfig?.api),
    model: config.model,
    fallbackModels: config.fallbackModels,
    fallbackAccountIds: config.fallbackProviderIds,
    enabled: config.enabled,
    isDefault: options?.isDefault ?? false,
    createdAt: config.createdAt,
    updatedAt: config.updatedAt,
  };
}

export function providerAccountToConfig(account: ProviderAccount): ProviderConfig {
  return {
    id: account.id,
    name: account.label,
    type: account.vendorId,
    runtimeKey: account.runtimeKey,
    baseUrl: account.baseUrl,
    apiProtocol: account.apiProtocol,
    model: account.model,
    fallbackModels: account.fallbackModels,
    fallbackProviderIds: account.fallbackAccountIds,
    enabled: account.enabled,
    createdAt: account.createdAt,
    updatedAt: account.updatedAt,
  };
}

export async function listProviderAccounts(): Promise<ProviderAccount[]> {
  const store = await getXClawProviderStore();
  const accounts = store.get('providerAccounts') as Record<string, ProviderAccount> | undefined;
  return Object.values(accounts ?? {});
}

export async function getProviderAccount(accountId: string): Promise<ProviderAccount | null> {
  const store = await getXClawProviderStore();
  const accounts = store.get('providerAccounts') as Record<string, ProviderAccount> | undefined;
  return accounts?.[accountId] ?? null;
}

export async function saveProviderAccount(account: ProviderAccount): Promise<void> {
  const store = await getXClawProviderStore();
  const accounts = (store.get('providerAccounts') ?? {}) as Record<string, ProviderAccount>;
  accounts[account.id] = account;
  store.set('providerAccounts', accounts);
  store.set('schemaVersion', PROVIDER_STORE_SCHEMA_VERSION);
}

export async function deleteProviderAccount(accountId: string): Promise<void> {
  const store = await getXClawProviderStore();
  const accounts = (store.get('providerAccounts') ?? {}) as Record<string, ProviderAccount>;
  delete accounts[accountId];
  store.set('providerAccounts', accounts);

  if (store.get('defaultProviderAccountId') === accountId) {
    store.delete('defaultProviderAccountId');
  }
}

export async function setDefaultProviderAccount(accountId: string): Promise<void> {
  const store = await getXClawProviderStore();
  store.set('defaultProviderAccountId', accountId);

  const accounts = (store.get('providerAccounts') ?? {}) as Record<string, ProviderAccount>;
  for (const account of Object.values(accounts)) {
    account.isDefault = account.id === accountId;
  }
  store.set('providerAccounts', accounts);
}

export async function getDefaultProviderAccountId(): Promise<string | undefined> {
  const store = await getXClawProviderStore();
  return store.get('defaultProviderAccountId') as string | undefined;
}

export async function replaceImportedProviderAccounts(
  accounts: ProviderAccount[],
  defaultAccountId: string | null,
): Promise<void> {
  const store = await getXClawProviderStore();
  const normalizedAccounts = Object.fromEntries(
    accounts.map((account) => [
      account.id,
      {
        ...account,
        isDefault: account.id === defaultAccountId,
      },
    ]),
  );
  const legacyProviders = Object.fromEntries(
    Object.values(normalizedAccounts).map((account) => [
      account.id,
      providerAccountToConfig(account),
    ]),
  );

  store.set('providerAccounts', normalizedAccounts);
  store.set('providers', legacyProviders);
  store.set('schemaVersion', PROVIDER_STORE_SCHEMA_VERSION);

  if (defaultAccountId) {
    store.set('defaultProviderAccountId', defaultAccountId);
    store.set('defaultProvider', defaultAccountId);
    return;
  }

  store.delete('defaultProviderAccountId');
  store.delete('defaultProvider');
}
