import type { ReactNode } from 'react';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import type { ChannelConfigContractField, ChannelConfigContractSection, ChannelType } from '@/types/channel';

type EditorValue = string | boolean | number | string[];

interface AgentItem {
  id: string;
  name: string;
}

interface SelectedAccount {
  accountId: string;
  isDefault: boolean;
  agentId?: string;
}

interface SelectedGroup {
  enabled: boolean;
}

interface EditorValidation {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

interface ChannelConfigEditorProps {
  channelType: ChannelType | null;
  title?: string;
  description: string;
  selectedAccountId?: string;
  selectedAccount?: SelectedAccount;
  selectedGroup?: SelectedGroup;
  hasRegistry: boolean;
  basicFields: ChannelConfigContractField[];
  visibleAdvancedSections: ChannelConfigContractSection[];
  candidateSections: ChannelConfigContractSection[];
  editorValues: Record<string, EditorValue>;
  accountIdDraft: string;
  agents: AgentItem[];
  editorLoading: boolean;
  editorSaving: boolean;
  editorValidating: boolean;
  editorTogglingEnabled: boolean;
  selectedIsWeixin: boolean;
  weixinGuardianEnabled: boolean;
  weixinGuardianLoading: boolean;
  weixinGuardianSaving: boolean;
  weixinGuardianToneClass: string;
  weixinGuardianMessageKey: string;
  showWeixinGuardianRelogin: boolean;
  editorValidation: EditorValidation | null;
  editorScrollbarClass: string;
  t: (key: string, options?: Record<string, unknown>) => string;
  onAccountIdChange: (value: string) => void;
  onFieldChange: (key: string, value: EditorValue) => void;
  onValidate: () => void;
  onSave: () => void;
  onToggleEnabled: (checked: boolean) => void;
  onBindAgent: (agentId: string) => void;
  onOpenModal: () => void;
  onWeixinGuardianToggle: (checked: boolean) => void;
}

const paneSurfaceClass =
  'app-pane-surface min-w-0 rounded-xl border border-[hsl(var(--border-subtle)/0.82)] bg-[hsl(var(--surface-elevated)/0.98)] shadow-none';
const sectionCardClass = 'rounded-lg border border-[hsl(var(--border-subtle)/0.5)] bg-[hsl(var(--surface-base)/0.42)] px-2.75 py-2.5 shadow-none';
const fieldCardClass = 'rounded-md border border-[hsl(var(--border-subtle)/0.44)] bg-[hsl(var(--surface-base)/0.56)] shadow-sm';
const compactFieldCardClass = 'rounded-md border border-transparent bg-transparent shadow-none';
const inspectorTitleClass = 'text-[14px] font-semibold tracking-tight text-foreground md:text-[15px]';
const inspectorSubtitleClass = 'mt-0.5 text-[11px] leading-5 text-muted-foreground/72';

const resolveTranslationText = (t: (key: string) => string, value?: string) =>
  !value ? '' : value.startsWith('channels:') ? t(value.replace('channels:', '')) : value;

const isStringArrayValue = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === 'string');

const getFieldValueForDisplay = (field: ChannelConfigContractField, value: EditorValue | undefined): EditorValue | undefined =>
  value !== undefined ? value : field.defaultValue;

const getFieldStringValue = (field: ChannelConfigContractField, value: EditorValue | undefined): string => {
  const resolved = getFieldValueForDisplay(field, value);
  if (typeof resolved === 'string') return resolved;
  if (typeof resolved === 'number') return String(resolved);
  if (isStringArrayValue(resolved)) return resolved.join(', ');
  return '';
};

const getFieldBooleanValue = (field: ChannelConfigContractField, value: EditorValue | undefined): boolean =>
  getFieldValueForDisplay(field, value) === true;

const getFieldSummaryValue = (
  field: ChannelConfigContractField,
  value: EditorValue | undefined,
  t: (key: string, options?: Record<string, unknown>) => string,
): string | null => {
  const resolved = getFieldValueForDisplay(field, value);
  if (resolved === undefined || resolved === null) return null;

  if (field.valueType === 'password') {
    return typeof resolved === 'string' && resolved.trim().length > 0 ? t('editor.summaryConfigured') : null;
  }

  if (typeof resolved === 'string') {
    const trimmed = resolved.trim();
    if (!trimmed) return null;
    const option = field.options?.find((item) => item.value === trimmed);
    return resolveTranslationText(t, option?.label || trimmed);
  }

  if (typeof resolved === 'boolean') {
    return resolved ? t('enabledLabel') : t('disabledLabel');
  }

  if (typeof resolved === 'number') {
    return String(resolved);
  }

  if (isStringArrayValue(resolved)) {
    const items = resolved.map((item) => item.trim()).filter(Boolean);
    if (items.length === 0) return null;
    if (items.length <= 2) {
      return items.join(', ');
    }
    return `${items.slice(0, 2).join(', ')} ${t('editor.summaryMoreCount', { count: items.length - 2 })}`;
  }

  return null;
};

const getSectionSummary = (
  section: ChannelConfigContractSection,
  editorValues: Record<string, EditorValue>,
  t: (key: string, options?: Record<string, unknown>) => string,
): string | null => {
  const summaryItems = section.fields.flatMap((field) => {
    const summaryValue = getFieldSummaryValue(field, editorValues[field.key], t);
    if (!summaryValue) return [];
    return [`${resolveTranslationText(t, field.label)}：${summaryValue}`];
  });

  if (summaryItems.length === 0) return null;
  return summaryItems.slice(0, 2).join(' · ');
};

const getCompactSectionLabel = (label: string): string => {
  if (label === 'editor.basicTitle' || label === '基础配置') return '配置';
  if (label === 'editor.behaviorTitle' || label === '通用行为') return '通用';
  return label;
};

const getCompactAdvancedSectionLabel = (sectionId: string, label: string): string => {
  if (sectionId === 'access') return '接入规则';
  if (sectionId === 'plugin-basics') return '插件设置';
  return label;
};

const getBasicSectionSummary = (
  basicFields: ChannelConfigContractField[],
  editorValues: Record<string, EditorValue>,
  t: (key: string, options?: Record<string, unknown>) => string,
): string | null => {
  const summaryItems = basicFields.flatMap((field) => {
    const summaryValue = getFieldSummaryValue(field, editorValues[field.key], t);
    if (!summaryValue) return [];
    return [summaryValue];
  });
  if (summaryItems.length === 0) return null;
  return summaryItems.slice(0, 2).join(' · ');
};

const getBehaviorSectionSummary = (
  selectedGroup: SelectedGroup | undefined,
  selectedAccount: SelectedAccount | undefined,
  t: (key: string, options?: Record<string, unknown>) => string,
): string =>
  [
    selectedGroup?.enabled ? t('enabledLabel') : t('disabledLabel'),
    selectedAccount?.agentId ? t('account.boundTo', { agent: selectedAccount.agentId }) : t('account.unassigned'),
  ].join(' · ');

function EditorSectionHeader({
  title,
  summary,
  className,
}: {
  title: string;
  summary?: string | null;
  className?: string;
}) {
  return (
    <div className={cn('mb-3 flex items-center justify-between gap-3', className)}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-foreground/58">
        {title}
      </p>
      {summary && (
        <p className="truncate text-right text-[10.5px] leading-5 text-muted-foreground/66" title={summary}>
          {summary}
        </p>
      )}
    </div>
  );
}

export function ChannelConfigEditor({
  channelType,
  title,
  description,
  selectedAccountId,
  selectedAccount,
  selectedGroup,
  hasRegistry,
  basicFields,
  visibleAdvancedSections,
  candidateSections,
  editorValues,
  accountIdDraft,
  agents,
  editorLoading,
  editorSaving,
  editorValidating,
  editorTogglingEnabled,
  selectedIsWeixin,
  weixinGuardianEnabled,
  weixinGuardianLoading,
  weixinGuardianSaving,
  weixinGuardianToneClass,
  weixinGuardianMessageKey,
  showWeixinGuardianRelogin,
  editorValidation,
  editorScrollbarClass,
  t,
  onAccountIdChange,
  onFieldChange,
  onValidate,
  onSave,
  onToggleEnabled,
  onBindAgent,
  onOpenModal,
  onWeixinGuardianToggle,
}: ChannelConfigEditorProps) {
  const basicTitle = getCompactSectionLabel(t('editor.basicTitle'));
  const behaviorTitle = getCompactSectionLabel(t('editor.behaviorTitle'));
  const basicSummary = getBasicSectionSummary(basicFields, editorValues, t);
  const behaviorSummary = getBehaviorSectionSummary(selectedGroup, selectedAccount, t);

  if (!title || !channelType) {
    return (
      <section className={cn(paneSurfaceClass, 'p-3.5')}>
        <div className="app-empty-surface rounded-md p-5 text-sm text-muted-foreground">
          {t('availableDesc')}
        </div>
      </section>
    );
  }

  if (selectedIsWeixin && !selectedGroup) {
    return (
      <section className={cn(paneSurfaceClass, 'p-3.5')}>
        <div className="space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h3 className={inspectorTitleClass}>{title}</h3>
              <p className={inspectorSubtitleClass}>{description}</p>
            </div>
          </div>
          <Button onClick={onOpenModal} className="h-8 rounded-md px-3 text-[11.5px]">
            {t('account.addByQr')}
          </Button>
        </div>
      </section>
    );
  }

  if (channelType === 'whatsapp') {
    return (
      <section className={cn(paneSurfaceClass, 'p-3.5')}>
        <div className="space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h3 className={inspectorTitleClass}>{title}</h3>
              <p className={inspectorSubtitleClass}>{description}</p>
            </div>
          </div>
          <Button onClick={onOpenModal} className="h-8 rounded-md px-3 text-[11.5px]">
            {t('dialog.generateQRCode')}
          </Button>
        </div>
      </section>
    );
  }

  if (!hasRegistry) {
    return (
      <section className={cn(paneSurfaceClass, 'p-3.5')}>
        <div className="space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h3 className={inspectorTitleClass}>{title}</h3>
              <p className={inspectorSubtitleClass}>{description}</p>
            </div>
          </div>
          <Button onClick={onOpenModal} className="h-8 rounded-md px-3 text-[11.5px]">
            {selectedGroup ? t('account.edit') : t('dialog.saveAndConnect')}
          </Button>
        </div>
      </section>
    );
  }

  return (
    <section className={cn(paneSurfaceClass, 'p-3.5')}>
      <div className="flex min-h-[500px] flex-col">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h3 className={inspectorTitleClass}>{title}</h3>
            <p className={inspectorSubtitleClass}>
              {selectedAccount ? t('account.idLabel', { id: selectedAccount.accountId }) : description}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              className="h-7 rounded-md px-3 text-[11.5px]"
              onClick={onOpenModal}
            >
              {selectedIsWeixin ? t(selectedAccountId ? 'account.relogin' : 'account.addByQr') : t('account.edit')}
            </Button>
          </div>
        </div>

        <div data-testid="channels-editor-scroll" className={cn('mt-4 flex-1 space-y-3 overflow-y-auto pr-2', editorScrollbarClass)}>
          <div className={sectionCardClass}>
            <EditorSectionHeader title={basicTitle} summary={basicSummary} />
            <div data-testid="channel-basic-fields-grid" className="grid gap-1.5 md:grid-cols-2">
              <div
                data-testid="channel-account-id-card"
                className={cn(compactFieldCardClass, 'px-2.5 py-2 md:col-span-2')}
                title={selectedIsWeixin ? t('account.readonlyIdHint') : t('account.renameHint')}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Label htmlFor="channel-account-id" className="text-xs font-medium text-foreground/80">
                    {t('account.customIdLabel')}
                  </Label>
                  {selectedAccount?.isDefault && (
                    <Badge
                      variant="secondary"
                      className="h-5 rounded-sm border border-border/55 bg-[hsl(var(--foreground)/0.04)] px-1.5 text-[10px] font-medium text-foreground/72 shadow-none hover:bg-[hsl(var(--foreground)/0.04)]"
                    >
                      {t('account.default')}
                    </Badge>
                  )}
                </div>
                <Input
                  id="channel-account-id"
                  value={accountIdDraft}
                  disabled={editorLoading || editorSaving}
                  readOnly={selectedIsWeixin}
                  onChange={(event) => {
                    if (!selectedIsWeixin) {
                      onAccountIdChange(event.target.value);
                    }
                  }}
                  placeholder={selectedIsWeixin ? '' : t('account.customIdPlaceholder')}
                  className="app-field-surface mt-1.5 h-8 rounded-md border-[hsl(var(--border-subtle)/0.72)] bg-[hsl(var(--surface-elevated)/0.98)] text-[12.5px] shadow-sm"
                />
              </div>
              {basicFields.map((field) => (
                <ChannelFieldEditor
                  key={field.key}
                  field={field}
                  t={t}
                  value={editorValues[field.key]}
                  disabled={editorLoading || editorSaving}
                  compact
                  onChange={(value) => onFieldChange(field.key, value)}
                />
              ))}
            </div>
          </div>

          <div className={sectionCardClass}>
            <EditorSectionHeader title={behaviorTitle} summary={behaviorSummary} />
            <div data-testid="channel-behavior-grid" className="grid gap-1.5 md:grid-cols-2">
              <div className={cn(compactFieldCardClass, 'grid gap-2 px-2.5 py-2 md:grid-cols-[minmax(0,1fr)_auto] md:items-center')}>
                <div className="min-w-0">
                  <Label className="text-[11.5px] font-medium text-foreground">{t('dialog.enableChannel')}</Label>
                  <p className="mt-0.5 text-[10.5px] leading-5 text-muted-foreground/72">
                    {selectedGroup?.enabled ? t('enabledLabel') : t('disabledLabel')}
                  </p>
                </div>
                <Switch
                  checked={selectedGroup?.enabled ?? true}
                  disabled={!channelType || editorTogglingEnabled}
                  onCheckedChange={onToggleEnabled}
                />
              </div>

              <div className={cn(compactFieldCardClass, 'grid gap-2 px-2.5 py-2 md:grid-cols-[minmax(0,1fr)_minmax(220px,240px)] md:items-center')}>
                <div className="min-w-0">
                  <Label htmlFor="channel-account-agent" className="text-[11.5px] font-medium text-foreground">
                    {t('account.bindAgentLabel')}
                  </Label>
                  <p className="mt-0.5 text-[10.5px] leading-5 text-muted-foreground/72 line-clamp-1">
                    {selectedAccount?.agentId || t('account.unassigned')}
                  </p>
                </div>
                <Select
                  id="channel-account-agent"
                  value={selectedAccount?.agentId || ''}
                  data-testid="channel-agent-select-trigger"
                  onValueChange={onBindAgent}
                  options={[
                    { value: '', label: t('account.unassigned') },
                    ...agents.map((agent) => ({
                      value: agent.id,
                      label: agent.name,
                    })),
                  ]}
                  className="app-field-surface h-8 w-full max-w-full rounded-md text-[12.5px] shadow-sm"
                />
              </div>
            </div>
          </div>

          {selectedIsWeixin && selectedAccount && (
            <div className={sectionCardClass}>
              <div className="mb-3 flex items-center justify-between gap-3">
                <EditorSectionHeader
                  title={t('weixin.guardian.title')}
                  summary={t(weixinGuardianEnabled ? 'enabledLabel' : 'disabledLabel')}
                  className="mb-0 flex-1"
                />
                <Switch
                  data-testid="weixin-guardian-switch"
                  checked={weixinGuardianEnabled}
                  disabled={weixinGuardianLoading || weixinGuardianSaving}
                  onCheckedChange={onWeixinGuardianToggle}
                />
              </div>

              <div className={cn(fieldCardClass, 'space-y-2.5 px-3 py-2.5', weixinGuardianToneClass)}>
                <p className="text-[12px] font-medium">{t(weixinGuardianMessageKey)}</p>
                <p className="text-[11px] leading-5">{t('weixin.guardian.noAutoKeepAlive')}</p>
                {showWeixinGuardianRelogin && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 rounded-md px-2.5 text-[10.5px]"
                    onClick={onOpenModal}
                  >
                    {t('account.relogin')}
                  </Button>
                )}
              </div>
            </div>
          )}

          {selectedIsWeixin && (
            <div className={sectionCardClass}>
              <EditorSectionHeader title={t('weixin.limits.title')} summary="24h" />
              <div className={cn(fieldCardClass, 'space-y-2 px-3 py-2.5 text-[11px] leading-5 text-muted-foreground/78')}>
                <p>{t('weixin.limits.items.accountId')}</p>
                <p>{t('weixin.limits.items.relogin')}</p>
                <p>{t('weixin.limits.items.expiry')}</p>
                <p>{t('weixin.limits.items.guard')}</p>
              </div>
            </div>
          )}

          {visibleAdvancedSections.map((section) => (
            <ChannelEditorSection
              key={section.id}
              sectionId={section.id}
              title={getCompactAdvancedSectionLabel(section.id, section.label)}
              subtitle={getSectionSummary(section, editorValues, t) || t('editor.sectionSubtitle', { count: section.fields.length })}
              defaultOpen={section.id === 'access'}
              compact
            >
              {section.fields.map((field) => (
                <ChannelFieldEditor
                  key={field.key}
                  field={field}
                  t={t}
                  value={editorValues[field.key]}
                  disabled={editorLoading || editorSaving}
                  compact
                  onChange={(value) => onFieldChange(field.key, value)}
                />
              ))}
            </ChannelEditorSection>
          ))}

          {candidateSections.map((section) => (
            <ChannelEditorSection
              key={section.id}
              sectionId={section.id}
              title={getCompactAdvancedSectionLabel(section.id, section.label)}
              subtitle={getSectionSummary(section, editorValues, t) || t('editor.pluginSectionSubtitle', { count: section.fields.length })}
              badge={t('editor.pluginBadge')}
              compact
            >
              {section.fields.map((field) => (
                <ChannelFieldEditor
                  key={field.key}
                  field={field}
                  t={t}
                  value={editorValues[field.key]}
                  disabled={editorLoading || editorSaving}
                  compact
                  onChange={(value) => onFieldChange(field.key, value)}
                />
              ))}
            </ChannelEditorSection>
          ))}

          {editorValidation && (
            <div
              className={cn(
                'rounded-md border px-4 py-3 text-sm',
                editorValidation.valid
                  ? 'border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-300'
                  : 'border-destructive/30 bg-destructive/10 text-destructive',
              )}
            >
              {editorValidation.errors.length > 0 && (
                <div className="space-y-1">
                  {editorValidation.errors.map((item) => (
                    <p key={item}>{item}</p>
                  ))}
                </div>
              )}
              {editorValidation.warnings.length > 0 && (
                <div className={cn('space-y-1', editorValidation.errors.length > 0 && 'mt-3')}>
                  {editorValidation.warnings.map((item) => (
                    <p key={item}>{item}</p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-end gap-2 border-t border-border/60 pt-3">
          <Button
            type="button"
            variant="outline"
            className="h-7 rounded-md px-3 text-[11.5px]"
            disabled={editorLoading || editorValidating || editorSaving}
            onClick={onValidate}
          >
            {editorValidating ? t('dialog.validating') : t('dialog.validateConfig')}
          </Button>
          <Button
            type="button"
            className="h-7 rounded-md px-3 text-[11.5px]"
            disabled={editorLoading || editorSaving}
            onClick={onSave}
          >
            {editorSaving ? t('dialog.validatingAndSaving') : selectedGroup ? t('dialog.updateAndReconnect') : t('dialog.saveAndConnect')}
          </Button>
        </div>
      </div>
    </section>
  );
}

function ChannelEditorSection({
  sectionId,
  title,
  subtitle,
  badge,
  defaultOpen = false,
  compact = false,
  children,
}: {
  sectionId?: string;
  title: string;
  subtitle: string;
  badge?: string;
  defaultOpen?: boolean;
  compact?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <details
      data-testid={sectionId ? `channel-editor-section-${sectionId}` : undefined}
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
      className="rounded-md border border-[hsl(var(--border-subtle)/0.48)] bg-[hsl(var(--surface-base)/0.4)] px-2.75 py-2.25 shadow-sm"
    >
      <summary className="flex cursor-default list-none items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-foreground/58">{title}</p>
          <p className="line-clamp-1 text-[10.5px] leading-5 text-muted-foreground/68" title={subtitle}>
            {subtitle}
          </p>
        </div>
        {badge && (
          <Badge
            variant="secondary"
            className="h-5 rounded-sm border border-border/55 bg-[hsl(var(--foreground)/0.04)] px-1.5 text-[10px] font-medium text-foreground/72 shadow-none hover:bg-[hsl(var(--foreground)/0.04)]"
          >
            {badge}
          </Badge>
        )}
      </summary>
      <div
        data-testid={sectionId ? `channel-editor-section-content-${sectionId}` : undefined}
        className={cn(
          compact ? 'mt-2 grid gap-1.5 md:grid-cols-2' : 'mt-2.5 grid gap-2.5',
        )}
      >
        {children}
      </div>
    </details>
  );
}

function ChannelFieldEditor({
  field,
  value,
  disabled,
  compact = false,
  onChange,
  t,
}: {
  field: ChannelConfigContractField;
  value: EditorValue | undefined;
  disabled?: boolean;
  compact?: boolean;
  onChange: (value: EditorValue) => void;
  t: (key: string, options?: Record<string, unknown>) => string;
}) {
  const label = resolveTranslationText(t, field.label);
  const description = resolveTranslationText(t, field.description);
  const placeholder = resolveTranslationText(t, field.placeholder);
  const inputId = `channel-editor-${field.key}`;
  const defaultValueLabel = field.defaultValue === undefined
    ? null
    : typeof field.defaultValue === 'boolean'
      ? field.defaultValue ? t('enabledLabel') : t('disabledLabel')
      : typeof field.defaultValue === 'number'
        ? String(field.defaultValue)
        : isStringArrayValue(field.defaultValue)
          ? field.defaultValue.join(', ')
          : field.defaultValue;
  const defaultBadgeLabel = defaultValueLabel ? t('editor.defaultValueBadge', { value: defaultValueLabel }) : null;

  if (field.type === 'boolean') {
    return (
      <div className={cn(compact ? compactFieldCardClass : fieldCardClass, compact ? 'px-2.5 py-2' : 'px-3 py-2.75')}>
        <div className={cn('flex items-start justify-between gap-3', compact && 'md:items-center')}>
          <div className="min-w-0 flex-1 space-y-1">
            <Label className="text-[11px] font-medium text-foreground/78">{label}</Label>
            {!compact && description && <p className="line-clamp-2 text-[11px] leading-5 text-muted-foreground/82" title={description}>{description}</p>}
          </div>
          {defaultBadgeLabel && (
            <span
              className="max-w-[11rem] truncate rounded-sm border border-border/55 bg-[hsl(var(--foreground)/0.035)] px-2 py-1 text-[10px] font-medium text-muted-foreground"
              title={t('editor.defaultValueLabel', { value: defaultValueLabel })}
            >
              {defaultBadgeLabel}
            </span>
          )}
          <Switch checked={getFieldBooleanValue(field, value)} disabled={disabled} onCheckedChange={onChange} />
        </div>
      </div>
    );
  }

  if (field.type === 'select') {
    return (
      <div
        className={cn(
          compact ? compactFieldCardClass : fieldCardClass,
          compact ? 'space-y-1 px-2.5 py-2' : 'space-y-1.5 px-3 py-2.75',
        )}
        title={compact && description ? description : undefined}
      >
        <div data-testid={`channel-field-header-${field.key}`}>
          <div className="flex items-start justify-between gap-3">
            <Label htmlFor={inputId} className="min-w-0 flex-1 text-[11px] font-medium text-foreground/78">{label}</Label>
            {defaultBadgeLabel && (
              <span
                className="max-w-[11rem] truncate rounded-sm border border-border/55 bg-[hsl(var(--foreground)/0.035)] px-2 py-1 text-[10px] font-medium text-muted-foreground"
                title={t('editor.defaultValueLabel', { value: defaultValueLabel })}
              >
                {defaultBadgeLabel}
              </span>
            )}
          </div>
          {!compact && description && <p className="text-[11px] leading-5 text-muted-foreground/82">{description}</p>}
        </div>
        <Select
          id={inputId}
          value={getFieldStringValue(field, value)}
          data-testid={`channel-field-select-trigger-${field.key}`}
          disabled={disabled}
          placeholder={placeholder || t('editor.selectPlaceholder')}
          onValueChange={onChange}
          options={(field.options || []).map((option) => ({
            value: option.value,
            label: resolveTranslationText(t, option.label),
          }))}
          className={cn(
            'app-field-surface rounded-md border-[hsl(var(--border-subtle)/0.82)] bg-[hsl(var(--surface-elevated)/0.98)] text-[12.5px] shadow-sm',
            compact ? 'h-7.5' : 'h-8.5',
          )}
        />
      </div>
    );
  }

  if (field.type === 'array') {
    return (
      <ChannelTextField
        field={field}
        label={label}
        description={description}
        defaultBadgeLabel={defaultBadgeLabel}
        defaultValueLabel={defaultValueLabel}
        inputId={inputId}
        placeholder={placeholder}
        value={getFieldStringValue(field, value)}
        disabled={disabled}
        compact={compact}
        t={t}
        onChange={(nextValue) =>
          onChange(
            nextValue
              .split(',')
              .map((item) => item.trim())
              .filter(Boolean),
          )}
      />
    );
  }

  if (field.type === 'number') {
    return (
      <ChannelTextField
        field={field}
        label={label}
        description={description}
        defaultBadgeLabel={defaultBadgeLabel}
        defaultValueLabel={defaultValueLabel}
        inputId={inputId}
        placeholder={placeholder}
        value={getFieldStringValue(field, value)}
        type="number"
        disabled={disabled}
        compact={compact}
        t={t}
        onChange={(nextValue) => onChange(nextValue === '' ? '' : Number(nextValue))}
      />
    );
  }

  return (
    <ChannelTextField
      field={field}
      label={label}
      description={description}
      defaultBadgeLabel={defaultBadgeLabel}
      defaultValueLabel={defaultValueLabel}
      inputId={inputId}
      placeholder={placeholder}
      value={getFieldStringValue(field, value)}
      type={field.valueType === 'password' ? 'password' : 'text'}
      disabled={disabled}
      compact={compact}
      t={t}
      onChange={onChange}
    />
  );
}

function ChannelTextField({
  field,
  label,
  description,
  defaultBadgeLabel,
  defaultValueLabel,
  inputId,
  placeholder,
  value,
  type = 'text',
  disabled,
  compact = false,
  t,
  onChange,
}: {
  field: ChannelConfigContractField;
  label: string;
  description: string;
  defaultBadgeLabel: string | null;
  defaultValueLabel: string | null;
  inputId: string;
  placeholder: string;
  value: string;
  type?: string;
  disabled?: boolean;
  compact?: boolean;
  t: (key: string, options?: Record<string, unknown>) => string;
  onChange: (value: string) => void;
}) {
  return (
    <div
      className={cn(
        compact ? compactFieldCardClass : fieldCardClass,
        compact ? 'space-y-1 px-2.5 py-2' : 'space-y-1.5 px-3 py-2.75',
      )}
      title={compact && description ? description : undefined}
    >
      <div data-testid={`channel-field-header-${field.key}`}>
        <div className="flex items-start justify-between gap-3">
          <Label htmlFor={inputId} className="min-w-0 flex-1 text-[11px] font-medium text-foreground/78">{label}</Label>
          {defaultBadgeLabel && (
            <span
              className="max-w-[11rem] truncate rounded-sm border border-border/55 bg-[hsl(var(--foreground)/0.035)] px-2 py-1 text-[10px] font-medium text-muted-foreground"
              title={t('editor.defaultValueLabel', { value: defaultValueLabel })}
            >
              {defaultBadgeLabel}
            </span>
          )}
        </div>
        {!compact && description && <p className="text-[11px] leading-5 text-muted-foreground/82">{description}</p>}
      </div>

      <Input
        id={inputId}
        type={type}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className={cn(
          'app-field-surface rounded-md border-[hsl(var(--border-subtle)/0.82)] bg-[hsl(var(--surface-elevated)/0.98)] text-[12.5px] shadow-none',
          compact ? 'h-7.5' : 'h-8.5',
        )}
      />
    </div>
  );
}
