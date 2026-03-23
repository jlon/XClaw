import { Check, Cpu, FilePenLine, Link2, MessageSquarePlus, MoreHorizontal, Plus, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { AgentAvatar } from '@/components/agents/AgentAvatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ChannelIcon } from '@/components/channels/ChannelIcon';
import { cn } from '@/lib/utils';
import type { AgentSummary } from '@/types/agent';
import type { ChannelType } from '@/types/channel';

export type AgentDetailTab = 'persona' | 'binding';

export interface AgentDetailChannelItem {
  channelType: ChannelType;
  accountId: string;
  name: string;
  error?: string;
}

export interface AgentWorkspaceFileItem {
  relativePath: string;
  displayName: string;
  reserved: boolean;
  editable: boolean;
}

export interface AgentLocalDetailPaneProps {
  agent: AgentSummary | null;
  activeTab: AgentDetailTab;
  activeChannels: AgentDetailChannelItem[];
  workspaceFiles: AgentWorkspaceFileItem[];
  selectedWorkspaceFilePath: string | null;
  workspaceFilesLoading: boolean;
  workspaceFilesError: string | null;
  gatewayState: string;
  onTabChange: (tab: AgentDetailTab) => void;
  onEditAgent: () => void;
  onDeleteAgent: () => void;
  onManageChannels: () => void;
  onCreateAgent: () => void;
  onInstallFromMarket: () => void;
  onStartChat: () => void;
  onEditWorkspaceFile: (relativePath: string) => void;
}

const shellCardClasses =
  'rounded-[24px] border border-border/70 bg-[hsl(var(--surface-elevated)/0.995)] shadow-[0_10px_24px_rgba(15,23,42,0.04),inset_0_1px_0_rgba(255,255,255,0.76)]';
const badgeClasses =
  'h-5 rounded-[10px] border border-border/70 bg-background/75 px-2 text-[10px] font-medium text-foreground/68 shadow-none';
const actionButtonClasses =
  'h-8 rounded-[12px] border-border/70 bg-transparent px-3.5 text-[12.5px] font-medium text-foreground/76 shadow-none transition-colors hover:bg-[hsl(var(--surface-hover)/0.46)] hover:text-foreground';
const summaryLabelClasses = 'text-[11px] font-medium uppercase tracking-[0.08em] text-foreground/44';
const tabButtonBaseClasses = 'h-8 rounded-[11px] px-3 text-[12.5px] font-medium transition-colors';
const compactInsightSurfaceClasses =
  'rounded-[16px] border border-border/55 bg-[hsl(var(--surface-panel)/0.95)] px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.62)]';

const getPathLeaf = (value: string) => {
  const parts = value.split(/[/\\]/).filter(Boolean);
  return parts[parts.length - 1] ?? value;
};

const ChannelLogo = ({ type }: { type: ChannelType }) => <ChannelIcon type={type} size={20} />;

const HeroFactCard = ({
  label,
  value,
  hint,
  icon,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: React.ComponentType<{ className?: string }>;
}) => {
  const Icon = icon;
  return (
    <div className="rounded-[18px] border border-border/60 bg-[linear-gradient(180deg,hsl(var(--surface-panel)/0.965)_0%,hsl(var(--surface-elevated)/0.985)_100%)] px-4 py-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.62)]">
      <div className="flex items-center gap-2 text-foreground/48">
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-[10px] border border-border/55 bg-[hsl(var(--surface-elevated)/0.96)] text-foreground/56">
          <Icon className="h-3.5 w-3.5 shrink-0" />
        </span>
        <p className="text-[11.5px] font-medium text-foreground/46">{label}</p>
      </div>
      <p className="mt-2.5 truncate text-[14px] font-semibold tracking-tight text-foreground">{value}</p>
      {hint ? <p className="mt-1 text-[11.5px] leading-[1.5] text-foreground/48">{hint}</p> : null}
    </div>
  );
};

function EmptyLocalState({
  onCreateAgent,
  onInstallFromMarket,
}: {
  onCreateAgent: () => void;
  onInstallFromMarket: () => void;
}) {
  const { t } = useTranslation('agents');

  return (
    <div
      data-testid="agents-empty-state"
      className="app-empty-surface flex h-full min-h-[520px] flex-col items-center justify-center rounded-[18px] border border-dashed border-border/55 px-6 py-10 text-center"
    >
      <h3 className="text-[20px] font-semibold tracking-tight text-foreground">{t('workbench.detail.emptyAgentTitle')}</h3>
      <p className="mt-2 max-w-[420px] text-[13px] leading-[1.65] text-foreground/58">
        {t('workbench.detail.emptyAgentDescription')}
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <Button onClick={onCreateAgent} className="h-9 rounded-[12px] px-4 text-[13px] font-medium shadow-none">
          <Plus className="mr-2 h-3.5 w-3.5" />
          {t('workbench.actions.createAgent')}
        </Button>
        <Button variant="outline" className={actionButtonClasses} onClick={onInstallFromMarket}>
          {t('workbench.actions.installFromMarket')}
        </Button>
      </div>
    </div>
  );
}

export function AgentLocalDetailPane({
  agent,
  activeTab,
  activeChannels,
  workspaceFiles,
  selectedWorkspaceFilePath,
  workspaceFilesLoading,
  workspaceFilesError,
  gatewayState,
  onTabChange,
  onEditAgent,
  onDeleteAgent,
  onManageChannels,
  onCreateAgent,
  onInstallFromMarket,
  onStartChat,
  onEditWorkspaceFile,
}: AgentLocalDetailPaneProps) {
  const { t } = useTranslation('agents');

  if (!agent) {
    return <EmptyLocalState onCreateAgent={onCreateAgent} onInstallFromMarket={onInstallFromMarket} />;
  }

  const builtinWorkspaceFiles = workspaceFiles.filter((file) => file.reserved);
  const runtimeStateLabel = t(`workbench.binding.runtimeStates.${gatewayState}`, { defaultValue: gatewayState });
  const heroFacts = [
    {
      label: t('workbench.overview.modelLabel'),
      value: agent.modelDisplay,
      hint: agent.inheritedModel ? t('inherited') : undefined,
      icon: Cpu,
    },
    {
      label: t('workbench.overview.channelLabel'),
      value: t('workbench.agentCard.channelsMeta', { count: activeChannels.length }),
      icon: Link2,
    },
  ];

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div className={cn(shellCardClasses, 'relative overflow-hidden p-5')}>
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-foreground/10 to-transparent" />
        <div className="space-y-4">
          <div className="grid gap-4 min-[1080px]:grid-cols-[minmax(0,1fr)_auto] min-[1080px]:items-start">
            <div className="flex min-w-0 items-start gap-4">
              <AgentAvatar agentId={agent.id} size={56} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-[21px] font-semibold tracking-tight text-foreground">{agent.name}</h2>
                  {agent.isDefault ? (
                    <Badge variant="outline" className={badgeClasses}>
                      <Check className="mr-1 h-3 w-3" />
                      {t('defaultBadge')}
                    </Badge>
                  ) : null}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 min-[1080px]:justify-self-end">
              <Button onClick={onStartChat} className="h-9 shrink-0 rounded-[13px] px-4 text-[13px] font-medium shadow-none">
                <MessageSquarePlus className="mr-2 h-3.5 w-3.5" />
                {t('workbench.actions.startChat')}
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    aria-label="更多操作"
                    className="h-9 w-9 rounded-[13px] border-border/60 bg-[hsl(var(--surface-panel)/0.92)] text-foreground/72 shadow-none hover:bg-[hsl(var(--surface-hover)/0.42)] hover:text-foreground"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-[196px]">
                  <DropdownMenuItem onSelect={onEditAgent}>
                    <FilePenLine className="mr-2 h-3.5 w-3.5 text-foreground/60" />
                    {t('workbench.actions.editAgent')}
                  </DropdownMenuItem>
                  {!agent.isDefault ? (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onSelect={onDeleteAgent}
                        className="text-destructive data-[highlighted]:bg-destructive/10 data-[highlighted]:text-destructive"
                      >
                        <Trash2 className="mr-2 h-3.5 w-3.5" />
                        {t('deleteAgent')}
                      </DropdownMenuItem>
                    </>
                  ) : null}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {heroFacts.map((fact) => (
              <HeroFactCard key={fact.label} label={fact.label} value={fact.value} hint={fact.hint} icon={fact.icon} />
            ))}
          </div>
        </div>

        <div className="mt-4 flex h-10 items-center rounded-[15px] border border-border/60 bg-[hsl(var(--surface-panel)/0.92)] p-1">
          <button
            type="button"
            onClick={() => onTabChange('persona')}
            className={cn(
              tabButtonBaseClasses,
              activeTab === 'persona'
                ? 'bg-[hsl(var(--surface-elevated)/0.98)] text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]'
                : 'text-foreground/58 hover:text-foreground',
            )}
          >
            {t('workbench.tabs.persona')}
          </button>
          <button
            type="button"
            onClick={() => onTabChange('binding')}
            className={cn(
              tabButtonBaseClasses,
              activeTab === 'binding'
                ? 'bg-[hsl(var(--surface-elevated)/0.98)] text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]'
                : 'text-foreground/58 hover:text-foreground',
            )}
          >
            {t('workbench.tabs.binding')}
          </button>
        </div>
      </div>

      {activeTab === 'binding' ? (
        <div className="grid gap-4">
          <div className={cn(shellCardClasses, 'p-4')}>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/55 pb-3">
              <div>
                <p className="text-[13px] font-semibold tracking-tight text-foreground">{t('workbench.overview.channelsTitle')}</p>
              </div>
              <Button variant="outline" className={actionButtonClasses} onClick={onManageChannels}>
                {t('workbench.actions.manageChannels')}
              </Button>
            </div>

            {activeChannels.length > 0 ? (
              <div className="mt-4 grid gap-2">
                {activeChannels.map((channel) => (
                  <div
                    key={`${channel.channelType}-${channel.accountId}`}
                    className="flex items-start gap-3 rounded-[16px] border border-border/55 bg-[hsl(var(--surface-panel)/0.96)] px-4 py-3"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] border border-border/55 bg-[hsl(var(--surface-elevated)/0.96)] text-foreground/70">
                      <ChannelLogo type={channel.channelType} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-[13px] font-medium text-foreground">{channel.name}</p>
                        <span className="inline-flex h-5 items-center rounded-full border border-border/55 bg-background/70 px-2 text-[10.5px] font-medium text-foreground/58">
                          {channel.channelType}
                        </span>
                      </div>
                      <p className="mt-1 text-[12px] text-foreground/56">{channel.accountId}</p>
                      {channel.error ? <p className="mt-1 text-[11.5px] text-destructive">{channel.error}</p> : null}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-4 rounded-[16px] border border-dashed border-border/55 bg-[hsl(var(--surface-panel)/0.82)] px-4 py-6 text-[12.5px] leading-[1.65] text-foreground/54">
                {t('workbench.overview.noChannels')}
              </div>
            )}
          </div>

          <div className="grid gap-3 lg:grid-cols-[minmax(220px,0.72fr)_minmax(0,1.28fr)]">
            <div className={compactInsightSurfaceClasses}>
              <p className={summaryLabelClasses}>{t('workbench.overview.runtimeStateLabel')}</p>
              <p className="mt-1.5 text-[14px] font-semibold tracking-tight text-foreground">{runtimeStateLabel}</p>
            </div>
            <div className={compactInsightSurfaceClasses}>
              <p className={summaryLabelClasses}>{t('workbench.overview.agentDirLabel')}</p>
              <p className="mt-1.5 text-[14px] font-semibold tracking-tight text-foreground">{getPathLeaf(agent.agentDir)}</p>
              <p className="mt-1.5 break-all text-[11.5px] leading-[1.55] text-foreground/46">{agent.agentDir}</p>
            </div>
          </div>
        </div>
      ) : (
        <div className={cn(shellCardClasses, 'min-h-[560px] p-4')}>
          <div className="border-b border-border/55 pb-3">
            <p className="text-[13px] font-semibold tracking-tight text-foreground">{t('workbench.persona.fileListTitle')}</p>
          </div>
          {workspaceFilesLoading ? (
            <div className="py-4 text-[12.5px] text-foreground/52">{t('workbench.persona.loading')}</div>
          ) : workspaceFilesError ? (
            <div className="py-4 text-[12.5px] text-destructive">{workspaceFilesError}</div>
          ) : builtinWorkspaceFiles.length > 0 ? (
            <div className="mt-4 grid gap-3">
              {builtinWorkspaceFiles.map((file) => {
                const selected = file.relativePath === selectedWorkspaceFilePath;
                return (
                  <div
                    key={file.relativePath}
                    className={cn(
                      'flex items-center justify-between gap-3 rounded-[18px] border px-4 py-3.5',
                      selected
                        ? 'border-[hsl(var(--primary)/0.16)] bg-[linear-gradient(180deg,hsl(var(--surface-elevated)/1)_0%,hsl(var(--surface-panel)/0.97)_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.74),0_8px_18px_rgba(15,23,42,0.035)]'
                        : 'border-border/55 bg-[hsl(var(--surface-panel)/0.94)]',
                    )}
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-[12.75px] font-medium text-foreground">{file.displayName}</p>
                        <Badge variant="outline" className={badgeClasses}>
                          {t('workbench.persona.bootstrapBadge')}
                        </Badge>
                      </div>
                      <p className="mt-1 text-[11.5px] leading-[1.5] text-foreground/46">{file.relativePath}</p>
                    </div>
                    <Button variant="outline" className={actionButtonClasses} onClick={() => onEditWorkspaceFile(file.relativePath)}>
                      <FilePenLine className="mr-2 h-3.5 w-3.5" />
                      {t('workbench.persona.editAction')}
                    </Button>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="mt-4 rounded-[16px] border border-dashed border-border/55 bg-[hsl(var(--surface-panel)/0.82)] px-4 py-6 text-[12.5px] leading-[1.65] text-foreground/54">
              {t('workbench.persona.emptyFiles')}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
