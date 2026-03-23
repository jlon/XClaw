import type { SkillCatalogItem, SkillChatDraft, SkillChatDraftContext } from '@/types/skill';

const SKILLHUB_INSTALL_GUIDE_URL = 'https://skillhub-1388575217.cos.ap-guangzhou.myqcloud.com/install/skillhub.md';

type GitHubImportDraftParams = {
  repositoryUrl: string;
  repoPath?: string;
  ref?: string;
};

const createDraftId = (prefix: string): string =>
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? `${prefix}-${crypto.randomUUID()}`
    : `${prefix}-${Date.now()}`;

const normalizeReturnContext = (context?: SkillChatDraftContext): SkillChatDraftContext | undefined => {
  if (!context) return undefined;
  return {
    localQuery: context.localQuery?.trim() || undefined,
    scrollTop: typeof context.scrollTop === 'number' ? context.scrollTop : undefined,
    activeProvider: context.activeProvider ?? null,
    providerQuery: context.providerQuery?.trim() || undefined,
  };
};

const resolveSkillHubInstallTarget = (item: SkillCatalogItem): string =>
  item.slug?.trim()
  || item.providerSkillId?.trim()
  || item.name.trim();

const buildSkillHubInstallMessage = (item: SkillCatalogItem): string => {
  const target = resolveSkillHubInstallTarget(item);
  return `请先检查是否已安装 SkillHub 商店，若未安装，请根据 ${SKILLHUB_INSTALL_GUIDE_URL} 安装Skillhub商店，但是只安装CLI，然后安装${target}技能。若已安装，则直接安装${target}技能。`;
};

export const buildCreateSkillChatDraft = (context?: SkillChatDraftContext): SkillChatDraft => ({
  id: createDraftId('create-skill'),
  kind: 'create-skill',
  title: '通过对话创建技能',
  message: '帮我创建一个新技能。先确认目标、输入输出、依赖和交付文件，再生成所需的技能结构。',
  returnContext: normalizeReturnContext(context),
  execution: {
    kind: 'chat-prompt',
    payload: {
      intent: 'create-skill',
    },
  },
});

export const buildGitHubImportSkillChatDraft = (
  params: GitHubImportDraftParams,
  context?: SkillChatDraftContext,
): SkillChatDraft => {
  const repositoryUrl = params.repositoryUrl.trim();
  if (!repositoryUrl) {
    throw new Error('repositoryUrl is required');
  }

  const repoPath = params.repoPath?.trim();
  const ref = params.ref?.trim();
  const segments = [
    `请帮我从 GitHub 导入技能仓库：${repositoryUrl}。`,
    repoPath ? `重点路径：${repoPath}。` : null,
    ref ? `目标分支或提交：${ref}。` : null,
    '先确认仓库结构和导入方式，再开始执行。',
  ].filter(Boolean);

  return {
    id: createDraftId('github-import'),
    kind: 'github-import',
    title: '从 GitHub 导入',
    message: segments.join(' '),
    returnContext: normalizeReturnContext(context),
    execution: {
      kind: 'chat-prompt',
      payload: {
        intent: 'github-import',
        repositoryUrl,
        repoPath,
        ref,
      },
    },
  };
};

export const buildProviderInstallSkillChatDraft = (
  item: SkillCatalogItem,
  context?: SkillChatDraftContext,
): SkillChatDraft => {
  const providerName = item.providerId === 'clawhub' ? 'ClawHub' : 'SkillHub';
  const message = item.providerId === 'skillhub'
    ? buildSkillHubInstallMessage(item)
    : item.installCapability.executionKind === 'host-install'
      ? `请安装 ${providerName} 技能 ${item.name}（slug: ${item.slug}）。安装完成后告诉我结果。`
      : `请帮我安装来自 ${providerName} 的技能 ${item.name}（slug: ${item.slug}）。先使用固定安装草案，不要自行猜命令。`;

  return {
    id: createDraftId('provider-install'),
    kind: 'provider-install',
    title: `安装 ${item.name}`,
    message,
    returnContext: normalizeReturnContext(context),
    providerId: item.providerId,
    providerSkillId: item.providerSkillId,
    slug: item.slug,
    name: item.name,
    execution: {
      kind: item.installCapability.executionKind,
      payload: {
        providerId: item.providerId,
        providerSkillId: item.providerSkillId,
        providerQualifiedId: item.id,
        slug: item.slug,
        name: item.name,
        version: item.version,
        sourceLabel: item.sourceLabel,
        metadata: item.metadata || {},
      },
    },
  };
};

export const isSkillChatDraft = (value: unknown): value is SkillChatDraft => {
  if (!value || typeof value !== 'object') return false;
  const draft = value as Partial<SkillChatDraft>;
  return typeof draft.id === 'string'
    && typeof draft.kind === 'string'
    && typeof draft.title === 'string'
    && typeof draft.message === 'string'
    && !!draft.execution
    && typeof draft.execution.kind === 'string'
    && !!draft.execution.payload
    && typeof draft.execution.payload === 'object';
};
