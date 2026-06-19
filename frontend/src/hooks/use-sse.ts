import { useState, useRef, useCallback } from "react";
import { useAuthStore } from "@/stores/auth-store";
import type { UsageInfo } from "@/api/conversations";

export type StreamEventType =
  | "text"
  | "reasoning";

export interface ApprovalRequestEvent {
  tool_call_id: string;
  tool_name: string;
  arguments: Record<string, unknown>;
}

export interface ToolCallEvent {
  tool_call_id: string;
  tool_name: string;
  arguments: string;
}

export interface ToolResultEvent {
  tool_call_id: string;
  tool_name: string;
  content: string;
  is_error?: boolean;
}

export interface ToolDeniedEvent {
  tool_call_id: string;
  tool_name: string;
  reason: string;
}

interface UseSSEOptions {
  onToken?: (type: StreamEventType, content: string) => void;
  onMessageStart?: () => void;
  onMessageEnd?: (aborted?: boolean) => void;
  onError?: (error: Error) => void;
  onToolApprovalRequired?: (req: ApprovalRequestEvent) => void;
  onToolCall?: (event: ToolCallEvent) => void;
  onToolResult?: (event: ToolResultEvent) => void;
  onToolDenied?: (event: ToolDeniedEvent) => void;
  onUsageInfo?: (usage: UsageInfo) => void;
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
              } else if (eventType === "tool_call") {
                options.onToolCall?.({
                  tool_call_id: data.tool_call_id,
                  tool_name: data.tool_name,
                  arguments: data.arguments || "",
                });
              } else if (eventType === "tool_result") {
                options.onToolResult?.({
                  tool_call_id: data.tool_call_id,
                  tool_name: data.tool_name,
                  content: data.content || "",
                  is_error: data.is_error || false,
                });
              } else if (eventType === "tool_denied") {
                options.onToolDenied?.({
                  tool_call_id: data.tool_call_id,
                  tool_name: data.tool_name,
                  reason: data.reason || "unknown",
                });
              } else if (eventType === "usage_info") {
                options.onUsageInfo?.(data as unknown as UsageInfo);
              }
            } catch {
              // skip malformed JSON
            }
          }
        }
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          options.onError?.(err as Error);
        } else {
          // abort 时也触发 onMessageEnd(true) 让调用方能保存部分内容
          options.onMessageEnd?.(true);
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
