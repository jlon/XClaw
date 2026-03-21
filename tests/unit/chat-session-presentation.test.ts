import { describe, expect, it } from 'vitest';
import { deriveChatSessionPresentation } from '@/pages/Chat/session-presentation';

describe('chat session presentation', () => {
  it('separates a trailing id suffix from the visible session title', () => {
    expect(deriveChatSessionPresentation('john id:5937398060')).toEqual({
      title: 'john',
      sessionId: '5937398060',
    });
  });

  it('keeps ordinary session titles unchanged', () => {
    expect(deriveChatSessionPresentation('Design review')).toEqual({
      title: 'Design review',
      sessionId: null,
    });
  });
});
