/**
 * Skills Page
 * Browse and manage AI skills
 */
import { useEffect, useState, useCallback } from 'react';
import {
  Search,
  Puzzle,
  Lock,
  Package,
  X,
  AlertCircle,
  Plus,
  Key,
  Trash2,
  RefreshCw,
  FolderOpen,
  FileCode,
  Globe,
  Copy,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { useSkillsStore } from '@/stores/skills';
import { useGatewayStore } from '@/stores/gateway';
import { WorkspacePageFrame, WorkspacePageLoading, WorkspacePageScrollArea, WorkspacePageShell } from '@/components/layout/WorkspacePage';
import { cn } from '@/lib/utils';
import { invokeIpc } from '@/lib/api-client';
import { hostApiFetch } from '@/lib/host-api';
import { trackUiEvent } from '@/lib/telemetry';
import { toast } from 'sonner';
import type { Skill } from '@/types/skill';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';




// Skill detail dialog component
interface SkillDetailDialogProps {
  skill: Skill | null;
  isOpen: boolean;
  onClose: () => void;
  onToggle: (enabled: boolean) => void;
  onUninstall?: (slug: string) => void;
  onOpenFolder?: (skill: Skill) => Promise<void> | void;
}

function resolveSkillSourceLabel(skill: Skill, t: TFunction<'skills'>): string {
  const source = (skill.source || '').trim().toLowerCase();
  if (!source) {
    if (skill.isBundled) return t('source.badge.bundled', { defaultValue: 'Bundled' });
    return t('source.badge.unknown', { defaultValue: 'Unknown source' });
  }
  if (source === 'openclaw-bundled') return t('source.badge.bundled', { defaultValue: 'Bundled' });
  if (source === 'openclaw-managed') return t('source.badge.managed', { defaultValue: 'Managed' });
  if (source === 'openclaw-workspace') return t('source.badge.workspace', { defaultValue: 'Workspace' });
  if (source === 'openclaw-extra') return t('source.badge.extra', { defaultValue: 'Extra dirs' });
  if (source === 'agents-skills-personal') return t('source.badge.agentsPersonal', { defaultValue: 'Personal .agents' });
  if (source === 'agents-skills-project') return t('source.badge.agentsProject', { defaultValue: 'Project .agents' });
  return source;
}

const headerButtonClasses =
  'h-8 rounded-[12px] px-3.5 text-[12.5px] font-medium shadow-none border-border/70 bg-transparent text-foreground/78 transition-colors hover:bg-[hsl(var(--surface-hover)/0.46)] hover:text-foreground';
const compactOutlineButtonClasses =
  'h-8 rounded-[12px] border border-border/70 bg-transparent px-3 text-[12px] font-medium text-foreground/78 shadow-none transition-colors hover:bg-[hsl(var(--surface-hover)/0.46)] hover:text-foreground';
const iconButtonClasses =
  'h-8 w-8 rounded-[12px] border border-border/70 bg-transparent shadow-none text-muted-foreground transition-colors hover:bg-[hsl(var(--surface-hover)/0.46)] hover:text-foreground';
const tokenInputClasses =
  'h-[44px] rounded-xl font-mono text-[13px] app-field-surface text-foreground placeholder:text-foreground/40 shadow-none transition-all focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30';
const compactInputClasses =
  'h-[38px] rounded-xl font-mono text-[12px] app-field-surface text-foreground/80 shadow-none transition-all focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30';
const sheetSurfaceClasses =
  'flex w-full flex-col border-l border-border/70 bg-[hsl(var(--surface-elevated)/0.995)] p-0 shadow-none';
const badgeClasses =
  'rounded-[10px] border border-border/70 bg-background/65 px-2.5 py-0.5 text-[10.5px] font-medium text-foreground/65 shadow-none transition-colors';
const listRowClasses =
  'group flex cursor-pointer flex-row items-center justify-between rounded-[12px] border border-transparent px-2.5 py-2 transition-colors hover:border-border/50 hover:bg-[hsl(var(--surface-hover)/0.42)]';
const listIconClasses =
  'flex h-5 w-5 shrink-0 items-center justify-center overflow-hidden rounded-[7px] border border-border/55 bg-[hsl(var(--surface-panel)/0.84)] text-[11px] text-foreground/58';
const searchFieldClasses =
  'relative flex items-center rounded-[14px] border border-border/60 bg-[hsl(var(--surface-panel)/0.84)] px-3 py-2 transition-colors hover:bg-[hsl(var(--surface-hover)/0.46)] focus-within:border-border/55 focus-within:bg-[hsl(var(--surface-panel)/0.96)]';
const filterButtonBaseClasses = 'flex items-center gap-1.5 rounded-[11px] px-2.5 py-1 text-[12px] font-medium transition-colors';

function SkillDetailDialog({ skill, isOpen, onClose, onToggle, onUninstall, onOpenFolder }: SkillDetailDialogProps) {
  const { t } = useTranslation('skills');
  const { fetchSkills } = useSkillsStore();
  const [envVars, setEnvVars] = useState<Array<{ key: string; value: string }>>([]);
  const [apiKey, setApiKey] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Initialize config from skill
  useEffect(() => {
    if (!skill) return;

    // API Key
    if (skill.config?.apiKey) {
      setApiKey(String(skill.config.apiKey));
    } else {
      setApiKey('');
    }

    // Env Vars
    if (skill.config?.env) {
      const vars = Object.entries(skill.config.env).map(([key, value]) => ({
        key,
        value: String(value),
      }));
      setEnvVars(vars);
    } else {
      setEnvVars([]);
    }
  }, [skill]);

  const handleOpenClawhub = async () => {
    if (!skill?.slug) return;
    await invokeIpc('shell:openExternal', `https://clawhub.ai/s/${skill.slug}`);
  };

  const handleOpenEditor = async () => {
    if (!skill?.id) return;
    try {
      const result = await hostApiFetch<{ success: boolean; error?: string }>('/api/clawhub/open-readme', {
        method: 'POST',
        body: JSON.stringify({ skillKey: skill.id, slug: skill.slug, baseDir: skill.baseDir }),
      });
      if (result.success) {
        toast.success(t('toast.openedEditor'));
      } else {
        toast.error(result.error || t('toast.failedEditor'));
      }
    } catch (err) {
      toast.error(t('toast.failedEditor') + ': ' + String(err));
    }
  };

  const handleCopyPath = async () => {
    if (!skill?.baseDir) return;
    try {
      await navigator.clipboard.writeText(skill.baseDir);
      toast.success(t('toast.copiedPath'));
    } catch (err) {
      toast.error(t('toast.failedCopyPath') + ': ' + String(err));
    }
  };

  const handleAddEnv = () => {
    setEnvVars([...envVars, { key: '', value: '' }]);
  };

  const handleUpdateEnv = (index: number, field: 'key' | 'value', value: string) => {
    const newVars = [...envVars];
    newVars[index] = { ...newVars[index], [field]: value };
    setEnvVars(newVars);
  };

  const handleRemoveEnv = (index: number) => {
    const newVars = [...envVars];
    newVars.splice(index, 1);
    setEnvVars(newVars);
  };

  const handleSaveConfig = async () => {
    if (isSaving || !skill) return;
    setIsSaving(true);
    try {
      // Build env object, filtering out empty keys
      const envObj = envVars.reduce((acc, curr) => {
        const key = curr.key.trim();
        const value = curr.value.trim();
        if (key) {
          acc[key] = value;
        }
        return acc;
      }, {} as Record<string, string>);

      // Use direct file access instead of Gateway RPC for reliability
      const result = await invokeIpc<{ success: boolean; error?: string }>(
        'skill:updateConfig',
        {
          skillKey: skill.id,
          apiKey: apiKey || '', // Empty string will delete the key
          env: envObj // Empty object will clear all env vars
        }
      ) as { success: boolean; error?: string };

      if (!result.success) {
        throw new Error(result.error || 'Unknown error');
      }

      // Refresh skills from gateway to get updated config
      await fetchSkills();

      toast.success(t('detail.configSaved'));
    } catch (err) {
      toast.error(t('toast.failedSave') + ': ' + String(err));
    } finally {
      setIsSaving(false);
    }
  };

  if (!skill) return null;

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        className={cn(sheetSurfaceClasses, 'sm:max-w-[450px]')}
        side="right"
      >
        <div className="flex h-full min-h-0 flex-col">
          <div className="shrink-0 border-b border-border/70 px-6 py-5">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="mb-3 flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] border border-border/70 bg-[hsl(var(--surface-panel)/0.92)] text-[22px] shadow-none">
                  {skill.icon || '🔧'}
                </div>
                <h2 className="truncate text-[20px] font-semibold tracking-tight text-foreground">
                  {skill.name}
                </h2>
                {skill.description && (
                  <p className="mt-2 max-w-[30rem] text-[13px] font-medium leading-[1.55] text-foreground/66">
                    {skill.description}
                  </p>
                )}
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className={iconButtonClasses}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className={badgeClasses}>
                v{skill.version}
              </Badge>
              <Badge variant="secondary" className={badgeClasses}>
                {skill.isCore ? t('detail.coreSystem') : skill.isBundled ? t('detail.bundled') : t('detail.userInstalled')}
              </Badge>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-6">
            <div className="space-y-6">
              <div className="space-y-2">
                <h3 className="text-[12px] font-semibold tracking-wide text-foreground/62">{t('detail.source')}</h3>
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="secondary" className={badgeClasses}>
                    {resolveSkillSourceLabel(skill, t)}
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    value={skill.baseDir || t('detail.pathUnavailable')}
                    readOnly
                    className={compactInputClasses}
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    className={iconButtonClasses}
                    disabled={!skill.baseDir}
                    onClick={handleCopyPath}
                    title={t('detail.copyPath')}
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className={iconButtonClasses}
                    disabled={!skill.baseDir}
                    onClick={() => onOpenFolder?.(skill)}
                    title={t('detail.openActualFolder')}
                  >
                    <FolderOpen className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

              {!skill.isCore && (
                <div className="space-y-2">
                  <h3 className="flex items-center gap-2 text-[12px] font-semibold tracking-wide text-foreground/62">
                    <Key className="h-3.5 w-3.5 text-primary/80" />
                    {t('detail.apiKey')}
                  </h3>
                  <Input
                    placeholder={t('detail.apiKeyPlaceholder', 'Enter API Key (optional)')}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    type="password"
                    className={tokenInputClasses}
                  />
                  <p className="mt-1 text-[12px] font-medium text-foreground/50">
                    {t('detail.apiKeyDesc', 'The primary API key for this skill. Leave blank if not required or configured elsewhere.')}
                  </p>
                </div>
              )}

              {!skill.isCore && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-2">
                      <h3 className="text-[12px] font-semibold tracking-wide text-foreground/62">
                        {t('detail.envVars')}
                        {envVars.length > 0 && (
                          <Badge variant="secondary" className={cn('ml-2 px-1.5 py-0 text-[10px] h-5', badgeClasses)}>
                            {envVars.length}
                          </Badge>
                        )}
                      </h3>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 gap-1.5 rounded-[12px] px-2.5 text-[12px] font-semibold text-foreground/78 hover:bg-[hsl(var(--surface-hover)/0.46)] hover:text-foreground"
                      onClick={handleAddEnv}
                    >
                      <Plus className="h-3 w-3" strokeWidth={3} />
                      {t('detail.addVariable', 'Add Variable')}
                    </Button>
                  </div>

                  <div className="space-y-2">
                    {envVars.length === 0 && (
                      <div className="flex items-center rounded-[12px] border border-border/70 app-field-surface px-3.5 py-2.5 text-[12.5px] font-medium italic text-foreground/50 shadow-none">
                        {t('detail.noEnvVars', 'No environment variables configured.')}
                      </div>
                    )}

                    {envVars.map((env, index) => (
                      <div className="flex items-center gap-3" key={index}>
                        <Input
                          value={env.key}
                          onChange={(e) => handleUpdateEnv(index, 'key', e.target.value)}
                          className={cn('flex-1 h-[38px]', tokenInputClasses)}
                          placeholder={t('detail.keyPlaceholder', 'Key')}
                        />
                        <Input
                          value={env.value}
                          onChange={(e) => handleUpdateEnv(index, 'value', e.target.value)}
                          className={cn('flex-1 h-[38px]', tokenInputClasses)}
                          placeholder={t('detail.valuePlaceholder', 'Value')}
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 shrink-0 rounded-xl text-destructive/70 transition-colors hover:bg-destructive/10 hover:text-destructive"
                          onClick={() => handleRemoveEnv(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {skill.slug && !skill.isBundled && !skill.isCore && (
                <div className="flex justify-center gap-2 pt-2">
                  <Button variant="outline" size="sm" className={cn('h-[28px] px-3 gap-1.5 text-[11px]', compactOutlineButtonClasses)} onClick={handleOpenClawhub}>
                    <Globe className="h-[12px] w-[12px]" />
                    ClawHub
                  </Button>
                  <Button variant="outline" size="sm" className={cn('h-[28px] px-3 gap-1.5 text-[11px]', compactOutlineButtonClasses)} onClick={handleOpenEditor}>
                    <FileCode className="h-[12px] w-[12px]" />
                    {t('detail.openManual')}
                  </Button>
                </div>
              )}
            </div>
          </div>

          <div className="shrink-0 border-t border-border/70 px-6 py-4">
            <div className="flex items-center justify-end gap-3">
              {!skill.isCore && (
                <Button
                  onClick={handleSaveConfig}
                  className={cn(
                    'h-[40px] rounded-[12px] border border-transparent px-5 text-[13px] font-semibold shadow-none transition-all',
                    'bg-primary text-primary-foreground hover:bg-primary/90'
                  )}
                  disabled={isSaving}
                >
                  {isSaving ? t('detail.saving') : t('detail.saveConfig')}
                </Button>
              )}

              {!skill.isCore && (
              <Button
                variant="outline"
                className="h-[40px] rounded-[12px] border-border/70 bg-transparent px-5 text-[13px] font-semibold text-foreground/80 shadow-none transition-colors hover:bg-[hsl(var(--surface-hover)/0.46)] hover:text-foreground"
                onClick={() => {
                  if (!skill.isBundled && onUninstall && skill.slug) {
                      onUninstall(skill.slug);
                      onClose();
                    } else {
                      onToggle(!skill.enabled);
                    }
                  }}
                >
                  {!skill.isBundled && onUninstall
                    ? t('detail.uninstall')
                    : (skill.enabled ? t('detail.disable') : t('detail.enable'))}
                </Button>
              )}
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function Skills() {
  const {
    skills,
    loading,
    error,
    fetchSkills,
    enableSkill,
    disableSkill,
    searchResults,
    searchSkills,
    installSkill,
    uninstallSkill,
    searching,
    searchError,
    installing
  } = useSkillsStore();
  const { t } = useTranslation('skills');
  const gatewayStatus = useGatewayStore((state) => state.status);
  const [searchQuery, setSearchQuery] = useState('');
  const [installQuery, setInstallQuery] = useState('');
  const [installSheetOpen, setInstallSheetOpen] = useState(false);
  const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null);
  const [selectedSource, setSelectedSource] = useState<'all' | 'built-in' | 'marketplace'>('all');

  const isGatewayRunning = gatewayStatus.state === 'running';
  const [showGatewayWarning, setShowGatewayWarning] = useState(false);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (!isGatewayRunning) {
      timer = setTimeout(() => {
        setShowGatewayWarning(true);
      }, 1500);
    } else {
      timer = setTimeout(() => {
        setShowGatewayWarning(false);
      }, 0);
    }
    return () => clearTimeout(timer);
  }, [isGatewayRunning]);

  useEffect(() => {
    if (isGatewayRunning) {
      fetchSkills();
    }
  }, [fetchSkills, isGatewayRunning]);

  const safeSkills = Array.isArray(skills) ? skills : [];
  const filteredSkills = safeSkills.filter((skill) => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      q.length === 0 ||
      skill.name.toLowerCase().includes(q) ||
      skill.description.toLowerCase().includes(q) ||
      skill.id.toLowerCase().includes(q) ||
      (skill.slug || '').toLowerCase().includes(q) ||
      (skill.author || '').toLowerCase().includes(q);

    let matchesSource = true;
    if (selectedSource === 'built-in') {
      matchesSource = !!skill.isBundled;
    } else if (selectedSource === 'marketplace') {
      matchesSource = !skill.isBundled;
    }

    return matchesSearch && matchesSource;
  }).sort((a, b) => {
    if (a.enabled && !b.enabled) return -1;
    if (!a.enabled && b.enabled) return 1;
    if (a.isCore && !b.isCore) return -1;
    if (!a.isCore && b.isCore) return 1;
    return a.name.localeCompare(b.name);
  });

  const sourceStats = {
    all: safeSkills.length,
    builtIn: safeSkills.filter(s => s.isBundled).length,
    marketplace: safeSkills.filter(s => !s.isBundled).length,
  };

  const bulkToggleVisible = useCallback(async (enable: boolean) => {
    const candidates = filteredSkills.filter((skill) => !skill.isCore && skill.enabled !== enable);
    if (candidates.length === 0) {
      toast.info(enable ? t('toast.noBatchEnableTargets') : t('toast.noBatchDisableTargets'));
      return;
    }

    let succeeded = 0;
    for (const skill of candidates) {
      try {
        if (enable) {
          await enableSkill(skill.id);
        } else {
          await disableSkill(skill.id);
        }
        succeeded += 1;
      } catch {
        // Continue to next skill and report final summary.
      }
    }

    trackUiEvent('skills.batch_toggle', { enable, total: candidates.length, succeeded });
    if (succeeded === candidates.length) {
      toast.success(enable ? t('toast.batchEnabled', { count: succeeded }) : t('toast.batchDisabled', { count: succeeded }));
      return;
    }
    toast.warning(t('toast.batchPartial', { success: succeeded, total: candidates.length }));
  }, [disableSkill, enableSkill, filteredSkills, t]);

  const handleToggle = useCallback(async (skillId: string, enable: boolean) => {
    try {
      if (enable) {
        await enableSkill(skillId);
        toast.success(t('toast.enabled'));
      } else {
        await disableSkill(skillId);
        toast.success(t('toast.disabled'));
      }
    } catch (err) {
      toast.error(String(err));
    }
  }, [enableSkill, disableSkill, t]);

  const hasInstalledSkills = safeSkills.some(s => !s.isBundled);

  const handleOpenSkillsFolder = useCallback(async () => {
    try {
      const skillsDir = await invokeIpc<string>('openclaw:getSkillsDir');
      if (!skillsDir) {
        throw new Error('Skills directory not available');
      }
      const result = await invokeIpc<string>('shell:openPath', skillsDir);
      if (result) {
        if (result.toLowerCase().includes('no such file') || result.toLowerCase().includes('not found') || result.toLowerCase().includes('failed to open')) {
          toast.error(t('toast.failedFolderNotFound'));
        } else {
          throw new Error(result);
        }
      }
    } catch (err) {
      toast.error(t('toast.failedOpenFolder') + ': ' + String(err));
    }
  }, [t]);

  const handleOpenSkillFolder = useCallback(async (skill: Skill) => {
    try {
      const result = await hostApiFetch<{ success: boolean; error?: string }>('/api/clawhub/open-path', {
        method: 'POST',
        body: JSON.stringify({
          skillKey: skill.id,
          slug: skill.slug,
          baseDir: skill.baseDir,
        }),
      });
      if (!result.success) {
        throw new Error(result.error || 'Failed to open folder');
      }
    } catch (err) {
      toast.error(t('toast.failedOpenActualFolder') + ': ' + String(err));
    }
  }, [t]);

  const [skillsDirPath, setSkillsDirPath] = useState('~/.openclaw/skills');

  useEffect(() => {
    invokeIpc<string>('openclaw:getSkillsDir')
      .then((dir) => setSkillsDirPath(dir as string))
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (!installSheetOpen) {
      return;
    }

    const query = installQuery.trim();
    if (query.length === 0) {
      searchSkills('');
      return;
    }

    const timer = setTimeout(() => {
      searchSkills(query);
    }, 300);
    return () => clearTimeout(timer);
  }, [installQuery, installSheetOpen, searchSkills]);

  const handleInstall = useCallback(async (slug: string) => {
    try {
      await installSkill(slug);
      await enableSkill(slug);
      toast.success(t('toast.installed'));
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      if (['installTimeoutError', 'installRateLimitError'].includes(errorMessage)) {
        toast.error(t(`toast.${errorMessage}`, { path: skillsDirPath }), { duration: 10000 });
      } else {
        toast.error(t('toast.failedInstall') + ': ' + errorMessage);
      }
    }
  }, [installSkill, enableSkill, t, skillsDirPath]);

  const handleUninstall = useCallback(async (slug: string) => {
    try {
      await uninstallSkill(slug);
      toast.success(t('toast.uninstalled'));
    } catch (err) {
      toast.error(t('toast.failedUninstall') + ': ' + String(err));
    }
  }, [uninstallSkill, t]);

  if (loading) {
    return <WorkspacePageLoading />;
  }

  return (
    <WorkspacePageFrame>
      <WorkspacePageShell>

        {/* Header */}
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-6 shrink-0">
          <div className="space-y-1.5">
            <h1 className="text-[28px] md:text-[31px] text-foreground font-semibold tracking-tight">
              {t('title')}
            </h1>
            <p className="max-w-2xl text-[13px] md:text-[14px] leading-[1.55] text-foreground/62 font-medium">
              {t('subtitle')}
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            {hasInstalledSkills && (
              <button
                onClick={handleOpenSkillsFolder}
                className={headerButtonClasses}
              >
                <FolderOpen className="h-4 w-4 mr-2" />
                {t('openFolder')}
              </button>
            )}
          </div>
        </div>

        <WorkspacePageScrollArea>
          {showGatewayWarning && (
            <div className="mb-5 flex items-center gap-2.5 rounded-[14px] border border-amber-500/15 bg-amber-500/6 px-3.5 py-2.5 app-insight-surface">
              <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              <span className="text-sm font-medium text-amber-900 dark:text-amber-100">
                {t('gatewayWarning')}
              </span>
            </div>
          )}

          <div className="mb-4 flex flex-col justify-between gap-3 rounded-[14px] app-insight-surface px-3.5 py-2.5 md:flex-row md:items-center">
            <div className="flex items-center flex-wrap gap-3 text-[14px]">
              <div className={cn(searchFieldClasses, 'mr-1')}>
                <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
                <input
                  placeholder={t('search')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="ml-2 w-28 bg-transparent text-[12.5px] font-normal text-foreground outline-none placeholder:text-foreground/44 md:w-36"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="text-foreground/50 hover:text-foreground shrink-0 ml-1"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setSelectedSource('all')}
                  className={cn(filterButtonBaseClasses, selectedSource === 'all' ? 'bg-[hsl(var(--surface-panel)/0.92)] text-foreground' : 'text-muted-foreground hover:bg-[hsl(var(--surface-hover)/0.48)] hover:text-foreground')}
                >
                  {t('filter.all', { count: sourceStats.all })}
                </button>
                <button
                  onClick={() => setSelectedSource('built-in')}
                  className={cn(filterButtonBaseClasses, selectedSource === 'built-in' ? 'bg-[hsl(var(--surface-panel)/0.92)] text-foreground' : 'text-muted-foreground hover:bg-[hsl(var(--surface-hover)/0.48)] hover:text-foreground')}
                >
                  {t('filter.builtIn', { count: sourceStats.builtIn })}
                </button>
                <button
                  onClick={() => setSelectedSource('marketplace')}
                  className={cn(filterButtonBaseClasses, selectedSource === 'marketplace' ? 'bg-[hsl(var(--surface-panel)/0.92)] text-foreground' : 'text-muted-foreground hover:bg-[hsl(var(--surface-hover)/0.48)] hover:text-foreground')}
                >
                  {t('filter.marketplace', { count: sourceStats.marketplace })}
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => bulkToggleVisible(true)}
                className={compactOutlineButtonClasses}
              >
                {t('actions.enableVisible')}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => bulkToggleVisible(false)}
                className={compactOutlineButtonClasses}
              >
                {t('actions.disableVisible')}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setInstallQuery('');
                  setInstallSheetOpen(true);
                }}
                className={compactOutlineButtonClasses}
              >
                {t('actions.installSkill')}
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={fetchSkills}
                disabled={!isGatewayRunning}
                className={cn(iconButtonClasses, 'ml-1')}
                title={t('refresh')}
              >
                <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
              </Button>
            </div>
          </div>

          {error && (
            <div className="mb-4 flex items-center gap-2 rounded-[14px] border border-destructive/16 bg-[hsl(var(--danger))/0.06] px-3.5 py-2.5 text-sm font-medium text-destructive">
              <AlertCircle className="h-5 w-5 shrink-0" />
              <span>
                {['fetchTimeoutError', 'fetchRateLimitError', 'timeoutError', 'rateLimitError'].includes(error)
                  ? t(`toast.${error}`, { path: skillsDirPath })
                  : error}
              </span>
            </div>
          )}

          <div className="flex flex-col gap-0.5">
            {filteredSkills.length === 0 ? (
              <div className="app-empty-surface flex flex-col items-center justify-center rounded-[20px] py-20 text-muted-foreground">
                <Puzzle className="h-10 w-10 mb-4 opacity-50" />
                <p>{searchQuery ? t('noSkillsSearch') : t('noSkillsAvailable')}</p>
              </div>
            ) : (
              filteredSkills.map((skill) => (
                <div
                  key={skill.id}
                  className={listRowClasses}
                  onClick={() => setSelectedSkill(skill)}
                >
                  <div className="flex items-center gap-3 flex-1 overflow-hidden pr-4">
                    <div className={listIconClasses}>
                      {skill.icon || '🧩'}
                    </div>
                    <div className="flex flex-col overflow-hidden">
                      <div className="flex items-center gap-2">
                        <h3 className="text-[14px] font-semibold text-foreground truncate">{skill.name}</h3>
                        {skill.isCore ? (
                          <Lock className="h-3 w-3 text-muted-foreground" />
                        ) : skill.isBundled ? (
                          <Puzzle className="h-3 w-3 text-primary/70" />
                        ) : null}
                      </div>
                      <p className="mt-0.5 text-[12.5px] text-muted-foreground line-clamp-1 pr-6 leading-[1.45]">
                        {skill.description}
                      </p>
                      <div className="mt-1 flex items-center gap-2 text-[11px] text-foreground/52">
                        <span className="truncate">{resolveSkillSourceLabel(skill, t)}</span>
                        {skill.slug && skill.slug !== skill.name ? (
                          <>
                            <span>·</span>
                            <span className="truncate">{skill.slug}</span>
                          </>
                        ) : null}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 shrink-0" onClick={e => e.stopPropagation()}>
                    {skill.version && (
                    <span className="text-[11px] text-muted-foreground">
                      v{skill.version}
                    </span>
                    )}
                    <Switch
                      checked={skill.enabled}
                      onCheckedChange={(checked) => handleToggle(skill.id, checked)}
                      disabled={skill.isCore}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </WorkspacePageScrollArea>
      </WorkspacePageShell>

      <Sheet open={installSheetOpen} onOpenChange={setInstallSheetOpen}>
        <SheetContent
          className={cn(sheetSurfaceClasses, 'sm:max-w-[560px]')}
          side="right"
        >
          <div className="px-6 py-5 border-b border-border/70">
            <h2 className="text-[20px] text-foreground font-semibold tracking-tight">{t('marketplace.installDialogTitle')}</h2>
            <p className="mt-1 text-[13px] text-foreground/70">{t('marketplace.installDialogSubtitle')}</p>
            <div className="mt-4 flex flex-col md:flex-row gap-2">
                <div className={searchFieldClasses}>
                <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
                <input
                  placeholder={t('searchMarketplace')}
                  value={installQuery}
                  onChange={(e) => setInstallQuery(e.target.value)}
                  className="ml-2 flex-1 bg-transparent p-0 text-[13px] text-foreground outline-none placeholder:text-foreground/46"
                />
                {installQuery && (
                  <button
                    type="button"
                    onClick={() => setInstallQuery('')}
                    className="shrink-0 ml-1 rounded-[8px] px-1.5 py-1 text-foreground/50 transition-colors hover:bg-[hsl(var(--surface-hover)/0.48)] hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              <Button
                variant="outline"
                disabled
                  className="h-9 rounded-[12px] border-border/70 bg-transparent px-3.5 text-[12px] text-muted-foreground"
              >
                {t('marketplace.sourceLabel')}: {t('marketplace.sourceClawHub')}
              </Button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-4">
            {searchError && (
              <div className="mb-4 flex items-center gap-2 rounded-[14px] border border-destructive/16 bg-[hsl(var(--danger))/0.06] px-3.5 py-2.5 text-sm font-medium text-destructive">
                <AlertCircle className="h-5 w-5 shrink-0" />
                <span>
                  {['searchTimeoutError', 'searchRateLimitError', 'timeoutError', 'rateLimitError'].includes(searchError.replace('Error: ', ''))
                    ? t(`toast.${searchError.replace('Error: ', '')}`, { path: skillsDirPath })
                    : t('marketplace.searchError')}
                </span>
              </div>
            )}

            {searching && (
              <div className="app-empty-surface flex flex-col items-center justify-center rounded-[20px] py-20 text-muted-foreground">
                <LoadingSpinner size="lg" />
                <p className="mt-4 text-sm">{t('marketplace.searching')}</p>
              </div>
            )}

            {!searching && searchResults.length > 0 && (
              <div className="flex flex-col gap-1">
                {searchResults.map((skill) => {
                  const isInstalled = safeSkills.some(s => s.id === skill.slug || s.name === skill.name);
                  const isInstallLoading = !!installing[skill.slug];

                  return (
                    <div
                      key={skill.slug}
                      className={listRowClasses}
                      onClick={() => invokeIpc('shell:openExternal', `https://clawhub.ai/s/${skill.slug}`)}
                    >
                      <div className="flex items-start gap-4 flex-1 overflow-hidden pr-4">
                        <div className={listIconClasses}>
                          📦
                        </div>
                        <div className="flex flex-col overflow-hidden">
                          <div className="mb-0.5 flex items-center gap-2">
                            <h3 className="text-[15px] font-semibold text-foreground truncate">{skill.name}</h3>
                            {skill.author && (
                              <span className="text-[11px] text-muted-foreground">• {skill.author}</span>
                            )}
                          </div>
                          <p className="text-[12.5px] text-muted-foreground line-clamp-1 pr-6 leading-[1.45]">
                            {skill.description}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 shrink-0" onClick={e => e.stopPropagation()}>
                        {skill.version && (
                          <span className="mr-2 text-[11px] text-muted-foreground">
                            v{skill.version}
                          </span>
                        )}
                        {isInstalled ? (
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleUninstall(skill.slug)}
                            disabled={isInstallLoading}
                            className="h-8 rounded-[12px] shadow-none"
                          >
                            {isInstallLoading ? <LoadingSpinner size="sm" /> : <Trash2 className="h-3.5 w-3.5" />}
                          </Button>
                        ) : (
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => handleInstall(skill.slug)}
                            disabled={isInstallLoading}
                            className="h-8 rounded-[12px] px-4 text-xs font-medium shadow-none"
                          >
                            {isInstallLoading ? <LoadingSpinner size="sm" /> : t('marketplace.install', 'Install')}
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {!searching && searchResults.length === 0 && !searchError && (
              <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                <Package className="h-10 w-10 mb-4 opacity-50" />
                <p>{installQuery.trim() ? t('marketplace.noResults') : t('marketplace.emptyPrompt')}</p>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Skill Detail Dialog */}
      <SkillDetailDialog
        skill={selectedSkill}
        isOpen={!!selectedSkill}
        onClose={() => setSelectedSkill(null)}
        onToggle={(enabled) => {
          if (!selectedSkill) return;
          handleToggle(selectedSkill.id, enabled);
          setSelectedSkill({ ...selectedSkill, enabled });
        }}
        onUninstall={handleUninstall}
        onOpenFolder={handleOpenSkillFolder}
      />
    </WorkspacePageFrame>
  );
}

export default Skills;
