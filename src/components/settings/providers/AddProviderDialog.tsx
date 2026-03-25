import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  Loader2,
  X,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { invokeIpc } from '@/lib/api-client';
import { hostApiFetch } from '@/lib/host-api';
import { subscribeHostEvent } from '@/lib/host-events';
import {
  PROVIDER_TYPE_INFO,
  getProviderIconClass,
  getProviderIconUrl,
  getProviderTypeInfo,
  resolveProviderModelForSave,
  shouldShowProviderModelId,
  type ProviderType,
  type ProviderTypeInfo,
} from '@/lib/providers';
import { useProviderStore, type ProviderAccount, type ProviderVendorInfo } from '@/stores/providers';
import { cn } from '@/lib/utils';
import { getProtocolBaseUrlPlaceholder } from './ProviderAccountFormSections';
import type { AddProviderDialogOptions } from './provider-account-create';

const inputClasses = 'appearance-none h-9 rounded-[10px] border border-border/70 bg-[hsl(var(--surface-panel)/0.96)] text-[13px] text-foreground placeholder:text-muted-foreground/55 shadow-none transition-colors focus:outline-none focus-visible:outline-none focus-visible:border-primary focus-visible:bg-[hsl(var(--surface-elevated)/1)] focus-visible:ring-0';
const tokenInputClasses = `${inputClasses} font-mono tracking-[0.01em]`;
const labelClasses = 'text-[13px] font-semibold text-foreground/80';
const modalSurfaceClasses = 'app-modal-surface flex max-h-[88vh] w-full flex-col rounded-[20px] border border-[hsl(var(--border-subtle)/0.82)] bg-[hsl(var(--surface-elevated)/0.99)] shadow-[0_18px_48px_rgba(15,23,42,0.12)]';
const primaryButtonClass = 'workbench-motion-button workbench-motion-button--lift rounded-[10px] h-8 px-4 bg-primary text-primary-foreground shadow-none hover:bg-primary/92';
const segmentedTrackClass = 'flex rounded-[10px] border border-border/60 bg-[hsl(var(--surface-base)/0.96)] p-0.5 gap-0.5';
const segmentedActiveClass = 'border border-[hsl(var(--primary)/0.16)] bg-[hsl(var(--surface-elevated)/0.98)] text-primary shadow-none';
const segmentedIdleClass = 'text-muted-foreground/82 hover:bg-[hsl(var(--foreground)/0.035)]';
const listRowClass = 'flex flex-col items-start gap-1.5 rounded-[14px] border border-[hsl(var(--border-subtle)/0.62)] px-2.5 py-2.5 text-left transition-colors hover:border-[hsl(var(--border-strong)/0.24)] hover:bg-[hsl(var(--surface-hover)/0.68)]';
const panelSurfaceClass = 'app-insight-surface rounded-[12px] border border-[hsl(var(--border-subtle)/0.78)] bg-[hsl(var(--surface-elevated)/0.96)]';
const setupGridClass = 'grid gap-3 md:grid-cols-2';
const pickerCardActiveClass = 'border-[hsl(var(--border-strong)/0.34)] bg-[hsl(var(--surface-elevated)/1)] shadow-[0_8px_18px_rgba(15,23,42,0.04)]';

export interface AddProviderDialogProps {
  existingVendorIds: Set<string>;
  vendors: ProviderVendorInfo[];
  onClose: () => void;
  onAdd: (
    type: ProviderType,
    name: string,
    apiKey: string,
    options?: AddProviderDialogOptions,
  ) => Promise<void>;
  onValidateKey: (
    type: string,
    apiKey: string,
    options?: { baseUrl?: string; apiProtocol?: ProviderAccount['apiProtocol'] }
  ) => Promise<{ valid: boolean; error?: string }>;
  devModeUnlocked: boolean;
}

export function AddProviderDialog({
  existingVendorIds,
  vendors,
  onClose,
  onAdd,
  onValidateKey,
  devModeUnlocked,
}: AddProviderDialogProps) {
  const { t } = useTranslation('settings');
  const [selectedType, setSelectedType] = useState<ProviderType | null>(null);
  const [name, setName] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [modelId, setModelId] = useState('');
  const [apiProtocol, setApiProtocol] = useState<ProviderAccount['apiProtocol']>('openai-completions');
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [oauthFlowing, setOauthFlowing] = useState(false);
  const [oauthData, setOauthData] = useState<{
    mode: 'device';
    verificationUri: string;
    userCode: string;
    expiresIn: number;
  } | {
    mode: 'manual';
    authorizationUrl: string;
    message?: string;
  } | null>(null);
  const [manualCodeInput, setManualCodeInput] = useState('');
  const [oauthError, setOauthError] = useState<string | null>(null);
  const [authMode, setAuthMode] = useState<'oauth' | 'apikey'>('apikey');

  const typeInfo = selectedType ? getProviderTypeInfo(selectedType) : undefined;
  const showModelIdField = shouldShowProviderModelId(typeInfo, devModeUnlocked);
  const isOAuth = typeInfo?.isOAuth ?? false;
  const supportsApiKey = typeInfo?.supportsApiKey ?? false;
  const vendorMap = new Map(vendors.map((vendor) => [vendor.id, vendor]));
  const selectedVendor = selectedType ? vendorMap.get(selectedType) : undefined;
  const preferredOAuthMode = selectedVendor?.supportedAuthModes.includes('oauth_browser')
    ? 'oauth_browser'
    : selectedVendor?.supportedAuthModes.includes('oauth_device')
      ? 'oauth_device'
      : selectedType === 'google'
        ? 'oauth_browser'
        : null;
  const useOAuthFlow = isOAuth && (!supportsApiKey || authMode === 'oauth');
  const compactCredentialLayout = Boolean(selectedType && !typeInfo?.showBaseUrl && !showModelIdField && selectedType !== 'custom');
  const setupSectionTitle = compactCredentialLayout && !useOAuthFlow
    ? t('aiProviders.sections.setupCompact', '基础与凭证')
    : t('aiProviders.sections.setup', '基础与接入');
  const setupPaneGridClass = compactCredentialLayout && !useOAuthFlow ? 'grid gap-3 lg:grid-cols-2' : setupGridClass;
  const latestRef = useRef({ selectedType, typeInfo, onAdd, onClose, t });
  const pendingOAuthRef = useRef<{ accountId: string; label: string } | null>(null);

  useEffect(() => {
    if (!selectedVendor || !isOAuth || !supportsApiKey) {
      return;
    }
    setAuthMode(selectedVendor.defaultAuthMode === 'api_key' ? 'apikey' : 'oauth');
  }, [selectedVendor, isOAuth, supportsApiKey]);

  useEffect(() => {
    latestRef.current = { selectedType, typeInfo, onAdd, onClose, t };
  }, [selectedType, typeInfo, onAdd, onClose, t]);

  useEffect(() => {
    const handleCode = (data: unknown) => {
      const payload = data as Record<string, unknown>;
      setOauthData(
        payload?.mode === 'manual'
          ? {
              mode: 'manual',
              authorizationUrl: String(payload.authorizationUrl || ''),
              message: typeof payload.message === 'string' ? payload.message : undefined,
            }
          : {
              mode: 'device',
              verificationUri: String(payload.verificationUri || ''),
              userCode: String(payload.userCode || ''),
              expiresIn: Number(payload.expiresIn || 300),
            },
      );
      setOauthError(null);
    };

    const handleSuccess = async (data: unknown) => {
      setOauthFlowing(false);
      setOauthData(null);
      setManualCodeInput('');
      setValidationError(null);
      const { onClose: close, t: translate } = latestRef.current;
      const payload = (data as { accountId?: string } | undefined) || undefined;
      const accountId = payload?.accountId || pendingOAuthRef.current?.accountId;

      try {
        const store = useProviderStore.getState();
        await store.refreshProviderSnapshot();
        if (accountId) {
          await store.setDefaultAccount(accountId);
        }
      } catch (error) {
        console.error('Failed to refresh providers after OAuth:', error);
      }

      pendingOAuthRef.current = null;
      close();
      toast.success(translate('aiProviders.toast.added'));
    };

    const handleError = (data: unknown) => {
      setOauthError((data as { message: string }).message);
      setOauthData(null);
      pendingOAuthRef.current = null;
    };

    const offCode = subscribeHostEvent('oauth:code', handleCode);
    const offSuccess = subscribeHostEvent('oauth:success', handleSuccess);
    const offError = subscribeHostEvent('oauth:error', handleError);

    return () => {
      offCode();
      offSuccess();
      offError();
    };
  }, []);

  const availableTypes = PROVIDER_TYPE_INFO.filter((type) => {
    const vendor = vendorMap.get(type.id);
    if (!vendor) {
      return !existingVendorIds.has(type.id) || type.id === 'custom';
    }
    return vendor.supportsMultipleAccounts || !existingVendorIds.has(type.id);
  });
  const availableTypeIds = availableTypes.map((type) => type.id).join('|');

  const selectType = useCallback((type: ProviderTypeInfo) => {
    setSelectedType(type.id);
    setName(type.id === 'custom' ? t('aiProviders.custom') : type.name);
    setBaseUrl(type.defaultBaseUrl || '');
    setModelId(type.defaultModelId || '');
    setApiProtocol('openai-completions');
    setValidationError(null);
    setOauthFlowing(false);
    setOauthData(null);
    setOauthError(null);
    setManualCodeInput('');
  }, [t]);

  useEffect(() => {
    if (!availableTypes.length) {
      if (selectedType) {
        setSelectedType(null);
      }
      return;
    }
    if (!selectedType) {
      selectType(availableTypes[0]);
      return;
    }
    if (!availableTypes.some((type) => type.id === selectedType)) {
      selectType(availableTypes[0]);
    }
  }, [availableTypeIds, availableTypes, selectedType, selectType]);

  const handleStartOAuth = async () => {
    if (!selectedType) {
      return;
    }
    if (selectedType === 'minimax-portal' && existingVendorIds.has('minimax-portal-cn')) {
      toast.error(t('aiProviders.toast.minimaxConflict'));
      return;
    }
    if (selectedType === 'minimax-portal-cn' && existingVendorIds.has('minimax-portal')) {
      toast.error(t('aiProviders.toast.minimaxConflict'));
      return;
    }

    setOauthFlowing(true);
    setOauthData(null);
    setManualCodeInput('');
    setOauthError(null);

    try {
      const vendor = vendorMap.get(selectedType);
      const supportsMultipleAccounts = vendor?.supportsMultipleAccounts ?? selectedType === 'custom';
      const accountId = supportsMultipleAccounts ? `${selectedType}-${crypto.randomUUID()}` : selectedType;
      const label = name || (typeInfo?.id === 'custom' ? t('aiProviders.custom') : typeInfo?.name) || selectedType;
      pendingOAuthRef.current = { accountId, label };
      await hostApiFetch('/api/providers/oauth/start', {
        method: 'POST',
        body: JSON.stringify({ provider: selectedType, accountId, label }),
      });
    } catch (error) {
      setOauthError(String(error));
      setOauthFlowing(false);
      pendingOAuthRef.current = null;
    }
  };

  const handleCancelOAuth = async () => {
    setOauthFlowing(false);
    setOauthData(null);
    setManualCodeInput('');
    setOauthError(null);
    pendingOAuthRef.current = null;
    await hostApiFetch('/api/providers/oauth/cancel', {
      method: 'POST',
    });
  };

  const handleSubmitManualOAuthCode = async () => {
    const value = manualCodeInput.trim();
    if (!value) {
      return;
    }
    try {
      await hostApiFetch('/api/providers/oauth/submit', {
        method: 'POST',
        body: JSON.stringify({ code: value }),
      });
      setOauthError(null);
    } catch (error) {
      setOauthError(String(error));
    }
  };

  const handleAdd = async () => {
    if (!selectedType) {
      return;
    }
    if (selectedType === 'minimax-portal' && existingVendorIds.has('minimax-portal-cn')) {
      toast.error(t('aiProviders.toast.minimaxConflict'));
      return;
    }
    if (selectedType === 'minimax-portal-cn' && existingVendorIds.has('minimax-portal')) {
      toast.error(t('aiProviders.toast.minimaxConflict'));
      return;
    }

    setSaving(true);
    setValidationError(null);

    try {
      if ((typeInfo?.requiresApiKey ?? false) && !apiKey.trim()) {
        setValidationError(t('aiProviders.toast.invalidKey'));
        setSaving(false);
        return;
      }

      if ((typeInfo?.requiresApiKey ?? false) && apiKey) {
        const result = await onValidateKey(selectedType, apiKey, {
          baseUrl: baseUrl.trim() || undefined,
          apiProtocol: (selectedType === 'custom' || selectedType === 'ollama') ? apiProtocol : undefined,
        });
        if (!result.valid) {
          setValidationError(result.error || t('aiProviders.toast.invalidKey'));
          setSaving(false);
          return;
        }
      }

      if (showModelIdField && !modelId.trim()) {
        setValidationError(t('aiProviders.toast.modelRequired'));
        setSaving(false);
        return;
      }

      await onAdd(
        selectedType,
        name || (typeInfo?.id === 'custom' ? t('aiProviders.custom') : typeInfo?.name) || selectedType,
        apiKey.trim(),
        {
          baseUrl: baseUrl.trim() || undefined,
          apiProtocol: (selectedType === 'custom' || selectedType === 'ollama') ? apiProtocol : undefined,
          model: resolveProviderModelForSave(typeInfo, modelId, devModeUnlocked),
          authMode: useOAuthFlow
            ? (preferredOAuthMode || 'oauth_device')
            : selectedType === 'ollama'
              ? 'local'
              : (isOAuth && supportsApiKey && authMode === 'apikey')
                ? 'api_key'
                : vendorMap.get(selectedType)?.defaultAuthMode || 'api_key',
        },
      );
    } catch (error) {
      console.error('Failed to add provider from dialog:', error);
    } finally {
      setSaving(false);
    }
  };

  const apiKeyFieldBlock = (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <Label htmlFor="apiKey" className={labelClasses}>{t('aiProviders.dialog.apiKey')}</Label>
        {typeInfo?.apiKeyUrl ? (
          <a
            href={typeInfo.apiKeyUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-[13px] font-medium text-primary hover:text-primary/80"
            tabIndex={-1}
          >
            {t('aiProviders.oauth.getApiKey')}
            <ExternalLink className="h-3 w-3" />
          </a>
        ) : null}
      </div>
      <div className="relative">
        <Input
          id="apiKey"
          type={showKey ? 'text' : 'password'}
          placeholder={typeInfo?.id === 'ollama' ? t('aiProviders.notRequired') : typeInfo?.placeholder}
          value={apiKey}
          onChange={(event) => {
            setApiKey(event.target.value);
            setValidationError(null);
          }}
          className={tokenInputClasses}
        />
        <button
          type="button"
          onClick={() => setShowKey((current) => !current)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
        >
          {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
      {validationError ? (
        <p className="text-[13px] font-medium text-red-500">{validationError}</p>
      ) : (
        <p className="text-[12px] text-muted-foreground">{t('aiProviders.dialog.apiKeyStored')}</p>
      )}
    </div>
  );

  return (
    <div className="app-modal-overlay fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4" data-testid="provider-add-dialog">
      <Card className={cn(modalSurfaceClasses, 'max-w-[64rem] overflow-hidden')}>
        <CardHeader className="relative shrink-0 border-b border-[hsl(var(--border-subtle)/0.72)] px-5 py-4">
          <CardTitle className="text-[15px] font-semibold tracking-tight text-foreground">{t('aiProviders.dialog.title')}</CardTitle>
          <CardDescription className="mt-0.5 text-[11.5px] text-foreground/66">
            {t('aiProviders.dialog.desc')}
          </CardDescription>
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-4 top-4 h-7 w-7 rounded-[10px] text-muted-foreground hover:bg-[hsl(var(--foreground)/0.05)] hover:text-foreground"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="min-h-0 flex flex-1 flex-col overflow-hidden p-0">
          <div className="app-provider-dialog-body app-setup-scrollbar-hidden min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4">
            <div className="flex flex-col gap-3.5">
              <section className={cn(panelSurfaceClass, 'shrink-0 p-2.5')}>
                {availableTypes.length ? (
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                    {availableTypes.map((type) => {
                      const selected = type.id === selectedType;
                      const meta = type.model || (type.supportsApiKey ? 'API Key' : 'OAuth');
                      return (
                        <button
                          key={type.id}
                          type="button"
                          disabled={saving || oauthFlowing}
                          onClick={() => {
                            if (!selected) {
                              selectType(type);
                            }
                          }}
                          className={cn(
                            listRowClass,
                            selected && pickerCardActiveClass,
                            'min-h-[74px] rounded-[14px] focus:outline-none focus-visible:outline-none focus-visible:border-[hsl(var(--border-strong)/0.42)] focus-visible:bg-[hsl(var(--surface-elevated)/1)] focus-visible:ring-0 disabled:cursor-not-allowed disabled:opacity-60',
                          )}
                        >
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] border border-[hsl(var(--border-subtle)/0.76)] bg-[hsl(var(--surface-base)/0.92)]">
                            {getProviderIconUrl(type.id) ? (
                              <img src={getProviderIconUrl(type.id)} alt={type.name} className={getProviderIconClass(type.id, 'h-4 w-4')} />
                            ) : (
                              <span className="text-[15px]">{type.icon}</span>
                            )}
                          </div>
                          <div className="min-w-0 space-y-0.5">
                            <p className="truncate text-[12.5px] font-semibold leading-none text-foreground">{type.id === 'custom' ? t('aiProviders.custom') : type.name}</p>
                            <p className="line-clamp-1 text-[10.5px] leading-4 text-muted-foreground/72">{meta}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex flex-1 items-center justify-center rounded-[14px] border border-dashed border-[hsl(var(--border-subtle)/0.72)] bg-[hsl(var(--surface-base)/0.42)] px-4 text-center text-[12.5px] text-muted-foreground">
                    {t('aiProviders.dialog.desc')}
                  </div>
                )}
              </section>

              <section className={cn(panelSurfaceClass, 'flex flex-col')}>
                {selectedType && typeInfo ? (
                  <>
                    <div className="flex shrink-0 items-start justify-between gap-4 border-b border-[hsl(var(--border-subtle)/0.72)] px-4 py-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] border border-[hsl(var(--border-subtle)/0.76)] bg-[hsl(var(--surface-base)/0.92)]">
                          {getProviderIconUrl(selectedType) ? (
                            <img src={getProviderIconUrl(selectedType)} alt={typeInfo.name} className={getProviderIconClass(selectedType, 'h-[18px] w-[18px]')} />
                          ) : (
                            <span className="text-lg">{typeInfo.icon}</span>
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-[13.5px] font-semibold text-foreground">{typeInfo.id === 'custom' ? t('aiProviders.custom') : typeInfo.name}</p>
                          <p className="mt-0.5 text-[11px] text-muted-foreground">{typeInfo.id}</p>
                        </div>
                      </div>
                    </div>

                  <div className="px-4 py-3.5">
                    <div className="space-y-2.5">
                      <section className={panelSurfaceClass + ' space-y-3 p-3'}>
                        <div className="flex flex-col gap-2.5">
                          <p className="text-[12px] font-semibold text-foreground/82">{setupSectionTitle}</p>
                          {isOAuth && supportsApiKey ? (
                            <div className={cn(segmentedTrackClass, 'grid w-full grid-cols-2 overflow-hidden text-[12px] font-medium sm:w-auto')}>
                              <button
                                type="button"
                                onClick={() => setAuthMode('oauth')}
                                className={cn('min-w-0 whitespace-nowrap rounded-[8px] px-2.5 py-2 text-center leading-none transition-colors sm:min-w-[112px]', authMode === 'oauth' ? segmentedActiveClass : segmentedIdleClass)}
                              >
                                {t('aiProviders.oauth.loginMode')}
                              </button>
                              <button
                                type="button"
                                onClick={() => setAuthMode('apikey')}
                                className={cn('min-w-0 whitespace-nowrap rounded-[8px] px-2.5 py-2 text-center leading-none transition-colors sm:min-w-[112px]', authMode === 'apikey' ? segmentedActiveClass : segmentedIdleClass)}
                              >
                                {t('aiProviders.oauth.apikeyMode')}
                              </button>
                            </div>
                          ) : null}
                        </div>

                        <div className={cn(setupPaneGridClass, 'gap-2.5')}>
                          <div className="space-y-2">
                            <Label htmlFor="name" className={labelClasses}>{t('aiProviders.dialog.displayName')}</Label>
                            <Input
                              id="name"
                              placeholder={typeInfo.id === 'custom' ? t('aiProviders.custom') : typeInfo.name}
                              value={name}
                              onChange={(event) => setName(event.target.value)}
                              className={inputClasses}
                            />
                          </div>

                          {typeInfo.showBaseUrl ? (
                            <div className="space-y-2">
                              <Label htmlFor="baseUrl" className={labelClasses}>{t('aiProviders.dialog.baseUrl')}</Label>
                              <Input
                                id="baseUrl"
                                placeholder={getProtocolBaseUrlPlaceholder(apiProtocol)}
                                value={baseUrl}
                                onChange={(event) => setBaseUrl(event.target.value)}
                                className={inputClasses}
                              />
                            </div>
                          ) : null}

                          {showModelIdField ? (
                            <div className="space-y-2">
                              <Label htmlFor="modelId" className={labelClasses}>{t('aiProviders.dialog.modelId')}</Label>
                              <Input
                                id="modelId"
                                placeholder={typeInfo.modelIdPlaceholder || 'provider/model-id'}
                                value={modelId}
                                onChange={(event) => {
                                  setModelId(event.target.value);
                                  setValidationError(null);
                                }}
                                className={inputClasses}
                              />
                            </div>
                          ) : null}

                          {selectedType === 'custom' ? (
                            <div className="space-y-2 md:col-span-2">
                              <Label className={labelClasses}>{t('aiProviders.dialog.protocol', 'Protocol')}</Label>
                              <div className={cn(segmentedTrackClass, 'gap-1 text-[12px]')}>
                                <button
                                  type="button"
                                  onClick={() => setApiProtocol('openai-completions')}
                                  className={cn('flex-1 rounded-[8px] px-3 py-1.5 transition-colors', apiProtocol === 'openai-completions' ? segmentedActiveClass : segmentedIdleClass)}
                                >
                                  {t('aiProviders.protocols.openaiCompletions', 'OpenAI Completions')}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setApiProtocol('openai-responses')}
                                  className={cn('flex-1 rounded-[8px] px-3 py-1.5 transition-colors', apiProtocol === 'openai-responses' ? segmentedActiveClass : segmentedIdleClass)}
                                >
                                  {t('aiProviders.protocols.openaiResponses', 'OpenAI Responses')}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setApiProtocol('anthropic-messages')}
                                  className={cn('flex-1 rounded-[8px] px-3 py-1.5 transition-colors', apiProtocol === 'anthropic-messages' ? segmentedActiveClass : segmentedIdleClass)}
                                >
                                  {t('aiProviders.protocols.anthropic', 'Anthropic')}
                                </button>
                              </div>
                            </div>
                          ) : null}
                          {compactCredentialLayout && !useOAuthFlow ? apiKeyFieldBlock : null}
                        </div>
                      </section>

                      {!useOAuthFlow && !compactCredentialLayout ? (
                        <section className={panelSurfaceClass + ' space-y-3 p-3'}>
                          {apiKeyFieldBlock}
                        </section>
                      ) : useOAuthFlow ? (
                        <section className={panelSurfaceClass + ' space-y-3 p-3'}>
                          {!oauthFlowing ? (
                            <>
                              <p className="text-[12px] font-medium text-foreground/70">
                                {t('aiProviders.oauth.loginPrompt')}
                              </p>
                              <Button
                                onClick={handleStartOAuth}
                                disabled={oauthFlowing}
                                className="h-9 w-full rounded-[10px] font-semibold"
                              >
                                {t('aiProviders.oauth.loginButton')}
                              </Button>
                            </>
                          ) : (
                            <div className="relative overflow-hidden">
                              <div className="relative z-10 flex flex-col items-center justify-center space-y-4 text-center">
                                {oauthError ? (
                                  <div className="space-y-3 text-red-500">
                                    <XCircle className="mx-auto h-10 w-10" />
                                    <p className="text-[14px] font-semibold">{t('aiProviders.oauth.authFailed')}</p>
                                    <p className="text-[12.5px] opacity-80">{oauthError}</p>
                                    <Button variant="outline" size="sm" onClick={handleCancelOAuth} className="mt-2 h-8 rounded-[10px] px-5">
                                      Try Again
                                    </Button>
                                  </div>
                                ) : !oauthData ? (
                                  <div className="space-y-4 py-5">
                                    <Loader2 className="mx-auto h-10 w-10 animate-spin text-primary" />
                                    <p className="text-[12.5px] font-medium text-muted-foreground animate-pulse">{t('aiProviders.oauth.requestingCode')}</p>
                                  </div>
                                ) : oauthData.mode === 'manual' ? (
                                  <div className="w-full space-y-3.5 text-left">
                                    <p className="rounded-[11px] bg-[hsl(var(--foreground)/0.03)] p-3 text-[12px] text-muted-foreground/84">
                                      {oauthData.message || 'Open the authorization page, complete login, then paste the callback URL or code below.'}
                                    </p>
                                    <Button
                                      variant="secondary"
                                      className="h-9 w-full rounded-[10px] font-semibold"
                                      onClick={() => invokeIpc('shell:openExternal', oauthData.authorizationUrl)}
                                    >
                                      <ExternalLink className="mr-2 h-4 w-4" />
                                      Open Authorization Page
                                    </Button>
                                    <Input
                                      placeholder="Paste callback URL or code"
                                      value={manualCodeInput}
                                      onChange={(event) => setManualCodeInput(event.target.value)}
                                      className={tokenInputClasses}
                                    />
                                    <Button
                                      className="h-9 w-full rounded-[10px] font-semibold"
                                      onClick={handleSubmitManualOAuthCode}
                                      disabled={!manualCodeInput.trim()}
                                    >
                                      Submit Code
                                    </Button>
                                    <Button variant="ghost" className="h-9 w-full rounded-[10px] font-semibold text-muted-foreground" onClick={handleCancelOAuth}>
                                      Cancel
                                    </Button>
                                  </div>
                                ) : (
                                  <div className="w-full space-y-4">
                                    <div className="space-y-2 text-left">
                                      <h3 className="text-[14px] font-semibold text-foreground">{t('aiProviders.oauth.approveLogin')}</h3>
                                      <div className="space-y-1.5 rounded-[11px] bg-[hsl(var(--foreground)/0.03)] p-3 text-[12px] text-muted-foreground/84">
                                        <p>1. {t('aiProviders.oauth.step1')}</p>
                                        <p>2. {t('aiProviders.oauth.step2')}</p>
                                        <p>3. {t('aiProviders.oauth.step3')}</p>
                                      </div>
                                    </div>

                                    <div className={panelSurfaceClass + ' flex items-center justify-center gap-3 px-3.5 py-3'}>
                                      <code className="text-[24px] font-mono font-bold tracking-[0.16em] text-foreground">
                                        {oauthData.userCode}
                                      </code>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 rounded-[10px] hover:bg-[hsl(var(--foreground)/0.04)]"
                                        onClick={() => {
                                          navigator.clipboard.writeText(oauthData.userCode);
                                          toast.success(t('aiProviders.oauth.codeCopied'));
                                        }}
                                      >
                                        <Copy className="h-4 w-4" />
                                      </Button>
                                    </div>

                                    <Button
                                      variant="secondary"
                                      className="h-9 w-full rounded-[10px] font-semibold"
                                      onClick={() => invokeIpc('shell:openExternal', oauthData.verificationUri)}
                                    >
                                      <ExternalLink className="mr-2 h-4 w-4" />
                                      {t('aiProviders.oauth.openLoginPage')}
                                    </Button>

                                    <div className="flex items-center justify-center gap-2 pt-1 text-[12.5px] font-medium text-muted-foreground">
                                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                                      <span>{t('aiProviders.oauth.waitingApproval')}</span>
                                    </div>

                                    <Button variant="ghost" className="h-9 w-full rounded-[10px] font-semibold text-muted-foreground" onClick={handleCancelOAuth}>
                                      Cancel
                                    </Button>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </section>
                      ) : null}
                    </div>
                  </div>

                  <div className="app-provider-dialog-footer flex shrink-0 justify-end gap-3 border-t border-[hsl(var(--border-subtle)/0.72)] px-4 py-3">
                    <Button
                      onClick={handleAdd}
                      className={cn(primaryButtonClass, 'h-9 px-6 text-[12.5px] font-semibold', useOAuthFlow && 'hidden')}
                      disabled={!selectedType || saving || (showModelIdField && modelId.trim().length === 0)}
                    >
                      {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      {t('aiProviders.dialog.add')}
                    </Button>
                  </div>
                  </>
                ) : (
                  <div className="flex h-full items-center justify-center px-6 text-center text-[12.5px] text-muted-foreground">
                    {t('aiProviders.dialog.desc')}
                  </div>
                )}
              </section>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
