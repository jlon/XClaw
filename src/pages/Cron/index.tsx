/**
 * Cron Page
 * Manage scheduled tasks
 */
import { useEffect, useState, useCallback } from 'react';
import {
  Plus,
  Clock,
  Play,
  Pause,
  Trash2,
  RefreshCw,
  X,
  Calendar,
  AlertCircle,
  CheckCircle2,
  XCircle,
  MessageSquare,
  Bot,
  Loader2,
  Timer,
  History,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { ChannelIcon } from '@/components/channels/ChannelIcon';
import { WorkspacePageFrame, WorkspacePageLoading, WorkspacePageScrollArea, WorkspacePageShell } from '@/components/layout/WorkspacePage';
import { WorkbenchHeader } from '@/components/layout/WorkbenchHeader';
import { WorkbenchHeaderActions } from '@/components/layout/WorkbenchHeaderActions';
import { WorkbenchHeaderIcon } from '@/components/layout/WorkbenchHeaderIcon';
import { WorkbenchHeaderTitleBlock } from '@/components/layout/WorkbenchHeaderTitleBlock';
import { WorkbenchSummaryStrip } from '@/components/layout/WorkbenchSummaryStrip';
import { useCronStore } from '@/stores/cron';
import { useAgentsStore } from '@/stores/agents';
import { useGatewayStore } from '@/stores/gateway';
import { formatRelativeTime, cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { CronJob, CronJobCreateInput, ScheduleType } from '@/types/cron';
import type { ChannelType } from '@/types/channel';
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

const headerButtonClasses =
  'h-9 rounded-[13px] px-3.5 text-[12.5px] font-medium shadow-none border-border/70 bg-transparent text-foreground/76 transition-colors hover:bg-[hsl(var(--surface-hover)/0.46)] hover:text-foreground';
const primaryHeaderButtonClasses =
  'h-9 rounded-[14px] px-4 text-[12.75px] font-medium shadow-none';
const iconButtonClasses =
  'h-8 w-8 rounded-[12px] border border-border/70 bg-transparent shadow-none text-muted-foreground transition-colors hover:bg-[hsl(var(--surface-hover)/0.46)] hover:text-foreground';
const inputClasses =
  'h-[44px] rounded-xl text-[13px] app-field-surface text-foreground placeholder:text-foreground/40 shadow-none transition-all focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30';
const tokenInputClasses =
  'h-[44px] rounded-xl font-mono text-[13px] app-field-surface text-foreground placeholder:text-foreground/40 shadow-none transition-all focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30';
const textareaClasses =
  'rounded-xl text-[13px] app-field-surface text-foreground placeholder:text-foreground/40 shadow-none transition-all focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30 resize-none';
const modalSurfaceClasses =
  'app-modal-surface w-full rounded-[20px]';
const cardSurfaceClasses =
  'app-cron-job-card group relative overflow-hidden rounded-[18px] border border-border/72 px-4 py-3.5 transition-colors cursor-pointer';
const scheduleButtonBaseClasses =
  'justify-start h-10 rounded-[12px] font-medium text-[13px] transition-all';

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
  defaultAgentId: string;
  onClose: () => void;
  onSave: (input: CronJobCreateInput) => Promise<void>;
}

function TaskDialog({ job, agents, defaultAgentId, onClose, onSave }: TaskDialogProps) {
  const { t } = useTranslation('cron');
  const [saving, setSaving] = useState(false);
  const agentOptions = agents.length > 0
    ? agents.map((agent) => ({ value: agent.id, label: agent.name }))
    : [{ value: defaultAgentId || 'main', label: defaultAgentId || 'main' }];
  if (job?.agentId && !agentOptions.some((option) => option.value === job.agentId)) {
    agentOptions.unshift({ value: job.agentId, label: job.agentId });
  }

  const [name, setName] = useState(job?.name || '');
  const [agentId, setAgentId] = useState(job?.agentId || defaultAgentId || agentOptions[0]?.value || 'main');
  const [message, setMessage] = useState(job?.message || '');
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
  const schedulePreview = estimateNextRun(useCustom ? customSchedule : schedule);

  useEffect(() => {
    const fallbackAgentId = job?.agentId || defaultAgentId || agents[0]?.id || 'main';
    if (!agentId && fallbackAgentId) {
      setAgentId(fallbackAgentId);
    }
  }, [agentId, agents, defaultAgentId, job?.agentId]);

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

    setSaving(true);
    try {
      await onSave({
        agentId: agentId.trim(),
        name: name.trim(),
        message: message.trim(),
        schedule: finalSchedule,
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
        className={cn(modalSurfaceClasses, 'relative max-h-[90vh] w-full max-w-[64rem] flex flex-col overflow-hidden')}
        onClick={(e) => e.stopPropagation()}
      >
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className={cn(iconButtonClasses, 'absolute right-5 top-5 z-10')}
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
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div className="space-y-5 min-w-0">
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(15rem,0.95fr)]">
              <div className="space-y-2 min-w-0">
                <Label htmlFor="name" className="text-[13px] font-semibold text-foreground/78">{t('dialog.taskName')}</Label>
                <Input
                  id="name"
                  placeholder={t('dialog.taskNamePlaceholder')}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={cn(inputClasses, 'h-[42px]')}
                />
              </div>

              <div className="space-y-2 min-w-0">
                <Label htmlFor="agentId" className="text-[13px] font-semibold text-foreground/78">{t('dialog.agent')}</Label>
                <Select
                  id="agentId"
                  aria-label={t('dialog.agent')}
                  value={agentId}
                  options={agentOptions}
                  placeholder={t('dialog.agentPlaceholder')}
                  onValueChange={setAgentId}
                  className="h-[42px] rounded-xl text-[13px]"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="message" className="text-[13px] font-semibold text-foreground/78">{t('dialog.message')}</Label>
              <Textarea
                id="message"
                placeholder={t('dialog.messagePlaceholder')}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={3}
                className={cn(textareaClasses, 'min-h-[84px]')}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-[13px] font-semibold text-foreground/78">{t('dialog.schedule')}</Label>
              {!useCustom ? (
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
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
              <div className="flex items-center justify-between gap-3 pt-1">
                <p className="text-[12px] font-medium text-muted-foreground/80">
                  {schedulePreview ? `${t('card.next')}: ${schedulePreview}` : t('dialog.cronPlaceholder')}
                </p>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setUseCustom(!useCustom)}
                  className="h-7 rounded-[12px] px-2.5 text-[12px] text-foreground/60 hover:bg-[hsl(var(--surface-hover)/0.46)] hover:text-foreground"
                >
                  {useCustom ? t('dialog.usePresets') : t('dialog.useCustomCron')}
                </Button>
              </div>
            </div>

            <div className="rounded-[15px] border border-border/70 app-pane-surface px-4 py-3 shadow-none">
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <Label className="text-[13px] font-semibold text-foreground/78">{t('dialog.enableImmediately')}</Label>
                  <p className="mt-0.5 text-[12.25px] leading-[1.45] text-muted-foreground">
                    {t('dialog.enableImmediatelyDesc')}
                  </p>
                </div>
                <Switch checked={enabled} onCheckedChange={setEnabled} />
              </div>
            </div>
          </div>
        </div>
        <div className="shrink-0 border-t border-border/70 px-6 py-4">
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={onClose} className="h-[40px] rounded-[12px] border-border/70 bg-transparent px-5 text-[13px] font-semibold text-foreground/80 shadow-none hover:bg-[hsl(var(--surface-hover)/0.46)] hover:text-foreground">
              {t('common:actions.cancel', 'Cancel')}
            </Button>
            <Button onClick={handleSubmit} disabled={saving} className="h-[40px] rounded-[12px] border border-transparent px-5 text-[13px] font-semibold shadow-none transition-all">
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {t('common:status.saving', 'Saving...')}
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
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
  onTrigger: () => Promise<void>;
}

function CronJobCard({ job, agentLabel, onToggle, onEdit, onDelete, onTrigger }: CronJobCardProps) {
  const { t } = useTranslation('cron');
  const [triggering, setTriggering] = useState(false);

  const handleTrigger = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setTriggering(true);
    try {
      await onTrigger();
      toast.success(t('toast.triggered'));
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
      <div className="app-cron-job-main">
        <div className="min-w-0">
          <div className="min-w-0 flex items-start gap-3">
            <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-[13px] border border-border/72 bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(246,246,248,0.94)_100%)] text-foreground/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.74)]">
              <Clock className={cn('h-4 w-4', job.enabled ? 'text-foreground/78' : 'text-muted-foreground')} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="truncate text-[14.5px] font-semibold tracking-[-0.018em] text-foreground">{job.name}</h3>
                <div
                  className={cn(
                    'h-2.5 w-2.5 rounded-[999px] shrink-0',
                    job.enabled ? 'bg-green-500' : 'bg-muted-foreground'
                  )}
                  title={job.enabled ? t('stats.active') : t('stats.paused')}
                />
              </div>
              <p className="mt-1 flex items-center gap-1.5 text-[12.25px] font-medium text-muted-foreground">
                <Timer className="h-3.5 w-3.5" />
                {parseCronSchedule(job.schedule, t)}
              </p>
            </div>
          </div>

          <div className="mt-3 pl-[3.25rem]">
            <div className="flex items-start gap-2">
              <MessageSquare className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <p className="line-clamp-2 text-[12.75px] leading-[1.55] text-muted-foreground">
                {job.message}
              </p>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2.5 text-[11.6px] font-medium text-muted-foreground/82">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border/72 bg-[hsl(var(--surface-elevated)/0.88)] px-2.5 py-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.64)]">
                <Bot className="h-3.5 w-3.5" />
                {t('card.agent')}: {agentLabel}
              </span>

              {job.target && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-border/72 bg-[hsl(var(--surface-elevated)/0.88)] px-2.5 py-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.64)]">
                  <ChannelIcon type={job.target.channelType as ChannelType} size={16} />
                  {job.target.channelName}
                </span>
              )}

              {job.lastRun && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-border/72 bg-[hsl(var(--surface-elevated)/0.88)] px-2.5 py-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.64)]">
                  <History className="h-3.5 w-3.5" />
                  {t('card.last')}: {formatRelativeTime(job.lastRun.time)}
                  {job.lastRun.success ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                  ) : (
                    <XCircle className="h-3.5 w-3.5 text-red-500" />
                  )}
                </span>
              )}

              {job.nextRun && job.enabled && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-border/72 bg-[hsl(var(--surface-elevated)/0.88)] px-2.5 py-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.64)]">
                  <Calendar className="h-3.5 w-3.5" />
                  {t('card.next')}: {new Date(job.nextRun).toLocaleString()}
                </span>
              )}
            </div>

            {job.lastRun && !job.lastRun.success && job.lastRun.error && (
              <div className="app-cron-job-error mt-3 flex items-start gap-2 rounded-[12px] border border-destructive/18 bg-[hsl(var(--danger))/0.07] px-3 py-2 text-[12.25px] text-destructive">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span className="line-clamp-2">{job.lastRun.error}</span>
              </div>
            )}
          </div>
        </div>

        <div className="app-cron-job-rail" onClick={e => e.stopPropagation()}>
          <Switch
            checked={job.enabled}
            onCheckedChange={onToggle}
            className="app-cron-card-switch"
          />
          <div className="app-cron-job-actions">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleTrigger}
              disabled={triggering}
              className="h-8 w-8 rounded-[12px] p-0 text-foreground/66 transition-colors hover:bg-[hsl(var(--surface-hover)/0.46)] hover:text-foreground"
              title={t('card.runNow')}
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
              className="h-8 w-8 rounded-[12px] p-0 text-destructive/66 transition-colors hover:bg-destructive/10 hover:text-destructive"
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
  const fetchAgents = useAgentsStore((state) => state.fetchAgents);
  const gatewayStatus = useGatewayStore((state) => state.status);
  const [showDialog, setShowDialog] = useState(false);
  const [editingJob, setEditingJob] = useState<CronJob | undefined>();
  const [jobToDelete, setJobToDelete] = useState<{ id: string } | null>(null);

  const isGatewayRunning = gatewayStatus.state === 'running';

  // Fetch jobs on mount
  useEffect(() => {
    if (isGatewayRunning) {
      fetchJobs();
    }
  }, [fetchJobs, isGatewayRunning]);

  useEffect(() => {
    void fetchAgents();
  }, [fetchAgents]);

  // Statistics
  const safeJobs = Array.isArray(jobs) ? jobs : [];
  const activeJobs = safeJobs.filter((j) => j.enabled);
  const pausedJobs = safeJobs.filter((j) => !j.enabled);
  const failedJobs = safeJobs.filter((j) => j.lastRun && !j.lastRun.success);
  const agentNameMap = Object.fromEntries(agents.map((agent) => [agent.id, agent.name]));
  const summaryItems = [
    {
      id: 'total',
      icon: <Clock className="h-3.5 w-3.5" />,
      label: t('stats.total'),
      value: safeJobs.length,
      tone: 'neutral' as const,
    },
    {
      id: 'active',
      icon: <Play className="h-3.5 w-3.5" />,
      label: t('stats.active'),
      value: activeJobs.length,
      tone: 'success' as const,
    },
    {
      id: 'paused',
      icon: <Pause className="h-3.5 w-3.5" />,
      label: t('stats.paused'),
      value: pausedJobs.length,
      tone: 'warning' as const,
    },
    {
      id: 'failed',
      icon: <AlertCircle className="h-3.5 w-3.5" />,
      label: t('stats.failed'),
      value: failedJobs.length,
      tone: 'danger' as const,
    },
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
          className="app-cron-header"
          icon={(
            <WorkbenchHeaderIcon tone="plum" className="app-cron-header-icon">
              <Clock className="h-[18px] w-[18px]" strokeWidth={2.1} />
            </WorkbenchHeaderIcon>
          )}
          titleBlock={(
            <WorkbenchHeaderTitleBlock
              title={t('title')}
              subtitle={t('subtitle')}
              className="app-cron-header-copy"
            />
          )}
          actions={(
            <WorkbenchHeaderActions className="app-cron-header-actions">
              <Button
                variant="outline"
                onClick={fetchJobs}
                disabled={!isGatewayRunning}
                className={headerButtonClasses}
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
                className={primaryHeaderButtonClasses}
              >
                <Plus className="mr-2 h-3.5 w-3.5" />
                {t('newTask')}
              </Button>
            </WorkbenchHeaderActions>
          )}
          summary={<WorkbenchSummaryStrip items={summaryItems} className="app-cron-summary-strip" />}
        />

        <WorkspacePageScrollArea>
          {!isGatewayRunning && (
            <div className="mb-5 flex items-center gap-2.5 rounded-[14px] border border-amber-500/15 bg-amber-500/6 px-3.5 py-2.5 app-insight-surface">
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

          {safeJobs.length === 0 ? (
            <div className="app-empty-surface flex flex-col items-center justify-center rounded-[16px] border border-dashed border-border/60 px-6 py-14 text-muted-foreground">
              <Clock className="mb-3 h-8 w-8 opacity-40" />
              <h3 className="mb-1.5 text-[17px] font-medium tracking-[-0.02em] text-foreground">{t('empty.title')}</h3>
              <p className="max-w-md text-center text-[12.8px] leading-[1.55]">
                {t('empty.description')}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
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
