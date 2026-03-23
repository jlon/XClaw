import { resolveProviderApiKeyForSave, type ProviderType } from '@/lib/providers';
import { buildProviderAccountId } from '@/lib/provider-accounts';
import type { ProviderAccount, ProviderVendorInfo } from '@/stores/providers';

export interface AddProviderDialogOptions {
  baseUrl?: string;
  model?: string;
  authMode?: ProviderAccount['authMode'];
  apiProtocol?: ProviderAccount['apiProtocol'];
}

export async function createProviderAccountFromDialog({
  type,
  name,
  apiKey,
  vendors,
  defaultAccountId,
  createAccount,
  setDefaultAccount,
  options,
}: {
  type: ProviderType;
  name: string;
  apiKey: string;
  vendors: ProviderVendorInfo[];
  defaultAccountId: string | null;
  createAccount: (account: ProviderAccount, apiKey?: string) => Promise<void>;
  setDefaultAccount: (providerId: string) => Promise<void>;
  options?: AddProviderDialogOptions;
}): Promise<string> {
  const vendorMap = new Map(vendors.map((vendor) => [vendor.id, vendor]));
  const vendor = vendorMap.get(type);
  const id = buildProviderAccountId(type, null, vendors);
  const effectiveApiKey = resolveProviderApiKeyForSave(type, apiKey);

  await createAccount({
    id,
    vendorId: type,
    label: name,
    authMode: options?.authMode || vendor?.defaultAuthMode || (type === 'ollama' ? 'local' : 'api_key'),
    baseUrl: options?.baseUrl,
    apiProtocol: options?.apiProtocol,
    model: options?.model,
    enabled: true,
    isDefault: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }, effectiveApiKey);

  if (!defaultAccountId) {
    await setDefaultAccount(id);
  }

  return id;
}
