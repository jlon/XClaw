import { describe, expect, it } from 'vitest';
import { parseStudioIdentityName } from '@electron/studio/identity-name';

describe('parseStudioIdentityName', () => {
  it('parses plain Chinese name fields from identity files', () => {
    expect(parseStudioIdentityName('# IDENTITY.md\n- 名称：小飞龙\n')).toBe('小飞龙');
  });

  it('parses multiline markdown name fields', () => {
    expect(parseStudioIdentityName('# IDENTITY.md\n- **Name:**\n  主脑\n')).toBe('主脑');
  });

  it('ignores template placeholders instead of surfacing them as office names', () => {
    expect(parseStudioIdentityName('# IDENTITY.md\n- **Name:**\n  _(pick something you like)_\n')).toBeNull();
  });
});
