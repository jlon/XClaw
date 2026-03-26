import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  ChevronRight,
  Copy,
  FileCode,
  FolderOpen,
  Github,
  Globe,
  Key,
  Lock,
  Loader2,
  MoreHorizontal,
  Plus,
  Puzzle,
  Trash2,
  X,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { useSkillsStore } from '@/stores/skills';
import { useGatewayStore } from '@/stores/gateway';
import { WorkbenchHeader } from '@/components/layout/WorkbenchHeader';
import { WorkbenchHeaderTitleBlock } from '@/components/layout/WorkbenchHeaderTitleBlock';
import { WorkspacePageFrame, WorkspacePageLoading, WorkspacePageScrollArea, WorkspacePageShell } from '@/components/layout/WorkspacePage';
import {
  workbenchPrimaryToolbarButtonClasses,
  workbenchToolbarIconButtonClasses,
} from '@/components/layout/workbench-button-styles';
import { cn } from '@/lib/utils';
import { invokeIpc } from '@/lib/api-client';
import { hostApiFetch } from '@/lib/host-api';
import { toast } from 'sonner';
import type { Skill, SkillCatalogItem, SkillProviderId } from '@/types/skill';
import {
  buildGitHubImportSkillChatDraft,
  buildProviderInstallSkillChatDraft,
} from './skills-chat-drafts';
import { resolveLocalizedSkillDescription } from './skill-copy';

const SKILLS_RETURN_CONTEXT_STORAGE_KEY = 'xclaw.skills.return-context';

interface SkillDetailDialogProps {
  skill: Skill | null;
  isOpen: boolean;
  onClose: () => void;
  onToggle: (enabled: boolean) => void;
  togglePending?: boolean;
  onUninstall?: (slug: string) => void;
  onOpenFolder?: (skill: Skill) => Promise<void> | void;
}

const compactOutlineButtonClasses =
  'workbench-motion-control h-8 rounded-md border border-border/70 bg-transparent px-3 text-[12px] font-medium text-foreground/78 shadow-sm hover:bg-[hsl(var(--surface-hover)/0.46)] hover:text-foreground';
const tokenInputClasses =
  'appearance-none h-8 rounded-md font-mono text-[13px] app-field-surface text-foreground placeholder:text-foreground/40 shadow-sm transition-all focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-0';
const compactInputClasses =
  'appearance-none h-8 rounded-md font-mono text-[12px] app-field-surface text-foreground/80 shadow-sm transition-all focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-0';
const badgeClasses =
  'rounded-sm border border-border/70 bg-[hsl(var(--surface-panel)/0.9)] px-2.5 py-0.5 text-[10.5px] font-medium text-foreground/65 shadow-none transition-colors dark:bg-[hsl(var(--surface-elevated)/0.82)] select-none';
const searchFieldClasses =
  'workbench-motion-control relative flex items-center rounded-md border border-border/60 bg-[hsl(var(--surface-panel)/0.84)] px-3.5 py-2 hover:bg-[hsl(var(--surface-hover)/0.46)] focus-within:border-border/55 focus-within:bg-[hsl(var(--surface-panel)/0.96)]';
const skillCardClasses =
  'app-skills-card workbench-motion-card group relative flex min-h-[160px] flex-col rounded-lg border border-border/70 bg-[hsl(var(--surface-elevated)/0.988)] px-4 py-4 shadow-sm motion-safe:hover:-translate-y-[1px] hover:border-border/90 hover:shadow-md cursor-default';
const providerResultClasses =
  'workbench-motion-card group flex items-start gap-4 rounded-lg border border-border/70 bg-[hsl(var(--surface-elevated)/0.985)] p-4 shadow-sm hover:border-border/85 hover:shadow-md';
const DEFAULT_PROVIDER_RESULT_LIMIT = 50;
const SEARCH_PROVIDER_RESULT_LIMIT = 24;

const providerMetaMap: Record<SkillProviderId, { title: string; subtitle: string; badge: string; homepage: string }> = {
  clawhub: {
    title: '从 ClawHub 搜索',
    subtitle: '搜索公开技能目录，确认后发送到聊天继续安装。',
    badge: 'ClawHub',
    homepage: 'https://clawhub.ai/',
  },
  skillhub: {
    title: '从 SkillHub 搜索',
    subtitle: '搜索腾讯技能目录，确认草案后在聊天里继续安装。',
    badge: 'SkillHub',
    homepage: 'https://skillhub.tencent.com/',
  },
};

type SkillVisualTone = 'coral' | 'peach' | 'amber' | 'slate' | 'teal' | 'plum';

const skillVisualToneClasses: Record<SkillVisualTone, {
  shell: string;
  accent: string;
  halo: string;
}> = {
  coral: {
    shell: 'border-[hsl(var(--primary)/0.2)] bg-[hsl(var(--primary)/0.12)] text-primary',
    accent: 'text-primary',
    halo: 'bg-[hsl(var(--primary)/0.32)]',
  },
  peach: {
    shell: 'border-[hsl(var(--primary)/0.16)] bg-[hsl(var(--primary)/0.08)] text-primary/90',
    accent: 'text-primary/90',
    halo: 'bg-[hsl(var(--primary)/0.24)]',
  },
  amber: {
    shell: 'border-[hsl(var(--warning)/0.2)] bg-[hsl(var(--warning)/0.12)] text-[hsl(var(--warning))]',
    accent: 'text-[hsl(var(--warning))]',
    halo: 'bg-[hsl(var(--warning)/0.28)]',
  },
  slate: {
    shell: 'border-[hsl(var(--runtime)/0.2)] bg-[hsl(var(--runtime)/0.12)] text-[hsl(var(--runtime))]',
    accent: 'text-[hsl(var(--runtime))]',
    halo: 'bg-[hsl(var(--runtime)/0.28)]',
  },
  teal: {
    shell: 'border-[hsl(var(--success)/0.2)] bg-[hsl(var(--success)/0.12)] text-[hsl(var(--success))]',
    accent: 'text-[hsl(var(--success))]',
    halo: 'bg-[hsl(var(--success)/0.28)]',
  },
  plum: {
    shell: 'border-[hsl(var(--info)/0.2)] bg-[hsl(var(--info)/0.12)] text-[hsl(var(--info))]',
    accent: 'text-[hsl(var(--info))]',
    halo: 'bg-[hsl(var(--info)/0.28)]',
  },
};

function resolveSkillVisualTone(skill: Pick<Skill, 'provenance' | 'providerId'>): SkillVisualTone {
  switch (skill.provenance) {
    case 'xclaw-preinstalled':
      return 'coral';
    case 'openclaw-managed':
    case 'openclaw-bundled':
      return 'peach';
    case 'openclaw-workspace':
      return 'teal';
    case 'openclaw-extra':
      return 'amber';
    case 'agents-personal':
      return 'plum';
    case 'agents-project':
      return 'slate';
    default:
      return skill.providerId === 'skillhub' ? 'amber' : 'coral';
  }
}

function SkillCardGlyph({
  skillId,
  tone,
  icon,
}: {
  skillId: string;
  tone: SkillVisualTone;
  icon?: string;
}) {
  const toneClasses = skillVisualToneClasses[tone];

  return (
    <div
      data-testid={`skills-card-glyph-${skillId}`}
      className={cn(
        'relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md border shadow-sm',
        toneClasses.shell,
      )}
    >
      <span className={cn('absolute inset-x-2 bottom-1.5 h-3 rounded-full blur-md', toneClasses.halo)} />
      {icon ? (
        <span className={cn('relative flex items-center justify-center text-[20px] leading-none', toneClasses.accent)}>{icon}</span>
      ) : (
        <Puzzle className={cn('relative h-[19px] w-[19px]', toneClasses.accent)} strokeWidth={2.1} />
      )}
    </div>
  );
}

function resolveSkillSourceLabel(skill: Skill, t: TFunction<'skills'>): string {
  if (skill.displaySourceLabel?.trim()) {
    return skill.displaySourceLabel.trim();
  }
  const source = (skill.provenance || skill.source || '').trim().toLowerCase();
  if (!source) {
    if (skill.isBundled) return t('source.badge.bundled', { defaultValue: 'Bundled' });
    return t('source.badge.unknown', { defaultValue: 'Unknown source' });
  }
  if (source === 'xclaw-preinstalled') return t('source.badge.xclawPreinstalled', { defaultValue: '内置技能' });
  if (source === 'openclaw-bundled') return t('source.badge.bundled', { defaultValue: 'Bundled' });
  if (source === 'openclaw-managed') return t('source.badge.managed', { defaultValue: '已安装' });
  if (source === 'openclaw-workspace') return t('source.badge.workspace', { defaultValue: 'Workspace' });
  if (source === 'openclaw-extra') return t('source.badge.extra', { defaultValue: 'Extra dirs' });
  if (source === 'agents-skills-personal' || source === 'agents-personal') return t('source.badge.agentsPersonal', { defaultValue: 'Agent' });
  if (source === 'agents-skills-project' || source === 'agents-project') return t('source.badge.agentsProject', { defaultValue: 'Agent' });
  return source;
}

function SkillDetailDialog({ skill, isOpen, onClose, onToggle, togglePending = false, onUninstall, onOpenFolder }: SkillDetailDialogProps) {
  const { t, i18n } = useTranslation('skills');
  const { fetchSkills } = useSkillsStore();
  const [envVars, setEnvVars] = useState<Array<{ key: string; value: string }>>([]);
  const [apiKey, setApiKey] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const localizedDescription = skill ? resolveLocalizedSkillDescription(skill, t, i18n.exists.bind(i18n)) : '';

  useEffect(() => {
    if (!skill) return;
    if (skill.config?.apiKey) {
      setApiKey(String(skill.config.apiKey));
    } else {
      setApiKey('');
    }
    if (skill.config?.env) {
      setEnvVars(Object.entries(skill.config.env).map(([key, value]) => ({ key, value: String(value) })));
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

  const handleSaveConfig = async () => {
    if (isSaving || !skill) return;
    setIsSaving(true);
    try {
      const envObj = envVars.reduce((acc, curr) => {
        const key = curr.key.trim();
        const value = curr.value.trim();
        if (key) {
          acc[key] = value;
        }
        return acc;
      }, {} as Record<string, string>);

      const result = await invokeIpc<{ success: boolean; error?: string }>('skill:updateConfig', {
        skillKey: skill.id,
        apiKey: apiKey || '',
        env: envObj,
      });

      if (!result.success) {
        throw new Error(result.error || 'Unknown error');
      }

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
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[min(84vh,760px)] max-w-[720px] gap-0 overflow-hidden rounded-xl border border-border/70 bg-[hsl(var(--surface-elevated))] p-0 shadow-lg">
        <div className="flex h-full min-h-0 max-h-[min(84vh,760px)] flex-col">
          <div className="shrink-0 border-b border-border/70 px-6 py-5">
            <div className="flex items-start justify-between gap-4">
              <DialogHeader className="min-w-0 space-y-0 text-left">
                <div className="mb-3 flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-border/70 bg-[hsl(var(--surface-panel)/0.92)] text-[22px] shadow-sm">
                  {skill.icon || '🔧'}
                </div>
                <DialogTitle className="truncate text-[20px] font-semibold tracking-tight text-foreground">
                  {skill.name}
                </DialogTitle>
                {localizedDescription ? (
                  <DialogDescription className="mt-2 max-w-[34rem] text-[13px] font-medium leading-[1.55] text-foreground/66">
                    {localizedDescription}
                  </DialogDescription>
                ) : null}
              </DialogHeader>
              <Button variant="ghost" size="icon" onClick={onClose} className={workbenchToolbarIconButtonClasses}>
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
                  <Input value={skill.baseDir || t('detail.pathUnavailable')} readOnly className={compactInputClasses} />
                  <Button variant="outline" size="icon" className={workbenchToolbarIconButtonClasses} disabled={!skill.baseDir} onClick={handleCopyPath} title={t('detail.copyPath')}>
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="outline" size="icon" className={workbenchToolbarIconButtonClasses} disabled={!skill.baseDir} onClick={() => onOpenFolder?.(skill)} title={t('detail.openActualFolder')}>
                    <FolderOpen className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

              {!skill.isCore ? (
                <div className="space-y-2">
                  <h3 className="flex items-center gap-2 text-[12px] font-semibold tracking-wide text-foreground/62">
                    <Key className="h-3.5 w-3.5 text-primary/80" />
                    {t('detail.apiKey')}
                  </h3>
                  <Input
                    placeholder={t('detail.apiKeyPlaceholder', { defaultValue: '输入 API 密钥（可选）' })}
                    value={apiKey}
                    onChange={(event) => setApiKey(event.target.value)}
                    type="password"
                    className={tokenInputClasses}
                  />
                  <p className="mt-1 text-[12px] font-medium text-foreground/50">
                    {t('detail.apiKeyDesc', { defaultValue: '此技能的主要 API 密钥。如果不需要或在别处配置，请留空。' })}
                  </p>
                </div>
              ) : null}

              {!skill.isCore ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-2">
                      <h3 className="text-[12px] font-semibold tracking-wide text-foreground/62">
                        {t('detail.envVars')}
                        {envVars.length > 0 ? (
                          <Badge variant="secondary" className={cn('ml-2 h-5 px-1.5 py-0 text-[10px]', badgeClasses)}>
                            {envVars.length}
                          </Badge>
                        ) : null}
                      </h3>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 gap-1.5 rounded-md px-2.5 text-[12px] font-semibold text-foreground/78 hover:bg-[hsl(var(--surface-hover)/0.46)] hover:text-foreground"
                      onClick={() => setEnvVars((current) => [...current, { key: '', value: '' }])}
                    >
                      <Plus className="h-3 w-3" strokeWidth={3} />
                      {t('detail.addVariable', { defaultValue: '添加变量' })}
                    </Button>
                  </div>

                  <div className="space-y-2">
                    {envVars.length === 0 ? (
                      <div className="flex items-center rounded-md border border-border/70 app-field-surface px-3.5 py-2.5 text-[12.5px] font-medium italic text-foreground/50 shadow-sm">
                        {t('detail.noEnvVars', { defaultValue: '未配置环境变量。' })}
                      </div>
                    ) : null}

                    {envVars.map((env, index) => (
                      <div className="flex items-center gap-3" key={`${env.key}-${index}`}>
                        <Input
                          value={env.key}
                          onChange={(event) => setEnvVars((current) => current.map((item, currentIndex) => currentIndex === index ? { ...item, key: event.target.value } : item))}
                          className={cn('h-8 flex-1', tokenInputClasses)}
                          placeholder={t('detail.keyPlaceholder', { defaultValue: '键名' })}
                        />
                        <Input
                          value={env.value}
                          onChange={(event) => setEnvVars((current) => current.map((item, currentIndex) => currentIndex === index ? { ...item, value: event.target.value } : item))}
                          className={cn('h-8 flex-1', tokenInputClasses)}
                          placeholder={t('detail.valuePlaceholder', { defaultValue: '值' })}
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 shrink-0 rounded-md text-destructive/70 transition-colors hover:bg-destructive/10 hover:text-destructive"
                          onClick={() => setEnvVars((current) => current.filter((_, currentIndex) => currentIndex !== index))}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {skill.slug && !skill.isBundled && !skill.isCore ? (
                <div className="flex justify-center gap-2 pt-2">
                  <Button variant="outline" size="sm" className={cn('h-[28px] gap-1.5 px-3 text-[11px]', compactOutlineButtonClasses)} onClick={handleOpenClawhub}>
                    <Globe className="h-[12px] w-[12px]" />
                    ClawHub
                  </Button>
                  <Button variant="outline" size="sm" className={cn('h-[28px] gap-1.5 px-3 text-[11px]', compactOutlineButtonClasses)} onClick={handleOpenEditor}>
                    <FileCode className="h-[12px] w-[12px]" />
                    {t('detail.openManual')}
                  </Button>
                </div>
              ) : null}
            </div>
          </div>

          <div className="shrink-0 border-t border-border/70 px-6 py-4">
            <div className="flex items-center justify-end gap-3">
              {!skill.isCore ? (
                <Button
                  onClick={handleSaveConfig}
                  className="h-8 rounded-md border border-transparent bg-primary px-5 text-[13px] font-semibold text-primary-foreground shadow-sm transition-all hover:bg-primary/90"
                  disabled={isSaving}
                >
                  {isSaving ? t('detail.saving') : t('detail.saveConfig')}
                </Button>
              ) : null}

              {!skill.isCore ? (
                <Button
                  variant="outline"
                  className="h-8 rounded-md border-border/70 bg-transparent px-5 text-[13px] font-semibold text-foreground/80 shadow-sm transition-colors hover:bg-[hsl(var(--surface-hover)/0.46)] hover:text-foreground"
                  disabled={togglePending}
                  onClick={() => {
                    onToggle(!skill.enabled);
                  }}
                >
                  {togglePending
                    ? t('card.updating', { defaultValue: '更新中' })
                    : skill.enabled
                      ? t('detail.disable')
                      : t('detail.enable')}
                </Button>
              ) : null}

              {!skill.isCore && !skill.isBundled && onUninstall && skill.slug ? (
                <Button
                  variant="outline"
                  className="h-8 rounded-md border-border/70 bg-transparent px-5 text-[13px] font-semibold text-foreground/80 shadow-sm transition-colors hover:bg-[hsl(var(--surface-hover)/0.46)] hover:text-foreground"
                  disabled={togglePending}
                  onClick={() => {
                    onUninstall(skill.slug!);
                    onClose();
                  }}
                >
                  {t('detail.uninstall')}
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface SkillCardProps {
  skill: Skill;
  index: number;
  onOpen: () => void;
  onToggle: (enabled: boolean) => void;
  togglePending?: boolean;
  onRequestFocus: (index: number) => void;
  registerCard: (index: number, node: HTMLDivElement | null) => void;
  onOpenFolder: (skill: Skill) => Promise<void> | void;
  onOpenReadme: (skill: Skill) => Promise<void> | void;
  onUninstall: (slug: string) => void;
  t: TFunction<'skills'>;
}

function SkillCard({
  skill,
  index,
  onOpen,
  onToggle,
  togglePending = false,
  onRequestFocus,
  registerCard,
  onOpenFolder,
  onOpenReadme,
  onUninstall,
  t,
}: SkillCardProps) {
  const removable = !skill.isBundled && !skill.isCore && Boolean(skill.slug);
  const tone = resolveSkillVisualTone(skill);
  const description = resolveLocalizedSkillDescription(skill, t);
  const statusLabel = togglePending
    ? t('card.updating', { defaultValue: '更新中' })
    : skill.enabled
      ? t('card.enabled', { defaultValue: '已启用' })
      : t('card.disabled', { defaultValue: '已停用' });
  const statusTone = togglePending ? 'pending' : skill.enabled ? 'enabled' : 'disabled';

  return (
    <div
      ref={(node) => registerCard(index, node)}
      data-testid={`skills-card-${skill.id}`}
      data-skill-tone={tone}
      data-skill-pending={togglePending ? 'true' : 'false'}
      aria-busy={togglePending}
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onOpen();
          return;
        }
        if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
          event.preventDefault();
          onRequestFocus(index + 1);
          return;
        }
        if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
          event.preventDefault();
          onRequestFocus(index - 1);
          return;
        }
        if (event.key === 'Home') {
          event.preventDefault();
          onRequestFocus(0);
          return;
        }
        if (event.key === 'End') {
          event.preventDefault();
          onRequestFocus(Number.MAX_SAFE_INTEGER);
        }
      }}
      className={skillCardClasses}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-4">
          <SkillCardGlyph skillId={skill.id} tone={tone} icon={skill.icon} />
          <div className="min-w-0 pt-0.5">
            <div className="flex min-w-0 items-center gap-2">
              <h3 className="truncate text-[15px] font-semibold tracking-tight text-foreground">{skill.name}</h3>
              {skill.isCore ? <Lock className="h-3.5 w-3.5 shrink-0 text-foreground/34" /> : null}
            </div>
            <p className="mt-1.5 line-clamp-2 text-[13px] font-medium leading-[1.55] text-foreground/58">
              {description || t('emptyCardDescription', { defaultValue: '这个技能暂时还没有补充描述。' })}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2" onClick={(event) => event.stopPropagation()}>
          {togglePending ? <Loader2 className="h-3.5 w-3.5 animate-spin text-foreground/42" /> : null}
          <Switch
            data-testid={`skills-card-switch-${skill.id}`}
            checked={skill.enabled}
            onCheckedChange={onToggle}
            disabled={skill.isCore || togglePending}
            aria-label={skill.enabled ? t('detail.disable') : t('detail.enable')}
            className="app-skills-card-switch"
          />
        </div>
      </div>

      <div className="mt-4 border-t border-border/60" />

      <div className="mt-auto flex items-center justify-between gap-3 pt-4">
        <div className="app-skills-card-meta">
          <Badge
            data-testid={`skills-card-source-badge-${skill.id}`}
            variant="secondary"
            className="app-skills-card-source-badge"
          >
            {resolveSkillSourceLabel(skill, t)}
          </Badge>
          {skill.version ? <span className="app-skills-card-version truncate">v{skill.version}</span> : null}
          <span className={cn('app-skills-card-status-pill', `app-skills-card-status-pill--${statusTone}`)}>
            {statusLabel}
          </span>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              data-testid={`skills-card-menu-${skill.id}`}
              type="button"
              variant="ghost"
              size="icon"
              aria-label={t('actions.more', { defaultValue: '更多操作' })}
              className="app-skills-card-menu-button"
              onClick={(event) => event.stopPropagation()}
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-[188px]">
            <DropdownMenuItem onSelect={onOpen}>{t('actions.viewDetails', { defaultValue: '查看详情' })}</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onOpenFolder(skill)}>{t('actions.openFolder', { defaultValue: '打开目录' })}</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onOpenReadme(skill)}>{t('actions.openReadme', { defaultValue: '打开 README' })}</DropdownMenuItem>
            {removable ? (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onSelect={() => onUninstall(skill.slug!)}
                  className="text-destructive data-[highlighted]:bg-destructive/10 data-[highlighted]:text-destructive"
                >
                  {t('detail.uninstall')}
                </DropdownMenuItem>
              </>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

interface ProviderSearchDialogProps {
  open: boolean;
  providerId: SkillProviderId | null;
  query: string;
  results: SkillCatalogItem[];
  loading: boolean;
  error: string | null;
  onOpenChange: (open: boolean) => void;
  onQueryChange: (query: string) => void;
  onInstall: (item: SkillCatalogItem) => void;
  onOpenSource: (item: SkillCatalogItem) => void;
  t: TFunction<'skills'>;
}

function ProviderSearchDialog({
  open,
  providerId,
  query,
  results,
  loading,
  error,
  onOpenChange,
  onQueryChange,
  onInstall,
  onOpenSource,
  t,
}: ProviderSearchDialogProps) {
  const meta = providerId ? providerMetaMap[providerId] : null;
  const handleOpenProviderHomepage = useCallback(async () => {
    if (!meta?.homepage) return;
    await invokeIpc('shell:openExternal', meta.homepage);
  }, [meta]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[min(82vh,760px)] max-h-[min(82vh,760px)] max-w-[880px] flex-col gap-0 overflow-hidden rounded-xl border border-border/70 bg-[hsl(var(--surface-elevated))] p-0 shadow-lg">
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="border-b border-border/70 px-6 py-5">
            <DialogHeader className="space-y-0 text-left">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <DialogTitle className="text-[22px] font-semibold tracking-tight text-foreground">
                    {meta?.title || t('addMenu.searchClawHub', { defaultValue: '搜索技能' })}
                  </DialogTitle>
                  <DialogDescription className="mt-1.5 text-[13px] font-medium leading-[1.55] text-foreground/62">
                    {meta?.subtitle || t('providerSearch.subtitle', { defaultValue: '选择技能后，发送到聊天继续安装。' })}
                  </DialogDescription>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {meta?.homepage ? (
                    <Button
                      type="button"
                      variant="outline"
                      className="h-8 rounded-md px-3 text-[12px] font-semibold shadow-sm"
                      onClick={handleOpenProviderHomepage}
                    >
                      <Globe className="mr-1.5 h-3.5 w-3.5" />
                      {t('providerSearch.visitCatalog', { name: meta.badge, defaultValue: `访问 ${meta.badge}` })}
                    </Button>
                  ) : null}
                  {meta ? (
                    <Badge variant="secondary" className="rounded-md border border-border/60 bg-[hsl(var(--surface-panel)/0.94)] px-3 py-1 text-[11px] font-semibold text-foreground/62 shadow-none select-none">
                      {meta.badge}
                    </Badge>
                  ) : null}
                </div>
              </div>
            </DialogHeader>
            <div className="mt-4">
              <div className={searchFieldClasses}>
                <Puzzle className="h-4 w-4 shrink-0 text-muted-foreground" />
                <input
                  autoFocus
                  placeholder={t('providerSearch.placeholder', { defaultValue: '搜索技能目录' })}
                  value={query}
                  onChange={(event) => onQueryChange(event.target.value)}
                  className="ml-2.5 flex-1 bg-transparent p-0 text-[13px] font-medium text-foreground outline-none placeholder:text-foreground/42"
                />
                {query ? (
                  <button
                    type="button"
                    onClick={() => onQueryChange('')}
                    className="ml-2 shrink-0 rounded-sm px-1.5 py-1 text-foreground/42 transition-colors hover:bg-[hsl(var(--surface-hover)/0.52)] hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                ) : null}
              </div>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-5">
            {error ? (
              <div className="mb-4 flex items-center gap-2.5 rounded-lg border border-destructive/16 bg-[hsl(var(--danger))/0.06] px-4 py-3 text-[13px] font-medium text-destructive">
                <AlertCircle className="h-4.5 w-4.5 shrink-0" />
                <span>{error}</span>
              </div>
            ) : null}

            {loading ? (
              <div className="flex min-h-[280px] flex-col items-center justify-center rounded-xl border border-dashed border-border/70 bg-[hsl(var(--surface-panel)/0.64)] text-foreground/54">
                <LoadingSpinner size="lg" />
                <p className="mt-4 text-[13px] font-medium">{t('providerSearch.loading', { defaultValue: '正在搜索技能目录…' })}</p>
              </div>
            ) : null}

            {!loading && results.length === 0 ? (
              <div className="flex min-h-[280px] flex-col items-center justify-center rounded-xl border border-dashed border-border/70 bg-[hsl(var(--surface-panel)/0.64)] text-center text-foreground/54">
                <Puzzle className="h-10 w-10 opacity-45" />
                <p className="mt-4 text-[14px] font-semibold text-foreground/72">
                  {query.trim()
                    ? t('providerSearch.emptyQuery', { defaultValue: '没有找到匹配的技能' })
                    : t('providerSearch.emptyDefault', { defaultValue: '输入关键词，或者直接浏览推荐技能' })}
                </p>
                <p className="mt-1.5 max-w-[24rem] text-[12.5px] font-medium leading-[1.6] text-foreground/46">
                  {t('providerSearch.emptyHint', { defaultValue: '这里不会直接安装，只会把可靠草案送到聊天窗口继续处理。' })}
                </p>
              </div>
            ) : null}

            {!loading && results.length > 0 ? (
              <div className="grid gap-3 pb-1">
                {results.map((item) => {
                  const description = resolveLocalizedSkillDescription(item, t);
                  return (
                    <div key={item.id} className={providerResultClasses}>
                      <SkillCardGlyph skillId={item.id} tone={resolveSkillVisualTone({ providerId: item.providerId })} icon={item.icon} />
                      <div className="min-w-0 flex-1">
                        <div className="min-w-0">
                          <div className="flex min-w-0 items-start gap-2">
                            <h3 className="min-w-0 flex-1 truncate text-[15px] font-semibold tracking-tight text-foreground" title={item.name}>
                              {item.name}
                            </h3>
                            {item.version ? <span className="shrink-0 pt-0.5 text-[11px] font-medium text-foreground/42">v{item.version}</span> : null}
                          </div>
                          <p className="mt-1.5 line-clamp-2 text-[13px] font-medium leading-[1.55] text-foreground/56">
                            {description}
                          </p>
                          <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-medium text-foreground/42">
                            <span>{item.sourceLabel || (item.providerId === 'clawhub' ? 'ClawHub' : 'SkillHub')}</span>
                            {item.author ? <span>{item.author}</span> : null}
                            {typeof item.downloads === 'number' ? <span>{item.downloads} downloads</span> : null}
                          </div>
                        </div>

                        <div className="mt-3.5 flex flex-wrap items-center justify-end gap-2 border-t border-border/55 pt-3">
                          {typeof item.metadata?.sourceUrl === 'string' && item.metadata.sourceUrl ? (
                            <Button type="button" variant="outline" className="h-8 rounded-md px-3 text-[12px] font-semibold shadow-sm" onClick={() => onOpenSource(item)}>
                              <Globe className="mr-1.5 h-3.5 w-3.5" />
                              {t('providerSearch.openSource', { defaultValue: '查看' })}
                            </Button>
                          ) : null}
                          <Button type="button" className="h-8 rounded-md px-3.5 text-[12px] font-semibold shadow-sm" onClick={() => onInstall(item)}>
                            {t('providerSearch.sendToChat', { defaultValue: '发送到聊天' })}
                            <ChevronRight className="ml-1.5 h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : null}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface GitHubImportDialogProps {
  open: boolean;
  repositoryUrl: string;
  repoPath: string;
  refValue: string;
  onOpenChange: (open: boolean) => void;
  onRepositoryUrlChange: (value: string) => void;
  onRepoPathChange: (value: string) => void;
  onRefValueChange: (value: string) => void;
  onSubmit: () => void;
  t: TFunction<'skills'>;
}

function GitHubImportDialog({
  open,
  repositoryUrl,
  repoPath,
  refValue,
  onOpenChange,
  onRepositoryUrlChange,
  onRepoPathChange,
  onRefValueChange,
  onSubmit,
  t,
}: GitHubImportDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[640px] gap-0 rounded-xl border border-border/70 bg-[hsl(var(--surface-elevated))] p-0 shadow-lg">
        <div className="border-b border-border/70 px-6 py-5">
          <DialogHeader className="space-y-0 text-left">
            <DialogTitle className="text-[22px] font-semibold tracking-tight text-foreground">
              {t('githubImport.title', { defaultValue: '从 GitHub 导入' })}
            </DialogTitle>
            <DialogDescription className="mt-1.5 text-[13px] font-medium leading-[1.55] text-foreground/62">
              {t('githubImport.subtitle', { defaultValue: '输入仓库地址后，把固定导入草案发送到聊天窗口继续处理。' })}
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="space-y-4 px-6 py-5">
          <div className="space-y-2">
            <label className="text-[12px] font-semibold tracking-wide text-foreground/60">
              {t('githubImport.repositoryLabel', { defaultValue: '仓库地址' })}
            </label>
            <Input autoFocus value={repositoryUrl} onChange={(event) => onRepositoryUrlChange(event.target.value)} placeholder="https://github.com/owner/repo" className={tokenInputClasses} />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-[12px] font-semibold tracking-wide text-foreground/60">
                {t('githubImport.pathLabel', { defaultValue: '仓库路径（可选）' })}
              </label>
              <Input value={repoPath} onChange={(event) => onRepoPathChange(event.target.value)} placeholder="skills/my-skill" className={compactInputClasses} />
            </div>

            <div className="space-y-2">
              <label className="text-[12px] font-semibold tracking-wide text-foreground/60">
                {t('githubImport.refLabel', { defaultValue: '分支或提交（可选）' })}
              </label>
              <Input value={refValue} onChange={(event) => onRefValueChange(event.target.value)} placeholder="main" className={compactInputClasses} />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-border/70 px-6 py-4">
          <Button type="button" variant="outline" className="h-8 rounded-md px-4 text-[13px] font-semibold shadow-sm" onClick={() => onOpenChange(false)}>
            {t('common.cancel', { defaultValue: '取消' })}
          </Button>
          <Button type="button" className="h-8 rounded-md px-4 text-[13px] font-semibold shadow-sm" onClick={onSubmit}>
            {t('githubImport.sendToChat', { defaultValue: '发送到聊天' })}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
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
    uninstallSkill,
  } = useSkillsStore();
  const { t } = useTranslation('skills');
  const navigate = useNavigate();
  const gatewayStatus = useGatewayStore((state) => state.status);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [providerDialogOpen, setProviderDialogOpen] = useState(false);
  const [activeProvider, setActiveProvider] = useState<SkillProviderId | null>(null);
  const [providerQuery, setProviderQuery] = useState('');
  const [providerResults, setProviderResults] = useState<SkillCatalogItem[]>([]);
  const [providerLoading, setProviderLoading] = useState(false);
  const [providerError, setProviderError] = useState<string | null>(null);
  const [pendingToggleSkillIds, setPendingToggleSkillIds] = useState<Set<string>>(() => new Set());
  const [githubImportOpen, setGithubImportOpen] = useState(false);
  const [githubRepositoryUrl, setGithubRepositoryUrl] = useState('');
  const [githubRepoPath, setGithubRepoPath] = useState('');
  const [githubRef, setGithubRef] = useState('');
  const [pendingRestoreScrollTop, setPendingRestoreScrollTop] = useState<number | null>(null);
  const skillCardRefs = useRef<Array<HTMLDivElement | null>>([]);
  const isGatewayRunning = gatewayStatus.state === 'running';
  const [showGatewayWarning, setShowGatewayWarning] = useState(false);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (!isGatewayRunning) {
      timer = setTimeout(() => setShowGatewayWarning(true), 1500);
    } else {
      timer = setTimeout(() => setShowGatewayWarning(false), 0);
    }
    return () => clearTimeout(timer);
  }, [isGatewayRunning]);

  useEffect(() => {
    if (isGatewayRunning) {
      fetchSkills();
    }
  }, [fetchSkills, isGatewayRunning]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const raw = window.sessionStorage.getItem(SKILLS_RETURN_CONTEXT_STORAGE_KEY);
    if (!raw) return;
    window.sessionStorage.removeItem(SKILLS_RETURN_CONTEXT_STORAGE_KEY);
    try {
      const context = JSON.parse(raw) as {
        localQuery?: string;
        scrollTop?: number;
        activeProvider?: SkillProviderId | null;
        providerQuery?: string;
      };
      if (context.localQuery) {
        setSearchQuery(context.localQuery);
      }
      if (typeof context.scrollTop === 'number') {
        setPendingRestoreScrollTop(context.scrollTop);
      }
      if (context.activeProvider) {
        setActiveProvider(context.activeProvider);
        setProviderQuery(context.providerQuery || '');
        setProviderDialogOpen(true);
      }
    } catch {
      window.sessionStorage.removeItem(SKILLS_RETURN_CONTEXT_STORAGE_KEY);
    }
  }, []);

  const safeSkills = useMemo(() => (Array.isArray(skills) ? skills : []), [skills]);
  const installedSkillKeys = useMemo(() => new Set(
    safeSkills
      .flatMap((skill) => [skill.slug, skill.id])
      .filter((value): value is string => typeof value === 'string')
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean),
  ), [safeSkills]);
  const filteredSkills = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    const provenanceRank: Record<string, number> = {
      'xclaw-preinstalled': 0,
      'openclaw-managed': 1,
      'openclaw-workspace': 2,
      'openclaw-extra': 3,
      'agents-personal': 4,
      'agents-project': 4,
      'openclaw-bundled': 5,
      unknown: 6,
    };

    return safeSkills
      .filter((skill) => {
        if (!query) return true;
        return [
          skill.name,
          resolveLocalizedSkillDescription(skill, t),
          skill.id,
          skill.slug,
          skill.author,
          skill.displaySourceLabel,
        ].filter(Boolean).some((value) => String(value).toLowerCase().includes(query));
      })
      .sort((left, right) => {
        const leftRank = provenanceRank[left.provenance || 'unknown'] ?? 99;
        const rightRank = provenanceRank[right.provenance || 'unknown'] ?? 99;
        if (leftRank !== rightRank) return leftRank - rightRank;
        if (left.enabled !== right.enabled) return left.enabled ? -1 : 1;
        return left.name.localeCompare(right.name);
      });
  }, [safeSkills, searchQuery, t]);

  useEffect(() => {
    if (pendingRestoreScrollTop === null) return;
    const frame = window.requestAnimationFrame(() => {
      const scrollArea = document.getElementById('skills-page-scroll-area');
      if (scrollArea) {
        scrollArea.scrollTop = pendingRestoreScrollTop;
      }
      setPendingRestoreScrollTop(null);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [filteredSkills.length, pendingRestoreScrollTop]);

  const handleToggle = useCallback(async (skillId: string, enable: boolean) => {
    if (pendingToggleSkillIds.has(skillId)) return;
    setPendingToggleSkillIds((current) => {
      const next = new Set(current);
      next.add(skillId);
      return next;
    });
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
    } finally {
      setPendingToggleSkillIds((current) => {
        const next = new Set(current);
        next.delete(skillId);
        return next;
      });
    }
  }, [disableSkill, enableSkill, pendingToggleSkillIds, t]);

  const handleOpenSkillFolder = useCallback(async (skill: Skill) => {
    try {
      const result = await hostApiFetch<{ success: boolean; error?: string }>('/api/clawhub/open-path', {
        method: 'POST',
        body: JSON.stringify({ skillKey: skill.id, slug: skill.slug, baseDir: skill.baseDir }),
      });
      if (!result.success) {
        throw new Error(result.error || 'Failed to open folder');
      }
    } catch (err) {
      toast.error(t('toast.failedOpenActualFolder') + ': ' + String(err));
    }
  }, [t]);

  const handleOpenSkillReadme = useCallback(async (skill: Skill) => {
    try {
      const result = await hostApiFetch<{ success: boolean; error?: string }>('/api/clawhub/open-readme', {
        method: 'POST',
        body: JSON.stringify({ skillKey: skill.id, slug: skill.slug, baseDir: skill.baseDir }),
      });
      if (!result.success) {
        throw new Error(result.error || 'Failed to open readme');
      }
      toast.success(t('toast.openedEditor'));
    } catch (err) {
      toast.error(t('toast.failedEditor') + ': ' + String(err));
    }
  }, [t]);

  const handleUninstall = useCallback(async (slug: string) => {
    try {
      await uninstallSkill(slug);
      toast.success(t('toast.uninstalled'));
    } catch (err) {
      toast.error(t('toast.failedUninstall') + ': ' + String(err));
    }
  }, [uninstallSkill, t]);

  const buildReturnContext = useCallback(() => {
    const scrollTop = document.getElementById('skills-page-scroll-area')?.scrollTop;
    return {
      localQuery: searchQuery.trim() || undefined,
      scrollTop: typeof scrollTop === 'number' ? scrollTop : undefined,
      activeProvider,
      providerQuery: providerQuery.trim() || undefined,
    };
  }, [activeProvider, providerQuery, searchQuery]);

  const persistReturnContext = useCallback(() => {
    if (typeof window === 'undefined') return;
    window.sessionStorage.setItem(SKILLS_RETURN_CONTEXT_STORAGE_KEY, JSON.stringify(buildReturnContext()));
  }, [buildReturnContext]);

  const handleSubmitGitHubImport = useCallback(() => {
    if (!githubRepositoryUrl.trim()) {
      toast.error(t('githubImport.validation', { defaultValue: '请先输入 GitHub 仓库地址。' }));
      return;
    }
    persistReturnContext();
    navigate('/new', {
      state: {
        skillChatDraft: buildGitHubImportSkillChatDraft({
          repositoryUrl: githubRepositoryUrl,
          repoPath: githubRepoPath,
          ref: githubRef,
        }, buildReturnContext()),
      },
    });
    setGithubImportOpen(false);
    setShowAddMenu(false);
  }, [buildReturnContext, githubRef, githubRepoPath, githubRepositoryUrl, navigate, persistReturnContext, t]);

  const openProviderSearch = useCallback((providerId: SkillProviderId) => {
    setActiveProvider(providerId);
    setProviderQuery('');
    setProviderResults([]);
    setProviderError(null);
    setProviderDialogOpen(true);
    setShowAddMenu(false);
  }, []);

  useEffect(() => {
    if (!providerDialogOpen || !activeProvider) return;

    let cancelled = false;
    const timer = setTimeout(async () => {
      setProviderLoading(true);
      setProviderError(null);
      try {
        const endpoint = activeProvider === 'clawhub'
          ? '/api/skills/providers/clawhub/search'
          : '/api/skills/providers/skillhub/search';
        const trimmedQuery = providerQuery.trim();
        const result = await hostApiFetch<{ success: boolean; results?: SkillCatalogItem[]; error?: string }>(endpoint, {
          method: 'POST',
          body: JSON.stringify({
            query: trimmedQuery,
            limit: trimmedQuery ? SEARCH_PROVIDER_RESULT_LIMIT : DEFAULT_PROVIDER_RESULT_LIMIT,
          }),
        });
        if (!result.success) {
          throw new Error(result.error || 'Search failed');
        }
        if (!cancelled) {
          setProviderResults((result.results || []).filter((item) => {
            const keys = [item.slug, item.providerSkillId, item.id]
              .filter((value): value is string => typeof value === 'string')
              .map((value) => value.trim().toLowerCase())
              .filter(Boolean);
            return !keys.some((key) => installedSkillKeys.has(key));
          }));
        }
      } catch (err) {
        if (!cancelled) {
          setProviderResults([]);
          setProviderError(String(err));
        }
      } finally {
        if (!cancelled) {
          setProviderLoading(false);
        }
      }
    }, 220);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [activeProvider, installedSkillKeys, providerDialogOpen, providerQuery]);

  const handleProviderInstall = useCallback((item: SkillCatalogItem) => {
    persistReturnContext();
    navigate('/', { state: { skillChatDraft: buildProviderInstallSkillChatDraft(item, buildReturnContext()) } });
    setProviderDialogOpen(false);
  }, [buildReturnContext, navigate, persistReturnContext]);

  const handleOpenProviderSource = useCallback(async (item: SkillCatalogItem) => {
    const url = typeof item.metadata?.sourceUrl === 'string' ? item.metadata.sourceUrl : '';
    if (!url) return;
    await invokeIpc('shell:openExternal', url);
  }, []);

  const installedSummary = useMemo(() => ({
    total: safeSkills.length,
    enabled: safeSkills.filter((skill) => skill.enabled).length,
    preinstalled: safeSkills.filter((skill) => skill.provenance === 'xclaw-preinstalled').length,
  }), [safeSkills]);
  const registerSkillCard = useCallback((index: number, node: HTMLDivElement | null) => {
    skillCardRefs.current[index] = node;
  }, []);
  const requestSkillCardFocus = useCallback((targetIndex: number) => {
    const totalCards = filteredSkills.length;
    if (!totalCards) return;
    const normalizedIndex = targetIndex === Number.MAX_SAFE_INTEGER
      ? totalCards - 1
      : Math.min(Math.max(targetIndex, 0), totalCards - 1);
    skillCardRefs.current[normalizedIndex]?.focus();
  }, [filteredSkills.length]);

  if (loading) {
    return <WorkspacePageLoading />;
  }

  return (
    <WorkspacePageFrame>
      <WorkspacePageShell className="app-skills-page-shell">
        <WorkbenchHeader
          titleBlock={(
            <WorkbenchHeaderTitleBlock
              title={t('title', { defaultValue: '技能管理' })}
              subtitle={t('subtitle', { defaultValue: '为你的智能体提供预封装且可重复的最佳实践与工具' })}
            />
          )}
          summary={(
            <div className="space-y-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center">
                <div className={cn(searchFieldClasses, 'h-9 flex-1 rounded-md px-3 py-0')}>
                  <Puzzle className="h-4.5 w-4.5 shrink-0 text-muted-foreground" />
                  <input
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder={t('search', { defaultValue: '搜索已经安装的技能' })}
                    className="ml-3 flex-1 bg-transparent p-0 text-[14px] font-medium text-foreground outline-none placeholder:text-foreground/42"
                  />
                  {searchQuery ? (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="shrink-0 rounded-sm px-1.5 py-1 text-foreground/42 transition-colors hover:bg-[hsl(var(--surface-hover)/0.52)] hover:text-foreground"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  ) : null}
                </div>

                <DropdownMenu open={showAddMenu} onOpenChange={setShowAddMenu}>
                  <DropdownMenuTrigger asChild>
                    <Button type="button" className={cn(workbenchPrimaryToolbarButtonClasses, 'min-w-[148px] justify-center gap-2')}>
                      <Plus className="h-4 w-4" />
                      {t('addSkill', { defaultValue: '添加技能' })}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-[248px] p-1.5">
                    <DropdownMenuItem onSelect={() => setGithubImportOpen(true)} className="gap-2">
                      <Github className="h-4 w-4 text-foreground/72" />
                      {t('addMenu.importGithub', { defaultValue: '从 GitHub 导入' })}
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => openProviderSearch('clawhub')} className="gap-2">
                      <Globe className="h-4 w-4 text-[#d85d45]" />
                      {t('addMenu.searchClawHub', { defaultValue: '从 ClawHub 搜索' })}
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => openProviderSearch('skillhub')} className="gap-2">
                      <Puzzle className="h-4 w-4 text-[#b37b5d]" />
                      {t('addMenu.searchSkillHub', { defaultValue: '从 SkillHub 搜索' })}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-[12px] font-medium text-foreground/48">
                <span>{t('summary.total', { defaultValue: '{{count}} 个技能', count: installedSummary.total })}</span>
                <span>·</span>
                <span>{t('summary.enabled', { defaultValue: '{{count}} 个已启用', count: installedSummary.enabled })}</span>
                <span>·</span>
                <span>{t('summary.preinstalled', { defaultValue: '{{count}} 个内置技能', count: installedSummary.preinstalled })}</span>
              </div>
            </div>
          )}
        />

        <WorkspacePageScrollArea id="skills-page-scroll-area">
          {showGatewayWarning ? (
            <div className="mb-5 flex items-center gap-2.5 rounded-lg border border-amber-500/15 bg-amber-500/6 px-4 py-3 app-insight-surface">
              <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              <span className="text-[13px] font-medium text-amber-900 dark:text-amber-100">
                {t('gatewayWarning', { defaultValue: '网关未运行。没有活跃的网关，无法加载技能。' })}
              </span>
            </div>
          ) : null}

          {error ? (
            <div className="mb-5 flex items-center gap-2.5 rounded-lg border border-destructive/16 bg-[hsl(var(--danger))/0.06] px-4 py-3 text-[13px] font-medium text-destructive">
              <AlertCircle className="h-4.5 w-4.5 shrink-0" />
              <span>{error}</span>
            </div>
          ) : null}

          {filteredSkills.length === 0 ? (
            <div className="flex min-h-[360px] flex-col items-center justify-center rounded-xl border border-dashed border-border/70 bg-[hsl(var(--surface-panel)/0.62)] px-6 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-[hsl(var(--primary)/0.18)] bg-[hsl(var(--primary)/0.1)] text-[24px] text-primary shadow-sm">
                🧩
              </div>
              <h2 className="mt-5 text-[18px] font-semibold tracking-tight text-foreground">
                {searchQuery.trim()
                  ? t('empty.searchTitle', { defaultValue: '没有找到匹配的技能' })
                  : t('empty.defaultTitle', { defaultValue: '这里还没有技能' })}
              </h2>
              <p className="mt-2 max-w-[32rem] text-[13px] font-medium leading-[1.65] text-foreground/54">
                {searchQuery.trim()
                  ? t('empty.searchSubtitle', { defaultValue: '换个关键词，或者从添加技能里搜索新的技能来源。' })
                  : t('empty.defaultSubtitle', { defaultValue: '你可以从 GitHub 导入，或者从 ClawHub / SkillHub 搜索。' })}
              </p>
            </div>
          ) : (
            <div data-testid="skills-card-grid" className="app-skills-card-grid">
              {filteredSkills.map((skill, index) => (
                <SkillCard
                  key={skill.id}
                  skill={skill}
                  index={index}
                  onOpen={() => setSelectedSkill(skill)}
                  onToggle={(enabled) => handleToggle(skill.id, enabled)}
                  togglePending={pendingToggleSkillIds.has(skill.id)}
                  onRequestFocus={requestSkillCardFocus}
                  registerCard={registerSkillCard}
                  onOpenFolder={handleOpenSkillFolder}
                  onOpenReadme={handleOpenSkillReadme}
                  onUninstall={handleUninstall}
                  t={t}
                />
              ))}
            </div>
          )}
        </WorkspacePageScrollArea>
      </WorkspacePageShell>

      <ProviderSearchDialog
        open={providerDialogOpen}
        providerId={activeProvider}
        query={providerQuery}
        results={providerResults}
        loading={providerLoading}
        error={providerError}
        onOpenChange={setProviderDialogOpen}
        onQueryChange={setProviderQuery}
        onInstall={handleProviderInstall}
        onOpenSource={handleOpenProviderSource}
        t={t}
      />

      <GitHubImportDialog
        open={githubImportOpen}
        repositoryUrl={githubRepositoryUrl}
        repoPath={githubRepoPath}
        refValue={githubRef}
        onOpenChange={setGithubImportOpen}
        onRepositoryUrlChange={setGithubRepositoryUrl}
        onRepoPathChange={setGithubRepoPath}
        onRefValueChange={setGithubRef}
        onSubmit={handleSubmitGitHubImport}
        t={t}
      />

      <SkillDetailDialog
        skill={selectedSkill}
        isOpen={!!selectedSkill}
        onClose={() => setSelectedSkill(null)}
        onToggle={(enabled) => {
          if (!selectedSkill) return;
          handleToggle(selectedSkill.id, enabled);
          setSelectedSkill({ ...selectedSkill, enabled });
        }}
        togglePending={selectedSkill ? pendingToggleSkillIds.has(selectedSkill.id) : false}
        onUninstall={handleUninstall}
        onOpenFolder={handleOpenSkillFolder}
      />
    </WorkspacePageFrame>
  );
}

export default Skills;
