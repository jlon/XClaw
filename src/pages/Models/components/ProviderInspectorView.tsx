import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { getProviderTypeInfo } from '@/lib/providers';
import { hasConfiguredCredentials, type ProviderListItem } from '@/lib/provider-accounts';
import {
  getAuthModeLabel,
  normalizeFallbackModels,
  normalizeFallbackProviderIds,
} from '@/components/settings/providers/ProviderAccountFormSections';

interface ProviderInspectorViewProps {
  item: ProviderListItem;
  allProviders: ProviderListItem[];
  defaultAccountId: string | null;
  onEdit: () => void;
  onDelete: () => void;
  onSetDefault: () => void;
}

interface FactRowProps {
  label: string;
  value: React.ReactNode;
  span?: 'normal' | 'full';
}

const surfaceClass = 'app-insight-surface rounded-[14px] border border-[hsl(var(--border-subtle)/0.78)] px-4 py-3';

function FactRow({ label, value, span = 'normal' }: FactRowProps) {
  return (
    <div className={cn('space-y-1', span === 'full' && 'md:col-span-2')}>
      <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground/74">{label}</p>
      <div className="text-[13px] leading-5 text-foreground/82">{value}</div>
    </div>
  );
}

export function ProviderInspectorView({
  item,
  allProviders,
  defaultAccountId,
  onEdit,
  onDelete,
  onSetDefault,
}: ProviderInspectorViewProps) {
  const { t } = useTranslation(['dashboard', 'settings']);
  const { account, status } = item;
  const typeInfo = getProviderTypeInfo(account.vendorId);
  const isDefault = defaultAccountId === account.id;
  const fallbackNames = [
    ...normalizeFallbackModels(account.fallbackModels),
    ...normalizeFallbackProviderIds(account.fallbackAccountIds)
      .map((fallbackId) => allProviders.find((candidate) => candidate.account.id === fallbackId)?.account.label)
      .filter(Boolean),
  ];
  const configured = hasConfiguredCredentials(account, status);

  return (
    <div className="space-y-3">
      <section className={surfaceClass}>
        <div className="grid gap-x-6 gap-y-3 md:grid-cols-2">
          <FactRow
            label={t('settings:aiProviders.sections.basic', '基础信息')}
            value={[typeInfo?.name || account.vendorId, getAuthModeLabel(account.authMode, (key) => t(`settings:${key}`)), account.label].filter(Boolean).join(' · ')}
          />
          <FactRow
            label={t('settings:aiProviders.sections.connection', '接入配置')}
            value={[account.baseUrl || t('dashboard:models.globalScopeHint', '全局范围'), account.model || t('settings:aiProviders.overview.noModelSelected', '未选择模型'), account.apiProtocol || 'openai-completions'].filter(Boolean).join(' · ')}
          />
          <FactRow
            label={t('settings:aiProviders.sections.fallbackStrategy', '回退策略')}
            value={fallbackNames.length > 0 ? fallbackNames.join(' · ') : t('settings:aiProviders.card.none', '无')}
            span="full"
          />
          <FactRow
            label={t('settings:aiProviders.sections.credentials', '凭证与验证')}
            value={(
              <span>{configured ? t('settings:aiProviders.card.configured', '已配置') : t('settings:aiProviders.dialog.apiKeyMissing', '未配置 API Key')}</span>
            )}
            span="full"
          />
        </div>
      </section>

      <footer className="flex flex-wrap items-center justify-end gap-2 pt-0.5" data-testid="models-provider-inspector-footer">
        <Button type="button" variant="outline" size="sm" className="rounded-full px-4" onClick={onEdit}>
          {t('dashboard:models.editProvider', { label: account.label, defaultValue: `编辑 ${account.label}` })}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="rounded-full px-3 text-foreground/78 hover:text-foreground"
          onClick={onSetDefault}
          disabled={isDefault}
        >
          {t('dashboard:models.setDefaultProvider', { label: account.label, defaultValue: `设为默认 · ${account.label}` })}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="rounded-full px-3 text-destructive/82 hover:text-destructive"
          onClick={onDelete}
        >
          {t('dashboard:models.deleteProvider', { label: account.label, defaultValue: `删除 ${account.label}` })}
        </Button>
      </footer>
    </div>
  );
}
