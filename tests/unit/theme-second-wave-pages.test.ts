import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('second-wave desktop theme rollout', () => {
  it('keeps settings and models on token-driven desktop surfaces instead of warm web styling', () => {
    const files = [
      'src/pages/Settings/index.tsx',
      'src/components/settings/ProvidersSettings.tsx',
      'src/components/settings/UpdateSettings.tsx',
      'src/pages/Models/index.tsx',
    ];

    const source = files.map((relativePath) => readFileSync(resolve(process.cwd(), relativePath), 'utf8')).join('\n');

    expect(source).not.toContain('bg-[#f3f1e9]');
    expect(source).not.toContain('border-black/10');
    expect(source).not.toContain('dark:border-white/10');
    expect(source).not.toContain('#0a84ff');
    expect(source).not.toContain('#007aff');
    expect(source).toContain('surface-panel');
    expect(source).toContain('surface-base');
    expect(source).toContain('app-field-surface');
    expect(source).toContain('settingsInputClass');
    expect(source).toContain('settingsCodeInputClass');
    expect(source).toContain('settingsPaneClass');
    expect(source).toContain('usageSurfaceClass');
    expect(source).toContain('border-border/70');
    expect(source).not.toContain('opacity-0 group-hover:opacity-100');
  });

  it('keeps agents, skills, and cron aligned with the shared desktop shell language', () => {
    const files = [
      'src/pages/Agents/index.tsx',
      'src/pages/Skills/index.tsx',
      'src/pages/Cron/index.tsx',
    ];

    const source = files.map((relativePath) => readFileSync(resolve(process.cwd(), relativePath), 'utf8')).join('\n');

    expect(source).not.toContain('bg-[#f3f1e9]');
    expect(source).not.toContain('border-black/10');
    expect(source).not.toContain('dark:border-white/10');
    expect(source).not.toContain('hover:bg-black/5');
    expect(source).not.toContain('hover:bg-accent/60');
    expect(source).toContain('app-insight-surface');
    expect(source).toContain('app-field-surface');
    expect(source).toContain('border-border/70');
    expect(source).toContain('rounded-md');
    expect(source).toContain('app-cron-summary-pill');
    expect(source).toContain('hover:bg-[hsl(var(--surface-hover)/0.46)]');
  });

  it('keeps setup on the same desktop surface system instead of a standalone warm web wizard skin', () => {
    const files = [
      'src/pages/Setup/index.tsx',
      'src/components/setup/SetupStartStage.tsx',
      'src/components/setup/SetupPreparationStage.tsx',
      'src/components/setup/SetupProviderStage.tsx',
      'src/components/setup/SetupCompleteStage.tsx',
    ];

    const source = files.map((relativePath) => readFileSync(resolve(process.cwd(), relativePath), 'utf8')).join('\n');

    expect(source).not.toContain('bg-[#f3f1e9]');
    expect(source).not.toContain('bg-[#eeece3]');
    expect(source).not.toContain('border-black/10');
    expect(source).not.toContain('dark:border-white/10');
    expect(source).not.toContain('bg-blue-600');
    expect(source).not.toContain('text-blue-500');
    expect(source).toContain('app-insight-surface');
    expect(source).toContain('app-panel-surface-elevated');
    expect(source).toContain('app-field-surface');
    expect(source).toContain('border-border/70');
  });

  it('keeps channels and the channel config modal on the same desktop surface language without pill-heavy web syntax', () => {
    const files = [
      'src/pages/Channels/index.tsx',
      'src/components/channels/ChannelConfigModal.tsx',
    ];

    const source = files.map((relativePath) => readFileSync(resolve(process.cwd(), relativePath), 'utf8')).join('\n');

    expect(source).not.toContain('bg-secondary/80');
    expect(source).not.toContain('hover:bg-accent/60');
    expect(source).toContain('rounded-md');
    expect(source).toContain('app-pane-surface');
    expect(source).toContain('app-modal-surface');
    expect(source).toContain('searchFieldClass');
  });

  it('keeps the skills enabled switch on a token-driven accent in light theme instead of a hard black toggle', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/styles/globals.css'), 'utf8');

    expect(source).toContain(".app-skills-card-switch[data-state='checked']");
    expect(source).not.toContain("border-color: rgb(33 35 41 / 0.9);");
    expect(source).not.toContain("background: linear-gradient(180deg, rgb(41 43 49 / 0.98) 0%, rgb(26 28 33 / 0.98) 100%);");
  });
});
