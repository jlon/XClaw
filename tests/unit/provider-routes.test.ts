import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { IncomingMessage, ServerResponse } from 'http';

const parseJsonBodyMock = vi.fn();
const sendJsonMock = vi.fn();
const syncUpdatedProviderToRuntimeMock = vi.fn();
const migrateProviderModelRefsInOpenClawMock = vi.fn();
const removeProviderFromOpenClawMock = vi.fn();
const getAccountMock = vi.fn();
const updateAccountMock = vi.fn();

vi.mock('@electron/api/route-utils', () => ({
  parseJsonBody: (...args: unknown[]) => parseJsonBodyMock(...args),
  sendJson: (...args: unknown[]) => sendJsonMock(...args),
}));

vi.mock('@electron/services/providers/provider-runtime-sync', () => ({
  syncDefaultProviderToRuntime: vi.fn(),
  syncDeletedProviderApiKeyToRuntime: vi.fn(),
  syncDeletedProviderToRuntime: vi.fn(),
  syncProviderApiKeyToRuntime: vi.fn(),
  syncSavedProviderToRuntime: vi.fn(),
  syncUpdatedProviderToRuntime: (...args: unknown[]) => syncUpdatedProviderToRuntimeMock(...args),
}));

vi.mock('@electron/services/providers/provider-service', () => ({
  getProviderService: () => ({
    listVendors: vi.fn(),
    listAccounts: vi.fn(),
    getDefaultAccountId: vi.fn(),
    setDefaultAccount: vi.fn(),
    getAccount: (...args: unknown[]) => getAccountMock(...args),
    createAccount: vi.fn(),
    updateAccount: (...args: unknown[]) => updateAccountMock(...args),
    deleteAccount: vi.fn(),
    listLegacyProvidersWithKeyInfo: vi.fn(),
    getDefaultLegacyProvider: vi.fn(),
    setDefaultLegacyProvider: vi.fn(),
    getLegacyProvider: vi.fn(),
    saveLegacyProvider: vi.fn(),
    deleteLegacyProviderApiKey: vi.fn(),
  }),
}));

vi.mock('@electron/services/providers/provider-store', () => ({
  providerAccountToConfig: (account: Record<string, unknown>) => ({
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
  }),
}));

vi.mock('@electron/utils/openclaw-auth', () => ({
  migrateProviderModelRefsInOpenClaw: (...args: unknown[]) => migrateProviderModelRefsInOpenClawMock(...args),
  removeProviderFromOpenClaw: (...args: unknown[]) => removeProviderFromOpenClawMock(...args),
}));

vi.mock('@electron/utils/device-oauth', () => ({
  deviceOAuthManager: {
    startFlow: vi.fn(),
    stopFlow: vi.fn(),
  },
}));

vi.mock('@electron/utils/browser-oauth', () => ({
  browserOAuthManager: {
    startFlow: vi.fn(),
    stopFlow: vi.fn(),
    submitManualCode: vi.fn(),
  },
}));

vi.mock('@electron/services/providers/provider-validation', () => ({
  validateApiKeyWithProvider: vi.fn(),
}));

vi.mock('@electron/utils/provider-registry', () => ({
  getProviderConfig: vi.fn(),
}));

vi.mock('@electron/utils/logger', () => ({
  logger: {
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
  },
}));

describe('handleProviderRoutes', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('migrates custom provider model refs when a label-driven runtime key changes', async () => {
    parseJsonBodyMock.mockResolvedValue({
      updates: {
        label: '998',
      },
    });
    getAccountMock.mockResolvedValue({
      id: 'custom-custom01',
      vendorId: 'custom',
      label: 'Custom',
      authMode: 'api_key',
      baseUrl: 'https://9985678.xyz/v1',
      apiProtocol: 'openai-completions',
      model: 'gpt-5.4',
      enabled: true,
      isDefault: false,
      createdAt: '2026-03-21T05:14:17.380Z',
      updatedAt: '2026-03-21T05:14:17.380Z',
    });
    updateAccountMock.mockResolvedValue({
      id: 'custom-custom01',
      vendorId: 'custom',
      label: '998',
      runtimeKey: '998',
      authMode: 'api_key',
      baseUrl: 'https://9985678.xyz/v1',
      apiProtocol: 'openai-completions',
      model: 'gpt-5.4',
      enabled: true,
      isDefault: false,
      createdAt: '2026-03-21T05:14:17.380Z',
      updatedAt: '2026-03-21T05:14:17.380Z',
    });

    const { handleProviderRoutes } = await import('@electron/api/routes/providers');

    const handled = await handleProviderRoutes(
      { method: 'PUT' } as IncomingMessage,
      {} as ServerResponse,
      new URL('http://127.0.0.1:3210/api/provider-accounts/custom-custom01'),
      { gatewayRuntimeController: { requestRuntimeRefresh: vi.fn() } } as never,
    );

    expect(handled).toBe(true);
    expect(syncUpdatedProviderToRuntimeMock).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'custom-custom01',
        runtimeKey: '998',
      }),
      undefined,
      expect.anything(),
    );
    expect(migrateProviderModelRefsInOpenClawMock).toHaveBeenCalledWith('custom-custom01', '998');
    expect(removeProviderFromOpenClawMock).toHaveBeenCalledWith('custom-custom01');
    expect(sendJsonMock).toHaveBeenCalledWith(expect.anything(), 200, expect.objectContaining({ success: true }));
  });
});
