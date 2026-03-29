import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { workbenchPrimaryToolbarButtonClasses } from '@/components/layout/workbench-button-styles';
import { cn } from '@/lib/utils';
import type { ChannelType } from '@/types/channel';
import { Plus, Trash2 } from 'lucide-react';

type ChannelAccountStatus = 'connected' | 'connecting' | 'disconnected' | 'error';

interface ChannelAccountListItem {
  accountId: string;
  name: string;
  enabled: boolean;
  status: ChannelAccountStatus;
  isDefault: boolean;
  agentId?: string;
  lastError?: string;
}

interface ChannelAccountListProps {
  channelType: ChannelType;
  title: string;
  summary: string;
  emptyDescription: string;
  addActionLabel: string;
  accounts?: ChannelAccountListItem[];
  selectedAccountId?: string;
  t: (key: string, options?: Record<string, unknown>) => string;
  onAddAccount: () => void;
  onDeleteChannel: () => void;
  onSelectAccount: (accountId: string) => void;
  onSetDefaultAccount: (accountId: string) => void;
  onDeleteAccount: (accountId: string) => void;
  getStatusLabel: (status: ChannelAccountStatus) => string;
  getStatusTone: (status: ChannelAccountStatus) => string;
}

const paneSurfaceClass =
  'app-pane-surface min-w-0 rounded-[14px] border border-[hsl(var(--border-subtle)/0.82)] bg-[hsl(var(--surface-elevated)/0.98)] shadow-none';
const selectedItemClass = 'app-field-surface border-[hsl(var(--border-strong)/0.18)] bg-[hsl(var(--foreground)/0.04)] text-foreground shadow-sm';
const idleItemClass = 'app-field-surface border-[hsl(var(--border-subtle)/0.68)] bg-[hsl(var(--surface-elevated)/0.72)] hover:border-[hsl(var(--border-strong)/0.16)] hover:bg-[hsl(var(--foreground)/0.024)]';

export function ChannelAccountList({
  channelType,
  title,
  summary,
  emptyDescription,
  addActionLabel,
  accounts,
  selectedAccountId,
  t,
  onAddAccount,
  onDeleteChannel,
  onSelectAccount,
  onSetDefaultAccount,
  onDeleteAccount,
  getStatusLabel,
  getStatusTone,
}: ChannelAccountListProps) {
  const hasAccounts = Boolean(accounts && accounts.length > 0);

  return (
    <section data-testid="channel-account-list" className={cn(paneSurfaceClass, 'p-3')}>
      <div className="mb-2.5 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <h2 className="text-[13px] font-semibold tracking-tight text-foreground">{title}</h2>
          <p className="mt-0.25 text-[10.5px] leading-5 text-muted-foreground/68">{summary}</p>
        </div>
        <div
          data-testid="channel-account-header-actions"
          className="grid shrink-0 grid-flow-col auto-cols-max items-center justify-end gap-2 self-start"
        >
          <Button
            size="sm"
            variant="outline"
            className="h-7 rounded-[10px] px-3 text-[11.5px] text-foreground/78 shadow-none hover:text-foreground"
            onClick={onAddAccount}
          >
            <Plus className="mr-1 h-3.5 w-3.5" />
            {addActionLabel}
          </Button>
          {hasAccounts && (
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 rounded-[10px] text-muted-foreground hover:bg-[hsl(var(--foreground)/0.05)] hover:text-destructive"
              onClick={onDeleteChannel}
              title={t('account.deleteChannel')}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {hasAccounts ? (
        <div className="space-y-1.5">
          {accounts?.map((account) => {
            const displayName = account.accountId === 'default' && account.name === account.accountId
              ? t('account.mainAccount')
              : account.name;
            const isSelected = selectedAccountId === account.accountId;
            const metaItems = [
              account.accountId,
              account.agentId || t('account.unassigned'),
            ];

            return (
              <div
                key={`${channelType}-${account.accountId}`}
                role="button"
                tabIndex={0}
                data-testid={`channel-account-item-${account.accountId}`}
                onClick={() => onSelectAccount(account.accountId)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onSelectAccount(account.accountId);
                  }
                }}
                className={cn('workbench-motion-nav group w-full rounded-[11px] border px-3 py-2.5 text-left', isSelected ? selectedItemClass : idleItemClass)}
              >
                <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className="truncate text-[13px] font-semibold tracking-tight text-foreground">{displayName}</p>
                      {account.isDefault && (
                        <Badge
                          variant="secondary"
                          className="app-field-surface h-5 rounded-[9px] border border-border/55 bg-[hsl(var(--foreground)/0.04)] px-1.5 text-[10px] font-medium text-foreground/72 shadow-none hover:bg-[hsl(var(--foreground)/0.04)]"
                        >
                          {t('account.default')}
                        </Badge>
                      )}
                      {!account.enabled && (
                        <Badge
                          variant="outline"
                          className="h-5 rounded-[9px] border border-border/55 px-1.5 text-[10px] text-foreground/68 shadow-none"
                        >
                          {t('disabledLabel')}
                        </Badge>
                      )}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10.5px] leading-5 text-muted-foreground/72">
                      {metaItems.map((item, index) => (
                        <div key={`${account.accountId}-${item}`} className="inline-flex items-center gap-2">
                          {index > 0 && <span className="h-1 w-1 rounded-full bg-border/80" />}
                          <span className="truncate">{item}</span>
                        </div>
                      ))}
                    </div>
                    {account.lastError && (
                      <p className="mt-1 line-clamp-2 text-[10.5px] leading-5 text-destructive">{account.lastError}</p>
                    )}
                  </div>

                  <div className="flex shrink-0 flex-wrap items-center justify-end gap-1 text-right opacity-82 transition-opacity group-hover:opacity-100">
                    <span className="app-field-surface inline-flex h-6.5 items-center gap-1.5 rounded-full border border-[hsl(var(--border-subtle)/0.54)] bg-[hsl(var(--surface-elevated)/0.96)] px-2 text-[10px] font-medium text-foreground/66">
                      <span
                        data-testid={`channel-account-indicator-${account.accountId}`}
                        className={cn('h-2.5 w-2.5 rounded-[999px]', getStatusTone(account.status))}
                      />
                      {getStatusLabel(account.status)}
                    </span>
                    {!account.isDefault && (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-6.5 rounded-[8px] px-2 text-[10.5px] text-foreground/68 hover:bg-[hsl(var(--foreground)/0.05)] hover:text-foreground"
                        onClick={(event) => {
                          event.stopPropagation();
                          onSetDefaultAccount(account.accountId);
                        }}
                      >
                        {t('account.setDefault')}
                      </Button>
                    )}
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-6.5 w-6.5 rounded-[8px] text-muted-foreground hover:bg-[hsl(var(--foreground)/0.05)] hover:text-destructive"
                      onClick={(event) => {
                        event.stopPropagation();
                        onDeleteAccount(account.accountId);
                      }}
                      title={t('account.delete')}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="app-empty-surface rounded-[14px] px-4 py-5">
          <p className="mb-1 text-[13px] font-semibold text-foreground">{title}</p>
          <p className="text-[11px] leading-5 text-muted-foreground/78">{emptyDescription}</p>
          <Button
            size="sm"
            className={cn(workbenchPrimaryToolbarButtonClasses, 'mt-4 h-[44px] px-4 text-[13px]')}
            onClick={onAddAccount}
          >
            <Plus className="mr-1 h-3.5 w-3.5" />
            {addActionLabel}
          </Button>
        </div>
      )}
    </section>
  );
}
