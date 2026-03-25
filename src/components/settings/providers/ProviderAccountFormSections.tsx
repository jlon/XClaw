/* eslint-disable react-refresh/only-export-components */
import { useEffect, useState } from 'react';
import { Check, ChevronDown, ExternalLink, Eye, EyeOff, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  getProviderTypeInfo,
  resolveProviderApiKeyForSave,
  shouldShowProviderModelId,
  type ProviderAccount,
} from '@/lib/providers';
import { hasConfiguredCredentials, type ProviderListItem } from '@/lib/provider-accounts';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

export interface ProviderAccountFormSavePayload {
  newApiKey?: string;
  updates?: Partial<ProviderAccount>;
}

export type ProviderAccountValidateFn = (
  key: string,
  options?: { baseUrl?: string; apiProtocol?: ProviderAccount['apiProtocol'] }
) => Promise<{ valid: boolean; error?: string }>;

export function normalizeFallbackProviderIds(ids?: string[]): string[] {
  return Array.from(new Set((ids ?? []).filter(Boolean)));
}

export function fallbackProviderIdsEqual(a?: string[], b?: string[]): boolean {
  const left = normalizeFallbackProviderIds(a).sort();
  const right = normalizeFallbackProviderIds(b).sort();
  return left.length === right.length && left.every((id, index) => id === right[index]);
}

export function normalizeFallbackModels(models?: string[]): string[] {
  return Array.from(new Set((models ?? []).map((model) => model.trim()).filter(Boolean)));
}

export function fallbackModelsEqual(a?: string[], b?: string[]): boolean {
  const left = normalizeFallbackModels(a);
  const right = normalizeFallbackModels(b);
  return left.length === right.length && left.every((model, index) => model === right[index]);
}

export function getAuthModeLabel(
  authMode: ProviderAccount['authMode'],
  t: (key: string) => string
): string {
  switch (authMode) {
    case 'api_key':
      return t('aiProviders.authModes.apiKey');
    case 'oauth_device':
      return t('aiProviders.authModes.oauthDevice');
    case 'oauth_browser':
      return t('aiProviders.authModes.oauthBrowser');
    case 'local':
      return t('aiProviders.authModes.local');
    default:
      return authMode;
  }
}

interface ProviderAccountFormSectionsProps {
  mode: 'edit' | 'view';
  item: ProviderListItem;
  allProviders: ProviderListItem[];
  devModeUnlocked: boolean;
  density?: 'default' | 'compact';
  footerTestId?: string;
  onSave: (payload: ProviderAccountFormSavePayload) => Promise<void>;
  onCancel: () => void;
  onValidateKey: ProviderAccountValidateFn;
}

const inputClasses = 'appearance-none app-field-surface h-8 rounded-md border border-[hsl(var(--border-subtle)/0.82)] text-[13px] text-foreground placeholder:text-muted-foreground/55 shadow-sm transition-colors focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-0';
const tokenInputClasses = `${inputClasses} font-mono tracking-[0.01em]`;
const sectionTitleClass = 'text-[13px] font-semibold text-foreground';
const labelClasses = 'text-[13px] font-semibold text-foreground/80';
const segmentedTrackClass = 'app-field-surface grid grid-cols-3 gap-1 rounded-md border border-[hsl(var(--border-subtle)/0.82)] p-1';
const segmentedActiveClass = 'border border-[hsl(var(--primary)/0.18)] bg-[hsl(var(--primary)/0.08)] text-primary shadow-none outline-none focus-visible:outline-none focus-visible:ring-0';
const segmentedIdleClass = 'border border-transparent text-muted-foreground/82 outline-none hover:bg-[hsl(var(--foreground)/0.035)] hover:text-foreground focus-visible:outline-none focus-visible:ring-0';

export function getProtocolBaseUrlPlaceholder(apiProtocol: ProviderAccount['apiProtocol']): string {
  if (apiProtocol === 'anthropic-messages') {
    return 'https://api.example.com/anthropic';
  }
  return 'https://api.example.com/v1';
}

export function ProviderAccountFormSections({
  mode,
  item,
  allProviders,
  devModeUnlocked,
  density = 'default',
  footerTestId,
  onSave,
  onCancel,
  onValidateKey,
}: ProviderAccountFormSectionsProps) {
  const { t } = useTranslation('settings');
  const { account, status } = item;
  const [label, setLabel] = useState(account.label);
  const [newKey, setNewKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [baseUrl, setBaseUrl] = useState(account.baseUrl || '');
  const [apiProtocol, setApiProtocol] = useState<ProviderAccount['apiProtocol']>(account.apiProtocol || 'openai-completions');
  const [modelId, setModelId] = useState(account.model || '');
  const [fallbackModelsText, setFallbackModelsText] = useState(normalizeFallbackModels(account.fallbackModels).join('\n'));
  const [fallbackProviderIds, setFallbackProviderIds] = useState<string[]>(normalizeFallbackProviderIds(account.fallbackAccountIds));
  const [showFallback, setShowFallback] = useState(false);
  const [validating, setValidating] = useState(false);
  const [saving, setSaving] = useState(false);
  const typeInfo = getProviderTypeInfo(account.vendorId);
  const showModelIdField = shouldShowProviderModelId(typeInfo, devModeUnlocked);
  const canEditModelConfig = Boolean(typeInfo?.showBaseUrl || showModelIdField);
  const fallbackOptions = allProviders.filter((candidate) => candidate.account.id !== account.id);
  const compact = density === 'compact';
  const rootClass = compact
    ? 'grid auto-rows-min gap-2.5 md:grid-cols-2 md:items-start'
    : 'space-y-4 border-t border-border/55 pt-3.5';
  const sectionClass = compact ? 'space-y-2' : 'space-y-3';
  const connectionFieldsClass = compact ? 'grid gap-2.5 md:grid-cols-2' : 'space-y-3';
  const fallbackContentClass = compact ? 'grid gap-2.5 pt-2.5 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]' : 'space-y-3 pt-2';
  const credentialsMetaClass = compact ? 'flex flex-wrap items-start justify-between gap-3' : 'flex items-center justify-between gap-3';
  const compactSectionSurfaceClass = compact
    ? 'app-insight-surface rounded-[12px] border border-[hsl(var(--border-subtle)/0.78)] px-3 py-2.5'
    : '';
  const setupSectionClass = compact
    ? 'app-insight-surface space-y-2.5 rounded-lg border border-[hsl(var(--border-subtle)/0.78)] px-3 py-2.5 md:col-span-2'
    : '';

  useEffect(() => {
    setLabel(account.label);
    setNewKey('');
    setShowKey(false);
    setBaseUrl(account.baseUrl || '');
    setApiProtocol(account.apiProtocol || 'openai-completions');
    setModelId(account.model || '');
    setFallbackModelsText(normalizeFallbackModels(account.fallbackModels).join('\n'));
    setFallbackProviderIds(normalizeFallbackProviderIds(account.fallbackAccountIds));
  }, [account.apiProtocol, account.baseUrl, account.fallbackAccountIds, account.fallbackModels, account.label, account.model]);

  if (mode !== 'edit') {
    return null;
  }

  const toggleFallbackProvider = (providerId: string) => {
    setFallbackProviderIds((current) => (
      current.includes(providerId)
        ? current.filter((id) => id !== providerId)
        : [...current, providerId]
    ));
  };

  const fallbackSummary = (() => {
    const modelCount = normalizeFallbackModels(fallbackModelsText.split('\n')).length;
    const providerCount = fallbackProviderIds.length;
    if (modelCount === 0 && providerCount === 0) {
      return t('aiProviders.dialog.noFallbackSummary', '无回退配置');
    }
    return t('aiProviders.dialog.fallbackSummary', {
      models: modelCount,
      providers: providerCount,
      defaultValue: `${modelCount} 个模型 · ${providerCount} 个提供商`,
    });
  })();

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload: ProviderAccountFormSavePayload = {};
      const normalizedFallbackModels = normalizeFallbackModels(fallbackModelsText.split('\n'));

      if (newKey.trim()) {
        setValidating(true);
        const result = await onValidateKey(newKey, {
          baseUrl: baseUrl.trim() || undefined,
          apiProtocol: (account.vendorId === 'custom' || account.vendorId === 'ollama') ? apiProtocol : undefined,
        });
        setValidating(false);
        if (!result.valid) {
          toast.error(result.error || t('aiProviders.toast.invalidKey'));
          setSaving(false);
          return;
        }
        payload.newApiKey = newKey.trim();
      }

      if (showModelIdField && !modelId.trim()) {
        toast.error(t('aiProviders.toast.modelRequired'));
        setSaving(false);
        return;
      }

      const updates: Partial<ProviderAccount> = {};
      if ((label.trim() || account.label) !== account.label) {
        updates.label = label.trim() || account.label;
      }
      if (typeInfo?.showBaseUrl && (baseUrl.trim() || undefined) !== (account.baseUrl || undefined)) {
        updates.baseUrl = baseUrl.trim() || undefined;
      }
      if ((account.vendorId === 'custom' || account.vendorId === 'ollama') && apiProtocol !== account.apiProtocol) {
        updates.apiProtocol = apiProtocol;
      }
      if (showModelIdField && (modelId.trim() || undefined) !== (account.model || undefined)) {
        updates.model = modelId.trim() || undefined;
      }
      if (!fallbackModelsEqual(normalizedFallbackModels, account.fallbackModels)) {
        updates.fallbackModels = normalizedFallbackModels;
      }
      if (!fallbackProviderIdsEqual(fallbackProviderIds, account.fallbackAccountIds)) {
        updates.fallbackAccountIds = normalizeFallbackProviderIds(fallbackProviderIds);
      }
      if (Object.keys(updates).length > 0) {
        payload.updates = updates;
      }

      if (account.vendorId === 'ollama' && !status?.hasKey && !payload.newApiKey) {
        payload.newApiKey = resolveProviderApiKeyForSave(account.vendorId, '') as string;
      }

      if (!payload.newApiKey && !payload.updates) {
        onCancel();
        setSaving(false);
        return;
      }

      await onSave(payload);
      setNewKey('');
      toast.success(t('aiProviders.toast.updated'));
    } catch (error) {
      toast.error(`${t('aiProviders.toast.failedUpdate')}: ${error}`);
    } finally {
      setSaving(false);
      setValidating(false);
    }
  };

  return (
    <div className={rootClass} data-testid="provider-account-form-sections" data-mode={mode} data-density={density}>
      {compact ? (
        <section className={setupSectionClass}>
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-0.5">
              <h3 className={sectionTitleClass}>{t('aiProviders.sections.setup', '基础与接入')}</h3>
              <p className="text-[12px] text-muted-foreground">
                {[
                  label.trim() || account.label,
                  baseUrl.trim() || account.baseUrl || null,
                  modelId.trim() || account.model || null,
                ].filter(Boolean).join(' · ')}
              </p>
            </div>
          </div>
          <div className="grid gap-2.5 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor={`provider-display-name-${account.id}`} className={labelClasses}>{t('aiProviders.dialog.displayName')}</Label>
              <Input
                id={`provider-display-name-${account.id}`}
                value={label}
                onChange={(event) => setLabel(event.target.value)}
                placeholder={typeInfo?.id === 'custom' ? t('aiProviders.custom') : typeInfo?.name}
                className={inputClasses}
              />
            </div>
            {typeInfo?.showBaseUrl ? (
              <div className="space-y-1.5">
                <Label htmlFor={`provider-base-url-${account.id}`} className={labelClasses}>{t('aiProviders.dialog.baseUrl')}</Label>
                <Input
                  id={`provider-base-url-${account.id}`}
                  value={baseUrl}
                  onChange={(event) => setBaseUrl(event.target.value)}
                  placeholder={getProtocolBaseUrlPlaceholder(apiProtocol)}
                  className={inputClasses}
                />
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label htmlFor={`provider-display-name-${account.id}-meta`} className={labelClasses}>{t('aiProviders.sections.connection', '接入配置')}</Label>
                <div id={`provider-display-name-${account.id}-meta`} className="app-field-surface flex h-8 items-center rounded-md px-3 text-[12px] text-muted-foreground">
                  {t('aiProviders.overview.noModelSelected', '未选择模型')}
                </div>
              </div>
            )}
            {showModelIdField ? (
              <div className="space-y-1.5">
                <Label htmlFor={`provider-model-id-${account.id}`} className={labelClasses}>{t('aiProviders.dialog.modelId')}</Label>
                <Input
                  id={`provider-model-id-${account.id}`}
                  value={modelId}
                  onChange={(event) => setModelId(event.target.value)}
                  placeholder={typeInfo?.modelIdPlaceholder || 'provider/model-id'}
                  className={inputClasses}
                />
              </div>
            ) : null}
            {account.vendorId === 'custom' ? (
              <div className="space-y-1.5 md:col-span-2">
                <Label className={labelClasses}>{t('aiProviders.dialog.protocol', 'Protocol')}</Label>
                <div className={`${segmentedTrackClass} text-[12px]`}>
                  <button
                    type="button"
                    onClick={() => setApiProtocol('openai-completions')}
                    className={cn('min-w-0 rounded-sm px-3 py-2 text-center leading-[1.25] transition-colors', apiProtocol === 'openai-completions' ? segmentedActiveClass : segmentedIdleClass)}
                  >
                    {t('aiProviders.protocols.openaiCompletions', 'OpenAI Completions')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setApiProtocol('openai-responses')}
                    className={cn('min-w-0 rounded-sm px-3 py-2 text-center leading-[1.25] transition-colors', apiProtocol === 'openai-responses' ? segmentedActiveClass : segmentedIdleClass)}
                  >
                    {t('aiProviders.protocols.openaiResponses', 'OpenAI Responses')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setApiProtocol('anthropic-messages')}
                    className={cn('min-w-0 rounded-sm px-3 py-2 text-center leading-[1.25] transition-colors', apiProtocol === 'anthropic-messages' ? segmentedActiveClass : segmentedIdleClass)}
                  >
                    {t('aiProviders.protocols.anthropic', 'Anthropic')}
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </section>
      ) : (
        <>
          <section className={cn(sectionClass, compactSectionSurfaceClass)}>
            <h3 className={sectionTitleClass}>{t('aiProviders.sections.basic', '基础信息')}</h3>
            <div className="space-y-1.5">
              <Label htmlFor={`provider-display-name-${account.id}`} className={labelClasses}>{t('aiProviders.dialog.displayName')}</Label>
              <Input
                id={`provider-display-name-${account.id}`}
                value={label}
                onChange={(event) => setLabel(event.target.value)}
                placeholder={typeInfo?.id === 'custom' ? t('aiProviders.custom') : typeInfo?.name}
                className={inputClasses}
              />
            </div>
          </section>

          <section className={cn(sectionClass, compactSectionSurfaceClass)}>
            <h3 className={sectionTitleClass}>{t('aiProviders.sections.connection', '接入配置')}</h3>
            {canEditModelConfig ? (
              <div className={connectionFieldsClass}>
                {typeInfo?.showBaseUrl ? (
                  <div className="space-y-1.5">
                    <Label htmlFor={`provider-base-url-${account.id}`} className={labelClasses}>{t('aiProviders.dialog.baseUrl')}</Label>
                    <Input
                      id={`provider-base-url-${account.id}`}
                      value={baseUrl}
                      onChange={(event) => setBaseUrl(event.target.value)}
                      placeholder={getProtocolBaseUrlPlaceholder(apiProtocol)}
                      className={inputClasses}
                    />
                  </div>
                ) : null}
                {showModelIdField ? (
                  <div className="space-y-1.5">
                    <Label htmlFor={`provider-model-id-${account.id}`} className={labelClasses}>{t('aiProviders.dialog.modelId')}</Label>
                    <Input
                      id={`provider-model-id-${account.id}`}
                      value={modelId}
                      onChange={(event) => setModelId(event.target.value)}
                      placeholder={typeInfo?.modelIdPlaceholder || 'provider/model-id'}
                      className={inputClasses}
                    />
                  </div>
                ) : null}
                {account.vendorId === 'custom' ? (
                  <div className={cn('space-y-1.5', compact && 'md:col-span-2')}>
                    <Label className={labelClasses}>{t('aiProviders.dialog.protocol', 'Protocol')}</Label>
                    <div className={`${segmentedTrackClass} text-[12px]`}>
                      <button
                        type="button"
                        onClick={() => setApiProtocol('openai-completions')}
                        className={cn('min-w-0 rounded-sm px-3 py-2 text-center leading-[1.25] transition-colors', apiProtocol === 'openai-completions' ? segmentedActiveClass : segmentedIdleClass)}
                      >
                        {t('aiProviders.protocols.openaiCompletions', 'OpenAI Completions')}
                      </button>
                      <button
                        type="button"
                        onClick={() => setApiProtocol('openai-responses')}
                        className={cn('min-w-0 rounded-sm px-3 py-2 text-center leading-[1.25] transition-colors', apiProtocol === 'openai-responses' ? segmentedActiveClass : segmentedIdleClass)}
                      >
                        {t('aiProviders.protocols.openaiResponses', 'OpenAI Responses')}
                      </button>
                      <button
                        type="button"
                        onClick={() => setApiProtocol('anthropic-messages')}
                        className={cn('min-w-0 rounded-sm px-3 py-2 text-center leading-[1.25] transition-colors', apiProtocol === 'anthropic-messages' ? segmentedActiveClass : segmentedIdleClass)}
                      >
                        {t('aiProviders.protocols.anthropic', 'Anthropic')}
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : (
              <p className="text-[12px] text-muted-foreground">
                {[
                  account.baseUrl || null,
                  account.model || null,
                  account.apiProtocol || null,
                ].filter(Boolean).join(' · ') || t('aiProviders.overview.noModelSelected', '未选择模型')}
              </p>
            )}
          </section>
        </>
      )}

      <section className={cn(sectionClass, compactSectionSurfaceClass, compact && 'md:col-span-2')}>
        <button
          type="button"
          onClick={() => setShowFallback((current) => !current)}
          className="flex w-full items-center justify-between gap-3 rounded-md text-left transition-colors hover:text-foreground"
        >
          <div className="min-w-0 space-y-0.5">
            <h3 className={sectionTitleClass}>{t('aiProviders.sections.fallbackStrategy', '回退策略')}</h3>
            <p className="truncate text-[12px] text-muted-foreground">{fallbackSummary}</p>
          </div>
          <span className="app-field-surface flex h-7 w-7 shrink-0 items-center justify-center rounded-md">
            <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform', showFallback && 'rotate-180')} />
          </span>
        </button>
        {showFallback ? (
          <div className={fallbackContentClass}>
            <div className="space-y-1.5">
              <Label htmlFor={`provider-fallback-models-${account.id}`} className={labelClasses}>{t('aiProviders.dialog.fallbackModelIds')}</Label>
              <Textarea
                id={`provider-fallback-models-${account.id}`}
                value={fallbackModelsText}
                onChange={(event) => setFallbackModelsText(event.target.value)}
                placeholder={t('aiProviders.dialog.fallbackModelIdsPlaceholder')}
                className={cn(
                  'app-field-surface rounded-md border-[hsl(var(--border-subtle)/0.82)] text-[13px] font-mono text-foreground shadow-sm',
                  compact ? 'min-h-[104px]' : 'min-h-24',
                )}
              />
              <p className="text-[12px] text-muted-foreground">
                {t('aiProviders.dialog.fallbackModelIdsHelp')}
              </p>
            </div>
            <div className="space-y-2 pt-1">
              <Label className={labelClasses}>{t('aiProviders.dialog.fallbackProviders')}</Label>
              {fallbackOptions.length === 0 ? (
                <p className="text-[13px] text-muted-foreground">{t('aiProviders.dialog.noFallbackOptions')}</p>
              ) : (
                <div className="app-field-surface space-y-1 rounded-md border border-[hsl(var(--border-subtle)/0.82)] p-1.5 shadow-sm">
                  {fallbackOptions.map((candidate) => (
                    <button
                      key={candidate.account.id}
                      type="button"
                      onClick={() => toggleFallbackProvider(candidate.account.id)}
                      className={cn(
                        'flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-left text-[12px] transition-colors',
                        fallbackProviderIds.includes(candidate.account.id)
                          ? 'bg-[hsl(var(--foreground)/0.055)] text-foreground'
                          : 'text-foreground/88 hover:bg-[hsl(var(--foreground)/0.035)]',
                      )}
                    >
                      <span
                        className={cn(
                          'flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border text-transparent transition-colors',
                          fallbackProviderIds.includes(candidate.account.id)
                            ? 'border-foreground/20 bg-[hsl(var(--foreground)/0.08)] text-foreground'
                            : 'border-border/70 bg-transparent',
                        )}
                      >
                        <Check className="h-3 w-3" />
                      </span>
                      <span className="min-w-0 flex-1 truncate font-medium">{candidate.account.label}</span>
                      <span className="truncate text-[12px] text-muted-foreground">
                        {candidate.account.model || candidate.vendor?.name || candidate.account.vendorId}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : null}
      </section>

      <section className={cn(sectionClass, compactSectionSurfaceClass, compact && 'md:col-span-2')}>
        <div className={credentialsMetaClass}>
          <div className="space-y-0.5">
            <h3 className={sectionTitleClass}>{t('aiProviders.sections.credentials', '凭证与验证')}</h3>
            <p className="text-[12px] text-muted-foreground">
              {hasConfiguredCredentials(account, status)
                ? t('aiProviders.dialog.apiKeyConfigured')
                : t('aiProviders.dialog.apiKeyMissing')}
            </p>
          </div>
          {hasConfiguredCredentials(account, status) ? (
            <div className="flex items-center gap-1.5 rounded-md border border-[hsl(var(--success))/0.18] bg-[hsl(var(--success))/0.08] px-2 py-1 text-[11px] font-medium text-[hsl(var(--success))]">
              <div className="h-1.5 w-1.5 rounded-sm bg-current" />
              {t('aiProviders.card.configured')}
            </div>
          ) : null}
        </div>
        {typeInfo?.apiKeyUrl ? (
          <div className="flex justify-start">
            <a
              href={typeInfo.apiKeyUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-[13px] text-primary hover:text-primary/80 hover:underline"
              tabIndex={-1}
            >
              {t('aiProviders.oauth.getApiKey')} <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        ) : null}
        <div className="space-y-1.5 pt-1" data-testid={footerTestId}>
          <Label htmlFor={`provider-api-key-${account.id}`} className={labelClasses}>{t('aiProviders.dialog.apiKey', 'API Key')}</Label>
          <div className={cn('flex gap-2', compact && 'items-start')}>
            <div className="relative flex-1">
              <Input
                id={`provider-api-key-${account.id}`}
                type={showKey ? 'text' : 'password'}
                placeholder={typeInfo?.requiresApiKey ? typeInfo.placeholder : (typeInfo?.id === 'ollama' ? t('aiProviders.notRequired') : t('aiProviders.card.editKey'))}
                value={newKey}
                onChange={(event) => setNewKey(event.target.value)}
                className={cn(tokenInputClasses, 'pr-10')}
                aria-label={t('aiProviders.dialog.apiKey')}
              />
              <button
                type="button"
                onClick={() => setShowKey((current) => !current)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label={showKey ? t('aiProviders.dialog.hideApiKey', '隐藏 API Key') : t('aiProviders.dialog.showApiKey', '显示 API Key')}
              >
                {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={handleSave}
              data-testid="provider-account-form-save"
              className={cn(
                'rounded-md border-border/70 px-4 shadow-sm hover:bg-[hsl(var(--surface-hover)/0.9)]',
                compact ? 'h-9' : 'h-[40px]',
              )}
              disabled={
                validating
                || saving
                || (
                  !newKey.trim()
                  && (label.trim() || account.label) === account.label
                  && (baseUrl.trim() || undefined) === (account.baseUrl || undefined)
                  && (modelId.trim() || undefined) === (account.model || undefined)
                  && fallbackModelsEqual(normalizeFallbackModels(fallbackModelsText.split('\n')), account.fallbackModels)
                  && fallbackProviderIdsEqual(fallbackProviderIds, account.fallbackAccountIds)
                )
                || Boolean(showModelIdField && !modelId.trim())
              }
            >
              {validating || saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4 text-green-500" />}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={onCancel}
              data-testid="provider-account-form-cancel"
              className={cn(
                'rounded-md border border-border/70 p-0 text-muted-foreground shadow-sm hover:bg-[hsl(var(--surface-hover)/0.9)] hover:text-foreground',
                compact ? 'h-9 w-9' : 'h-[40px] w-[40px]',
              )}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-[12px] text-muted-foreground">
            {t('aiProviders.dialog.replaceApiKeyHelp')}
          </p>
        </div>
      </section>
    </div>
  );
}
