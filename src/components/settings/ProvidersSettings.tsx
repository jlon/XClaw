/**
 * Providers Settings Component
 * Manage AI provider configurations and API keys
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  Plus,
  Trash2,
  Edit,
  Eye,
  EyeOff,
  Check,
  X,
  Loader2,
  Key,
  ExternalLink,
  Copy,
  XCircle,
  ChevronDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  useProviderStore,
  type ProviderAccount,
  type ProviderVendorInfo,
} from '@/stores/providers';
import {
  PROVIDER_TYPE_INFO,
  getProviderDocsUrl,
  type ProviderType,
  getProviderIconUrl,
  resolveProviderApiKeyForSave,
  resolveProviderModelForSave,
  shouldShowProviderModelId,
  shouldInvertInDark,
} from '@/lib/providers';
import {
  buildProviderAccountId,
  buildProviderListItems,
  hasConfiguredCredentials,
  type ProviderListItem,
} from '@/lib/provider-accounts';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { invokeIpc } from '@/lib/api-client';
import { useSettingsStore } from '@/stores/settings';
import { hostApiFetch } from '@/lib/host-api';
import { subscribeHostEvent } from '@/lib/host-events';

const inputClasses = 'h-9 rounded-[10px] border border-border/70 bg-[hsl(var(--surface-panel)/0.9)] text-[13px] text-foreground placeholder:text-muted-foreground/55 shadow-none transition-colors focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20';
const tokenInputClasses = `${inputClasses} font-mono tracking-[0.01em]`;
const labelClasses = 'text-[13px] font-semibold text-foreground/80';
const modalSurfaceClasses = 'app-modal-surface w-full rounded-[12px]';
const primaryButtonClass = 'rounded-[10px] h-8 px-4 bg-primary text-primary-foreground shadow-none hover:bg-primary/90';
const segmentedTrackClass = 'flex rounded-[9px] border border-border/55 bg-[hsl(var(--surface-base)/0.96)] p-0.5 gap-0.5';
const segmentedActiveClass = 'bg-[hsl(var(--surface-elevated)/0.98)] text-foreground shadow-none ring-1 ring-border/50';
const segmentedIdleClass = 'text-muted-foreground/82 hover:bg-[hsl(var(--foreground)/0.035)]';

function normalizeFallbackProviderIds(ids?: string[]): string[] {
  return Array.from(new Set((ids ?? []).filter(Boolean)));
}

function getProtocolBaseUrlPlaceholder(
  apiProtocol: ProviderAccount['apiProtocol'],
): string {
  if (apiProtocol === 'anthropic-messages') {
    return 'https://api.example.com/anthropic';
  }
  return 'https://api.example.com/v1';
}

function fallbackProviderIdsEqual(a?: string[], b?: string[]): boolean {
  const left = normalizeFallbackProviderIds(a).sort();
  const right = normalizeFallbackProviderIds(b).sort();
  return left.length === right.length && left.every((id, index) => id === right[index]);
}

function normalizeFallbackModels(models?: string[]): string[] {
  return Array.from(new Set((models ?? []).map((model) => model.trim()).filter(Boolean)));
}

function fallbackModelsEqual(a?: string[], b?: string[]): boolean {
  const left = normalizeFallbackModels(a);
  const right = normalizeFallbackModels(b);
  return left.length === right.length && left.every((model, index) => model === right[index]);
}

function getAuthModeLabel(
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

export function ProvidersSettings() {
  const { t } = useTranslation('settings');
  const devModeUnlocked = useSettingsStore((state) => state.devModeUnlocked);
  const {
    statuses,
    accounts,
    vendors,
    defaultAccountId,
    loading,
    refreshProviderSnapshot,
    createAccount,
    removeAccount,
    updateAccount,
    setDefaultAccount,
    validateAccountApiKey,
  } = useProviderStore();

  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingProvider, setEditingProvider] = useState<string | null>(null);
  const vendorMap = new Map(vendors.map((vendor) => [vendor.id, vendor]));
  const existingVendorIds = new Set(accounts.map((account) => account.vendorId));
  const displayProviders = useMemo(
    () => buildProviderListItems(accounts, statuses, vendors, defaultAccountId),
    [accounts, statuses, vendors, defaultAccountId],
  );

  // Fetch providers on mount
  useEffect(() => {
    refreshProviderSnapshot();
  }, [refreshProviderSnapshot]);

  const handleAddProvider = async (
    type: ProviderType,
    name: string,
    apiKey: string,
    options?: { baseUrl?: string; model?: string; authMode?: ProviderAccount['authMode']; apiProtocol?: ProviderAccount['apiProtocol'] }
  ) => {
    const vendor = vendorMap.get(type);
    const id = buildProviderAccountId(type, null, vendors);
    const effectiveApiKey = resolveProviderApiKeyForSave(type, apiKey);
    try {
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

      // Auto-set as default if no default is currently configured
      if (!defaultAccountId) {
        await setDefaultAccount(id);
      }

      setShowAddDialog(false);
      toast.success(t('aiProviders.toast.added'));
    } catch (error) {
      toast.error(`${t('aiProviders.toast.failedAdd')}: ${error}`);
    }
  };

  const handleDeleteProvider = async (providerId: string) => {
    try {
      await removeAccount(providerId);
      toast.success(t('aiProviders.toast.deleted'));
    } catch (error) {
      toast.error(`${t('aiProviders.toast.failedDelete')}: ${error}`);
    }
  };

  const handleSetDefault = async (providerId: string) => {
    try {
      await setDefaultAccount(providerId);
      toast.success(t('aiProviders.toast.defaultUpdated'));
    } catch (error) {
      toast.error(`${t('aiProviders.toast.failedDefault')}: ${error}`);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-4">
        <h2 className="text-[22px] font-semibold tracking-tight text-foreground md:text-[24px]">
          {t('aiProviders.title', 'AI Providers')}
        </h2>
        <Button onClick={() => setShowAddDialog(true)} className="h-8 rounded-[10px] px-4 font-medium text-[12px] bg-primary text-primary-foreground shadow-none hover:bg-primary/92">
          <Plus className="h-4 w-4 mr-2" />
          {t('aiProviders.add')}
        </Button>
      </div>

      {loading ? (
        <div className="app-empty-surface flex items-center justify-center rounded-[14px] py-12 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : displayProviders.length === 0 ? (
        <div className="app-empty-surface flex flex-col items-center justify-center rounded-[14px] py-18 text-muted-foreground">
          <Key className="mb-4 h-10 w-10 opacity-45" />
          <h3 className="mb-1 text-[14px] font-medium text-foreground">{t('aiProviders.empty.title')}</h3>
          <p className="mb-6 max-w-sm text-center text-[12.5px]">
            {t('aiProviders.empty.desc')}
          </p>
          <Button onClick={() => setShowAddDialog(true)} className={primaryButtonClass}>
            <Plus className="h-4 w-4 mr-2" />
            {t('aiProviders.empty.cta')}
          </Button>
        </div>
      ) : (
        <div className="space-y-2.5">
          {displayProviders.map((item) => (
            <ProviderCard
              key={item.account.id}
              item={item}
              allProviders={displayProviders}
              isDefault={item.account.id === defaultAccountId}
              isEditing={editingProvider === item.account.id}
              onEdit={() => setEditingProvider(item.account.id)}
              onCancelEdit={() => setEditingProvider(null)}
              onDelete={() => handleDeleteProvider(item.account.id)}
              onSetDefault={() => handleSetDefault(item.account.id)}
              onSaveEdits={async (payload) => {
                await updateAccount(
                  item.account.id,
                  payload.updates ?? {},
                  payload.newApiKey
                );
                setEditingProvider(null);
              }}
              onValidateKey={(key, options) => validateAccountApiKey(item.account.id, key, options)}
              devModeUnlocked={devModeUnlocked}
            />
          ))}
        </div>
      )}

      {/* Add Provider Dialog */}
      {showAddDialog && (
        <AddProviderDialog
          existingVendorIds={existingVendorIds}
          vendors={vendors}
          onClose={() => setShowAddDialog(false)}
          onAdd={handleAddProvider}
          onValidateKey={(type, key, options) => validateAccountApiKey(type, key, options)}
          devModeUnlocked={devModeUnlocked}
        />
      )}
    </div>
  );
}

interface ProviderCardProps {
  item: ProviderListItem;
  allProviders: ProviderListItem[];
  isDefault: boolean;
  isEditing: boolean;
  onEdit: () => void;
  onCancelEdit: () => void;
  onDelete: () => void;
  onSetDefault: () => void;
  onSaveEdits: (payload: { newApiKey?: string; updates?: Partial<ProviderAccount> }) => Promise<void>;
  onValidateKey: (
    key: string,
    options?: { baseUrl?: string; apiProtocol?: ProviderAccount['apiProtocol'] }
  ) => Promise<{ valid: boolean; error?: string }>;
  devModeUnlocked: boolean;
}



function ProviderCard({
  item,
  allProviders,
  isDefault,
  isEditing,
  onEdit,
  onCancelEdit,
  onDelete,
  onSetDefault,
  onSaveEdits,
  onValidateKey,
  devModeUnlocked,
}: ProviderCardProps) {
  const { t, i18n } = useTranslation('settings');
  const { account, vendor, status } = item;
  const [label, setLabel] = useState(account.label);
  const [newKey, setNewKey] = useState('');
  const [baseUrl, setBaseUrl] = useState(account.baseUrl || '');
  const [apiProtocol, setApiProtocol] = useState<ProviderAccount['apiProtocol']>(account.apiProtocol || 'openai-completions');
  const [modelId, setModelId] = useState(account.model || '');
  const [fallbackModelsText, setFallbackModelsText] = useState(
    normalizeFallbackModels(account.fallbackModels).join('\n')
  );
  const [fallbackProviderIds, setFallbackProviderIds] = useState<string[]>(
    normalizeFallbackProviderIds(account.fallbackAccountIds)
  );
  const [showKey, setShowKey] = useState(false);
  const [showFallback, setShowFallback] = useState(false);
  const [validating, setValidating] = useState(false);
  const [saving, setSaving] = useState(false);

  const typeInfo = PROVIDER_TYPE_INFO.find((t) => t.id === account.vendorId);
  const providerDocsUrl = getProviderDocsUrl(typeInfo, i18n.language);
  const showModelIdField = shouldShowProviderModelId(typeInfo, devModeUnlocked);
  const canEditModelConfig = Boolean(typeInfo?.showBaseUrl || showModelIdField);

  useEffect(() => {
    if (isEditing) {
      setLabel(account.label);
      setNewKey('');
      setShowKey(false);
      setBaseUrl(account.baseUrl || '');
      setApiProtocol(account.apiProtocol || 'openai-completions');
      setModelId(account.model || '');
      setFallbackModelsText(normalizeFallbackModels(account.fallbackModels).join('\n'));
      setFallbackProviderIds(normalizeFallbackProviderIds(account.fallbackAccountIds));
    }
  }, [isEditing, account.label, account.baseUrl, account.fallbackModels, account.fallbackAccountIds, account.model, account.apiProtocol]);

  const fallbackOptions = allProviders.filter((candidate) => candidate.account.id !== account.id);

  const toggleFallbackProvider = (providerId: string) => {
    setFallbackProviderIds((current) => (
      current.includes(providerId)
        ? current.filter((id) => id !== providerId)
        : [...current, providerId]
    ));
  };

  const handleSaveEdits = async () => {
    setSaving(true);
    try {
      const payload: { newApiKey?: string; updates?: Partial<ProviderAccount> } = {};
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

      {
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
      }

      // Keep Ollama key optional in UI, but persist a placeholder when
      // editing legacy configs that have no stored key.
      if (account.vendorId === 'ollama' && !status?.hasKey && !payload.newApiKey) {
        payload.newApiKey = resolveProviderApiKeyForSave(account.vendorId, '') as string;
      }

      if (!payload.newApiKey && !payload.updates) {
        onCancelEdit();
        setSaving(false);
        return;
      }

      await onSaveEdits(payload);
      setNewKey('');
      toast.success(t('aiProviders.toast.updated'));
    } catch (error) {
      toast.error(`${t('aiProviders.toast.failedUpdate')}: ${error}`);
    } finally {
      setSaving(false);
      setValidating(false);
    }
  };

  const summaryPrimary = [
    vendor?.name || account.vendorId,
    getAuthModeLabel(account.authMode, t),
    account.model || null,
  ].filter(Boolean);
  const summarySecondary = [
    hasConfiguredCredentials(account, status) ? t('aiProviders.card.configured') : t('aiProviders.dialog.apiKeyMissing'),
    ((account.fallbackModels?.length ?? 0) > 0 || (account.fallbackAccountIds?.length ?? 0) > 0)
      ? `${t('aiProviders.sections.fallback')}: ${[
          ...normalizeFallbackModels(account.fallbackModels),
          ...normalizeFallbackProviderIds(account.fallbackAccountIds)
            .map((fallbackId) => allProviders.find((candidate) => candidate.account.id === fallbackId)?.account.label)
            .filter(Boolean),
        ].join(', ')}`
      : null,
  ].filter(Boolean);

  const currentInputClasses = inputClasses;

  const currentLabelClasses = isDefault ? "text-[13px] text-muted-foreground" : labelClasses;
  const currentSectionLabelClasses = isDefault ? "text-[14px] font-semibold text-foreground/85" : labelClasses;

  return (
    <div
      className={cn(
        'group app-pane-surface relative flex flex-col overflow-hidden rounded-[12px] border border-transparent p-3 transition-colors hover:border-border/45 hover:bg-[hsl(var(--surface-hover)/0.42)]',
        isDefault && 'bg-[hsl(var(--surface-base)/0.995)] border-[hsl(var(--border-strong)/0.65)]',
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex min-w-0 items-start gap-3.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] border border-border/60 bg-[hsl(var(--surface-panel)/0.92)] text-foreground">
            {getProviderIconUrl(account.vendorId) ? (
              <img src={getProviderIconUrl(account.vendorId)} alt={typeInfo?.name || account.vendorId} className={cn('h-[17px] w-[17px]', shouldInvertInDark(account.vendorId) && 'dark:invert')} />
            ) : (
              <span className="text-[15px]">{vendor?.icon || typeInfo?.icon || '⚙️'}</span>
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="truncate font-semibold text-[14px] text-foreground">{account.label}</span>
              {isDefault && (
                <span className="flex items-center gap-1 rounded-full bg-[hsl(var(--foreground)/0.05)] px-2 py-0.5 text-[9.5px] font-medium text-foreground/72">
                  <Check className="h-3 w-3" />
                  {t('aiProviders.card.default')}
                </span>
              )}
            </div>
            {summaryPrimary.length > 0 && (
              <p className="mt-0.5 truncate text-[11.5px] text-muted-foreground/74">{summaryPrimary.join(' · ')}</p>
            )}
            {summarySecondary.map((summary, index) => (
              <p key={`${account.id}-summary-${index}`} className="mt-0.5 truncate text-[11.5px] text-muted-foreground/70">
                {summary}
              </p>
            ))}
          </div>
        </div>

        {!isEditing && (
          <div className="flex shrink-0 items-center gap-1 opacity-60 transition-opacity group-hover:opacity-100">
            {!isDefault && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 rounded-[9px] text-muted-foreground hover:text-foreground hover:bg-[hsl(var(--foreground)/0.05)] shadow-none"
                onClick={onSetDefault}
                title={t('aiProviders.card.setDefault')}
              >
                <Check className="h-4 w-4" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 rounded-[9px] text-muted-foreground hover:text-foreground hover:bg-[hsl(var(--foreground)/0.05)] shadow-none"
              onClick={onEdit}
              title={t('aiProviders.card.editKey')}
            >
              <Edit className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 rounded-[9px] text-muted-foreground hover:text-destructive hover:bg-[hsl(var(--foreground)/0.05)] shadow-none"
              onClick={onDelete}
              title={t('aiProviders.card.delete')}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      {isEditing && (
        <div className="mt-3.5 space-y-4.5 border-t border-border/55 pt-3.5">
          {providerDocsUrl && (
            <div className="mb-2 flex justify-end -mt-2">
              <a
                href={providerDocsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[11.5px] font-medium text-primary hover:text-primary/80"
              >
                {t('aiProviders.dialog.customDoc')}
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          )}
            <div className="space-y-1.5">
              <Label className={currentLabelClasses}>{t('aiProviders.dialog.displayName')}</Label>
              <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder={typeInfo?.id === 'custom' ? t('aiProviders.custom') : typeInfo?.name}
              className={currentInputClasses}
            />
          </div>
            {canEditModelConfig && (
            <div className="space-y-3">
              <p className={currentSectionLabelClasses}>{t('aiProviders.sections.model')}</p>
              {typeInfo?.showBaseUrl && (
                <div className="space-y-1.5">
                  <Label className={currentLabelClasses}>{t('aiProviders.dialog.baseUrl')}</Label>
                  <Input
                    value={baseUrl}
                    onChange={(e) => setBaseUrl(e.target.value)}
                    placeholder={getProtocolBaseUrlPlaceholder(apiProtocol)}
                    className={currentInputClasses}
                  />
                </div>
              )}
              {showModelIdField && (
                <div className="space-y-1.5 pt-2">
                  <Label className={currentLabelClasses}>{t('aiProviders.dialog.modelId')}</Label>
                  <Input
                    value={modelId}
                    onChange={(e) => setModelId(e.target.value)}
                    placeholder={typeInfo?.modelIdPlaceholder || 'provider/model-id'}
                    className={currentInputClasses}
                  />
                </div>
              )}
              {account.vendorId === 'custom' && (
                <div className="space-y-1.5 pt-2">
                  <Label className={currentLabelClasses}>{t('aiProviders.dialog.protocol', 'Protocol')}</Label>
                  <div className={segmentedTrackClass + ' text-[12px]'}>
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
              )}
            </div>
          )}
          <div className="space-y-3">
            <button
              onClick={() => setShowFallback(!showFallback)}
              className="flex items-center justify-between w-full text-[14px] font-bold text-foreground/80 hover:text-foreground transition-colors"
            >
              <span>{t('aiProviders.sections.fallback')}</span>
              <ChevronDown className={cn("h-4 w-4 transition-transform", showFallback && "rotate-180")} />
            </button>
            {showFallback && (
              <div className="space-y-3 pt-2">
                <div className="space-y-1.5">
                  <Label className={currentLabelClasses}>{t('aiProviders.dialog.fallbackModelIds')}</Label>
                  <Textarea
                    value={fallbackModelsText}
                    onChange={(e) => setFallbackModelsText(e.target.value)}
                    placeholder={t('aiProviders.dialog.fallbackModelIdsPlaceholder')}
                    className={isDefault
                      ? "min-h-24 rounded-[12px] border-border/70 app-field-surface text-[13px] font-mono shadow-none"
                      : "min-h-24 rounded-[12px] border-border/70 app-field-surface text-[13px] font-mono shadow-none"}
                  />
                  <p className="text-[12px] text-muted-foreground">
                    {t('aiProviders.dialog.fallbackModelIdsHelp')}
                  </p>
                </div>
                <div className="space-y-2 pt-1">
                  <Label className={currentLabelClasses}>{t('aiProviders.dialog.fallbackProviders')}</Label>
                  {fallbackOptions.length === 0 ? (
                    <p className="text-[13px] text-muted-foreground">{t('aiProviders.dialog.noFallbackOptions')}</p>
                  ) : (
                    <div className="app-pane-surface space-y-1.5 rounded-[10px] border border-border/60 p-2">
                      {fallbackOptions.map((candidate) => (
                        <button
                          key={candidate.account.id}
                          type="button"
                          onClick={() => toggleFallbackProvider(candidate.account.id)}
                          className={cn(
                            'flex w-full items-center gap-3 rounded-[9px] px-2.5 py-2 text-left text-[12px] transition-colors',
                            fallbackProviderIds.includes(candidate.account.id)
                              ? 'bg-[hsl(var(--foreground)/0.055)] text-foreground'
                              : 'hover:bg-[hsl(var(--foreground)/0.035)] text-foreground/88',
                          )}
                        >
                          <span className={cn(
                            'flex h-4 w-4 shrink-0 items-center justify-center rounded-[5px] border text-transparent transition-colors',
                            fallbackProviderIds.includes(candidate.account.id)
                              ? 'border-foreground/20 bg-[hsl(var(--foreground)/0.08)] text-foreground'
                              : 'border-border/70 bg-transparent',
                          )}>
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
            )}
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="space-y-0.5">
                <Label className={currentSectionLabelClasses}>{t('aiProviders.dialog.apiKey')}</Label>
                <p className="text-[12px] text-muted-foreground">
                  {hasConfiguredCredentials(account, status)
                    ? t('aiProviders.dialog.apiKeyConfigured')
                    : t('aiProviders.dialog.apiKeyMissing')}
                </p>
              </div>
              {hasConfiguredCredentials(account, status) ? (
                <div className="flex items-center gap-1.5 text-[11px] font-medium text-green-600 dark:text-green-500 bg-green-500/10 px-2 py-1 rounded-md">
                  <div className="w-1.5 h-1.5 rounded-full bg-current" />
                  {t('aiProviders.card.configured')}
                </div>
              ) : null}
            </div>
            {typeInfo?.apiKeyUrl && (
              <div className="flex justify-start">
                <a
                  href={typeInfo.apiKeyUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[13px] text-primary hover:text-primary/80 hover:underline flex items-center gap-1"
                  tabIndex={-1}
                >
                  {t('aiProviders.oauth.getApiKey')} <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            )}
            <div className="space-y-1.5 pt-1">
              <Label className={currentLabelClasses}>{t('aiProviders.dialog.replaceApiKey')}</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    type={showKey ? 'text' : 'password'}
                    placeholder={typeInfo?.requiresApiKey ? typeInfo?.placeholder : (typeInfo?.id === 'ollama' ? t('aiProviders.notRequired') : t('aiProviders.card.editKey'))}
                    value={newKey}
                    onChange={(e) => setNewKey(e.target.value)}
                    className={cn(tokenInputClasses, 'pr-10')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey(!showKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <Button
                  variant="outline"
                  onClick={handleSaveEdits}
                  className={cn(
                    "rounded-[10px] px-4 border-border/70 shadow-none",
                    isDefault
                      ? "h-[40px] bg-[hsl(var(--surface-base)/0.96)] hover:bg-[hsl(var(--surface-hover)/0.9)]"
                      : "h-[40px] app-field-surface hover:bg-[hsl(var(--surface-hover)/0.9)]"
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
                  {validating || saving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="h-4 w-4 text-green-500" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  onClick={onCancelEdit}
                  className={cn(
                    "rounded-[10px] p-0 shadow-none",
                    isDefault
                      ? "h-[40px] w-[40px] hover:bg-[hsl(var(--surface-hover)/0.9)]"
                      : "h-[40px] w-[40px] app-field-surface border border-border/70 hover:bg-[hsl(var(--surface-hover)/0.9)] text-muted-foreground hover:text-foreground"
                  )}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-[12px] text-muted-foreground">
                {t('aiProviders.dialog.replaceApiKeyHelp')}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface AddProviderDialogProps {
  existingVendorIds: Set<string>;
  vendors: ProviderVendorInfo[];
  onClose: () => void;
  onAdd: (
    type: ProviderType,
    name: string,
    apiKey: string,
    options?: { baseUrl?: string; model?: string; authMode?: ProviderAccount['authMode']; apiProtocol?: ProviderAccount['apiProtocol'] }
  ) => Promise<void>;
  onValidateKey: (
    type: string,
    apiKey: string,
    options?: { baseUrl?: string; apiProtocol?: ProviderAccount['apiProtocol'] }
  ) => Promise<{ valid: boolean; error?: string }>;
  devModeUnlocked: boolean;
}

function AddProviderDialog({
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

  // OAuth Flow State
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
  // For providers that support both OAuth and API key, let the user choose.
  // Default to the vendor's declared auth mode instead of hard-coding OAuth.
  const [authMode, setAuthMode] = useState<'oauth' | 'apikey'>('apikey');

  const typeInfo = PROVIDER_TYPE_INFO.find((t) => t.id === selectedType);
  const providerDocsUrl = getProviderDocsUrl(typeInfo, i18n.language);
  const showModelIdField = shouldShowProviderModelId(typeInfo, devModeUnlocked);
  const isOAuth = typeInfo?.isOAuth ?? false;
  const supportsApiKey = typeInfo?.supportsApiKey ?? false;
  const vendorMap = new Map(vendors.map((vendor) => [vendor.id, vendor]));
  const selectedVendor = selectedType ? vendorMap.get(selectedType) : undefined;
  const preferredOAuthMode = selectedVendor?.supportedAuthModes.includes('oauth_browser')
    ? 'oauth_browser'
    : (selectedVendor?.supportedAuthModes.includes('oauth_device')
      ? 'oauth_device'
      : (selectedType === 'google' ? 'oauth_browser' : null));
  // Effective OAuth mode: pure OAuth providers, or dual-mode with oauth selected
  const useOAuthFlow = isOAuth && (!supportsApiKey || authMode === 'oauth');

  useEffect(() => {
    if (!selectedVendor || !isOAuth || !supportsApiKey) {
      return;
    }
    setAuthMode(selectedVendor.defaultAuthMode === 'api_key' ? 'apikey' : 'oauth');
  }, [selectedVendor, isOAuth, supportsApiKey]);

  // Keep refs to the latest values so event handlers see the current dialog state.
  const latestRef = React.useRef({ selectedType, typeInfo, onAdd, onClose, t });
  const pendingOAuthRef = React.useRef<{ accountId: string; label: string } | null>(null);
  useEffect(() => {
    latestRef.current = { selectedType, typeInfo, onAdd, onClose, t };
  });

  // Manage OAuth events
  useEffect(() => {
    const handleCode = (data: unknown) => {
      const payload = data as Record<string, unknown>;
      if (payload?.mode === 'manual') {
        setOauthData({
          mode: 'manual',
          authorizationUrl: String(payload.authorizationUrl || ''),
          message: typeof payload.message === 'string' ? payload.message : undefined,
        });
      } else {
        setOauthData({
          mode: 'device',
          verificationUri: String(payload.verificationUri || ''),
          userCode: String(payload.userCode || ''),
          expiresIn: Number(payload.expiresIn || 300),
        });
      }
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

      // device-oauth.ts already saved the provider config to the backend,
      // including the dynamically resolved baseUrl for the region (e.g. CN vs Global).
      // If we call add() here with undefined baseUrl, it will overwrite and erase it!
      // So we just fetch the latest list from the backend to update the UI.
      try {
        const store = useProviderStore.getState();
        await store.refreshProviderSnapshot();

        // OAuth sign-in should immediately become active default to avoid
        // leaving runtime on an API-key-only provider/model.
        if (accountId) {
          await store.setDefaultAccount(accountId);
        }
      } catch (err) {
        console.error('Failed to refresh providers after OAuth:', err);
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

  const handleStartOAuth = async () => {
    if (!selectedType) return;

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
    } catch (e) {
      setOauthError(String(e));
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
    if (!value) return;
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

  const availableTypes = PROVIDER_TYPE_INFO.filter((type) => {
    const vendor = vendorMap.get(type.id);
    if (!vendor) {
      return !existingVendorIds.has(type.id) || type.id === 'custom';
    }
    return vendor.supportsMultipleAccounts || !existingVendorIds.has(type.id);
  });

  const handleAdd = async () => {
    if (!selectedType) return;

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
      // Validate key first if the provider requires one and a key was entered
      const requiresKey = typeInfo?.requiresApiKey ?? false;
      if (requiresKey && !apiKey.trim()) {
        setValidationError(t('aiProviders.toast.invalidKey')); // reusing invalid key msg or should add 'required' msg? null checks
        setSaving(false);
        return;
      }
      if (requiresKey && apiKey) {
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

      const requiresModel = showModelIdField;
      if (requiresModel && !modelId.trim()) {
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
          authMode: useOAuthFlow ? (preferredOAuthMode || 'oauth_device') : selectedType === 'ollama'
            ? 'local'
            : (isOAuth && supportsApiKey && authMode === 'apikey')
              ? 'api_key'
              : vendorMap.get(selectedType)?.defaultAuthMode || 'api_key',
        }
      );
    } catch {
      // error already handled via toast in parent
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="app-modal-overlay fixed inset-0 z-50 flex items-center justify-center p-4">
      <Card className={cn(modalSurfaceClasses, 'max-h-[90vh] max-w-lg flex flex-col overflow-hidden')}>
        <CardHeader className="relative pb-2 shrink-0">
          <CardTitle className="text-[17px] font-semibold tracking-tight">{t('aiProviders.dialog.title')}</CardTitle>
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
        <CardContent className="overflow-y-auto flex-1 p-5">
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
                  className="flex w-full items-center gap-3 rounded-[10px] border border-transparent bg-transparent px-3 py-2.5 text-left transition-colors hover:bg-[hsl(var(--foreground)/0.04)]"
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
                    <p className="mt-0.5 truncate text-[11px] text-muted-foreground/72">{type.id}</p>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="space-y-5">
              <div className="app-pane-surface flex items-center gap-2.5 rounded-[11px] p-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] border border-border/55 bg-[hsl(var(--surface-base)/0.96)]">
                  {getProviderIconUrl(selectedType!) ? (
                    <img src={getProviderIconUrl(selectedType!)} alt={typeInfo?.name} className={cn('h-[18px] w-[18px]', shouldInvertInDark(selectedType!) && 'dark:invert')} />
                  ) : (
                    <span className="text-lg">{typeInfo?.icon}</span>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="truncate font-semibold text-[14px]">{typeInfo?.id === 'custom' ? t('aiProviders.custom') : typeInfo?.name}</p>
                  <button
                    onClick={() => {
                      setSelectedType(null);
                      setValidationError(null);
                      setBaseUrl('');
                      setModelId('');
                    }}
                    className="text-[12px] font-medium text-primary hover:text-primary/80"
                  >
                    {t('aiProviders.dialog.change')}
                  </button>
                  {providerDocsUrl && (
                    <>
                      <span className="mx-2 text-foreground/20">|</span>
                      <a
                        href={providerDocsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[12px] font-medium text-primary hover:text-primary/80"
                      >
                        {t('aiProviders.dialog.customDoc')}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </>
                  )}
                </div>
              </div>

              <div className="space-y-5 bg-transparent p-0">
                <div className="space-y-2.5">
                  <Label htmlFor="name" className={labelClasses}>{t('aiProviders.dialog.displayName')}</Label>
                  <Input
                    id="name"
                    placeholder={typeInfo?.id === 'custom' ? t('aiProviders.custom') : typeInfo?.name}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className={inputClasses}
                  />
                </div>

                {/* Auth mode toggle for providers supporting both */}
                {isOAuth && supportsApiKey && (
                  <div className={cn(segmentedTrackClass, 'overflow-hidden text-[12px] font-medium')}>
                    <button
                      onClick={() => setAuthMode('oauth')}
                      className={cn(
                        'flex-1 rounded-[8px] px-3 py-2 transition-colors',
                        authMode === 'oauth' ? segmentedActiveClass : segmentedIdleClass
                      )}
                    >
                      {t('aiProviders.oauth.loginMode')}
                    </button>
                    <button
                      onClick={() => setAuthMode('apikey')}
                      className={cn(
                        'flex-1 rounded-[8px] px-3 py-2 transition-colors',
                        authMode === 'apikey' ? segmentedActiveClass : segmentedIdleClass
                      )}
                    >
                      {t('aiProviders.oauth.apikeyMode')}
                    </button>
                  </div>
                )}

                {/* API Key input — shown for non-OAuth providers or when apikey mode is selected */}
                {(!isOAuth || (supportsApiKey && authMode === 'apikey')) && (
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="apiKey" className={labelClasses}>{t('aiProviders.dialog.apiKey')}</Label>
                      {typeInfo?.apiKeyUrl && (
                        <a
                          href={typeInfo.apiKeyUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-[13px] font-medium text-primary hover:text-primary/80"
                          tabIndex={-1}
                        >
                          {t('aiProviders.oauth.getApiKey')} <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                    <div className="relative">
                      <Input
                        id="apiKey"
                        type={showKey ? 'text' : 'password'}
                        placeholder={typeInfo?.id === 'ollama' ? t('aiProviders.notRequired') : typeInfo?.placeholder}
                        value={apiKey}
                        onChange={(e) => {
                          setApiKey(e.target.value);
                          setValidationError(null);
                        }}
                        className={tokenInputClasses}
                      />
                      <button
                        type="button"
                        onClick={() => setShowKey(!showKey)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    {validationError && (
                      <p className="text-[13px] text-red-500 font-medium">{validationError}</p>
                    )}
                    <p className="text-[12px] text-muted-foreground">
                      {t('aiProviders.dialog.apiKeyStored')}
                    </p>
                  </div>
                )}

                {typeInfo?.showBaseUrl && (
                  <div className="space-y-2.5">
                    <Label htmlFor="baseUrl" className={labelClasses}>{t('aiProviders.dialog.baseUrl')}</Label>
                    <Input
                      id="baseUrl"
                      placeholder={getProtocolBaseUrlPlaceholder(apiProtocol)}
                      value={baseUrl}
                      onChange={(e) => setBaseUrl(e.target.value)}
                      className={inputClasses}
                    />
                  </div>
                )}

                {showModelIdField && (
                  <div className="space-y-2.5">
                    <Label htmlFor="modelId" className={labelClasses}>{t('aiProviders.dialog.modelId')}</Label>
                    <Input
                      id="modelId"
                      placeholder={typeInfo?.modelIdPlaceholder || 'provider/model-id'}
                      value={modelId}
                      onChange={(e) => {
                        setModelId(e.target.value);
                        setValidationError(null);
                      }}
                      className={inputClasses}
                    />
                  </div>
                )}
                {selectedType === 'custom' && (
                <div className="space-y-2.5">
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
                )}
                {/* Device OAuth Trigger — only shown when in OAuth mode */}
                {useOAuthFlow && (
                  <div className="space-y-4 pt-1.5">
                    <div className="app-pane-surface rounded-[12px] border border-border/55 p-4 text-left">
                      <p className="mb-3 block text-[12px] font-medium text-foreground/70">
                        {t('aiProviders.oauth.loginPrompt')}
                      </p>
                      <Button
                        onClick={handleStartOAuth}
                        disabled={oauthFlowing}
                        className="h-9 w-full rounded-[10px] font-semibold"
                      >
                        {oauthFlowing ? (
                          <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{t('aiProviders.oauth.waiting')}</>
                        ) : (
                          t('aiProviders.oauth.loginButton')
                        )}
                      </Button>
                    </div>

                    {/* OAuth Active State Modal / Inline View */}
                    {oauthFlowing && (
                      <div className="relative mt-3.5 overflow-hidden rounded-[12px] border border-border/55 app-pane-surface p-4">
                        <div className="relative z-10 flex flex-col items-center justify-center space-y-5 text-center">
                          {oauthError ? (
                            <div className="text-red-500 space-y-3">
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
                            <div className="space-y-4 w-full">
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
                                onChange={(e) => setManualCodeInput(e.target.value)}
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
                            <div className="space-y-4.5 w-full">
                              <div className="space-y-2">
                                <h3 className="font-semibold text-[14px] text-foreground">{t('aiProviders.oauth.approveLogin')}</h3>
                                <div className="mt-2 space-y-1.5 rounded-[11px] bg-[hsl(var(--foreground)/0.03)] p-3 text-left text-[12px] text-muted-foreground/84">
                                  <p>1. {t('aiProviders.oauth.step1')}</p>
                                  <p>2. {t('aiProviders.oauth.step2')}</p>
                                  <p>3. {t('aiProviders.oauth.step3')}</p>
                                </div>
                              </div>

                              <div className="flex items-center justify-center gap-3 rounded-[11px] border border-border/55 app-pane-surface px-3.5 py-3">
                                <code className="text-[26px] font-mono tracking-[0.16em] font-bold text-foreground">
                                  {oauthData.userCode}
                                </code>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 rounded-full hover:bg-accent/50"
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
                    )}
                  </div>
                )}
              </div>

              <Separator className="bg-border/60" />

              <div className="flex justify-end gap-3">
                <Button
                  onClick={handleAdd}
                  className={cn(primaryButtonClass, 'h-9 px-6 text-[12.5px] font-semibold', useOAuthFlow && 'hidden')}
                  disabled={!selectedType || saving || (showModelIdField && modelId.trim().length === 0)}
                >
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : null}
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
