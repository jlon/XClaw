import { describe, expect, it } from 'vitest';
import { normalizeAccountId } from '../../shared/account-id';

describe('account id normalization', () => {
  it('falls back to default for blank values', () => {
    expect(normalizeAccountId('')).toBe('default');
    expect(normalizeAccountId('   ')).toBe('default');
    expect(normalizeAccountId(undefined)).toBe('default');
  });

  it('normalizes mixed characters into a stable lowercase id', () => {
    expect(normalizeAccountId('  WX Bot / IM  ')).toBe('wx-bot-im');
    expect(normalizeAccountId('Bot__Name')).toBe('bot__name');
  });

  it('blocks dangerous prototype keys', () => {
    expect(normalizeAccountId('__proto__')).toBe('default');
    expect(normalizeAccountId('constructor')).toBe('default');
  });
});
