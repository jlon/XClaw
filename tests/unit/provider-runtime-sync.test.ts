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
  syncAllProviderAuthToRuntime,
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

  it('replays saved provider configs during startup auth sync so model allowlists self-heal', async () => {
    mocks.listProviderAccounts.mockResolvedValue([
      {
        id: 'custom-014df125-c7e1-49f3-a97d-6a9ee685fbcc',
        label: '998',
        runtimeKey: '998',
        vendorId: 'custom',
        authMode: 'api_key',
        baseUrl: 'https://9985678.xyz/v1',
        apiProtocol: 'openai-completions',
        model: 'gpt-5.4',
        enabled: true,
        createdAt: '2026-03-21T04:34:34.053Z',
        updatedAt: '2026-03-21T04:34:34.053Z',
      },
    ]);
    mocks.getProviderSecret.mockResolvedValue({
      type: 'api_key',
      apiKey: 'sk-998',
    });
    mocks.getProviderConfig.mockReturnValue({
      api: 'openai-completions',
      baseUrl: undefined,
    });

    await syncAllProviderAuthToRuntime();

    expect(mocks.saveProviderKeyToOpenClaw).toHaveBeenCalledWith('998', 'sk-998');
    expect(mocks.syncProviderConfigToOpenClaw).toHaveBeenCalledWith(
      '998',
      'gpt-5.4',
      expect.objectContaining({
        baseUrl: 'https://9985678.xyz/v1',
        api: 'openai-completions',
      }),
    );
    expect(mocks.updateAgentModelProvider).toHaveBeenCalledWith(
      '998',
      expect.objectContaining({
        models: [{ id: 'gpt-5.4', name: 'gpt-5.4' }],
      }),
    );
  });
});
