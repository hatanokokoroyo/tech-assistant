import { useState, useRef, useCallback } from "react";
import { useAuthStore } from "@/stores/auth-store";

export type StreamEventType =
  | "text"
  | "reasoning"
  | "tool_call_progress"
  | "tool_result";

export interface ApprovalRequestEvent {
  tool_call_id: string;
  tool_name: string;
  arguments: Record<string, unknown>;
}

export interface ToolDeniedEvent {
  tool_call_id: string;
  tool_name: string;
  reason: string;
}

interface UseSSEOptions {
  onToken?: (type: StreamEventType, content: string) => void;
  onMessageStart?: () => void;
  onMessageEnd?: () => void;
  onError?: (error: Error) => void;
  onToolApprovalRequired?: (req: ApprovalRequestEvent) => void;
  onToolDenied?: (event: ToolDeniedEvent) => void;
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

          const parts = buffer.split("\n\n");
          buffer = parts.pop() || "";

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
                options.onToken?.(
                  data.type as StreamEventType,
                  data.content || "",
                );
              } else if (eventType === "message_end") {
                options.onMessageEnd?.();
              } else if (eventType === "tool_approval_required") {
                options.onToolApprovalRequired?.({
                  tool_call_id: data.tool_call_id,
                  tool_name: data.tool_name,
                  arguments: data.arguments || {},
                });
              } else if (eventType === "tool_denied") {
                options.onToolDenied?.({
                  tool_call_id: data.tool_call_id,
                  tool_name: data.tool_name,
                  reason: data.reason || "unknown",
                });
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
