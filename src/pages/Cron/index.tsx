/**
 * Cron Page
 * Manage scheduled tasks
 */
import { useEffect, useState, useCallback } from 'react';
import {
  Plus,
  Clock,
  Play,
  Trash2,
  RefreshCw,
  X,
  Calendar,
  AlertCircle,
  CheckCircle2,
  XCircle,
  MessageSquare,
  Loader2,
  Timer,
  History,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { WorkspacePageFrame, WorkspacePageLoading, WorkspacePageScrollArea, WorkspacePageShell } from '@/components/layout/WorkspacePage';
import { useCronStore } from '@/stores/cron';
import { useGatewayStore } from '@/stores/gateway';
import { formatRelativeTime, cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { CronJob, CronJobCreateInput, ScheduleType } from '@/types/cron';
import { CHANNEL_ICONS, type ChannelType } from '@/types/channel';
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
  'h-8 rounded-full px-3.5 text-[12.5px] font-medium shadow-none border-border/70 bg-transparent text-foreground/78 transition-colors hover:bg-accent/60 hover:text-foreground';
const iconButtonClasses =
  'h-8 w-8 rounded-full border border-border/70 bg-transparent shadow-none text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground';
const inputClasses =
  'h-[44px] rounded-xl text-[13px] app-field-surface text-foreground placeholder:text-foreground/40 shadow-none transition-all focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30';
const tokenInputClasses =
  'h-[44px] rounded-xl font-mono text-[13px] app-field-surface text-foreground placeholder:text-foreground/40 shadow-none transition-all focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30';
const textareaClasses =
  'rounded-xl text-[13px] app-field-surface text-foreground placeholder:text-foreground/40 shadow-none transition-all focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30 resize-none';
const modalSurfaceClasses =
  'app-modal-surface w-full rounded-[20px]';
const cardSurfaceClasses =
  'group relative flex flex-col overflow-hidden rounded-[13px] border border-transparent px-3.5 py-3 transition-colors cursor-pointer hover:border-border/55 hover:bg-[hsl(var(--surface-hover)/0.46)]';
const scheduleButtonBaseClasses =
  'justify-start h-10 rounded-xl font-medium text-[13px] transition-all';

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
  onClose: () => void;
  onSave: (input: CronJobCreateInput) => Promise<void>;
}

function TaskDialog({ job, onClose, onSave }: TaskDialogProps) {
  const { t } = useTranslation('cron');
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState(job?.name || '');
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

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast.error(t('toast.nameRequired'));
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
        className={cn(modalSurfaceClasses, 'max-h-[90vh] max-w-lg flex flex-col overflow-hidden')}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between border-b border-border/70 px-6 py-5">
          <div>
            <h2 className="text-[19px] font-semibold tracking-tight text-foreground">
              {job ? t('dialog.editTitle') : t('dialog.createTitle')}
            </h2>
            <p className="mt-1 text-[13px] font-medium text-foreground/62">
              {t('dialog.description')}
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className={iconButtonClasses}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
          <div className="space-y-2">
            <Label htmlFor="name" className="text-[13px] font-semibold text-foreground/78">{t('dialog.taskName')}</Label>
            <Input
              id="name"
              placeholder={t('dialog.taskNamePlaceholder')}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={cn(inputClasses, 'h-[42px]')}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="message" className="text-[13px] font-semibold text-foreground/78">{t('dialog.message')}</Label>
            <Textarea
              id="message"
              placeholder={t('dialog.messagePlaceholder')}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              className={cn(textareaClasses, 'min-h-[92px]')}
            />
          </div>

          <div className="space-y-2">
            <Label className="text-[13px] font-semibold text-foreground/78">{t('dialog.schedule')}</Label>
            {!useCustom ? (
              <div className="grid grid-cols-2 gap-2">
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
                        : 'border-border/70 bg-transparent text-foreground/80 hover:bg-accent/60 hover:text-foreground'
                    )}
                  >
                    <Timer className="h-4 w-4 mr-2 opacity-70" />
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
                className="h-7 rounded-full px-2.5 text-[12px] text-foreground/60 hover:bg-accent/60 hover:text-foreground"
              >
                {useCustom ? t('dialog.usePresets') : t('dialog.useCustomCron')}
              </Button>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-[14px] border border-border/70 app-pane-surface p-3.5 shadow-none">
            <div>
              <Label className="text-[13px] font-semibold text-foreground/78">{t('dialog.enableImmediately')}</Label>
              <p className="text-[12.5px] text-muted-foreground mt-0.5">
                {t('dialog.enableImmediatelyDesc')}
              </p>
            </div>
            <Switch checked={enabled} onCheckedChange={setEnabled} />
          </div>
        </div>
        <div className="shrink-0 border-t border-border/70 px-6 py-4">
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={onClose} className="h-[40px] rounded-full border-border/70 bg-transparent px-5 text-[13px] font-semibold text-foreground/80 shadow-none hover:bg-accent/60 hover:text-foreground">
              {t('common:actions.cancel', 'Cancel')}
            </Button>
            <Button onClick={handleSubmit} disabled={saving} className="h-[40px] rounded-full border border-transparent px-5 text-[13px] font-semibold shadow-none transition-all">
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
  onToggle: (enabled: boolean) => void;
  onEdit: () => void;
  onDelete: () => void;
  onTrigger: () => Promise<void>;
}

function CronJobCard({ job, onToggle, onEdit, onDelete, onTrigger }: CronJobCardProps) {
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
      <div className="mb-2.5 flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] border border-border/70 bg-[hsl(var(--surface-panel)/0.92)] text-foreground/70">
            <Clock className={cn('h-3.5 w-3.5', job.enabled ? 'text-foreground/78' : 'text-muted-foreground')} />
          </div>
          <div className="flex min-w-0 flex-col">
            <div className="mb-0.5 flex items-center gap-2">
              <h3 className="truncate text-[14px] font-semibold text-foreground">{job.name}</h3>
              <div
                className={cn(
                  'h-2 w-2 rounded-full shrink-0',
                  job.enabled ? 'bg-green-500' : 'bg-muted-foreground'
                )}
                title={job.enabled ? t('stats.active') : t('stats.paused')}
              />
            </div>
            <p className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
              <Timer className="h-3 w-3" />
              {parseCronSchedule(job.schedule, t)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
          <Switch
            checked={job.enabled}
            onCheckedChange={onToggle}
          />
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-2 pl-11">
        <div className="flex items-start gap-2">
          <MessageSquare className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" />
          <p className="line-clamp-2 text-[12.5px] leading-[1.45] text-muted-foreground">
            {job.message}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11.25px] font-medium text-muted-foreground/78">
          {job.target && (
            <span className="flex items-center gap-1.5">
              {CHANNEL_ICONS[job.target.channelType as ChannelType]}
              {job.target.channelName}
            </span>
          )}

          {job.lastRun && (
            <span className="flex items-center gap-1.5">
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
            <span className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" />
              {t('card.next')}: {new Date(job.nextRun).toLocaleString()}
            </span>
          )}
        </div>

        {/* Last Run Error */}
        {job.lastRun && !job.lastRun.success && job.lastRun.error && (
          <div className="flex items-start gap-2 rounded-[12px] border border-destructive/18 bg-[hsl(var(--danger))/0.07] px-3 py-2 text-[12.25px] text-destructive">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span className="line-clamp-2">{job.lastRun.error}</span>
          </div>
        )}

        <div className="mt-1 flex justify-end gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleTrigger}
            disabled={triggering}
            className="h-7 w-7 rounded-full p-0 text-foreground/66 transition-colors hover:bg-accent/60 hover:text-foreground"
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
            className="h-7 w-7 rounded-full p-0 text-destructive/66 transition-colors hover:bg-destructive/10 hover:text-destructive"
            title={t('common:actions.delete', 'Delete')}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

export function Cron() {
  const { t } = useTranslation('cron');
  const { jobs, loading, error, fetchJobs, createJob, updateJob, toggleJob, deleteJob, triggerJob } = useCronStore();
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

  // Statistics
  const safeJobs = Array.isArray(jobs) ? jobs : [];
  const activeJobs = safeJobs.filter((j) => j.enabled);
  const pausedJobs = safeJobs.filter((j) => !j.enabled);
  const failedJobs = safeJobs.filter((j) => j.lastRun && !j.lastRun.success);

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
      <WorkspacePageShell>
        {/* Header */}
        <div className="mb-5 flex shrink-0 flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1.5">
            <h1 className="text-[28px] md:text-[31px] text-foreground font-semibold tracking-tight">
              {t('title')}
            </h1>
            <p className="max-w-2xl text-[13px] md:text-[14px] leading-[1.55] text-foreground/62 font-medium">
              {t('subtitle')}
            </p>
          </div>
          <div className="flex items-center gap-2.5">
            <Button
              variant="outline"
              onClick={fetchJobs}
              disabled={!isGatewayRunning}
              className={headerButtonClasses}
            >
              <RefreshCw className="h-3.5 w-3.5 mr-2" />
              {t('refresh')}
            </Button>
            <Button
              onClick={() => {
                setEditingJob(undefined);
                setShowDialog(true);
              }}
              disabled={!isGatewayRunning}
              className="h-9 rounded-full px-4 text-[13px] font-medium shadow-none"
            >
              <Plus className="h-3.5 w-3.5 mr-2" />
              {t('newTask')}
            </Button>
          </div>
        </div>

        {/* Content Area */}
        <WorkspacePageScrollArea>
          {/* Gateway Warning */}
          {!isGatewayRunning && (
            <div className="mb-5 flex items-center gap-2.5 rounded-[14px] border border-amber-500/15 bg-amber-500/6 px-3.5 py-2.5 app-insight-surface">
              <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              <span className="text-sm font-medium text-amber-900 dark:text-amber-100">
                {t('gatewayWarning')}
              </span>
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className="mb-5 flex items-center gap-2.5 rounded-[14px] border border-destructive/16 bg-[hsl(var(--danger))/0.06] px-3.5 py-2.5 app-insight-surface">
              <AlertCircle className="h-5 w-5 text-destructive" />
              <span className="text-sm font-medium text-destructive">
                {error}
              </span>
            </div>
          )}

          {/* Statistics */}
          <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-[13px] app-insight-surface px-3.5 py-2 text-[11.5px] font-medium text-foreground/62">
            <span>{t('stats.total')}: {safeJobs.length}</span>
            <span>{t('stats.active')}: {activeJobs.length}</span>
            <span>{t('stats.paused')}: {pausedJobs.length}</span>
            <span>{t('stats.failed')}: {failedJobs.length}</span>
          </div>

          {/* Jobs List */}
          {safeJobs.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-[14px] border border-dashed border-border/60 py-18 text-muted-foreground app-empty-surface">
              <Clock className="mb-4 h-9 w-9 opacity-45" />
              <h3 className="mb-2 text-[18px] font-medium text-foreground">{t('empty.title')}</h3>
              <p className="mb-6 max-w-md text-center text-[13px]">
                {t('empty.description')}
              </p>
              <Button
                onClick={() => {
                  setEditingJob(undefined);
                  setShowDialog(true);
                }}
                disabled={!isGatewayRunning}
                className="h-9 rounded-full px-5"
              >
                <Plus className="h-4 w-4 mr-2" />
                {t('empty.create')}
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {safeJobs.map((job) => (
                <CronJobCard
                  key={job.id}
                  job={job}
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

      {/* Create/Edit Dialog */}
      {showDialog && (
        <TaskDialog
          job={editingJob}
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
