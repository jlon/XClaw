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
    expect(source).toContain('border-border/70');
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
    expect(source).toContain('app-panel-surface');
    expect(source).toContain('app-field-surface');
    expect(source).toContain('border-border/70');
    expect(source).toContain('hover:bg-accent/60');
  });

  it('keeps setup on the same desktop surface system instead of a standalone warm web wizard skin', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/pages/Setup/index.tsx'), 'utf8');

    expect(source).not.toContain('bg-[#f3f1e9]');
    expect(source).not.toContain('bg-[#eeece3]');
    expect(source).not.toContain('border-black/10');
    expect(source).not.toContain('dark:border-white/10');
    expect(source).not.toContain('bg-blue-600');
    expect(source).not.toContain('text-blue-500');
    expect(source).toContain('app-panel-surface');
    expect(source).toContain('app-panel-surface-elevated');
    expect(source).toContain('app-field-surface');
    expect(source).toContain('border-border/70');
  });
});
