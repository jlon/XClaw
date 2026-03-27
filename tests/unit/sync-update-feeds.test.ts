import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('sync update feeds script', () => {
  it('syncs the beta feed with canonical updater metadata and manual-download metadata', () => {
    const script = readFileSync(resolve(process.cwd(), 'scripts/sync-update-feeds.sh'), 'utf8');

    expect(script).toContain('/downloads/updates');
    expect(script).toContain('beta');
    expect(script).not.toContain('/downloads/updates/stable');
    expect(script).toContain('feed.json');
    expect(script).toContain('latest.yml');
    expect(script).toContain('latest-mac.yml');
    expect(script).toContain('.blockmap');
    expect(script).toContain('.dmg');
  });
});
