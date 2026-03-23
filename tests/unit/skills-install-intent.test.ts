import { describe, expect, it } from 'vitest';
import {
  buildCreateSkillChatDraft,
  buildGitHubImportSkillChatDraft,
  buildProviderInstallSkillChatDraft,
  isSkillChatDraft,
} from '@/pages/Skills/skills-chat-drafts';
import type { SkillCatalogItem } from '@/types/skill';

describe('skills chat drafts', () => {
  it('builds a create-skill draft with chat-prompt execution', () => {
    const draft = buildCreateSkillChatDraft({
      localQuery: 'excel',
      scrollTop: 120,
      activeProvider: null,
    });

    expect(draft.kind).toBe('create-skill');
    expect(draft.execution.kind).toBe('chat-prompt');
    expect(draft.returnContext).toMatchObject({
      localQuery: 'excel',
      scrollTop: 120,
      activeProvider: null,
    });
    expect(isSkillChatDraft(draft)).toBe(true);
  });

  it('builds a github import draft with repository metadata', () => {
    const draft = buildGitHubImportSkillChatDraft({
      repositoryUrl: 'https://github.com/example/skills',
      repoPath: 'skills/excel',
      ref: 'main',
    });

    expect(draft.kind).toBe('github-import');
    expect(draft.message).toContain('https://github.com/example/skills');
    expect(draft.execution).toMatchObject({
      kind: 'chat-prompt',
      payload: {
        intent: 'github-import',
        repositoryUrl: 'https://github.com/example/skills',
        repoPath: 'skills/excel',
        ref: 'main',
      },
    });
  });

  it('builds a deterministic host-install draft for clawhub skills', () => {
    const item: SkillCatalogItem = {
      id: 'clawhub:daily-standup',
      providerId: 'clawhub',
      providerSkillId: 'daily-standup',
      slug: 'daily-standup',
      name: 'Daily Standup',
      description: 'Prepare concise meeting updates.',
      installCapability: {
        providerId: 'clawhub',
        executionKind: 'host-install',
      },
    };

    const draft = buildProviderInstallSkillChatDraft(item, {
      activeProvider: 'clawhub',
      providerQuery: 'standup',
    });

    expect(draft.kind).toBe('provider-install');
    expect(draft.execution).toMatchObject({
      kind: 'host-install',
      payload: {
        providerId: 'clawhub',
        providerSkillId: 'daily-standup',
        providerQualifiedId: 'clawhub:daily-standup',
      },
    });
    expect(draft.returnContext).toMatchObject({
      activeProvider: 'clawhub',
      providerQuery: 'standup',
    });
  });

  it('builds an exact cli-only chat prompt draft for skillhub results', () => {
    const item: SkillCatalogItem = {
      id: 'skillhub:github',
      providerId: 'skillhub',
      providerSkillId: 'github',
      slug: 'github',
      name: 'Github',
      description: 'Interact with GitHub using the gh CLI.',
      sourceLabel: 'SkillHub',
      metadata: { sourceUrl: 'https://clawhub.ai/steipete/github' },
      installCapability: {
        providerId: 'skillhub',
        executionKind: 'chat-prompt',
      },
    };

    const draft = buildProviderInstallSkillChatDraft(item);

    expect(draft.execution).toMatchObject({
      kind: 'chat-prompt',
      payload: {
        providerId: 'skillhub',
        providerSkillId: 'github',
      },
    });
    expect(draft.message).toBe('请先检查是否已安装 SkillHub 商店，若未安装，请根据 https://skillhub-1388575217.cos.ap-guangzhou.myqcloud.com/install/skillhub.md 安装Skillhub商店，但是只安装CLI，然后安装github技能。若已安装，则直接安装github技能。');
  });
});
