import { useEffect, useRef, useCallback } from "react";

export function useAutoScroll(deps: React.DependencyList) {
  const containerRef = useRef<HTMLDivElement>(null);
  const shouldAutoScroll = useRef(true);

  const scrollToBottom = useCallback(() => {
    const el = containerRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (shouldAutoScroll.current) {
      scrollToBottom();
    }
  }, deps);

  const handleScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const isAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 50;
    shouldAutoScroll.current = isAtBottom;
  }, []);

  return { containerRef, scrollToBottom, handleScroll };
}
