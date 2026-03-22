import { describe, expect, it } from 'vitest';
import { extractText, isSystemRuntimeMessage } from '@/pages/Chat/message-utils';
import type { RawMessage } from '@/stores/chat';

describe('chat message utils', () => {
  it('strips assistant think tags from string content', () => {
    const message: RawMessage = {
      role: 'assistant',
      content: '<think>hidden reasoning</think>\nVisible answer',
    };

    expect(extractText(message)).toBe('Visible answer');
  });

  it('removes runtime context lines from assistant text content', () => {
    const message: RawMessage = {
      role: 'assistant',
      content: [
        { type: 'text', text: 'OpenClaw runtime context (internal)' },
        { type: 'text', text: 'This context is runtime-generated, not user-authored' },
        { type: 'text', text: '最终答复' },
      ],
    };

    expect(extractText(message)).toBe('最终答复');
  });

  it('strips leading transport prefixes from user text content', () => {
    const message: RawMessage = {
      role: 'user',
      content: '[WhatsApp 2026-03-22 10:00] 你好',
    };

    expect(extractText(message)).toBe('你好');
  });

  it('detects runtime messages from __openclaw metadata even without a system role', () => {
    expect(isSystemRuntimeMessage({
      role: 'assistant',
      content: 'internal',
      __openclaw: { source: 'runtime' },
    })).toBe(true);
  });
});
