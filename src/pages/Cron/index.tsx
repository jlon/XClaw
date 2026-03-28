/**
 * Cron Page
 * Manage scheduled tasks
 */
import { useEffect, useState, useCallback, useRef } from 'react';
import {
  Plus,
  Clock,
  Play,
  Trash2,
  RefreshCw,
  X,
  AlertCircle,
  CheckCircle2,
  CircleOff,
  Activity,
  Loader2,
  Timer,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { WorkbenchHeader } from '@/components/layout/WorkbenchHeader';
import { WorkbenchHeaderTitleBlock } from '@/components/layout/WorkbenchHeaderTitleBlock';
import { WorkbenchHeaderActions } from '@/components/layout/WorkbenchHeaderActions';
import { WorkbenchSummaryStrip } from '@/components/layout/WorkbenchSummaryStrip';
import { WorkspacePageFrame, WorkspacePageLoading, WorkspacePageScrollArea, WorkspacePageShell } from '@/components/layout/WorkspacePage';
import {
  workbenchPrimaryToolbarButtonClasses,
  workbenchToolbarButtonClasses,
  workbenchToolbarIconButtonClasses,
} from '@/components/layout/workbench-button-styles';
import { useCronStore } from '@/stores/cron';
import { useAgentsStore } from '@/stores/agents';
import { useGatewayStore } from '@/stores/gateway';
import { hostApiFetch } from '@/lib/host-api';
import { formatRelativeTime, cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { CronJob, CronJobCreateInput, CronTriggerResult, ScheduleType } from '@/types/cron';
import { CHANNEL_NAMES, type ChannelType } from '@/types/channel';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';

// Common cron schedule presets
const schedulePresets: { key: string; value: string; type: ScheduleType }[] = [
  { key: 'everyMinute', value: '* * * * *', type: 'interval' },
  { key: 'every5Min', value: '*/5 * * * *', type: 'interval' },
  { key: 'every15Min', value: '*/15 * * * *', type: 'interval' },
  { key: 'everyHour', value: '0 * * * *', type: 'interval' },
  { key: 'daily9am', value: '0 9 * * *', type: 'daily' },
  { key: 'daily6pm', value: '0 18 * * *', type: 'daily' },
  { key: 'weeklyMon', value: '0 9 * * 1', type: 'weekly' },
  { key: 'monthly1st', value: '0 9 1 * *', type: 'monthly' },
];

const inputClasses =
  'appearance-none h-8 rounded-[6px] border border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface-base))] text-[13px] text-foreground placeholder:text-muted-foreground shadow-none transition-[border-color,box-shadow,background-color] duration-[var(--motion-fast)] ease-out focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(var(--glow-brand),0.25)] focus-visible:ring-offset-0';
const tokenInputClasses =
  'appearance-none h-8 rounded-[6px] border border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface-base))] font-mono text-[13px] text-foreground placeholder:text-muted-foreground shadow-none transition-[border-color,box-shadow,background-color] duration-[var(--motion-fast)] ease-out focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(var(--glow-brand),0.25)] focus-visible:ring-offset-0';
const textareaClasses =
  'appearance-none rounded-[6px] border border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface-base))] text-[13px] text-foreground placeholder:text-muted-foreground shadow-none transition-[border-color,box-shadow,background-color] duration-[var(--motion-fast)] ease-out focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(var(--glow-brand),0.25)] focus-visible:ring-offset-0 resize-none';
const modalSurfaceClasses =
  'app-modal-surface w-full rounded-xl';
const cardSurfaceClasses =
  'app-cron-task-card workbench-motion-card group relative flex min-h-[160px] flex-col overflow-hidden rounded-xl border border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface-base))] px-4 py-4 shadow-sm motion-safe:hover:-translate-y-[1px] hover:border-[hsl(var(--border-strong))] hover:shadow-md cursor-default transition-[border-color,box-shadow,background-color,transform] duration-[var(--motion-base)] ease-[cubic-bezier(0.16,1,0.3,1)]';
const scheduleButtonBaseClasses =
  'workbench-motion-control justify-start h-8 rounded-md font-medium text-[13px]';

interface ChannelAccountItem {
  accountId: string;
  configured: boolean;
  enabled: boolean;
  agentId?: string;
}

interface ChannelGroupItem {
  channelType: ChannelType;
  enabled: boolean;
  accounts: ChannelAccountItem[];
}

interface ChannelAccountsResponse {
  success: boolean;
  channels?: ChannelGroupItem[];
}

interface ChannelEditorValuesResponse {
  success: boolean;
  hint?: RecipientInference;
}

interface CronTargetOption {
  value: string;
  channelType: ChannelType;
  accountId: string;
  label: string;
}

interface RecipientInference {
  recipientId: string | null;
  reason: 'derived' | 'wildcard' | 'multiple' | 'missing';
  candidates?: string[];
}

const buildCronTargetValue = (channelType: string, accountId: string) => `${channelType}::${accountId}`;

function formatCronTargetLabel(channelType: string, accountId: string): string {
  const channelName = CHANNEL_NAMES[channelType as ChannelType] ?? channelType;
  return accountId === 'default' ? channelName : `${channelName} · ${accountId}`;
}

// Parse cron schedule to human-readable format
// Handles both plain cron strings and Gateway CronSchedule objects:
//   { kind: "cron", expr: "...", tz?: "..." }
//   { kind: "every", everyMs: number }
//   { kind: "at", at: "..." }
function parseCronSchedule(schedule: unknown, t: TFunction<'cron'>): string {
  // Handle Gateway CronSchedule object format
  if (schedule && typeof schedule === 'object') {
    const s = schedule as { kind?: string; expr?: string; tz?: string; everyMs?: number; at?: string };
    if (s.kind === 'cron' && typeof s.expr === 'string') {
      return parseCronExpr(s.expr, t);
    }
    if (s.kind === 'every' && typeof s.everyMs === 'number') {
      const ms = s.everyMs;
      if (ms < 60_000) return t('schedule.everySeconds', { count: Math.round(ms / 1000) });
      if (ms < 3_600_000) return t('schedule.everyMinutes', { count: Math.round(ms / 60_000) });
      if (ms < 86_400_000) return t('schedule.everyHours', { count: Math.round(ms / 3_600_000) });
      return t('schedule.everyDays', { count: Math.round(ms / 86_400_000) });
    }
    if (s.kind === 'at' && typeof s.at === 'string') {
      try {
        return t('schedule.onceAt', { time: new Date(s.at).toLocaleString() });
      } catch {
        return t('schedule.onceAt', { time: s.at });
      }
    }
    return String(schedule);
  }

  // Handle plain cron string
  if (typeof schedule === 'string') {
    return parseCronExpr(schedule, t);
  }

  return String(schedule ?? t('schedule.unknown'));
}

// Parse a plain cron expression string to human-readable text
function parseCronExpr(cron: string, t: TFunction<'cron'>): string {
  const preset = schedulePresets.find((p) => p.value === cron);
  if (preset) return t(`presets.${preset.key}` as const);

  const parts = cron.split(' ');
  if (parts.length !== 5) return cron;

  const [minute, hour, dayOfMonth, , dayOfWeek] = parts;

  if (minute === '*' && hour === '*') return t('presets.everyMinute');
  if (minute.startsWith('*/')) return t('schedule.everyMinutes', { count: Number(minute.slice(2)) });
  if (hour === '*' && minute === '0') return t('presets.everyHour');
  if (dayOfWeek !== '*' && dayOfMonth === '*') {
    return t('schedule.weeklyAt', { day: dayOfWeek, time: `${hour}:${minute.padStart(2, '0')}` });
  }
  if (dayOfMonth !== '*') {
    return t('schedule.monthlyAtDay', { day: dayOfMonth, time: `${hour}:${minute.padStart(2, '0')}` });
  }
  if (hour !== '*') {
    return t('schedule.dailyAt', { time: `${hour}:${minute.padStart(2, '0')}` });
  }

  return cron;
}

function estimateNextRun(scheduleExpr: string): string | null {
  const now = new Date();
  const next = new Date(now.getTime());

  if (scheduleExpr === '* * * * *') {
    next.setSeconds(0, 0);
    next.setMinutes(next.getMinutes() + 1);
    return next.toLocaleString();
  }

  if (scheduleExpr === '*/5 * * * *') {
    const delta = 5 - (next.getMinutes() % 5 || 5);
    next.setSeconds(0, 0);
    next.setMinutes(next.getMinutes() + delta);
    return next.toLocaleString();
  }

  if (scheduleExpr === '*/15 * * * *') {
    const delta = 15 - (next.getMinutes() % 15 || 15);
    next.setSeconds(0, 0);
    next.setMinutes(next.getMinutes() + delta);
    return next.toLocaleString();
  }

  if (scheduleExpr === '0 * * * *') {
    next.setMinutes(0, 0, 0);
    next.setHours(next.getHours() + 1);
    return next.toLocaleString();
  }

  if (scheduleExpr === '0 9 * * *' || scheduleExpr === '0 18 * * *') {
    const targetHour = scheduleExpr === '0 9 * * *' ? 9 : 18;
    next.setSeconds(0, 0);
    next.setHours(targetHour, 0, 0, 0);
    if (next <= now) next.setDate(next.getDate() + 1);
    return next.toLocaleString();
  }

  if (scheduleExpr === '0 9 * * 1') {
    next.setSeconds(0, 0);
    next.setHours(9, 0, 0, 0);
    const day = next.getDay();
    const daysUntilMonday = day === 1 ? 7 : (8 - day) % 7;
    next.setDate(next.getDate() + daysUntilMonday);
    return next.toLocaleString();
  }

  if (scheduleExpr === '0 9 1 * *') {
    next.setSeconds(0, 0);
    next.setDate(1);
    next.setHours(9, 0, 0, 0);
    if (next <= now) next.setMonth(next.getMonth() + 1);
    return next.toLocaleString();
  }

  return null;
}

// Create/Edit Task Dialog
interface TaskDialogProps {
  job?: CronJob;
  agents: Array<{ id: string; name: string }>;
  channelGroups: ChannelGroupItem[];
  defaultAgentId: string;
  onClose: () => void;
  onSave: (input: CronJobCreateInput) => Promise<void>;
}

function TaskDialog({ job, agents, channelGroups, defaultAgentId, onClose, onSave }: TaskDialogProps) {
  const { t } = useTranslation('cron');
  const [saving, setSaving] = useState(false);
  const recipientInferenceCache = useRef<Record<string, RecipientInference>>({});
  const agentOptions = agents.length > 0
    ? agents.map((agent) => ({ value: agent.id, label: agent.name }))
    : [{ value: defaultAgentId || 'main', label: defaultAgentId || 'main' }];
  if (job?.agentId && !agentOptions.some((option) => option.value === job.agentId)) {
    agentOptions.unshift({ value: job.agentId, label: job.agentId });
  }

  const [name, setName] = useState(job?.name || '');
  const [agentId, setAgentId] = useState(job?.agentId || defaultAgentId || agentOptions[0]?.value || 'main');
  const [message, setMessage] = useState(job?.message || '');
  const boundTargetOptions: CronTargetOption[] = channelGroups
    .filter((group) => group.enabled !== false)
    .flatMap((group) =>
      group.accounts
        .filter((account) => account.configured && account.enabled !== false && account.agentId === agentId)
        .map((account) => ({
          value: buildCronTargetValue(group.channelType, account.accountId),
          channelType: group.channelType,
          accountId: account.accountId,
          label: formatCronTargetLabel(group.channelType, account.accountId),
        })))
    .sort((left, right) => left.label.localeCompare(right.label));
  // Extract cron expression string from CronSchedule object or use as-is if string
  const initialSchedule = (() => {
    const s = job?.schedule;
    if (!s) return '0 9 * * *';
    if (typeof s === 'string') return s;
    if (typeof s === 'object' && 'expr' in s && typeof (s as { expr: string }).expr === 'string') {
      return (s as { expr: string }).expr;
    }
    return '0 9 * * *';
  })();
  const [schedule, setSchedule] = useState(initialSchedule);
  const [customSchedule, setCustomSchedule] = useState('');
  const [useCustom, setUseCustom] = useState(false);
  const [enabled, setEnabled] = useState(job?.enabled ?? true);
  const [targetValue, setTargetValue] = useState(
    job?.target ? buildCronTargetValue(job.target.channelType, job.target.accountId) : '',
  );
  const [recipientId, setRecipientId] = useState(job?.target?.recipientId || '');
  const [recipientDirty, setRecipientDirty] = useState(Boolean(job?.target?.recipientId));
  const [lastAutoRecipientId, setLastAutoRecipientId] = useState<string | null>(null);
  const [recipientHint, setRecipientHint] = useState(t('dialog.targetRecipientDesc'));
  const [recipientHintTone, setRecipientHintTone] = useState<'muted' | 'success' | 'warning'>('muted');
  const schedulePreview = estimateNextRun(useCustom ? customSchedule : schedule);

  useEffect(() => {
    const fallbackAgentId = job?.agentId || defaultAgentId || agents[0]?.id || 'main';
    if (!agentId && fallbackAgentId) {
      setAgentId(fallbackAgentId);
    }
  }, [agentId, agents, defaultAgentId, job?.agentId]);

  useEffect(() => {
    if (boundTargetOptions.length === 0) {
      if (targetValue) setTargetValue('');
      if (!job?.target?.recipientId) setRecipientId('');
      setRecipientDirty(Boolean(job?.target?.recipientId));
      setLastAutoRecipientId(null);
      setRecipientHint(t('dialog.noChannels'));
      setRecipientHintTone('warning');
      return;
    }

    if (!boundTargetOptions.some((option) => option.value === targetValue)) {
      const nextValue = boundTargetOptions[0]?.value || '';
      setTargetValue(nextValue);
      if (!job?.target || nextValue !== buildCronTargetValue(job.target.channelType, job.target.accountId)) {
        setRecipientId('');
        setRecipientDirty(false);
        setLastAutoRecipientId(null);
      }
    }
  }, [boundTargetOptions, job?.target, t, targetValue]);

  const resolveRecipientHint = useCallback(async (nextTargetValue: string, overwriteValue: boolean) => {
    const selectedTarget = boundTargetOptions.find((option) => option.value === nextTargetValue);
    if (!selectedTarget) {
      setRecipientHint(boundTargetOptions.length === 0 ? t('dialog.noChannels') : t('dialog.targetRecipientDesc'));
      setRecipientHintTone(boundTargetOptions.length === 0 ? 'warning' : 'muted');
      return;
    }

    const cacheKey = `${selectedTarget.channelType}:${selectedTarget.accountId}`;
    let inference = recipientInferenceCache.current[cacheKey];

    if (!inference) {
      try {
        const accountParam = selectedTarget.accountId ? `?accountId=${encodeURIComponent(selectedTarget.accountId)}` : '';
        const response = await hostApiFetch<ChannelEditorValuesResponse>(
          `/api/channels/recipient-hints/${encodeURIComponent(selectedTarget.channelType)}${accountParam}`,
        );
        inference = response.hint ?? { recipientId: null, reason: 'missing' };
      } catch {
        inference = { recipientId: null, reason: 'missing' };
      }
      recipientInferenceCache.current[cacheKey] = inference;
    }

    if (inference.recipientId && overwriteValue) {
      setRecipientId(inference.recipientId);
      setLastAutoRecipientId(inference.recipientId);
    } else if (!inference.recipientId && overwriteValue) {
      setRecipientId('');
      setLastAutoRecipientId(null);
    }

    if (inference.reason === 'derived' && inference.recipientId) {
      const showsAutoValue = overwriteValue || recipientId.trim() === inference.recipientId;
      setRecipientHint(t(showsAutoValue ? 'dialog.targetRecipientAuto' : 'dialog.targetRecipientDetected', { value: inference.recipientId }));
      setRecipientHintTone('success');
      return;
    }

    if (inference.reason === 'wildcard') {
      setRecipientHint(t('dialog.targetRecipientWildcard'));
      setRecipientHintTone('warning');
      return;
    }

    if (inference.reason === 'multiple') {
      setRecipientHint(t('dialog.targetRecipientMultiple'));
      setRecipientHintTone('warning');
      return;
    }

    setRecipientHint(t('dialog.targetRecipientUnavailable'));
    setRecipientHintTone('muted');
  }, [boundTargetOptions, recipientId, t]);

  useEffect(() => {
    if (!targetValue || boundTargetOptions.length === 0) {
      return;
    }

    const overwriteValue = !recipientDirty || !recipientId.trim() || recipientId === lastAutoRecipientId;
    void resolveRecipientHint(targetValue, overwriteValue);
  }, [boundTargetOptions.length, lastAutoRecipientId, recipientDirty, recipientId, resolveRecipientHint, targetValue]);

  const handleTargetValueChange = (nextValue: string) => {
    if (nextValue !== targetValue) {
      setTargetValue(nextValue);
      if (!job?.target || nextValue !== buildCronTargetValue(job.target.channelType, job.target.accountId)) {
        setRecipientId('');
        setRecipientDirty(false);
        setLastAutoRecipientId(null);
      }
    }
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast.error(t('toast.nameRequired'));
      return;
    }
    if (!agentId.trim()) {
      toast.error(t('toast.agentRequired'));
      return;
    }
    if (!message.trim()) {
      toast.error(t('toast.messageRequired'));
      return;
    }

    const finalSchedule = useCustom ? customSchedule : schedule;
    if (!finalSchedule.trim()) {
      toast.error(t('toast.scheduleRequired'));
      return;
    }
    if (!targetValue.trim()) {
      toast.error(t('toast.channelRequired'));
      return;
    }
    if (!recipientId.trim()) {
      toast.error(t('toast.recipientRequired'));
      return;
    }

    const selectedTarget = boundTargetOptions.find((option) => option.value === targetValue);
    if (!selectedTarget) {
      toast.error(t('toast.channelRequired'));
      return;
    }

    setSaving(true);
    try {
      await onSave({
        agentId: agentId.trim(),
        name: name.trim(),
        message: message.trim(),
        schedule: finalSchedule,
        target: {
          channelType: selectedTarget.channelType,
          accountId: selectedTarget.accountId,
          recipientId: recipientId.trim(),
        },
        enabled,
      });
      onClose();
      toast.success(job ? t('toast.updated') : t('toast.created'));
    } catch (err) {
      toast.error(String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="app-modal-overlay fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className={cn(modalSurfaceClasses, 'relative flex max-h-[min(90vh,52rem)] w-full max-w-[66rem] flex-col overflow-hidden')}
        onClick={(e) => e.stopPropagation()}
      >
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className={cn(workbenchToolbarIconButtonClasses, 'absolute right-5 top-5 z-10')}
        >
          <X className="h-4 w-4" />
        </Button>
        <div className="shrink-0 border-b border-border/70 px-6 pb-4 pt-5 pr-[4.75rem]">
          <div>
            <h2 className="text-[19px] font-semibold tracking-tight text-foreground">
              {job ? t('dialog.editTitle') : t('dialog.createTitle')}
            </h2>
            <p className="mt-1 text-[13px] font-medium text-foreground/62">
              {t('dialog.description')}
            </p>
          </div>
        </div>
        <div className="app-cron-dialog-body px-6 py-4">
          <div className="app-cron-dialog-stack">
            <div className="app-cron-dialog-topline">
              <section className="app-cron-dialog-pane app-cron-dialog-pane--name">
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-[13px] font-semibold text-foreground/78">{t('dialog.taskName')}</Label>
                  <Input
                    id="name"
                    placeholder={t('dialog.taskNamePlaceholder')}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className={cn(inputClasses, 'h-8')}
                  />
                </div>
              </section>

              <section className="app-cron-dialog-pane app-cron-dialog-pane--agent">
                <div className="space-y-2">
                  <Label htmlFor="agentId" className="text-[13px] font-semibold text-foreground/78">{t('dialog.agent')}</Label>
                  <Select
                    id="agentId"
                    aria-label={t('dialog.agent')}
                    value={agentId}
                    options={agentOptions}
                    placeholder={t('dialog.agentPlaceholder')}
                    onValueChange={setAgentId}
                    className="h-8 rounded-md text-[13px]"
                  />
                </div>
              </section>
            </div>

            <div className="app-cron-dialog-grid">
              <section className="app-cron-dialog-pane app-cron-dialog-pane--main">
                <div className="space-y-2">
                  <Label htmlFor="message" className="text-[13px] font-semibold text-foreground/78">{t('dialog.message')}</Label>
                  <Textarea
                    id="message"
                    placeholder={t('dialog.messagePlaceholder')}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={6}
                    className={cn(textareaClasses, 'min-h-[220px]')}
                  />
                </div>
              </section>

              <section className="app-cron-dialog-pane app-cron-dialog-pane--meta">
                <div className="space-y-2">
                  <Label htmlFor="targetChannel" className="text-[13px] font-semibold text-foreground/78">{t('dialog.targetChannel')}</Label>
                  <Select
                    id="targetChannel"
                    aria-label={t('dialog.targetChannel')}
                    value={targetValue}
                    options={boundTargetOptions}
                    placeholder={boundTargetOptions.length > 0 ? t('dialog.targetChannel') : t('dialog.noChannels')}
                    disabled={boundTargetOptions.length === 0}
                    onValueChange={handleTargetValueChange}
                    className="h-8 rounded-md text-[13px]"
                  />
                  {boundTargetOptions.length === 0 ? (
                    <p className="text-[12px] leading-[1.5] text-amber-700 dark:text-amber-300">
                      {t('dialog.noChannels')}
                    </p>
                  ) : null}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="recipientId" className="text-[13px] font-semibold text-foreground/78">{t('dialog.targetRecipient')}</Label>
                  <Input
                    id="recipientId"
                    placeholder={t('dialog.targetRecipientPlaceholder')}
                    value={recipientId}
                    onChange={(e) => {
                      setRecipientId(e.target.value);
                      setRecipientDirty(true);
                      if (!e.target.value.trim()) {
                        setLastAutoRecipientId(null);
                      }
                    }}
                    className={cn(tokenInputClasses, 'h-10')}
                  />
                  <p
                    className={cn(
                      'text-[12px] leading-[1.55]',
                      recipientHintTone === 'success'
                        ? 'text-emerald-700 dark:text-emerald-300'
                        : recipientHintTone === 'warning'
                          ? 'text-amber-700 dark:text-amber-300'
                          : 'text-foreground/48',
                    )}
                  >
                    {recipientHint}
                  </p>
                </div>
              </section>
            </div>

            <section className="app-cron-dialog-pane app-cron-dialog-pane--schedule">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <Label className="text-[13px] font-semibold text-foreground/78">{t('dialog.schedule')}</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setUseCustom(!useCustom)}
                    className="h-7 rounded-md px-2.5 text-[12px] text-foreground/60 hover:bg-[hsl(var(--surface-hover)/0.46)] hover:text-foreground"
                  >
                    {useCustom ? t('dialog.usePresets') : t('dialog.useCustomCron')}
                  </Button>
                </div>
              </div>

              {!useCustom ? (
                <div className="app-cron-dialog-presets">
                  {schedulePresets.map((preset) => (
                    <Button
                      key={preset.value}
                      type="button"
                      variant={schedule === preset.value ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setSchedule(preset.value)}
                      className={cn(
                        scheduleButtonBaseClasses,
                        schedule === preset.value
                          ? 'border-transparent bg-primary text-primary-foreground shadow-none hover:bg-primary/90'
                          : 'border-border/70 bg-transparent text-foreground/80 hover:bg-[hsl(var(--surface-hover)/0.46)] hover:text-foreground'
                      )}
                    >
                      <Timer className="mr-2 h-4 w-4 opacity-70" />
                      {t(`presets.${preset.key}` as const)}
                    </Button>
                  ))}
                </div>
              ) : (
                <Input
                  placeholder={t('dialog.cronPlaceholder')}
                  value={customSchedule}
                  onChange={(e) => setCustomSchedule(e.target.value)}
                  className={tokenInputClasses}
                />
              )}

              <div className="app-cron-dialog-schedule-footer">
                <div className="app-cron-dialog-preview">
                  <span className="app-cron-dialog-preview-label">{t('card.next')}</span>
                  <span className="app-cron-dialog-preview-value">
                    {schedulePreview || t('dialog.cronPlaceholder')}
                  </span>
                </div>

                <label className="app-cron-dialog-inline-toggle">
                  <Switch checked={enabled} onCheckedChange={setEnabled} />
                  <span>{t('dialog.enableImmediately')}</span>
                </label>
              </div>
            </section>
          </div>
        </div>
        <div className="shrink-0 border-t border-border/70 px-6 py-4">
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={onClose} className="h-8 rounded-md border-border/70 bg-transparent px-4 text-[12.75px] font-semibold text-foreground/80 shadow-none hover:bg-[hsl(var(--surface-hover)/0.46)] hover:text-foreground">
              {t('common:actions.cancel', 'Cancel')}
            </Button>
            <Button onClick={handleSubmit} disabled={saving || boundTargetOptions.length === 0} className="workbench-motion-button workbench-motion-button--lift h-8 rounded-md border border-transparent px-4 text-[12.75px] font-semibold shadow-sm">
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t('common:status.saving', 'Saving...')}
                </>
              ) : (
                <>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  {job ? t('dialog.saveChanges') : t('dialog.createTitle')}
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Job Card Component
interface CronJobCardProps {
  job: CronJob;
  agentLabel: string;
  onToggle: (enabled: boolean) => void;
  onEdit: () => void;
  onDelete: () => void;
  onTrigger: () => Promise<CronTriggerResult>;
}

function CronJobCard({ job, agentLabel, onToggle, onEdit, onDelete, onTrigger }: CronJobCardProps) {
  const { t } = useTranslation('cron');
  const [triggering, setTriggering] = useState(false);
  const scheduleLabel = parseCronSchedule(job.schedule, t);
  const lastRunLabel = job.lastRun ? formatRelativeTime(job.lastRun.time) : null;
  const nextRunLabel = job.nextRun && job.enabled ? new Date(job.nextRun).toLocaleString() : null;
  const hasDeliveryTarget = Boolean(job.target?.channelType && job.target?.accountId && job.target?.recipientId?.trim());
  const stateTone = !hasDeliveryTarget ? 'failed' : !job.enabled ? 'paused' : job.lastRun && !job.lastRun.success ? 'failed' : 'active';

  const handleTrigger = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setTriggering(true);
    try {
      const result = await onTrigger();
      if (result?.ran === false && result.reason === 'already-running') {
        toast.message(t('toast.alreadyRunning'));
      } else if (result?.ran === false) {
        toast.message(t('toast.triggerQueued'));
      } else {
        toast.success(t('toast.triggered'));
      }
    } catch (error) {
      console.error('Failed to trigger cron job:', error);
      toast.error(t('toast.failedTrigger', { error: error instanceof Error ? error.message : String(error) }));
    } finally {
      setTriggering(false);
    }
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete();
  };

  return (
    <div
      className={cardSurfaceClasses}
      onClick={onEdit}
    >
      <div className="app-cron-task-head">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2.5">
            <h3 className="truncate text-[18px] font-semibold tracking-[-0.026em] text-foreground">{job.name}</h3>
            <span
              className={cn(
                'h-2.5 w-2.5 shrink-0 rounded-full',
                stateTone === 'active' ? 'bg-emerald-500' : stateTone === 'failed' ? 'bg-destructive' : 'bg-foreground/26',
              )}
              title={stateTone === 'active' ? t('stats.active') : stateTone === 'failed' ? t('stats.failed') : t('stats.paused')}
            />
          </div>
          <p className="mt-1 text-[12.5px] font-medium leading-none text-foreground/52">
            {scheduleLabel}
          </p>
        </div>

        <div className="app-cron-task-switch" onClick={e => e.stopPropagation()}>
          <Switch
            checked={job.enabled}
            onCheckedChange={onToggle}
            className="app-cron-card-switch"
          />
        </div>
      </div>

      <p className="app-cron-task-message line-clamp-2 text-[13px] leading-[1.62] text-foreground/66">
        {job.message}
      </p>

      <div className="app-cron-task-facts">
        <span className="app-cron-task-fact-pill">
          {t('card.agent')}: {agentLabel}
        </span>

        {job.target ? (
          <span className="app-cron-task-fact-pill">
            {formatCronTargetLabel(job.target.channelType, job.target.accountId)}
          </span>
        ) : null}

        {lastRunLabel ? (
          <span className={cn('app-cron-task-fact-pill', !job.lastRun?.success && 'app-cron-task-fact-pill--danger')}>
            {t('card.last')}: {lastRunLabel}
          </span>
        ) : null}

        {nextRunLabel ? (
          <span className="app-cron-task-fact-pill">
            {t('card.next')}: {nextRunLabel}
          </span>
        ) : null}
      </div>

      {job.lastRun && !job.lastRun.success && job.lastRun.error ? (
        <div className="app-cron-task-error">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span className="line-clamp-2">{job.lastRun.error}</span>
        </div>
      ) : !hasDeliveryTarget ? (
        <div className="app-cron-task-error">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span className="line-clamp-2">{t('card.deliveryMissing')}</span>
        </div>
      ) : null}

      <div className="app-cron-task-footer" onClick={e => e.stopPropagation()}>
        <div className="app-cron-task-status-row">
          <span className={cn('app-cron-task-status-pill', `app-cron-task-status-pill--${stateTone}`)}>
            {!hasDeliveryTarget ? t('card.deliveryRequired') : stateTone === 'active' ? t('stats.active') : stateTone === 'failed' ? t('stats.failed') : t('stats.paused')}
          </span>
        </div>

        <div className="app-cron-task-tools">
          <div className="app-cron-task-actions">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleTrigger}
              disabled={triggering || !hasDeliveryTarget}
              className="h-7 w-7 rounded-md p-0 text-foreground/56 transition-colors hover:bg-[hsl(var(--surface-hover)/0.52)] hover:text-foreground"
              title={hasDeliveryTarget ? t('card.runNow') : t('card.configureDelivery')}
            >
              {triggering ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Play className="h-3.5 w-3.5" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDelete}
              className="h-7 w-7 rounded-md p-0 text-destructive/54 transition-colors hover:bg-destructive/10 hover:text-destructive"
              title={t('common:actions.delete', 'Delete')}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function Cron() {
  const { t } = useTranslation('cron');
  const { jobs, loading, error, fetchJobs, createJob, updateJob, toggleJob, deleteJob, triggerJob } = useCronStore();
  const agents = useAgentsStore((state) => state.agents);
  const defaultAgentId = useAgentsStore((state) => state.defaultAgentId);
  const gatewayStatus = useGatewayStore((state) => state.status);
  const [showDialog, setShowDialog] = useState(false);
  const [editingJob, setEditingJob] = useState<CronJob | undefined>();
  const [jobToDelete, setJobToDelete] = useState<{ id: string } | null>(null);
  const [channelGroups, setChannelGroups] = useState<ChannelGroupItem[]>([]);

  const isGatewayRunning = gatewayStatus.state === 'running';

  // Fetch jobs on mount
  useEffect(() => {
    if (isGatewayRunning) {
      fetchJobs();
    }
  }, [fetchJobs, isGatewayRunning]);

  useEffect(() => {
    void useAgentsStore.getState().fetchAgents();
  }, []);

  useEffect(() => {
    if (!showDialog) {
      return;
    }

    let cancelled = false;
    const loadChannelGroups = async () => {
      try {
        const response = await hostApiFetch<ChannelAccountsResponse>('/api/channels/accounts');
        if (!cancelled) {
          setChannelGroups(response.channels || []);
        }
      } catch {
        if (!cancelled) {
          setChannelGroups([]);
        }
      }
    };

    void loadChannelGroups();
    return () => {
      cancelled = true;
    };
  }, [showDialog]);

  // Statistics
  const safeJobs = Array.isArray(jobs) ? jobs : [];
  const activeJobs = safeJobs.filter((j) => j.enabled);
  const pausedJobs = safeJobs.filter((j) => !j.enabled);
  const failedJobs = safeJobs.filter((j) => j.lastRun && !j.lastRun.success);
  const agentNameMap = Object.fromEntries(agents.map((agent) => [agent.id, agent.name]));
  const summaryItems = [
    { id: 'total', icon: <Activity className="h-3.5 w-3.5" />, label: t('stats.total'), value: safeJobs.length, tone: 'neutral' as const },
    { id: 'active', icon: <CheckCircle2 className="h-3.5 w-3.5" />, label: t('stats.active'), value: activeJobs.length, tone: 'success' as const },
    { id: 'paused', icon: <CircleOff className="h-3.5 w-3.5" />, label: t('stats.paused'), value: pausedJobs.length, tone: 'warning' as const },
    { id: 'failed', icon: <AlertCircle className="h-3.5 w-3.5" />, label: t('stats.failed'), value: failedJobs.length, tone: 'danger' as const },
  ];

  const handleSave = useCallback(async (input: CronJobCreateInput) => {
    if (editingJob) {
      await updateJob(editingJob.id, input);
    } else {
      await createJob(input);
    }
  }, [editingJob, createJob, updateJob]);

  const handleToggle = useCallback(async (id: string, enabled: boolean) => {
    try {
      await toggleJob(id, enabled);
      toast.success(enabled ? t('toast.enabled') : t('toast.paused'));
    } catch {
      toast.error(t('toast.failedUpdate'));
    }
  }, [toggleJob, t]);



  if (loading) {
    return <WorkspacePageLoading />;
  }

  return (
    <WorkspacePageFrame>
      <WorkspacePageShell className="app-cron-shell">
        <WorkbenchHeader
          titleBlock={
            <WorkbenchHeaderTitleBlock
              title={t('title')}
              subtitle={t('subtitle')}
            />
          }
          summary={
            <div className="app-cron-toolbar">
              <WorkbenchSummaryStrip items={summaryItems} className="app-cron-summary-line" />

              <WorkbenchHeaderActions className="app-cron-toolbar-actions">
                <Button
                  variant="outline"
                  onClick={fetchJobs}
                  disabled={!isGatewayRunning}
                  className={workbenchToolbarButtonClasses}
                >
                  <RefreshCw className="mr-2 h-3.5 w-3.5" />
                  {t('refresh')}
                </Button>
                <Button
                  onClick={() => {
                    setEditingJob(undefined);
                    setShowDialog(true);
                  }}
                  disabled={!isGatewayRunning}
                  className={workbenchPrimaryToolbarButtonClasses}
                >
                  <Plus className="mr-2 h-3.5 w-3.5" />
                  {t('newTask')}
                </Button>
              </WorkbenchHeaderActions>
            </div>
          }
        />

        <WorkspacePageScrollArea>
          {!isGatewayRunning && (
            <div className="app-cron-notice mb-5 flex items-center gap-2.5 rounded-lg border border-amber-500/15 bg-amber-500/6 px-3.5 py-2.5 app-insight-surface">
              <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              <span className="text-sm font-medium text-amber-900 dark:text-amber-100">
                {t('gatewayWarning')}
              </span>
            </div>
          )}

          {error && (
            <div className="app-cron-notice mb-5 flex items-center gap-2.5 rounded-lg border border-destructive/16 bg-[hsl(var(--danger))/0.06] px-3.5 py-2.5 app-insight-surface">
              <AlertCircle className="h-5 w-5 text-destructive" />
              <span className="text-sm font-medium text-destructive">
                {error}
              </span>
            </div>
          )}

          {safeJobs.length === 0 ? (
            <div className="app-cron-empty-state app-empty-surface flex flex-col items-center justify-center rounded-xl border border-dashed border-border/60 px-6 py-14 text-muted-foreground">
              <Clock className="mb-3 h-8 w-8 opacity-40" />
              <h3 className="mb-1.5 text-[17px] font-medium tracking-[-0.02em] text-foreground">{t('empty.title')}</h3>
              <p className="max-w-md text-center text-[12.8px] leading-[1.55]">
                {t('empty.description')}
              </p>
            </div>
          ) : (
            <div className="app-cron-card-grid">
              {safeJobs.map((job) => (
                <CronJobCard
                  key={job.id}
                  job={job}
                  agentLabel={agentNameMap[job.agentId ?? defaultAgentId] ?? job.agentId ?? defaultAgentId}
                  onToggle={(enabled) => handleToggle(job.id, enabled)}
                  onEdit={() => {
                    setEditingJob(job);
                    setShowDialog(true);
                  }}
                  onDelete={() => setJobToDelete({ id: job.id })}
                  onTrigger={() => triggerJob(job.id)}
                />
              ))}
            </div>
          )}
        </WorkspacePageScrollArea>
      </WorkspacePageShell>

      {showDialog && (
        <TaskDialog
          job={editingJob}
          agents={agents}
          channelGroups={channelGroups}
          defaultAgentId={defaultAgentId}
          onClose={() => {
            setShowDialog(false);
            setEditingJob(undefined);
          }}
          onSave={handleSave}
        />
      )}

      <ConfirmDialog
        open={!!jobToDelete}
        title={t('common:actions.confirm', 'Confirm')}
        message={t('card.deleteConfirm')}
        confirmLabel={t('common:actions.delete', 'Delete')}
        cancelLabel={t('common:actions.cancel', 'Cancel')}
        variant="destructive"
        onConfirm={async () => {
          if (jobToDelete) {
            await deleteJob(jobToDelete.id);
            setJobToDelete(null);
            toast.success(t('toast.deleted'));
          }
        }}
        onCancel={() => setJobToDelete(null)}
      />
    </WorkspacePageFrame>
  );
}

export default Cron;
