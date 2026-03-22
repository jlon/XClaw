import { describe, expect, it } from 'vitest';

import {
  formatApprovalCommandReply,
  parseApprovalCommand,
} from '@/stores/chat/approval-command';

describe('chat approval command', () => {
  it('parses canonical approve commands', () => {
    expect(parseApprovalCommand('/approve 08d6b8cd allow-once')).toEqual({
      id: '08d6b8cd',
      decision: 'allow-once',
    });
    expect(parseApprovalCommand('/approve allow-always 08d6b8cd')).toEqual({
      id: '08d6b8cd',
      decision: 'allow-always',
    });
  });

  it('accepts the common /aprove typo and normalizes aliases', () => {
    expect(parseApprovalCommand('/aprove 08d6b8cd allow')).toEqual({
      id: '08d6b8cd',
      decision: 'allow-once',
    });
    expect(parseApprovalCommand('/approve 08d6b8cd reject')).toEqual({
      id: '08d6b8cd',
      decision: 'deny',
    });
  });

  it('returns usage errors for invalid approval commands', () => {
    expect(parseApprovalCommand('/approve')).toEqual({
      error: 'Usage: /approve <id> allow-once|allow-always|deny',
    });
    expect(parseApprovalCommand('/approve abc maybe')).toEqual({
      error: 'Usage: /approve <id> allow-once|allow-always|deny',
    });
  });

  it('formats approval replies like OpenClaw command responses', () => {
    expect(formatApprovalCommandReply('08d6b8cd', 'allow-once')).toBe(
      'Exec approval allow-once submitted for 08d6b8cd.',
    );
  });
});
