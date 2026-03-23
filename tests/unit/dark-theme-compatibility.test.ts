import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('dark theme compatibility audit', () => {
  it('keeps shared workbench actions and settings active states on token-driven accents', () => {
    const source = [
      'src/components/layout/workbench-button-styles.ts',
      'src/components/layout/WorkbenchHeaderIcon.tsx',
      'src/pages/Settings/index.tsx',
    ]
      .map((relativePath) => readFileSync(resolve(process.cwd(), relativePath), 'utf8'))
      .join('\n');

    expect(source).not.toContain('border-[#e7d6cf]');
    expect(source).not.toContain('rgba(251,243,239,0.98)');
    expect(source).not.toContain('text-[#9f5c45]');
    expect(source).not.toContain('border-[#d9e1eb]');
    expect(source).not.toContain('border-[#f1d7ce]');
    expect(source).not.toContain('border-[#efe1c6]');
    expect(source).not.toContain('data-[state=active]:border-[#e6d4cc]');
    expect(source).not.toContain('data-[state=active]:bg-[linear-gradient(180deg,rgba(252,245,241,0.98)_0%,rgba(246,236,231,0.96)_100%)]');
    expect(source).toContain('hsl(var(--primary)');
  });

  it('keeps chat session utilities and exec approval overlay on theme surfaces instead of white fills', () => {
    const source = [
      'src/components/layout/ChatSessionsPane.tsx',
      'src/pages/Chat/ExecApprovalOverlay.tsx',
    ]
      .map((relativePath) => readFileSync(resolve(process.cwd(), relativePath), 'utf8'))
      .join('\n');

    expect(source).not.toContain('text-[#4b5563]');
    expect(source).not.toContain('text-[#333]');
    expect(source).not.toContain('text-[#70757d]');
    expect(source).not.toContain('bg-white p-1.5');
    expect(source).not.toContain('border-[#ececee]');
    expect(source).not.toContain('bg-[rgba(255,255,255,0.72)]');
    expect(source).not.toContain('bg-[rgba(255,255,255,0.78)]');
    expect(source).not.toContain('bg-[linear-gradient(135deg,#1f2937,#374151)]');
    expect(source).toContain('surface-elevated');
    expect(source).toContain('surface-panel');
  });

  it('keeps agents, skills, channels, and setup on dark-compatible token choices', () => {
    const source = [
      'src/pages/Skills/index.tsx',
      'src/pages/Agents/index.tsx',
      'src/components/agents/AgentListPane.tsx',
      'src/components/channels/ChannelConfigEditor.tsx',
      'src/components/setup/SetupCompleteStage.tsx',
    ]
      .map((relativePath) => readFileSync(resolve(process.cwd(), relativePath), 'utf8'))
      .join('\n');

    expect(source).not.toContain('bg-[linear-gradient(180deg,rgba(255,246,243,0.98)_0%,rgba(255,236,231,0.94)_100%)]');
    expect(source).not.toContain('bg-[linear-gradient(180deg,rgba(255,249,239,0.98)_0%,rgba(247,238,219,0.94)_100%)]');
    expect(source).not.toContain('focus-within:bg-white');
    expect(source).not.toContain('bg-white px-3.5');
    expect(source).not.toContain('dark:data-[state=checked]:bg-white/70');
    expect(source).not.toContain('border-slate-500');
    expect(source).toContain('surface-hover');
    expect(source).toContain('surface-elevated');
  });
});
