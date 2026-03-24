import { useEffect, useMemo, useState } from 'react';
import { Check, Edit, Key, Loader2, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { useProviderStore } from '@/stores/providers';
import { PROVIDER_TYPE_INFO, getProviderIconClass, getProviderIconUrl, type ProviderType } from '@/lib/providers';
import { buildProviderListItems, hasConfiguredCredentials, type ProviderListItem } from '@/lib/provider-accounts';
import { cn } from '@/lib/utils';
import { useSettingsStore } from '@/stores/settings';
import {
  getAuthModeLabel,
  normalizeFallbackModels,
  normalizeFallbackProviderIds,
  ProviderAccountFormSections,
  type ProviderAccountFormSavePayload,
  type ProviderAccountValidateFn,
} from '@/components/settings/providers/ProviderAccountFormSections';
import {
  AddProviderDialog,
} from '@/components/settings/providers/AddProviderDialog';
import {
  createProviderAccountFromDialog,
  type AddProviderDialogOptions,
} from '@/components/settings/providers/provider-account-create';

const primaryButtonClass = 'workbench-motion-button workbench-motion-button--lift rounded-[10px] h-8 px-4 bg-primary text-primary-foreground shadow-none hover:bg-primary/90';

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
  const existingVendorIds = new Set(accounts.map((account) => account.vendorId));
  const displayProviders = useMemo(
    () => buildProviderListItems(accounts, statuses, vendors, defaultAccountId),
    [accounts, statuses, vendors, defaultAccountId],
  );

  useEffect(() => {
    refreshProviderSnapshot();
  }, [refreshProviderSnapshot]);

  const handleAddProvider = async (
    type: ProviderType,
    name: string,
    apiKey: string,
    options?: AddProviderDialogOptions,
  ) => {
    try {
      await createProviderAccountFromDialog({
        type,
        name,
        apiKey,
        vendors,
        defaultAccountId,
        createAccount,
        setDefaultAccount,
        options,
      });
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
                await updateAccount(item.account.id, payload.updates ?? {}, payload.newApiKey);
                setEditingProvider(null);
              }}
              onValidateKey={(key, options) => validateAccountApiKey(item.account.id, key, options)}
              devModeUnlocked={devModeUnlocked}
            />
          ))}
        </div>
      )}

      {showAddDialog ? (
        <AddProviderDialog
          existingVendorIds={existingVendorIds}
          vendors={vendors}
          onClose={() => setShowAddDialog(false)}
          onAdd={handleAddProvider}
          onValidateKey={(type, key, options) => validateAccountApiKey(type, key, options)}
          devModeUnlocked={devModeUnlocked}
        />
      ) : null}
    </div>
  );
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
}: {
  item: ProviderListItem;
  allProviders: ProviderListItem[];
  isDefault: boolean;
  isEditing: boolean;
  onEdit: () => void;
  onCancelEdit: () => void;
  onDelete: () => void;
  onSetDefault: () => void;
  onSaveEdits: (payload: ProviderAccountFormSavePayload) => Promise<void>;
  onValidateKey: ProviderAccountValidateFn;
  devModeUnlocked: boolean;
}) {
  const { t } = useTranslation('settings');
  const { account, vendor, status } = item;
  const typeInfo = PROVIDER_TYPE_INFO.find((candidate) => candidate.id === account.vendorId);
  const summaryPrimary = [vendor?.name || account.vendorId, getAuthModeLabel(account.authMode, t), account.model || null].filter(Boolean);
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

  return (
    <div
      className={cn(
        'group relative flex flex-col overflow-hidden rounded-[14px] border border-border/55 bg-[hsl(var(--surface-base)/0.98)] p-3 transition-colors hover:border-border/70 hover:bg-[hsl(var(--surface-hover)/0.34)]',
        isDefault && 'bg-[hsl(var(--surface-elevated)/0.99)] border-[hsl(var(--border-strong)/0.6)]',
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex min-w-0 items-start gap-3.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] border border-border/60 bg-[hsl(var(--surface-panel)/0.92)] text-foreground">
            {getProviderIconUrl(account.vendorId) ? (
              <img src={getProviderIconUrl(account.vendorId)} alt={typeInfo?.name || account.vendorId} className={getProviderIconClass(account.vendorId, 'h-[17px] w-[17px]')} />
            ) : (
              <span className="text-[15px]">{vendor?.icon || typeInfo?.icon || '⚙️'}</span>
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="truncate font-semibold text-[14px] text-foreground">{account.label}</span>
              {isDefault ? (
                <span className="flex items-center gap-1 rounded-[9px] bg-[hsl(var(--foreground)/0.05)] px-2 py-0.5 text-[9.5px] font-medium text-foreground/72">
                  <Check className="h-3 w-3" />
                  {t('aiProviders.card.default')}
                </span>
              ) : null}
            </div>
            {summaryPrimary.length > 0 ? (
              <p className="mt-0.5 truncate text-[11.5px] text-muted-foreground/74">{summaryPrimary.join(' · ')}</p>
            ) : null}
            {summarySecondary.map((summary, index) => (
              <p key={`${account.id}-summary-${index}`} className="mt-0.5 truncate text-[11.5px] text-muted-foreground/70">
                {summary}
              </p>
            ))}
          </div>
        </div>

        {!isEditing ? (
          <div className="flex shrink-0 items-center gap-1 opacity-60 transition-opacity group-hover:opacity-100">
            {!isDefault ? (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 rounded-[9px] text-muted-foreground hover:text-foreground hover:bg-[hsl(var(--foreground)/0.05)] shadow-none"
                onClick={onSetDefault}
                title={t('aiProviders.card.setDefault')}
              >
                <Check className="h-4 w-4" />
              </Button>
            ) : null}
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
        ) : null}
      </div>

      {isEditing ? (
        <ProviderAccountFormSections
          mode="edit"
          item={item}
          allProviders={allProviders}
          devModeUnlocked={devModeUnlocked}
          onSave={onSaveEdits}
          onCancel={onCancelEdit}
          onValidateKey={onValidateKey}
        />
      ) : null}
    </div>
  );
}
