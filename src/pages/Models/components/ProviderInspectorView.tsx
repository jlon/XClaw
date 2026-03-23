import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { getProviderDocsUrl, getProviderTypeInfo } from '@/lib/providers';
import { hasConfiguredCredentials, type ProviderListItem } from '@/lib/provider-accounts';
import {
  getAuthModeLabel,
  normalizeFallbackModels,
  normalizeFallbackProviderIds,
} from '@/components/settings/providers/ProviderAccountFormSections';
import { useTranslation } from 'react-i18next';

interface ProviderInspectorViewProps {
  item: ProviderListItem;
  allProviders: ProviderListItem[];
  defaultAccountId: string | null;
  onEdit: () => void;
  onDelete: () => void;
  onSetDefault: () => void;
}

const sectionTitleClass = 'text-[13px] font-semibold text-foreground';
const sectionValueClass = 'text-[13px] leading-5 text-foreground/78';
const sectionSurfaceClass = 'app-insight-surface rounded-[13px] border border-[hsl(var(--border-subtle)/0.78)] px-3 py-2.5';

function Section({
  title,
  children,
  span = 'normal',
}: {
  title: string;
  children: React.ReactNode;
  span?: 'normal' | 'full';
}) {
  return (
    <section className={cn('space-y-1.5', sectionSurfaceClass, span === 'full' && 'md:col-span-2')}>
      <h3 className={sectionTitleClass}>{title}</h3>
      <div className={sectionValueClass}>{children}</div>
    </section>
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
  const { t, i18n } = useTranslation(['dashboard', 'settings']);
  const { account, status } = item;
  const typeInfo = getProviderTypeInfo(account.vendorId);
  const isDefault = defaultAccountId === account.id;
  const fallbackNames = [
    ...normalizeFallbackModels(account.fallbackModels),
    ...normalizeFallbackProviderIds(account.fallbackAccountIds)
      .map((fallbackId) => allProviders.find((candidate) => candidate.account.id === fallbackId)?.account.label)
      .filter(Boolean),
  ];
  const docsUrl = typeInfo ? getProviderDocsUrl(typeInfo, i18n.language) ?? typeInfo.apiKeyUrl : undefined;

  return (
    <div className="space-y-3">
      <div className="grid gap-2.5 md:grid-cols-2">
        <Section title={t('settings:aiProviders.sections.basic', '基础信息')}>
          <p>{[typeInfo?.name || account.vendorId, getAuthModeLabel(account.authMode, (key) => t(`settings:${key}`)), account.label].filter(Boolean).join(' · ')}</p>
        </Section>

        <Section title={t('settings:aiProviders.sections.connection', '接入配置')}>
          <p>{[account.baseUrl || t('dashboard:models.globalScopeHint', '全局范围'), account.model || t('settings:aiProviders.overview.noModelSelected', '未选择模型'), account.apiProtocol || 'openai-completions'].filter(Boolean).join(' · ')}</p>
        </Section>

        <Section title={t('settings:aiProviders.sections.fallbackStrategy', '回退策略')}>
          <p>{fallbackNames.length > 0 ? fallbackNames.join(' · ') : t('settings:aiProviders.card.none', '无')}</p>
        </Section>

        <Section title={t('settings:aiProviders.sections.credentials', '凭证与验证')}>
          <div className="flex flex-wrap items-center gap-3">
            <span>{hasConfiguredCredentials(account, status) ? t('settings:aiProviders.card.configured', '已配置') : t('settings:aiProviders.dialog.apiKeyMissing', '未配置 API Key')}</span>
            {docsUrl ? (
              <a
                href={docsUrl}
                target="_blank"
                rel="noreferrer"
                className="font-medium text-primary hover:text-primary/82"
              >
                {t('dashboard:models.docs', 'docs')}
              </a>
            ) : null}
          </div>
        </Section>
      </div>

      <footer className="flex flex-wrap items-center justify-end gap-2 pt-0.5" data-testid="models-provider-inspector-footer">
        <Button type="button" variant="outline" size="sm" className="rounded-full px-4" onClick={onEdit}>
          {t('dashboard:models.editProvider', { label: account.label, defaultValue: `编辑 ${account.label}` })}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="rounded-full px-4"
          onClick={onSetDefault}
          disabled={isDefault}
        >
          {t('dashboard:models.setDefaultProvider', { label: account.label, defaultValue: `设为默认 · ${account.label}` })}
        </Button>
        <Button type="button" variant="destructive" size="sm" className="rounded-full px-4" onClick={onDelete}>
          {t('dashboard:models.deleteProvider', { label: account.label, defaultValue: `删除 ${account.label}` })}
        </Button>
      </footer>
    </div>
  );
}
