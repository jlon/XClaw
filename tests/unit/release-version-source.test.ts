import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { resolveReleaseVersion } from '../../scripts/resolve-release-version.mjs';

describe('release version source', () => {
  it('prefers a git tag version over manual inputs', () => {
    expect(
      resolveReleaseVersion({
        githubRef: 'refs/tags/v2026.3.23-beta.0',
        inputVersion: '2026.3.22',
        channel: 'stable',
      }),
    ).toBe('2026.3.23-beta.0');
  });

  it('uses the workflow input version when no tag is present', () => {
    expect(
      resolveReleaseVersion({
        githubRef: 'refs/heads/main',
        inputVersion: '2026.3.23',
        channel: 'stable',
      }),
    ).toBe('2026.3.23');
  });

  it('falls back to an auto-generated date version for manual CI runs', () => {
    expect(
      resolveReleaseVersion({
        githubRef: 'refs/heads/main',
        inputVersion: '',
        channel: 'beta',
        date: new Date('2026-03-23T12:00:00+08:00'),
      }),
    ).toBe('2026.3.23-beta.0');
  });

  it('wires the GitHub release workflow to the shared release-version resolver', () => {
    const workflow = readFileSync(resolve(process.cwd(), '.github/workflows/release.yml'), 'utf8');

    expect(workflow).toContain('scripts/resolve-release-version.mjs');
    expect(workflow).toContain('workflow_dispatch:');
    expect(workflow).toContain('channel:');
  });
});
