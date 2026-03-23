import { describe, expect, it } from 'vitest';
import { formatDateVersion, parseVersionDateArgs } from '../../scripts/version-date.mjs';

describe('version-date', () => {
  it('formats a stable date version as YYYY.M.D', () => {
    expect(formatDateVersion({ date: new Date('2026-03-23T12:00:00+08:00'), channel: 'stable' })).toBe(
      '2026.3.23',
    );
  });

  it('formats prerelease channels with semver suffixes', () => {
    const date = new Date('2026-03-23T12:00:00+08:00');
    expect(formatDateVersion({ date, channel: 'beta' })).toBe('2026.3.23-beta.0');
    expect(formatDateVersion({ date, channel: 'dev' })).toBe('2026.3.23-dev.0');
  });

  it('rejects unsupported release channels', () => {
    expect(() =>
      formatDateVersion({ date: new Date('2026-03-23T12:00:00+08:00'), channel: 'nightly' }),
    ).toThrow('Unsupported release channel: nightly');
  });

  it('ignores the pnpm argument separator when parsing cli flags', () => {
    const { channel, date } = parseVersionDateArgs(['--', '--channel', 'beta', '--date', '2026-03-23']);
    expect(channel).toBe('beta');
    expect(formatDateVersion({ date, channel })).toBe('2026.3.23-beta.0');
  });
});
