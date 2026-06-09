import { useState, useCallback, useRef, useEffect } from "react";
import { useParams } from "react-router";
import { Loader2, MessageSquare, StopCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMessages } from "@/queries/use-conversations";
import { useSSE, type StreamEventType } from "@/hooks/use-sse";
import { useAutoScroll } from "@/hooks/use-auto-scroll";
import type { Message, ToolCallInfo } from "@/api/conversations";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export default function ChatView() {
  const { conversationId } = useParams();
  const convId = Number(conversationId);

  const { data: messages, isLoading } = useMessages(convId);
  const [localMessages, setLocalMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const streamingContentRef = useRef({
    text: "",
    reasoning: "",
    toolCalls: [] as ToolCallInfo[],
  });
  const [, forceRender] = useState(0);

  // 同步服务端消息到本地
  useEffect(() => {
    if (messages) {
      setLocalMessages(messages);
    }
  }, [messages]);

  const { containerRef, handleScroll } = useAutoScroll([
    localMessages,
    streamingContentRef.current.text,
  ]);

  const { send, abort, isStreaming } = useSSE({
    onToken: useCallback((type: StreamEventType, content: string) => {
      if (type === "text") {
        streamingContentRef.current.text += content;
      } else if (type === "reasoning") {
        streamingContentRef.current.reasoning += content;
      } else if (type === "tool_call_progress") {
        // 简化处理：追加到最后一个 tool call 或创建新的
        const last =
          streamingContentRef.current.toolCalls[
            streamingContentRef.current.toolCalls.length - 1
          ];
        if (last && !last.result) {
          last.arguments += content;
        } else {
          streamingContentRef.current.toolCalls.push({
            id: String(Date.now()),
            name: "tool",
            arguments: content,
          });
        }
      } else if (type === "tool_result") {
        const last =
          streamingContentRef.current.toolCalls[
            streamingContentRef.current.toolCalls.length - 1
          ];
        if (last) {
          last.result = (last.result || "") + content;
        }
      }
      forceRender((n) => n + 1);
    }, []),
    onMessageEnd: useCallback(() => {
      const sc = streamingContentRef.current;
      const newMsg: Message = {
        id: Date.now(),
        conversation_id: convId,
        role: "assistant",
        content: sc.text,
        reasoning: sc.reasoning || undefined,
        tool_calls: sc.toolCalls.length ? sc.toolCalls : undefined,
        created_at: new Date().toISOString(),
      };
      setLocalMessages((prev) => [...prev, newMsg]);
      streamingContentRef.current = {
        text: "",
        reasoning: "",
        toolCalls: [],
      };
    }, [convId]),
    onError: useCallback((err: Error) => {
      console.error("SSE error:", err);
    }, []),
  });

  const handleSend = useCallback(async () => {
    const text = inputValue.trim();
    if (!text || isStreaming) return;

    const userMsg: Message = {
      id: Date.now(),
      conversation_id: convId,
      role: "user",
      content: text,
      created_at: new Date().toISOString(),
    };
    setLocalMessages((prev) => [...prev, userMsg]);
    setInputValue("");
    streamingContentRef.current = {
      text: "",
      reasoning: "",
      toolCalls: [],
    };
    await send(convId, text);
  }, [inputValue, isStreaming, convId, send]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  if (!conversationId) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        <div className="space-y-2 text-center">
          <MessageSquare className="mx-auto h-10 w-10 opacity-30" />
          <p className="text-sm">选择或创建一个对话</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* 消息列表 */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 py-4"
      >
        <div className="mx-auto max-w-3xl space-y-4">
          {localMessages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} />
          ))}

          {/* 流式输出中的消息 */}
          {isStreaming && (
            <div className="flex gap-3">
              <div className="h-8 w-8 shrink-0 rounded-full bg-muted flex items-center justify-center text-xs">
                🤖
              </div>
              <div className="min-w-0 flex-1 space-y-2">
                {streamingContentRef.current.reasoning && (
                  <CollapsibleBlock
                    title="思考过程"
                    defaultOpen={false}
                    variant="reasoning"
                  >
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                      {streamingContentRef.current.reasoning}
                    </p>
                  </CollapsibleBlock>
                )}
                {streamingContentRef.current.text && (
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {streamingContentRef.current.text}
                    </ReactMarkdown>
                  </div>
                )}
                <span className="inline-block h-4 w-0.5 animate-pulse bg-foreground" />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 输入区 */}
      <div className="border-t p-4">
        <div className="mx-auto max-w-3xl">
          <div className="flex gap-2">
            <textarea
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="输入消息... (Enter 发送, Shift+Enter 换行)"
              className="min-h-[40px] max-h-[160px] flex-1 resize-none rounded-lg border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              rows={1}
            />
            {isStreaming ? (
              <Button
                variant="destructive"
                size="icon"
                className="shrink-0"
                onClick={abort}
              >
                <StopCircle className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                className="shrink-0"
                onClick={handleSend}
                disabled={!inputValue.trim()}
              >
                发送
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── 消息气泡 ──
function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === "user";

  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : ""}`}>
      <div
        className={`h-8 w-8 shrink-0 rounded-full flex items-center justify-center text-xs ${
          isUser ? "bg-primary/10 text-primary" : "bg-muted"
        }`}
      >
        {isUser ? "👤" : "🤖"}
      </div>
      <div
        className={`min-w-0 max-w-[80%] space-y-2 ${
          isUser ? "text-right" : ""
        }`}
      >
        {message.reasoning && (
          <CollapsibleBlock
            title="思考过程"
            defaultOpen={false}
            variant="reasoning"
          >
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
              {message.reasoning}
            </p>
          </CollapsibleBlock>
        )}
        <div
          className={`inline-block rounded-lg px-3 py-2 text-sm ${
            isUser
              ? "bg-primary text-primary-foreground"
              : "bg-muted"
          }`}
        >
          {isUser ? (
            <p className="whitespace-pre-wrap">{message.content}</p>
          ) : (
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {message.content}
              </ReactMarkdown>
            </div>
          )}
        </div>
        {message.tool_calls?.map((tc) => (
          <CollapsibleBlock
            key={tc.id}
            title={`🔧 ${tc.name}`}
            defaultOpen={false}
            variant="tool"
          >
            <pre className="overflow-x-auto text-xs text-muted-foreground">
              {tc.arguments}
            </pre>
            {tc.result && (
              <pre className="mt-2 overflow-x-auto border-t pt-2 text-xs text-muted-foreground">
                {tc.result}
              </pre>
            )}
          </CollapsibleBlock>
        ))}
      </div>
    </div>
  );
}

// ── 折叠块 ──
function CollapsibleBlock({
  title,
  defaultOpen = false,
  variant,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  variant: "reasoning" | "tool";
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  const borderColor =
    variant === "reasoning" ? "border-l-warning" : "border-l-primary";

  return (
    <div className={`rounded-md border-l-2 ${borderColor} bg-muted/50`}>
      <button
        className="flex w-full items-center gap-1 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
        onClick={() => setOpen(!open)}
      >
        <span
          className={`transition-transform ${open ? "rotate-90" : ""}`}
        >
          ▶
        </span>
        {title}
      </button>
      {open && <div className="px-3 pb-2">{children}</div>}
    </div>
  );
}
