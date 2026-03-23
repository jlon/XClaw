import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ProviderAccountFormSections } from '@/components/settings/providers/ProviderAccountFormSections';
import type { ProviderAccount } from '@/lib/providers';
import type { ProviderListItem } from '@/lib/provider-accounts';

const toastSuccessMock = vi.fn();
const toastErrorMock = vi.fn();

vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccessMock(...args),
    error: (...args: unknown[]) => toastErrorMock(...args),
  },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => ({
      'aiProviders.sections.basic': '基础信息',
      'aiProviders.sections.connection': '接入配置',
      'aiProviders.sections.fallbackStrategy': '回退策略',
      'aiProviders.sections.credentials': '凭证与验证',
      'aiProviders.dialog.displayName': 'Display Name',
      'aiProviders.dialog.baseUrl': 'Base URL',
      'aiProviders.dialog.modelId': 'Model ID',
      'aiProviders.dialog.protocol': 'Protocol',
      'aiProviders.dialog.apiKeyConfigured': 'An API key is already stored for this provider.',
      'aiProviders.dialog.apiKeyMissing': 'No API key is stored for this provider yet.',
      'aiProviders.dialog.apiKey': 'API Key',
      'aiProviders.dialog.replaceApiKey': 'Replace API Key',
      'aiProviders.dialog.replaceApiKeyHelp': 'Leave this field empty if you want to keep the currently stored API key.',
      'aiProviders.dialog.fallbackModelIds': 'Fallback Model IDs',
      'aiProviders.dialog.fallbackModelIdsPlaceholder': 'gpt-4.1-mini',
      'aiProviders.dialog.fallbackModelIdsHelp': 'One model ID per line.',
      'aiProviders.dialog.fallbackProviders': 'Fallback Providers',
      'aiProviders.dialog.noFallbackOptions': 'Add another provider first.',
      'aiProviders.dialog.customDoc': 'Documentation',
      'aiProviders.protocols.openaiCompletions': 'OpenAI Completions',
      'aiProviders.protocols.openaiResponses': 'OpenAI Responses',
      'aiProviders.protocols.anthropic': 'Anthropic',
      'aiProviders.oauth.getApiKey': 'Get API Key',
      'aiProviders.card.configured': 'Configured',
      'aiProviders.toast.updated': 'Provider updated',
      'aiProviders.toast.failedUpdate': 'Failed to update provider',
      'aiProviders.toast.invalidKey': 'Invalid API key',
      'aiProviders.toast.modelRequired': 'Model ID is required',
      'aiProviders.authModes.apiKey': 'API Key',
      'aiProviders.custom': 'Custom',
      'aiProviders.notRequired': 'Not required',
      'aiProviders.card.editKey': 'Edit API key',
    } as Record<string, string>)[key] ?? fallback ?? key,
    i18n: { language: 'en' },
  }),
}));

function createAccount(overrides: Partial<ProviderAccount> = {}): ProviderAccount {
  return {
    id: 'custom-a',
    vendorId: 'custom',
    label: 'Custom Prod',
    runtimeKey: 'custom-prod',
    authMode: 'api_key',
    baseUrl: 'https://api.example.com/v1',
    apiProtocol: 'openai-completions',
    model: 'custom/model',
    enabled: true,
    isDefault: false,
    createdAt: '2026-03-20T00:00:00.000Z',
    updatedAt: '2026-03-20T00:00:00.000Z',
    ...overrides,
  };
}

function createItem(overrides: Partial<ProviderListItem> = {}): ProviderListItem {
  return {
    account: createAccount(),
    vendor: {
      id: 'custom',
      name: 'Custom',
      icon: '⚙️',
      placeholder: 'API key...',
      requiresApiKey: true,
      showBaseUrl: true,
      showModelId: true,
      modelIdPlaceholder: 'provider/model-id',
      category: 'custom',
      supportedAuthModes: ['api_key'],
      defaultAuthMode: 'api_key',
      supportsMultipleAccounts: true,
    },
    status: {
      id: 'custom-a',
      name: 'Custom Prod',
      type: 'custom',
      hasKey: true,
      keyMasked: 'sk-***',
      enabled: true,
      createdAt: '2026-03-20T00:00:00.000Z',
      updatedAt: '2026-03-20T00:00:00.000Z',
    },
    ...overrides,
  };
}

describe('ProviderAccountFormSections', () => {
  it('renders grouped edit sections with api key controls', () => {
    render(
      <ProviderAccountFormSections
        mode="edit"
        item={createItem()}
        allProviders={[createItem()]}
        devModeUnlocked={false}
        onSave={vi.fn().mockResolvedValue(undefined)}
        onCancel={vi.fn()}
        onValidateKey={vi.fn().mockResolvedValue({ valid: true })}
      />
    );

    expect(screen.getByText('基础信息')).toBeInTheDocument();
    expect(screen.getByText('接入配置')).toBeInTheDocument();
    expect(screen.getByText('回退策略')).toBeInTheDocument();
    expect(screen.getByText('凭证与验证')).toBeInTheDocument();
    expect(screen.getByLabelText('API Key')).toBeInTheDocument();
    expect(screen.queryByTestId('provider-summary-view')).not.toBeInTheDocument();
  });

  it('validates a replacement key and forwards the save payload', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const onValidateKey = vi.fn().mockResolvedValue({ valid: true });

    render(
      <ProviderAccountFormSections
        mode="edit"
        item={createItem()}
        allProviders={[createItem()]}
        devModeUnlocked={false}
        onSave={onSave}
        onCancel={vi.fn()}
        onValidateKey={onValidateKey}
      />
    );

    fireEvent.change(screen.getByLabelText('Display Name'), { target: { value: 'Custom Stage' } });
    fireEvent.change(screen.getByLabelText('API Key'), { target: { value: 'sk-stage' } });
    fireEvent.click(screen.getByTestId('provider-account-form-save'));

    await waitFor(() => {
      expect(onValidateKey).toHaveBeenCalledWith('sk-stage', {
        baseUrl: 'https://api.example.com/v1',
        apiProtocol: 'openai-completions',
      });
    });
    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith({
        newApiKey: 'sk-stage',
        updates: { label: 'Custom Stage' },
      });
    });
    await waitFor(() => {
      expect(toastSuccessMock).toHaveBeenCalledWith('Provider updated');
    });
  });
});
