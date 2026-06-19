import { useLayoutEffect, useRef, useCallback } from "react";

/**
 * 自动滚动到底部。
 * - 内容变化时自动滚动（新消息、流式输出）
 * - 用户手动向上滚动超过 50px 时暂停自动滚动
 * - 用户滚回底部（50px 内）时恢复自动滚动
 */
export function useAutoScroll(deps: React.DependencyList) {
  const containerRef = useRef<HTMLDivElement>(null);
  const shouldAutoScroll = useRef(true);

  const scrollToBottom = useCallback(() => {
    const el = containerRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, []);

  // 使用 useLayoutEffect 在 DOM 更新后、浏览器绘制前同步滚动，消除跳闪
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useLayoutEffect(() => {
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
