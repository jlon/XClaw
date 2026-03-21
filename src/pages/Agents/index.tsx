import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, Check, Plus, RefreshCw, Settings2, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { WorkspacePageFrame, WorkspacePageLoading, WorkspacePageScrollArea, WorkspacePageShell } from '@/components/layout/WorkspacePage';
import { useAgentsStore } from '@/stores/agents';
import { useGatewayStore } from '@/stores/gateway';
import { hostApiFetch } from '@/lib/host-api';
import { subscribeHostEvent } from '@/lib/host-events';
import { CHANNEL_ICONS, CHANNEL_NAMES, type ChannelType } from '@/types/channel';
import type { AgentSummary } from '@/types/agent';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import telegramIcon from '@/assets/channels/telegram.svg';
import discordIcon from '@/assets/channels/discord.svg';
import whatsappIcon from '@/assets/channels/whatsapp.svg';
import dingtalkIcon from '@/assets/channels/dingtalk.svg';
import feishuIcon from '@/assets/channels/feishu.svg';
import wecomIcon from '@/assets/channels/wecom.svg';
import qqIcon from '@/assets/channels/qq.svg';

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

const headerButtonClasses =
  'h-8 rounded-[12px] px-3.5 text-[12.5px] font-medium shadow-none border-border/70 bg-transparent text-foreground/78 transition-colors hover:bg-[hsl(var(--surface-hover)/0.46)] hover:text-foreground';
const fieldInputClasses =
  'h-[44px] rounded-xl text-[13px] app-field-surface text-foreground placeholder:text-foreground/40 shadow-none transition-all focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30';
const modalSurfaceClasses =
  'app-modal-surface w-full rounded-[20px]';
const badgeClasses =
  'h-5 rounded-[10px] border border-border/70 bg-background/70 px-2 text-[10px] font-medium text-foreground/70 shadow-none';
const panelCardClasses =
  'group flex items-stretch gap-3 rounded-[13px] border border-transparent px-3 py-2.5 text-left transition-colors hover:border-border/60 hover:bg-[hsl(var(--surface-hover)/0.42)]';
const modalTitleClasses =
  'text-[20px] md:text-[22px] font-semibold tracking-tight text-foreground';
const modalDescriptionClasses =
  'mt-1 text-[13px] font-medium leading-[1.6] text-foreground/68';
const dialogIconButtonClasses =
  'h-8 w-8 rounded-[12px] border border-border/70 bg-transparent shadow-none text-muted-foreground transition-colors hover:bg-[hsl(var(--surface-hover)/0.46)] hover:text-foreground';
const dialogActionButtonClasses =
  'h-9 rounded-[12px] px-4 text-[13px] font-medium shadow-none border-border/70 bg-transparent text-foreground/80 transition-colors hover:bg-[hsl(var(--surface-hover)/0.46)] hover:text-foreground';

export function Agents() {
  const { t } = useTranslation('agents');
  const gatewayStatus = useGatewayStore((state) => state.status);
  const lastGatewayStateRef = useRef(gatewayStatus.state);
  const {
    agents,
    loading,
    error,
    fetchAgents,
    createAgent,
    deleteAgent,
  } = useAgentsStore();
  const [channelGroups, setChannelGroups] = useState<ChannelGroupItem[]>([]);

  const [showAddDialog, setShowAddDialog] = useState(false);
  const [activeAgentId, setActiveAgentId] = useState<string | null>(null);
  const [agentToDelete, setAgentToDelete] = useState<AgentSummary | null>(null);

  const fetchChannelAccounts = useCallback(async () => {
    try {
      const response = await hostApiFetch<{ success: boolean; channels?: ChannelGroupItem[] }>('/api/channels/accounts');
      setChannelGroups(response.channels || []);
    } catch {
      setChannelGroups([]);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void Promise.all([fetchAgents(), fetchChannelAccounts()]);
  }, [fetchAgents, fetchChannelAccounts]);

  useEffect(() => {
    const unsubscribe = subscribeHostEvent('gateway:channel-status', () => {
      void fetchChannelAccounts();
    });
    return () => {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, [fetchChannelAccounts]);

  useEffect(() => {
    const previousGatewayState = lastGatewayStateRef.current;
    lastGatewayStateRef.current = gatewayStatus.state;

    if (previousGatewayState !== 'running' && gatewayStatus.state === 'running') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      void fetchChannelAccounts();
    }
  }, [fetchChannelAccounts, gatewayStatus.state]);

  const activeAgent = useMemo(
    () => agents.find((agent) => agent.id === activeAgentId) ?? null,
    [activeAgentId, agents],
  );
  const handleRefresh = () => {
    void Promise.all([fetchAgents(), fetchChannelAccounts()]);
  };

  if (loading) {
    return <WorkspacePageLoading />;
  }

  return (
    <WorkspacePageFrame>
      <WorkspacePageShell>
        <div className="flex shrink-0 flex-col gap-4 mb-8 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1.5">
            <h1 className="text-[28px] md:text-[31px] text-foreground font-semibold tracking-tight">
              {t('title')}
            </h1>
            <p className="max-w-2xl text-[13px] md:text-[14px] leading-[1.55] text-foreground/62 font-medium">
              {t('subtitle')}
            </p>
          </div>
          <div className="flex items-center gap-2.5 md:mt-1">
            <Button
              variant="outline"
              onClick={handleRefresh}
              className={headerButtonClasses}
            >
              <RefreshCw className="h-3.5 w-3.5 mr-2" />
              {t('refresh')}
            </Button>
            <Button
              onClick={() => setShowAddDialog(true)}
              className="h-9 rounded-[12px] px-4 text-[13px] font-medium shadow-none"
            >
              <Plus className="h-3.5 w-3.5 mr-2" />
              {t('addAgent')}
            </Button>
          </div>
        </div>

        <WorkspacePageScrollArea>
          {gatewayStatus.state !== 'running' && (
            <div className="mb-5 flex items-center gap-2.5 rounded-[14px] border border-[hsl(var(--warning))/0.15] bg-[hsl(var(--warning))/0.06] px-3.5 py-2.5 text-[hsl(var(--warning))] app-insight-surface">
              <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              <span className="text-sm font-medium text-amber-900 dark:text-amber-100">
                {t('gatewayWarning')}
              </span>
            </div>
          )}

          {error && (
            <div className="mb-5 flex items-center gap-2.5 rounded-[14px] border border-destructive/16 bg-[hsl(var(--danger))/0.06] px-3.5 py-2.5 app-insight-surface">
              <AlertCircle className="h-5 w-5 text-destructive" />
              <span className="text-sm font-medium text-destructive">
                {error}
              </span>
            </div>
          )}

          <div className="space-y-2.5">
            {agents.map((agent) => (
              <AgentCard
                key={agent.id}
                agent={agent}
                channelGroups={channelGroups}
                onOpenSettings={() => setActiveAgentId(agent.id)}
                onDelete={() => setAgentToDelete(agent)}
              />
            ))}
          </div>
        </WorkspacePageScrollArea>
      </WorkspacePageShell>

      {showAddDialog && (
        <AddAgentDialog
          onClose={() => setShowAddDialog(false)}
          onCreate={async (name) => {
            await createAgent(name);
            setShowAddDialog(false);
            toast.success(t('toast.agentCreated'));
          }}
        />
      )}

      {activeAgent && (
        <AgentSettingsModal
          agent={activeAgent}
          channelGroups={channelGroups}
          onClose={() => setActiveAgentId(null)}
        />
      )}

      <ConfirmDialog
        open={!!agentToDelete}
        title={t('deleteDialog.title')}
        message={agentToDelete ? t('deleteDialog.message', { name: agentToDelete.name }) : ''}
        confirmLabel={t('common:actions.delete')}
        cancelLabel={t('common:actions.cancel')}
        variant="destructive"
        onConfirm={async () => {
          if (!agentToDelete) return;
          try {
            await deleteAgent(agentToDelete.id);
            const deletedId = agentToDelete.id;
            setAgentToDelete(null);
            if (activeAgentId === deletedId) {
              setActiveAgentId(null);
            }
            toast.success(t('toast.agentDeleted'));
          } catch (error) {
            toast.error(t('toast.agentDeleteFailed', { error: String(error) }));
          }
        }}
        onCancel={() => setAgentToDelete(null)}
      />
    </WorkspacePageFrame>
  );
}

function AgentCard({
  agent,
  channelGroups,
  onOpenSettings,
  onDelete,
}: {
  agent: AgentSummary;
  channelGroups: ChannelGroupItem[];
  onOpenSettings: () => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation('agents');
  const boundChannelAccounts = channelGroups.flatMap((group) =>
    group.accounts
      .filter((account) => account.agentId === agent.id)
      .map((account) => {
        const channelName = CHANNEL_NAMES[group.channelType as ChannelType] || group.channelType;
        const accountLabel =
          account.accountId === 'default'
            ? t('settingsDialog.mainAccount')
            : account.name || account.accountId;
        return `${channelName} · ${accountLabel}`;
      }),
  );
  const channelsText = boundChannelAccounts.length > 0
    ? boundChannelAccounts.join(', ')
    : t('none');
  const agentInitial = agent.name.trim().charAt(0).toUpperCase() || 'A';

  return (
    <div
      className={cn(
        panelCardClasses,
        agent.isDefault && 'border-[hsl(var(--border-strong)/0.75)] bg-[hsl(var(--surface-panel)/0.9)]'
      )}
    >
      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] border border-border/60 bg-[hsl(var(--surface-panel)/0.88)] text-[11px] font-semibold text-foreground/62 shadow-none">
        {agentInitial}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <h2 className="truncate text-[14.5px] font-semibold text-foreground">{agent.name}</h2>
            </div>
            <p className="mt-0.5 line-clamp-1 text-[12.5px] leading-[1.45] text-foreground/60">
              {t('modelLine', {
                model: agent.modelDisplay,
                suffix: agent.inheritedModel ? ` (${t('inherited')})` : '',
              })}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5 pt-0.5">
            {agent.isDefault && (
              <Badge
                variant="secondary"
                className={cn('flex items-center gap-1 px-2 py-0.5', badgeClasses, 'bg-[hsl(var(--surface-panel)/0.96)] text-foreground/76')}
              >
                <Check className="h-3 w-3" />
                {t('defaultBadge')}
              </Badge>
            )}
            {!agent.isDefault && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 rounded-[12px] text-muted-foreground/70 transition-all hover:bg-destructive/10 hover:text-destructive"
                onClick={onDelete}
                title={t('deleteAgent')}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 rounded-[12px] text-muted-foreground/70 transition-all hover:bg-[hsl(var(--surface-hover)/0.46)] hover:text-foreground"
              onClick={onOpenSettings}
              title={t('settings')}
            >
              <Settings2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <p className="text-[12.5px] leading-[1.45] text-foreground/56 line-clamp-1">
          {t('channelsLine', { channels: channelsText })}
        </p>
      </div>
    </div>
  );
}

const inputClasses = fieldInputClasses;
const labelClasses = 'text-[14px] font-semibold text-foreground/80';

function ChannelLogo({ type }: { type: ChannelType }) {
  switch (type) {
    case 'telegram':
      return <img src={telegramIcon} alt="Telegram" className="w-[20px] h-[20px] dark:invert" />;
    case 'discord':
      return <img src={discordIcon} alt="Discord" className="w-[20px] h-[20px] dark:invert" />;
    case 'whatsapp':
      return <img src={whatsappIcon} alt="WhatsApp" className="w-[20px] h-[20px] dark:invert" />;
    case 'dingtalk':
      return <img src={dingtalkIcon} alt="DingTalk" className="w-[20px] h-[20px] dark:invert" />;
    case 'feishu':
      return <img src={feishuIcon} alt="Feishu" className="w-[20px] h-[20px] dark:invert" />;
    case 'wecom':
      return <img src={wecomIcon} alt="WeCom" className="w-[20px] h-[20px] dark:invert" />;
    case 'qqbot':
      return <img src={qqIcon} alt="QQ" className="w-[20px] h-[20px] dark:invert" />;
    default:
      return <span className="text-[20px] leading-none">{CHANNEL_ICONS[type] || '💬'}</span>;
  }
}

function AddAgentDialog({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (name: string) => Promise<void>;
}) {
  const { t } = useTranslation('agents');
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await onCreate(name.trim());
    } catch (error) {
      toast.error(t('toast.agentCreateFailed', { error: String(error) }));
      setSaving(false);
      return;
    }
    setSaving(false);
  };

  return (
    <div className="app-modal-overlay fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className={cn(modalSurfaceClasses, 'max-w-md overflow-hidden')}>
        <div className="flex items-start justify-between gap-4 border-b border-border/70 px-6 py-5">
          <div>
            <h2 className={modalTitleClasses}>{t('createDialog.title')}</h2>
            <p className={modalDescriptionClasses}>{t('createDialog.description')}</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className={dialogIconButtonClasses}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="space-y-5 px-6 py-5">
          <div className="space-y-2.5">
            <Label htmlFor="agent-name" className={labelClasses}>{t('createDialog.nameLabel')}</Label>
            <Input
              id="agent-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={t('createDialog.namePlaceholder')}
              className={inputClasses}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={onClose}
              className={dialogActionButtonClasses}
            >
              {t('common:actions.cancel')}
            </Button>
            <Button
              onClick={() => void handleSubmit()}
              disabled={saving || !name.trim()}
              className="h-9 rounded-[12px] px-4 text-[13px] font-medium shadow-none"
            >
              {saving ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  {t('creating')}
                </>
              ) : (
                t('common:actions.save')
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function AgentSettingsModal({
  agent,
  channelGroups,
  onClose,
}: {
  agent: AgentSummary;
  channelGroups: ChannelGroupItem[];
  onClose: () => void;
  }) {
  const { t } = useTranslation('agents');
  const { updateAgent } = useAgentsStore();
  const [name, setName] = useState(agent.name);
  const [savingName, setSavingName] = useState(false);

  useEffect(() => {
    setName(agent.name);
  }, [agent.name]);

  const handleSaveName = async () => {
    if (!name.trim() || name.trim() === agent.name) return;
    setSavingName(true);
    try {
      await updateAgent(agent.id, name.trim());
      toast.success(t('toast.agentUpdated'));
    } catch (error) {
      toast.error(t('toast.agentUpdateFailed', { error: String(error) }));
    } finally {
      setSavingName(false);
    }
  };

  const assignedChannels = channelGroups.flatMap((group) =>
    group.accounts
      .filter((account) => account.agentId === agent.id)
      .map((account) => ({
        channelType: group.channelType as ChannelType,
        accountId: account.accountId,
        name:
          account.accountId === 'default'
            ? t('settingsDialog.mainAccount')
            : account.name || account.accountId,
        error: account.lastError,
      })),
  );

  return (
    <div className="app-modal-overlay fixed inset-0 z-50 flex items-center justify-center p-4">
      <Card className={cn(modalSurfaceClasses, 'max-h-[90vh] max-w-2xl flex flex-col overflow-hidden')}>
        <CardHeader className="flex flex-row items-start justify-between border-b border-border/70 px-6 py-5 shrink-0">
          <div>
            <CardTitle className="text-[20px] md:text-[22px] font-semibold tracking-tight">
              {t('settingsDialog.title', { name: agent.name })}
            </CardTitle>
            <CardDescription className="mt-1 text-[13px] font-medium leading-[1.6] text-foreground/68">
              {t('settingsDialog.description')}
            </CardDescription>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className={dialogIconButtonClasses}
          >
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="space-y-6 overflow-y-auto flex-1 px-6 py-5">
          <div className="space-y-4">
            <div className="space-y-2.5">
              <Label htmlFor="agent-settings-name" className={labelClasses}>{t('settingsDialog.nameLabel')}</Label>
              <div className="flex gap-2">
                <Input
                  id="agent-settings-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  readOnly={agent.isDefault}
                  className={inputClasses}
                />
                {!agent.isDefault && (
                  <Button
                    variant="outline"
                    onClick={() => void handleSaveName()}
                    disabled={savingName || !name.trim() || name.trim() === agent.name}
                    className="h-[44px] rounded-[12px] border-border/70 bg-transparent px-4 text-[13px] font-medium text-foreground/80 shadow-none transition-colors hover:bg-[hsl(var(--surface-hover)/0.46)] hover:text-foreground"
                  >
                    {savingName ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      t('common:actions.save')
                    )}
                  </Button>
                )}
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1 rounded-[14px] app-insight-surface px-3.5 py-3">
                <p className="text-[11px] font-medium text-muted-foreground/72">
                  {t('settingsDialog.agentIdLabel')}
                </p>
                <p className="font-mono text-[12.5px] text-foreground/82">{agent.id}</p>
              </div>
              <div className="space-y-1 rounded-[14px] app-insight-surface px-3.5 py-3">
                <p className="text-[11px] font-medium text-muted-foreground/72">
                  {t('settingsDialog.modelLabel')}
                </p>
                <p className="text-[12.75px] text-foreground/82">
                  {agent.modelDisplay}
                  {agent.inheritedModel ? ` (${t('inherited')})` : ''}
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-[16px] text-foreground font-semibold tracking-tight">
                  {t('settingsDialog.channelsTitle')}
                </h3>
                <p className="mt-1 text-[12.5px] leading-[1.55] text-foreground/62">{t('settingsDialog.channelsDescription')}</p>
              </div>
            </div>

            {assignedChannels.length === 0 && agent.channelTypes.length === 0 ? (
              <div className="rounded-[14px] border border-dashed border-border/60 bg-[hsl(var(--surface-panel)/0.62)] px-3.5 py-3 text-[12.5px] text-muted-foreground">
                {t('settingsDialog.noChannels')}
              </div>
            ) : (
              <div className="space-y-2.5">
                {assignedChannels.map((channel) => (
                  <div key={`${channel.channelType}-${channel.accountId}`} className="flex items-center justify-between rounded-[13px] border border-transparent px-3 py-2.5 transition-colors hover:bg-[hsl(var(--surface-hover)/0.5)]">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] border border-border/60 bg-[hsl(var(--surface-panel)/0.88)] text-foreground/68 shadow-none">
                        <ChannelLogo type={channel.channelType} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[13.5px] font-semibold text-foreground">{channel.name}</p>
                        <p className="text-[12.25px] text-muted-foreground">
                          {CHANNEL_NAMES[channel.channelType]} · {channel.accountId === 'default' ? t('settingsDialog.mainAccount') : channel.accountId}
                        </p>
                        {channel.error && (
                          <p className="mt-1 text-[11.5px] text-destructive">{channel.error}</p>
                        )}
                      </div>
                    </div>
                    <div className="shrink-0" />
                  </div>
                ))}
                {assignedChannels.length === 0 && agent.channelTypes.length > 0 && (
                  <div className="rounded-[14px] border border-dashed border-border/60 bg-[hsl(var(--surface-panel)/0.62)] px-3.5 py-3 text-[12.5px] text-muted-foreground">
                    {t('settingsDialog.channelsManagedInChannels')}
                  </div>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default Agents;
