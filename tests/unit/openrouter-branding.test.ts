import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PROVIDER_DEFINITIONS } from '@electron/shared/providers/registry';

describe('OpenRouter branding headers', () => {
  it('removes legacy claw-x attribution headers from defaults and gateway preloads', () => {
    const openrouter = PROVIDER_DEFINITIONS.find((provider) => provider.id === 'openrouter');
    const headers = openrouter?.providerConfig?.headers ?? {};
    const source = [
      'electron/gateway/process-launcher.ts',
      'electron/utils/openrouter-headers-preload.cjs',
    ]
      .map((relativePath) => readFileSync(resolve(process.cwd(), relativePath), 'utf8'))
      .join('\n');

    expect(headers).not.toHaveProperty('HTTP-Referer');
    expect(headers).not.toHaveProperty('X-Title');
    expect(source).not.toContain('https://claw-x.com');
    expect(source).not.toContain("flat['X-Title'] = 'XClaw'");
    expect(source).not.toContain("flat['HTTP-Referer'] =");
  });
});
