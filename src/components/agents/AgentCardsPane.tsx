import type { ReactNode } from 'react';
import { Check, Plus, Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { AgentAvatar } from '@/components/agents/AgentAvatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { AgentSummary } from '@/types/agent';
import { cn } from '@/lib/utils';

interface ChannelAccountItem {
  accountId: string;
  name: string;
  configured: boolean;
  status: 'connected' | 'connecting' | 'disconnected' | 'error';
  lastError?: string;
  isDefault: boolean;
  agentId?: string;
}

interface ChannelGroupItem {
  channelType: string;
  defaultAccountId: string;
  status: 'connected' | 'connecting' | 'disconnected' | 'error';
  accounts: ChannelAccountItem[];
}

export interface AgentCardsPaneProps {
  agents: AgentSummary[];
  channelGroups: ChannelGroupItem[];
  selectedAgentId: string | null;
  searchValue: string;
  onSearchValueChange: (value: string) => void;
  onSelectAgent: (agent: AgentSummary) => void;
  onCreateAgent: () => void;
  onInstallFromMarket: () => void;
  actionButtonClassName: string;
  primaryActionButtonClassName: string;
  badgeClassName: string;
  toolbarSlot?: ReactNode;
  className?: string;
}

function getAssignedChannelCount(agentId: string, channelGroups: ChannelGroupItem[]) {
  return channelGroups.reduce(
    (count, group) => count + group.accounts.filter((account) => account.agentId === agentId).length,
    0,
  );
}

export function AgentCardsPane({
  agents,
  channelGroups,
  selectedAgentId,
  searchValue,
  onSearchValueChange,
  onSelectAgent,
  onCreateAgent,
  onInstallFromMarket,
  actionButtonClassName,
  primaryActionButtonClassName,
  badgeClassName,
  toolbarSlot,
  className,
}: AgentCardsPaneProps) {
  const { t } = useTranslation('agents');
  const resolveText = (key: string, fallback: string) => {
    const value = t(key);
    return value === key ? fallback : value;
  };
  const searchLabel = resolveText('workbench.sourceList.searchPlaceholder', '搜索智能体、模型、工作区');
  const gridClassName = 'grid gap-3 min-[1600px]:grid-cols-2';

  return (
    <div className={className}>
      <section
        data-testid="agents-browser-rail"
        className="app-pane-surface rounded-xl border border-border/70 bg-[hsl(var(--surface-elevated)/0.99)] px-4 py-3.5 shadow-sm"
      >
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="app-field-surface workbench-motion-control flex h-10 min-w-0 flex-1 items-center gap-2.5 rounded-md border border-border/70 bg-[hsl(var(--surface-panel)/0.84)] px-3.5 hover:bg-[hsl(var(--surface-hover)/0.4)] focus-within:border-border/60 focus-within:bg-[hsl(var(--surface-elevated)/0.98)]">
            <Search className="h-4 w-4 shrink-0 text-foreground/34" />
            <Input
              value={searchValue}
              onChange={(event) => onSearchValueChange(event.target.value)}
              aria-label={searchLabel}
              placeholder={searchLabel}
              className="h-7 border-0 bg-transparent px-0 text-[13px] text-foreground shadow-none outline-none ring-0 ring-offset-0 placeholder:text-foreground/34 focus-visible:border-0 focus-visible:bg-transparent focus-visible:ring-0"
            />
          </div>
          {toolbarSlot ? <div className="flex flex-wrap items-center gap-2">{toolbarSlot}</div> : null}
        </div>
      </section>

      <div className="mt-5 min-h-0 flex-1 overflow-y-auto pr-1">
        {agents.length > 0 ? (
          <div data-testid="agents-card-list" className={gridClassName}>
            {agents.map((agent) => {
              const selected = agent.id === selectedAgentId;
              const assignedChannelCount = getAssignedChannelCount(agent.id, channelGroups);
              return (
                <button
                  key={agent.id}
                  type="button"
                  onClick={() => onSelectAgent(agent)}
                  aria-pressed={selected}
                  className={cn(
                    'app-pane-surface workbench-motion-card group relative flex w-full flex-col overflow-hidden rounded-xl border px-4 py-4 text-left',
                    selected
                      ? 'border-[hsl(var(--primary)/0.18)] bg-[hsl(var(--surface-elevated))] shadow-sm'
                      : 'border-border/60 bg-[hsl(var(--surface-elevated))] shadow-sm hover:border-border/74 hover:shadow-md cursor-default',
                  )}
                >
                  <div className="absolute inset-x-4 top-0 h-px bg-gradient-to-r from-transparent via-foreground/8 to-transparent" />
                  <div className="flex min-w-0 flex-col gap-2">
                    <div className="flex items-start gap-3">
                      <AgentAvatar agentId={agent.id} profile={agent.avatarProfile} size={46} className="mt-0.5" />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="truncate text-[15px] font-semibold tracking-[-0.01em] text-foreground">
                            {agent.name}
                          </h3>
                          {agent.isDefault ? (
                            <Badge variant="outline" className={badgeClassName}>
                              <Check className="mr-1 h-3 w-3" />
                              {t('defaultBadge')}
                            </Badge>
                          ) : null}
                          {agent.inheritedModel ? (
                            <Badge variant="outline" className={badgeClassName}>
                              {t('inherited')}
                            </Badge>
                          ) : null}
                        </div>
                        <p className="mt-1.5 text-[12.5px] leading-[1.55] text-foreground/58">
                          {t('workbench.agentCard.meta', {
                            model: agent.modelDisplay,
                            channels: assignedChannelCount,
                          })}
                        </p>
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <div
            data-testid="agents-empty-state"
            className="app-empty-surface flex h-full min-h-[420px] flex-col items-center justify-center rounded-xl border border-dashed border-border/55 px-6 py-10 text-center"
          >
            <div className="max-w-[420px]">
              <h3 className="text-[20px] font-semibold tracking-tight text-foreground">
                {t('workbench.emptyTitle')}
              </h3>
              <p className="mt-2 text-[13px] leading-[1.65] text-foreground/58">
                {t('workbench.emptyDescription')}
              </p>
            </div>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <Button onClick={onCreateAgent} className={cn(primaryActionButtonClassName, 'px-4')}>
                <Plus className="mr-2 h-3.5 w-3.5" />
                {t('workbench.actions.createAgent')}
              </Button>
              <Button
                variant="outline"
                className={actionButtonClassName}
                onClick={onInstallFromMarket}
              >
                {t('workbench.actions.installFromMarket')}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
