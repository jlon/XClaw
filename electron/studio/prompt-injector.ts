import { mkdir, readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { validateWorkspacePathInput } from '../utils/workspace-path';

export const STAR_OFFICE_PROMPT_BEGIN = '<!-- XCLAW:STAR_OFFICE:BEGIN -->';
export const STAR_OFFICE_PROMPT_END = '<!-- XCLAW:STAR_OFFICE:END -->';
const STAR_OFFICE_PROMPT_TITLE = '## XClaw Star Office';

export type StarOfficePromptInjectionStatus = 'injected' | 'skipped' | 'corrupt' | 'error';

export interface StarOfficePromptInjectionResult {
  workspacePath: string;
  agentsFilePath: string;
  status: StarOfficePromptInjectionStatus;
  warning: string | null;
}

const buildPromptBlock = (newline: string): string => [
  STAR_OFFICE_PROMPT_TITLE,
  '',
  STAR_OFFICE_PROMPT_BEGIN,
  '- 你正在使用 XClaw 的 Star Office 集成。',
  '- 仅在 `AGENTS.md` 中维护这段工作室规则，保持规则块幂等。',
  '- 需要补充当前任务说明时，优先更新 `STAR_OFFICE_DETAIL.txt`，保持简短且具体。',
  STAR_OFFICE_PROMPT_END,
].join(newline);

const detectNewline = (content: string): string => (content.includes('\r\n') ? '\r\n' : '\n');

const buildWarning = (workspacePath: string, reason: string): string => (
  `Star Office 提示词注入失败，已跳过 ${workspacePath}: ${reason}`
);

const inspectPromptState = (content: string): 'complete' | 'absent' | 'corrupt' => {
  const beginIndex = content.indexOf(STAR_OFFICE_PROMPT_BEGIN);
  const endIndex = content.indexOf(STAR_OFFICE_PROMPT_END);

  if (beginIndex === -1 && endIndex === -1) {
    return 'absent';
  }

  if (beginIndex !== -1 && endIndex !== -1 && beginIndex < endIndex) {
    return 'complete';
  }

  return 'corrupt';
};

export async function injectStarOfficePrompt(workspacePath: string): Promise<StarOfficePromptInjectionResult> {
  const validation = validateWorkspacePathInput(workspacePath);
  if (!validation.normalizedPath) {
    return {
      workspacePath,
      agentsFilePath: join(workspacePath, 'AGENTS.md'),
      status: 'error',
      warning: buildWarning(workspacePath, validation.error || '工作区路径无效'),
    };
  }

  const normalizedWorkspacePath = validation.normalizedPath;
  const agentsFilePath = join(normalizedWorkspacePath, 'AGENTS.md');

  try {
    await mkdir(normalizedWorkspacePath, { recursive: true });
    const existingContent = await readFile(agentsFilePath, 'utf-8').catch(() => '');
    const promptState = inspectPromptState(existingContent);

    if (promptState === 'complete') {
      return {
        workspacePath: normalizedWorkspacePath,
        agentsFilePath,
        status: 'skipped',
        warning: null,
      };
    }

    if (promptState === 'corrupt') {
      return {
        workspacePath: normalizedWorkspacePath,
        agentsFilePath,
        status: 'corrupt',
        warning: buildWarning(normalizedWorkspacePath, '检测到不完整的 XCLAW:STAR_OFFICE 标记块'),
      };
    }

    const newline = detectNewline(existingContent);
    const promptBlock = buildPromptBlock(newline);
    const nextContent = existingContent.length > 0
      ? `${existingContent.trimEnd()}${newline}${newline}${promptBlock}${newline}`
      : `${promptBlock}${newline}`;

    await writeFile(agentsFilePath, nextContent, 'utf-8');

    return {
      workspacePath: normalizedWorkspacePath,
      agentsFilePath,
      status: 'injected',
      warning: null,
    };
  } catch (error) {
    return {
      workspacePath,
      agentsFilePath,
      status: 'error',
      warning: buildWarning(normalizedWorkspacePath, error instanceof Error ? error.message : String(error)),
    };
  }
}
