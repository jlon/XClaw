import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { hasConfiguredCredentials, type ProviderListItem } from '@/lib/provider-accounts';
import type { ProviderInspectorShell } from '../workbench-layout';
import { ProviderInspectorEditor } from './ProviderInspectorEditor';
import { ProviderInspectorView } from './ProviderInspectorView';
import type { ProviderAccountFormSavePayload, ProviderAccountValidateFn } from '@/components/settings/providers/ProviderAccountFormSections';

interface ProviderInspectorProps {
  shell: ProviderInspectorShell;
  mode: 'view' | 'edit';
  item: ProviderListItem | null;
  allProviders: ProviderListItem[];
  scopeItems: ProviderListItem[];
  defaultAccountId: string | null;
  devModeUnlocked: boolean;
  selectedAccountId: string | null;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onSetDefault: () => void;
  onSelectAccount: (accountId: string) => void;
  onSave: (payload: ProviderAccountFormSavePayload) => Promise<void>;
  onCancelEdit: () => void;
  onValidateKey: ProviderAccountValidateFn;
}

const paneSurfaceClass = 'app-pane-surface rounded-[20px] border border-[hsl(var(--border-subtle)/0.82)] shadow-none';
const modalSurfaceClass = 'app-modal-surface rounded-[22px] border border-[hsl(var(--border-subtle)/0.86)] shadow-[0_18px_48px_rgba(15,23,42,0.12)]';

export function ProviderInspector({
  shell,
  mode,
  item,
  allProviders,
  scopeItems,
  defaultAccountId,
  devModeUnlocked,
  selectedAccountId,
  onClose,
  onEdit,
  onDelete,
  onSetDefault,
  onSelectAccount,
  onSave,
  onCancelEdit,
  onValidateKey,
}: ProviderInspectorProps) {
  const { t } = useTranslation(['dashboard', 'common']);
  if (!item) {
    return null;
  }
  const closeLabel = t('common:actions.close', '关闭');
  const inspectorTitle = t('dashboard:models.inspectorTitle', '提供商详情');
  const inspectorDescription = t('dashboard:models.inspectorDescription', {
    label: item.account.label,
    defaultValue: `${item.account.label} 的配置与用量详情`,
  });
  const isDefault = defaultAccountId === item.account.id;
  const configured = hasConfiguredCredentials(item.account, item.status);
  const accountSwitchTitle = t('dashboard:models.accountSwitchTitle', '账号');
  const accountSwitchHint = t('dashboard:models.accountSwitchHint', '同一提供商下的账号共享分析范围，切换后右侧配置会跟着切换。');
  const defaultLabel = t('dashboard:models.defaultProvider', '默认');
  const configuredLabel = configured
    ? t('settings:aiProviders.card.configured', '已配置')
    : t('settings:aiProviders.dialog.apiKeyMissing', '未配置 API Key');
  const duplicatedLabels = new Set(
    scopeItems
      .map((candidate) => candidate.account.label.trim())
      .filter((label, index, labels) => label.length > 0 && labels.indexOf(label) !== index),
  );

  const content = (
    <section
      className={cn(
        shell === 'pane' ? paneSurfaceClass : modalSurfaceClass,
        shell === 'pane'
          ? 'sticky top-0 flex max-h-[calc(100vh-6.5rem)] flex-col overflow-hidden p-4'
          : 'flex max-h-[min(90vh,880px)] flex-col overflow-hidden p-0'
      )}
        data-testid="models-provider-inspector"
        data-mode={mode}
        data-shell={shell}
    >
        <div className={cn('space-y-2.5', shell === 'pane' ? 'mb-3' : 'shrink-0 border-b border-[hsl(var(--border-subtle)/0.72)] px-6 py-4')}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 space-y-1">
              <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground/74">{inspectorTitle}</p>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="truncate text-[20px] font-semibold tracking-tight text-foreground">{item.account.label}</h2>
                {isDefault ? (
                  <span className="app-field-surface rounded-full px-2 py-0.5 text-[11px] font-medium text-foreground/80">
                    {defaultLabel}
                  </span>
                ) : null}
                <span
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium',
                    configured
                      ? 'border border-[hsl(var(--success))/0.16] bg-[hsl(var(--success))/0.08] text-[hsl(var(--success))]'
                      : 'app-field-surface text-muted-foreground',
                  )}
                >
                  {configured ? <span className="h-1.5 w-1.5 rounded-full bg-current" /> : null}
                  {configuredLabel}
                </span>
              </div>
              <p className="text-[12px] text-muted-foreground">
                {[item.account.id, item.account.runtimeKey || item.account.vendorId].filter(Boolean).join(' · ')}
              </p>
            </div>
            {shell !== 'pane' ? (
              <Button type="button" variant="ghost" size="icon" className="app-field-surface h-8 w-8 rounded-[10px] text-muted-foreground shadow-none hover:bg-[hsl(var(--surface-hover)/0.84)] hover:text-foreground" onClick={onClose} aria-label={closeLabel}>
                <X className="h-4 w-4" />
              </Button>
            ) : null}
          </div>
          {scopeItems.length > 1 ? (
            <section
              className="app-insight-surface space-y-2 rounded-[14px] border border-[hsl(var(--border-subtle)/0.78)] px-3 py-2.5"
              data-testid="models-provider-account-switcher"
            >
              <div className="space-y-1">
                <p className="text-[12px] font-medium text-foreground/86">{accountSwitchTitle}</p>
                <p className="text-[11px] leading-[18px] text-muted-foreground">{accountSwitchHint}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {scopeItems.map((candidate) => {
                  const active = candidate.account.id === selectedAccountId;
                  const candidateIsDefault = defaultAccountId === candidate.account.id;
                  const candidateLabel = duplicatedLabels.has(candidate.account.label.trim())
                    ? `${candidate.account.label} · ${candidate.account.id}`
                    : candidate.account.label;

                  return (
                    <button
                      key={candidate.account.id}
                      type="button"
                      className={cn(
                        'rounded-full border px-2.5 py-1 text-[11.5px] font-medium transition-colors',
                        active
                          ? 'border-[hsl(var(--border-strong)/0.34)] bg-[hsl(var(--surface-elevated)/0.98)] text-primary'
                          : 'border-border/65 bg-[hsl(var(--surface-base)/0.78)] text-foreground/76 hover:bg-[hsl(var(--surface-hover)/0.82)] hover:text-foreground',
                      )}
                      data-testid={`models-provider-account-switch-${candidate.account.id}`}
                      onClick={() => onSelectAccount(candidate.account.id)}
                    >
                      <span>{candidateLabel}</span>
                      {candidateIsDefault ? (
                        <span className="ml-1.5 text-[11px] text-muted-foreground">{defaultLabel}</span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </section>
          ) : null}
        </div>
      <div className={cn('min-h-0 flex-1 overflow-y-auto', shell === 'pane' ? 'pr-1' : 'px-6 py-4')}>
        {mode === 'edit' ? (
          <ProviderInspectorEditor
            item={item}
            allProviders={allProviders}
            devModeUnlocked={devModeUnlocked}
            onSave={onSave}
            onCancel={onCancelEdit}
            onValidateKey={onValidateKey}
          />
        ) : (
          <ProviderInspectorView
            item={item}
            allProviders={allProviders}
            defaultAccountId={defaultAccountId}
            onEdit={onEdit}
            onDelete={onDelete}
            onSetDefault={onSetDefault}
          />
        )}
      </div>
    </section>
  );

  if (shell === 'pane') {
    return <aside className="min-w-0">{content}</aside>;
  }

  return (
    <Dialog open onOpenChange={(open) => {
      if (!open) {
        onClose();
      }
      }}
    >
      <DialogContent className="max-h-[94vh] w-[min(96vw,1240px)] max-w-none overflow-hidden border-0 bg-transparent p-4 shadow-none">
        <DialogTitle className="sr-only">{inspectorTitle}</DialogTitle>
        <DialogDescription className="sr-only">{inspectorDescription}</DialogDescription>
        {content}
      </DialogContent>
    </Dialog>
  );
}
