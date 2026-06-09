import { useState, useRef, useCallback } from "react";
import { useAuthStore } from "@/stores/auth-store";

export type StreamEventType =
  | "text"
  | "reasoning"
  | "tool_call_progress"
  | "tool_result"
  | "done";

export interface StreamEvent {
  type: StreamEventType;
  content: string;
}

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
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          let currentEvent = "";

          for (const line of lines) {
            if (line.startsWith("event: ")) {
              currentEvent = line.slice(7).trim();
            } else if (line.startsWith("data: ") && currentEvent) {
              try {
                const data = JSON.parse(line.slice(6));

                if (currentEvent === "token" && data.type) {
                  options.onToken?.(data.type, data.content || "");
                } else if (currentEvent === "message_end") {
                  options.onMessageEnd?.();
                }
              } catch {
                // skip malformed JSON
              }
              currentEvent = "";
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
