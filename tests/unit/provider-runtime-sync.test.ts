import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProviderConfig } from '@electron/utils/secure-storage';

const mocks = vi.hoisted(() => ({
  getProviderAccount: vi.fn(),
  listProviderAccounts: vi.fn(),
  getProviderSecret: vi.fn(),
  getAllProviders: vi.fn(),
  getApiKey: vi.fn(),
  getDefaultProvider: vi.fn(),
  getProvider: vi.fn(),
  getProviderConfig: vi.fn(),
  getProviderDefaultModel: vi.fn(),
  removeProviderFromOpenClaw: vi.fn(),
  saveOAuthTokenToOpenClaw: vi.fn(),
  saveProviderKeyToOpenClaw: vi.fn(),
  setOpenClawDefaultModel: vi.fn(),
  setOpenClawDefaultModelWithOverride: vi.fn(),
  syncProviderConfigToOpenClaw: vi.fn(),
  updateAgentModelProvider: vi.fn(),
}));

vi.mock('@electron/services/providers/provider-store', () => ({
  getProviderAccount: mocks.getProviderAccount,
  listProviderAccounts: mocks.listProviderAccounts,
}));

vi.mock('@electron/services/secrets/secret-store', () => ({
  getProviderSecret: mocks.getProviderSecret,
}));

vi.mock('@electron/utils/secure-storage', () => ({
  getAllProviders: mocks.getAllProviders,
  getApiKey: mocks.getApiKey,
  getDefaultProvider: mocks.getDefaultProvider,
  getProvider: mocks.getProvider,
}));

vi.mock('@electron/utils/provider-registry', () => ({
  getProviderConfig: mocks.getProviderConfig,
  getProviderDefaultModel: mocks.getProviderDefaultModel,
}));

vi.mock('@electron/utils/openclaw-auth', () => ({
  removeProviderFromOpenClaw: mocks.removeProviderFromOpenClaw,
  saveOAuthTokenToOpenClaw: mocks.saveOAuthTokenToOpenClaw,
  saveProviderKeyToOpenClaw: mocks.saveProviderKeyToOpenClaw,
  setOpenClawDefaultModel: mocks.setOpenClawDefaultModel,
  setOpenClawDefaultModelWithOverride: mocks.setOpenClawDefaultModelWithOverride,
  syncProviderConfigToOpenClaw: mocks.syncProviderConfigToOpenClaw,
  updateAgentModelProvider: mocks.updateAgentModelProvider,
}));

vi.mock('@electron/utils/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import {
  syncDefaultProviderToRuntime,
  syncDeletedProviderToRuntime,
  syncSavedProviderToRuntime,
} from '@electron/services/providers/provider-runtime-sync';

function createProvider(overrides: Partial<ProviderConfig> = {}): ProviderConfig {
  return {
    id: 'moonshot',
    name: 'Moonshot',
    type: 'moonshot',
    model: 'kimi-k2.5',
    enabled: true,
    createdAt: '2026-03-14T00:00:00.000Z',
    updatedAt: '2026-03-14T00:00:00.000Z',
    ...overrides,
  };
}

function createRuntimeController() {
  return {
    requestRuntimeRefresh: vi.fn().mockResolvedValue(undefined),
  };
}

describe('provider-runtime-sync refresh strategy', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getProviderAccount.mockResolvedValue(null);
    mocks.getProviderSecret.mockResolvedValue(undefined);
    mocks.getAllProviders.mockResolvedValue([]);
    mocks.getApiKey.mockResolvedValue('sk-test');
    mocks.getDefaultProvider.mockResolvedValue('moonshot');
    mocks.getProvider.mockResolvedValue(createProvider());
    mocks.getProviderDefaultModel.mockReturnValue('kimi-k2.5');
    mocks.getProviderConfig.mockReturnValue({
      api: 'openai-completions',
      baseUrl: 'https://api.moonshot.cn/v1',
      apiKeyEnv: 'MOONSHOT_API_KEY',
    });
    mocks.syncProviderConfigToOpenClaw.mockResolvedValue(undefined);
    mocks.setOpenClawDefaultModel.mockResolvedValue(undefined);
    mocks.setOpenClawDefaultModelWithOverride.mockResolvedValue(undefined);
    mocks.saveProviderKeyToOpenClaw.mockResolvedValue(undefined);
    mocks.removeProviderFromOpenClaw.mockResolvedValue(undefined);
    mocks.updateAgentModelProvider.mockResolvedValue(undefined);
  });

  it('uses debouncedReload after saving provider config', async () => {
    const gatewayRuntimeController = createRuntimeController();
    await syncSavedProviderToRuntime(createProvider(), undefined, gatewayRuntimeController);

    expect(gatewayRuntimeController.requestRuntimeRefresh).toHaveBeenCalledWith({});
  });

  it('uses debouncedRestart after deleting provider config', async () => {
    const gatewayRuntimeController = createRuntimeController();
    await syncDeletedProviderToRuntime(createProvider(), 'moonshot', gatewayRuntimeController);

    expect(gatewayRuntimeController.requestRuntimeRefresh).toHaveBeenCalledWith({ mode: 'restart', delayMs: undefined });
  });

  it('uses debouncedReload after switching default provider when gateway is running', async () => {
    const gatewayRuntimeController = createRuntimeController();
    await syncDefaultProviderToRuntime('moonshot', gatewayRuntimeController);

    expect(gatewayRuntimeController.requestRuntimeRefresh).toHaveBeenCalledWith({});
  });

  it('does nothing when no runtime controller is available', async () => {
    await syncDefaultProviderToRuntime('moonshot', undefined);
  });
});
