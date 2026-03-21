import { useEffect, useRef } from "react";
import { useStickToBottom } from "use-stick-to-bottom";

/**
 * A wrapper around useStickToBottom that ensures the initial scroll
 * to bottom happens instantly without any visible animation.
 *
 * @param resetKey - When this key changes, the scroll position will be reset to bottom instantly.
 *                   Typically this should be the conversation ID.
 */
export function useStickToBottomInstant(resetKey?: string) {
  const lastKeyRef = useRef(resetKey);
  const hasInitializedRef = useRef(false);

  const result = useStickToBottom({
    initial: "instant",
    resize: "instant",
  });

  const { scrollRef } = result;

  // Reset initialization when key changes
  useEffect(() => {
    if (resetKey !== lastKeyRef.current) {
      hasInitializedRef.current = false;
      lastKeyRef.current = resetKey;
    }
  }, [resetKey]);

  // Scroll to bottom instantly on mount or when key changes
  useEffect(() => {
    if (hasInitializedRef.current) return;

    const scrollElement = scrollRef.current;
    if (!scrollElement) return;

    const frame = requestAnimationFrame(() => {
      scrollElement.scrollTop = scrollElement.scrollHeight;
      hasInitializedRef.current = true;
    });

    return () => cancelAnimationFrame(frame);
  }, [scrollRef, resetKey]);

  return result;
}
