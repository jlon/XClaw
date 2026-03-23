import { useEffect, useRef, useState } from 'react';
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
import { Separator } from '@/components/ui/separator';
import { invokeIpc } from '@/lib/api-client';
import { hostApiFetch } from '@/lib/host-api';
import { subscribeHostEvent } from '@/lib/host-events';
import {
  PROVIDER_TYPE_INFO,
  getProviderDocsUrl,
  getProviderIconUrl,
  getProviderTypeInfo,
  resolveProviderModelForSave,
  shouldInvertInDark,
  shouldShowProviderModelId,
  type ProviderType,
} from '@/lib/providers';
import { useProviderStore, type ProviderAccount, type ProviderVendorInfo } from '@/stores/providers';
import { cn } from '@/lib/utils';
import { getProtocolBaseUrlPlaceholder } from './ProviderAccountFormSections';
import type { AddProviderDialogOptions } from './provider-account-create';

const inputClasses = 'h-9 rounded-[10px] border border-border/70 bg-[hsl(var(--surface-panel)/0.96)] text-[13px] text-foreground placeholder:text-muted-foreground/55 shadow-none transition-colors focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20';
const tokenInputClasses = `${inputClasses} font-mono tracking-[0.01em]`;
const labelClasses = 'text-[13px] font-semibold text-foreground/80';
const modalSurfaceClasses = 'app-modal-surface w-full rounded-[14px] border border-border/65 bg-[hsl(var(--surface-elevated)/0.99)]';
const primaryButtonClass = 'rounded-[10px] h-8 px-4 bg-primary text-primary-foreground shadow-none hover:bg-primary/90';
const segmentedTrackClass = 'flex rounded-[10px] border border-border/60 bg-[hsl(var(--surface-base)/0.96)] p-0.5 gap-0.5';
const segmentedActiveClass = 'bg-[hsl(var(--surface-elevated)/0.98)] text-foreground shadow-none ring-1 ring-border/50';
const segmentedIdleClass = 'text-muted-foreground/82 hover:bg-[hsl(var(--foreground)/0.035)]';
const listRowClass = 'flex w-full items-center gap-3 rounded-[11px] border border-transparent px-3 py-2 text-left transition-colors hover:border-border/50 hover:bg-[hsl(var(--foreground)/0.035)]';
const listRowMetaClass = 'mt-0.5 truncate text-[11px] text-muted-foreground/72';
const panelSurfaceClass = 'app-pane-surface rounded-[12px] border border-border/60 bg-[hsl(var(--surface-panel)/0.95)]';

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
  const { t, i18n } = useTranslation('settings');
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
  const providerDocsUrl = getProviderDocsUrl(typeInfo, i18n.language);
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

  return (
    <div className="app-modal-overlay fixed inset-0 z-50 flex items-center justify-center p-4" data-testid="provider-add-dialog">
      <Card className={cn(modalSurfaceClasses, 'max-h-[90vh] max-w-[36rem] flex flex-col overflow-hidden')}>
        <CardHeader className="relative shrink-0 pb-3">
          <CardTitle className="text-[15px] font-semibold tracking-tight text-foreground">{t('aiProviders.dialog.title')}</CardTitle>
          <CardDescription className="mt-1 text-[11.5px] text-foreground/66">
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
        <CardContent className="flex-1 overflow-y-auto p-4">
          {!selectedType ? (
            <div className="space-y-1.5">
              {availableTypes.map((type) => (
                <button
                  key={type.id}
                  onClick={() => {
                    setSelectedType(type.id);
                    setName(type.id === 'custom' ? t('aiProviders.custom') : type.name);
                    setBaseUrl(type.defaultBaseUrl || '');
                    setModelId(type.defaultModelId || '');
                  }}
                  className={listRowClass}
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] border border-border/60 bg-[hsl(var(--surface-base)/0.96)]">
                    {getProviderIconUrl(type.id) ? (
                      <img src={getProviderIconUrl(type.id)} alt={type.name} className={cn('h-[18px] w-[18px]', shouldInvertInDark(type.id) && 'dark:invert')} />
                    ) : (
                      <span className="text-lg">{type.icon}</span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-medium text-[13px] text-foreground">{type.id === 'custom' ? t('aiProviders.custom') : type.name}</p>
                    <p className={listRowMetaClass}>{type.id}</p>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="space-y-5">
              <div className={panelSurfaceClass + ' flex items-center gap-2.5 p-3'}>
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] border border-border/55 bg-[hsl(var(--surface-base)/0.96)]">
                  {getProviderIconUrl(selectedType) ? (
                    <img src={getProviderIconUrl(selectedType)} alt={typeInfo?.name} className={cn('h-[18px] w-[18px]', shouldInvertInDark(selectedType) && 'dark:invert')} />
                  ) : (
                    <span className="text-lg">{typeInfo?.icon}</span>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="truncate font-semibold text-[14px]">{typeInfo?.id === 'custom' ? t('aiProviders.custom') : typeInfo?.name}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-[12px] font-medium">
                    <button
                      onClick={() => {
                        setSelectedType(null);
                        setValidationError(null);
                        setBaseUrl('');
                        setModelId('');
                      }}
                      className="text-primary hover:text-primary/80"
                    >
                      {t('aiProviders.dialog.change')}
                    </button>
                    {providerDocsUrl ? (
                      <a
                        href={providerDocsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-primary hover:text-primary/80"
                      >
                        {t('aiProviders.dialog.customDoc')}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="space-y-4 bg-transparent p-0">
                <div className="space-y-2.5">
                  <Label htmlFor="name" className={labelClasses}>{t('aiProviders.dialog.displayName')}</Label>
                  <Input
                    id="name"
                    placeholder={typeInfo?.id === 'custom' ? t('aiProviders.custom') : typeInfo?.name}
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    className={inputClasses}
                  />
                </div>

                {isOAuth && supportsApiKey ? (
                  <div className={cn(segmentedTrackClass, 'overflow-hidden text-[12px] font-medium')}>
                    <button
                      onClick={() => setAuthMode('oauth')}
                      className={cn('flex-1 rounded-[8px] px-3 py-2 transition-colors', authMode === 'oauth' ? segmentedActiveClass : segmentedIdleClass)}
                    >
                      {t('aiProviders.oauth.loginMode')}
                    </button>
                    <button
                      onClick={() => setAuthMode('apikey')}
                      className={cn('flex-1 rounded-[8px] px-3 py-2 transition-colors', authMode === 'apikey' ? segmentedActiveClass : segmentedIdleClass)}
                    >
                      {t('aiProviders.oauth.apikeyMode')}
                    </button>
                  </div>
                ) : null}

                {!isOAuth || (supportsApiKey && authMode === 'apikey') ? (
                  <div className={panelSurfaceClass + ' space-y-2.5 p-3'}>
                    <div className="flex items-center justify-between">
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
                      <p className="text-[13px] text-red-500 font-medium">{validationError}</p>
                    ) : null}
                    <p className="text-[12px] text-muted-foreground">{t('aiProviders.dialog.apiKeyStored')}</p>
                  </div>
                ) : null}

                {typeInfo?.showBaseUrl ? (
                  <div className={panelSurfaceClass + ' space-y-2.5 p-3'}>
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
                  <div className={panelSurfaceClass + ' space-y-2.5 p-3'}>
                    <Label htmlFor="modelId" className={labelClasses}>{t('aiProviders.dialog.modelId')}</Label>
                    <Input
                      id="modelId"
                      placeholder={typeInfo?.modelIdPlaceholder || 'provider/model-id'}
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
                  <div className={panelSurfaceClass + ' space-y-2.5 p-3'}>
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

                {useOAuthFlow ? (
                  <div className="space-y-4 pt-1.5">
                    <div className={panelSurfaceClass + ' p-4 text-left'}>
                      <p className="mb-3 block text-[12px] font-medium text-foreground/70">
                        {t('aiProviders.oauth.loginPrompt')}
                      </p>
                      <Button
                        onClick={handleStartOAuth}
                        disabled={oauthFlowing}
                        className="h-9 w-full rounded-[10px] font-semibold"
                      >
                        {oauthFlowing ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            {t('aiProviders.oauth.waiting')}
                          </>
                        ) : t('aiProviders.oauth.loginButton')}
                      </Button>
                    </div>

                    {oauthFlowing ? (
                      <div className={panelSurfaceClass + ' relative mt-3.5 overflow-hidden p-4'}>
                        <div className="relative z-10 flex flex-col items-center justify-center space-y-5 text-center">
                          {oauthError ? (
                            <div className="space-y-3 text-red-500">
                              <XCircle className="h-10 w-10 mx-auto" />
                              <p className="font-semibold text-[14px]">{t('aiProviders.oauth.authFailed')}</p>
                              <p className="text-[12.5px] opacity-80">{oauthError}</p>
                              <Button variant="outline" size="sm" onClick={handleCancelOAuth} className="mt-2 h-8 rounded-[10px] px-5">
                                Try Again
                              </Button>
                            </div>
                          ) : !oauthData ? (
                            <div className="space-y-4 py-6">
                              <Loader2 className="mx-auto h-10 w-10 animate-spin text-primary" />
                              <p className="text-[12.5px] font-medium text-muted-foreground animate-pulse">{t('aiProviders.oauth.requestingCode')}</p>
                            </div>
                          ) : oauthData.mode === 'manual' ? (
                            <div className="w-full space-y-4">
                              <div className="space-y-2">
                                <h3 className="font-semibold text-[14px] text-foreground">Complete OpenAI Login</h3>
                                <p className="rounded-[11px] bg-[hsl(var(--foreground)/0.03)] p-3 text-left text-[12px] text-muted-foreground/84">
                                  {oauthData.message || 'Open the authorization page, complete login, then paste the callback URL or code below.'}
                                </p>
                              </div>
                              <Button
                                variant="secondary"
                                className="h-9 w-full rounded-[10px] font-semibold"
                                onClick={() => invokeIpc('shell:openExternal', oauthData.authorizationUrl)}
                              >
                                <ExternalLink className="h-4 w-4 mr-2" />
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
                            <div className="w-full space-y-4.5">
                              <div className="space-y-2">
                                <h3 className="font-semibold text-[14px] text-foreground">{t('aiProviders.oauth.approveLogin')}</h3>
                                <div className="mt-2 space-y-1.5 rounded-[11px] bg-[hsl(var(--foreground)/0.03)] p-3 text-left text-[12px] text-muted-foreground/84">
                                  <p>1. {t('aiProviders.oauth.step1')}</p>
                                  <p>2. {t('aiProviders.oauth.step2')}</p>
                                  <p>3. {t('aiProviders.oauth.step3')}</p>
                                </div>
                              </div>

                              <div className={panelSurfaceClass + ' flex items-center justify-center gap-3 px-3.5 py-3'}>
                                <code className="text-[26px] font-mono tracking-[0.16em] font-bold text-foreground">
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
                                <ExternalLink className="h-4 w-4 mr-2" />
                                {t('aiProviders.oauth.openLoginPage')}
                              </Button>

                              <div className="flex items-center justify-center gap-2 pt-2 text-[12.5px] font-medium text-muted-foreground">
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
                    ) : null}
                  </div>
                ) : null}
              </div>

              <Separator className="bg-border/60" />

              <div className="flex justify-end gap-3">
                <Button
                  onClick={handleAdd}
                  className={cn(primaryButtonClass, 'h-9 px-6 text-[12.5px] font-semibold', useOAuthFlow && 'hidden')}
                  disabled={!selectedType || saving || (showModelIdField && modelId.trim().length === 0)}
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  {t('aiProviders.dialog.add')}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
