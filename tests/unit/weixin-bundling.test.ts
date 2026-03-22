import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function readProjectFile(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), 'utf8');
}

describe('weixin plugin bundling coverage', () => {
  it('includes openclaw-weixin in every bundled-plugin manifest', () => {
    const bundleScript = readProjectFile('scripts/bundle-openclaw-plugins.mjs');
    const afterPackScript = readProjectFile('scripts/after-pack.cjs');
    const configSync = readProjectFile('electron/gateway/config-sync.ts');

    expect(bundleScript).toContain("@tencent-weixin/openclaw-weixin");
    expect(bundleScript).toContain("pluginId: 'openclaw-weixin'");

    expect(afterPackScript).toContain("@tencent-weixin/openclaw-weixin");
    expect(afterPackScript).toContain("pluginId: 'openclaw-weixin'");

    expect(configSync).toContain("openclaw-weixin");
    expect(configSync).toContain("@tencent-weixin/openclaw-weixin");
  });

  it('keeps the electron-side weixin login flow free of plugin-sdk barrel imports', () => {
    const weixinLogin = readProjectFile('electron/utils/weixin-login.ts');

    expect(weixinLogin).not.toContain("from 'openclaw/plugin-sdk'");
    expect(weixinLogin).not.toContain('from "openclaw/plugin-sdk"');
  });
});
