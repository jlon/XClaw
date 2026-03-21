import { act, render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useStickToBottomInstant } from '@/hooks/use-stick-to-bottom-instant';

const { hookResult, useStickToBottomMock } = vi.hoisted(() => ({
  hookResult: {
    scrollRef: { current: null as HTMLDivElement | null },
    contentRef: { current: null as HTMLDivElement | null },
  },
  useStickToBottomMock: vi.fn(),
}));

vi.mock('use-stick-to-bottom', () => ({
  useStickToBottom: useStickToBottomMock,
}));

function HookHarness({ resetKey, height }: { resetKey?: string; height: number }) {
  const { scrollRef } = useStickToBottomInstant(resetKey);

  return (
    <div
      ref={(node) => {
        scrollRef.current = node;
        if (!node) return;
        Object.defineProperty(node, 'scrollHeight', { configurable: true, value: height });
        Object.defineProperty(node, 'scrollTop', { configurable: true, writable: true, value: 0 });
      }}
    />
  );
}

describe('useStickToBottomInstant', () => {
  beforeEach(() => {
    hookResult.scrollRef.current = null;
    hookResult.contentRef.current = null;
    useStickToBottomMock.mockReset();
    useStickToBottomMock.mockReturnValue(hookResult);
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => undefined);
  });

  it('scrolls to the current bottom on first paint without hiding the scroller', () => {
    render(<HookHarness resetKey="agent:main:thread-1" height={640} />);

    expect(hookResult.scrollRef.current).toBeTruthy();
    expect(hookResult.scrollRef.current?.scrollTop).toBe(640);
  });

  it('re-initializes when the session key changes', () => {
    const { rerender } = render(<HookHarness resetKey="agent:main:thread-1" height={480} />);

    expect(hookResult.scrollRef.current?.scrollTop).toBe(480);

    act(() => {
      rerender(<HookHarness resetKey="agent:main:thread-2" height={920} />);
    });

    expect(hookResult.scrollRef.current?.scrollTop).toBe(920);
  });
});
