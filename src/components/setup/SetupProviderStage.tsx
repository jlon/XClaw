import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { Check, Eye, EyeOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { setupStageContainerVariants, setupStageItemVariants } from './setup-motion';

export interface SetupProviderOption {
  id: string;
  name: ReactNode;
  description?: ReactNode;
  iconUrl?: string;
  iconClassName?: string;
  icon?: ReactNode;
  selected?: boolean;
  disabled?: boolean;
  onSelect?: (id: string) => void;
}

export interface SetupProviderToggleOption {
  id: string;
  label: ReactNode;
  selected?: boolean;
  disabled?: boolean;
  onSelect?: (id: string) => void;
}

export interface SetupProviderField {
  id: string;
  label: ReactNode;
  value: string;
  placeholder?: string;
  type?: 'text' | 'password' | 'url';
  description?: ReactNode;
  error?: ReactNode;
  showValue?: boolean;
  onToggleShowValue?: () => void;
  onChange?: (value: string) => void;
  trailingAction?: ReactNode;
}

export interface SetupProviderMetric {
  label: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
}

export interface SetupProviderStageProps {
  variant: 'configure' | 'review';
  title: ReactNode;
  description?: ReactNode;
  providerOptions?: SetupProviderOption[];
  authModes?: SetupProviderToggleOption[];
  fields?: SetupProviderField[];
  reviewCards?: SetupProviderMetric[];
  blockingIssues?: ReactNode[];
  warnings?: ReactNode[];
  warningsTitle?: ReactNode;
  statusPanel?: ReactNode;
  validationMessage?: ReactNode;
  footerNote?: ReactNode;
  children?: ReactNode;
  className?: string;
}

const renderMetricCard = (metric: SetupProviderMetric) => (
  <div key={String(metric.label)} className="rounded-2xl border border-border/70 app-field-surface p-4">
    <div className="text-sm text-muted-foreground">{metric.label}</div>
    <div className="mt-1 break-all text-sm font-medium text-foreground">{metric.value}</div>
    {metric.hint ? <div className="mt-3 text-xs leading-5 text-muted-foreground">{metric.hint}</div> : null}
  </div>
);

export function SetupProviderStage({
  variant,
  title,
  description,
  providerOptions,
  authModes,
  fields,
  reviewCards,
  blockingIssues,
  warnings,
  warningsTitle,
  statusPanel,
  validationMessage,
  footerNote,
  children,
  className,
}: SetupProviderStageProps) {
  const { t } = useTranslation('setup');
  const isConfigure = variant === 'configure';

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={setupStageContainerVariants}
      className={cn('space-y-6', className)}
    >
      <motion.div variants={setupStageItemVariants} className="space-y-2">
        <h2 className="text-xl font-semibold">{title}</h2>
        {description ? <p className="text-muted-foreground">{description}</p> : null}
      </motion.div>

      {isConfigure && providerOptions?.length ? (
        <motion.div variants={setupStageItemVariants} className="grid gap-3 md:grid-cols-2">
          {providerOptions.map((provider) => (
            <button
              key={provider.id}
              type="button"
              disabled={provider.disabled || !provider.onSelect}
              onClick={() => provider.onSelect?.(provider.id)}
              className={cn(
                'workbench-motion-button workbench-motion-button--lift rounded-2xl border p-4 text-left',
                provider.selected
                  ? 'border-primary/40 bg-primary/8 shadow-sm'
                  : 'border-border/70 app-field-surface hover:border-primary/30',
                (provider.disabled || !provider.onSelect) && 'cursor-default opacity-70',
              )}
            >
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border/70 bg-[hsl(var(--surface-panel)/0.9)] dark:bg-[hsl(var(--surface-elevated)/0.82)]">
                  {provider.iconUrl ? (
                    <img src={provider.iconUrl} alt="" className={provider.iconClassName || 'h-6 w-6 object-contain'} />
                  ) : provider.icon ? (
                    <span className="text-lg">{provider.icon}</span>
                  ) : (
                    <Check className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-base font-medium text-foreground">{provider.name}</div>
                  {provider.description ? (
                    <div className="mt-2 text-sm leading-6 text-muted-foreground">{provider.description}</div>
                  ) : null}
                </div>
              </div>
            </button>
          ))}
        </motion.div>
      ) : null}

      {isConfigure && authModes?.length ? (
        <motion.div variants={setupStageItemVariants} className="flex overflow-hidden rounded-2xl border border-border/70 text-sm">
          {authModes.map((mode) => (
            <button
              key={mode.id}
              type="button"
              disabled={mode.disabled || !mode.onSelect}
              onClick={() => mode.onSelect?.(mode.id)}
              className={cn(
                'workbench-motion-button flex-1 px-3 py-2',
                mode.selected
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-[hsl(var(--surface-elevated)/0.82)] hover:text-foreground',
                (mode.disabled || !mode.onSelect) && 'cursor-default opacity-70',
              )}
            >
              {mode.label}
            </button>
          ))}
        </motion.div>
      ) : null}

      {isConfigure && fields?.length ? (
        <motion.div variants={setupStageItemVariants} className="space-y-4">
          {fields.map((field) => (
            <div key={field.id} className="space-y-2">
              <Label htmlFor={field.id}>{field.label}</Label>
              <div className="relative">
                <Input
                  id={field.id}
                  type={field.type ?? 'text'}
                  value={field.value}
                  placeholder={field.placeholder}
                  onChange={(event) => field.onChange?.(event.target.value)}
                  className={cn('pr-10 app-field-surface', field.error ? 'border-destructive/40' : undefined)}
                />
                {field.showValue !== undefined ? (
                  <button
                    type="button"
                    onClick={field.onToggleShowValue}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    disabled={!field.onToggleShowValue}
                  >
                    {field.showValue ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                ) : field.trailingAction ? (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">{field.trailingAction}</div>
                ) : null}
              </div>
              {field.description ? <div className="text-xs leading-5 text-muted-foreground">{field.description}</div> : null}
              {field.error ? <div className="text-sm text-destructive">{field.error}</div> : null}
            </div>
          ))}
        </motion.div>
      ) : null}

      {!isConfigure && reviewCards?.length ? (
        <motion.div variants={setupStageItemVariants} className="grid gap-3 sm:grid-cols-2">
          {reviewCards.map(renderMetricCard)}
        </motion.div>
      ) : null}

      {blockingIssues?.length ? (
        <motion.div variants={setupStageItemVariants} className="rounded-2xl border border-red-500/20 bg-[hsl(var(--danger)/0.08)] p-4">
          <div className="font-medium text-destructive">{t('provider.blockingTitle')}</div>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm leading-6 text-destructive">
            {blockingIssues.map((issue, index) => (
              <li key={`${index}-${String(issue)}`}>{issue}</li>
            ))}
          </ul>
        </motion.div>
      ) : null}

      {warnings?.length ? (
        <motion.div variants={setupStageItemVariants} className="rounded-2xl border border-amber-500/20 bg-[hsl(var(--warning)/0.08)] p-4">
          <div className="font-medium text-amber-700 dark:text-amber-100">{warningsTitle ?? t('provider.warningsTitle')}</div>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm leading-6 text-amber-800 dark:text-amber-50">
            {warnings.map((warning, index) => (
              <li key={`${index}-${String(warning)}`}>{warning}</li>
            ))}
          </ul>
        </motion.div>
      ) : null}

      {statusPanel ? (
        <motion.div variants={setupStageItemVariants} className="rounded-xl border border-primary/18 app-insight-surface p-4 text-sm leading-6 text-muted-foreground">
          {statusPanel}
        </motion.div>
      ) : null}

      {validationMessage ? (
        <motion.div variants={setupStageItemVariants} className="rounded-xl app-insight-surface p-4 text-sm leading-6 text-muted-foreground">
          {validationMessage}
        </motion.div>
      ) : null}

      {footerNote ? (
        <motion.div variants={setupStageItemVariants} className="rounded-xl app-insight-surface p-4 text-sm leading-6 text-muted-foreground">
          {footerNote}
        </motion.div>
      ) : null}

      {children}
    </motion.div>
  );
}
