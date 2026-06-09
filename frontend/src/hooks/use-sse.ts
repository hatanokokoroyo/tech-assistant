import { useState, useRef, useCallback } from "react";
import { useAuthStore } from "@/stores/auth-store";

export type StreamEventType =
  | "text"
  | "reasoning"
  | "tool_call_progress"
  | "tool_result";

interface UseSSEOptions {
  onToken?: (type: StreamEventType, content: string) => void;
  onMessageStart?: () => void;
  onMessageEnd?: () => void;
  onError?: (error: Error) => void;
}

export function useSSE(options: UseSSEOptions) {
  const [isStreaming, setIsStreaming] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const send = useCallback(
    async (conversationId: number, content: string) => {
      if (isStreaming) return;

      const token = useAuthStore.getState().token;
      const controller = new AbortController();
      abortControllerRef.current = controller;
      setIsStreaming(true);
      options.onMessageStart?.();

      try {
        const res = await fetch(
          `/api/conversations/${conversationId}/stream`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({ content }),
            signal: controller.signal,
          },
        );

        if (!res.ok) {
          throw new Error(`SSE 请求失败: ${res.status}`);
        }

        const reader = res.body?.getReader();
        if (!reader) throw new Error("无法读取响应流");

        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          // SSE 规范：事件以 \n\n 分隔
          const parts = buffer.split("\n\n");
          buffer = parts.pop() || ""; // 最后一个不完整的部分保留

          for (const part of parts) {
            if (!part.trim()) continue;

            let eventType = "";
            let dataLines: string[] = [];

            for (const line of part.split("\n")) {
              if (line.startsWith("event: ")) {
                eventType = line.slice(7).trim();
              } else if (line.startsWith("data: ")) {
                dataLines.push(line.slice(6));
              } else if (line.startsWith("data:")) {
                dataLines.push(line.slice(5));
              }
            }

            if (!eventType || !dataLines.length) continue;
            const dataStr = dataLines.join("\n");

            try {
              const data = JSON.parse(dataStr);

              if (eventType === "message_start") {
                options.onMessageStart?.();
              } else if (eventType === "token" && data.type) {
                // 后端 token 事件的 type: text / reasoning / tool_call_progress / tool_result
                options.onToken?.(
                  data.type as StreamEventType,
                  data.content || "",
                );
              } else if (eventType === "message_end") {
                options.onMessageEnd?.();
              }
            } catch {
              // skip malformed JSON
            }
          }
        }
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          options.onError?.(err as Error);
        }
      } finally {
        setIsStreaming(false);
        abortControllerRef.current = null;
      }
    },
    [isStreaming, options],
  );

  const abort = useCallback(() => {
    abortControllerRef.current?.abort();
    setIsStreaming(false);
  }, []);

  return { send, abort, isStreaming };
}
