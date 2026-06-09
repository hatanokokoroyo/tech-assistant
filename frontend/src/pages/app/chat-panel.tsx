import { useNavigate, useParams } from "react-router";
import { MessageSquare, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import PanelLayout from "@/components/shared/panel-layout";
import {
  useConversations,
  useCreateConversation,
  useDeleteConversation,
  useConversation,
} from "@/queries/use-conversations";
import { useSSE, type StreamEventType } from "@/hooks/use-sse";
import { useAutoScroll } from "@/hooks/use-auto-scroll";
import type { Message } from "@/api/conversations";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "@/lib/format";
import { useState, useCallback, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export default function ChatPanel() {
  const { projectId, conversationId } = useParams();
  const pid = Number(projectId);
  const convId = conversationId ? Number(conversationId) : null;

  return (
    <PanelLayout
      activeTab="chat"
      middleHeader={
        <ChatPanelHeader pid={pid} />
      }
      middleContent={
        <ChatListContent pid={pid} currentConvId={convId} />
      }
      rightContent={
        convId ? (
          <ChatViewContent convId={convId} />
        ) : (
          <div className="flex flex-1 items-center justify-center text-muted-foreground">
            <div className="space-y-2 text-center">
              <MessageSquare className="mx-auto h-10 w-10 opacity-30" />
              <p className="text-sm">选择或创建一个对话</p>
            </div>
          </div>
        )
      }
    />
  );
}

// ── 中栏标题 + 新建按钮 ──
function ChatPanelHeader({ pid }: { pid: number }) {
  const navigate = useNavigate();
  const createConversation = useCreateConversation(pid);

  const handleCreate = async () => {
    try {
      const conv = await createConversation.mutateAsync("新对话");
      navigate(`/projects/${pid}/chat/${conv.id}`);
    } catch {
      // handled
    }
  };

  return (
    <div className="flex items-center justify-between border-b px-3 py-2">
      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
        对话
      </span>
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6"
        onClick={handleCreate}
        disabled={createConversation.isPending}
      >
        <Plus className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

// ── 中栏会话列表 ──
function ChatListContent({
  pid,
  currentConvId,
}: {
  pid: number;
  currentConvId: number | null;
}) {
  const navigate = useNavigate();
  const { data: conversations, isLoading } = useConversations(pid);
  const deleteConversation = useDeleteConversation(pid);
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);

  const handleDelete = async () => {
    if (deleteTarget === null) return;
    try {
      await deleteConversation.mutateAsync(deleteTarget);
      if (currentConvId === deleteTarget) {
        navigate(`/projects/${pid}/chat`);
      }
    } catch {
      // handled
    }
    setDeleteTarget(null);
  };

  if (isLoading) {
    return (
      <div className="space-y-1 p-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-14 animate-pulse rounded-md bg-muted" />
        ))}
      </div>
    );
  }

  if (!conversations?.length) {
    return (
      <div className="flex flex-col items-center py-12 text-center">
        <MessageSquare className="mb-2 h-8 w-8 text-muted-foreground/30" />
        <p className="text-xs text-muted-foreground">还没有对话</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-0.5 p-1">
        {conversations.map((conv) => (
          <div
            key={conv.id}
            className={cn(
              "group flex cursor-pointer items-center gap-2 rounded-md px-3 py-2.5 transition-colors hover:bg-accent",
              currentConvId === conv.id && "bg-accent",
            )}
            onClick={() => navigate(`/projects/${pid}/chat/${conv.id}`)}
          >
            <MessageSquare className="h-4 w-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm">{conv.title || "新对话"}</p>
              <p className="text-xs text-muted-foreground">
                {conv.message_count ?? 0} 条消息
                {conv.updated_at && ` · ${formatDistanceToNow(new Date(conv.updated_at))}`}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
              onClick={(e) => {
                e.stopPropagation();
                setDeleteTarget(conv.id);
              }}
            >
              <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
            </Button>
          </div>
        ))}
      </div>

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={() => setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除对话</AlertDialogTitle>
            <AlertDialogDescription>
              确定删除此对话？所有消息将被清除，此操作不可恢复。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// ── 右栏对话视图 ──
function ChatViewContent({ convId }: { convId: number }) {
  const { data: conversation, isLoading } = useConversation(convId);
  const [localMessages, setLocalMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const streamingRef = useRef({ text: "", reasoning: "" });
  const [, forceRender] = useState(0);

  // 同步服务端消息
  useEffect(() => {
    if (conversation?.messages) {
      setLocalMessages(conversation.messages);
    }
  }, [conversation]);

  const { containerRef, handleScroll } = useAutoScroll([
    localMessages,
    streamingRef.current.text,
  ]);

  const { send, abort, isStreaming } = useSSE({
    onToken: useCallback((type: StreamEventType, content: string) => {
      if (type === "text") streamingRef.current.text += content;
      else if (type === "reasoning") streamingRef.current.reasoning += content;
      forceRender((n) => n + 1);
    }, []),
    onMessageEnd: useCallback(() => {
      const sc = streamingRef.current;
      if (sc.text) {
        const newMsg: Message = {
          id: Date.now(),
          role: "assistant",
          content: sc.text,
          created_at: new Date().toISOString(),
        };
        setLocalMessages((prev) => [...prev, newMsg]);
      }
      streamingRef.current = { text: "", reasoning: "" };
    }, []),
    onError: useCallback((err: Error) => {
      console.error("SSE error:", err);
    }, []),
  });

  const handleSend = useCallback(async () => {
    const text = inputValue.trim();
    if (!text || isStreaming) return;
    setLocalMessages((prev) => [
      ...prev,
      { id: Date.now(), role: "user", content: text, created_at: new Date().toISOString() },
    ]);
    setInputValue("");
    streamingRef.current = { text: "", reasoning: "" };
    await send(convId, text);
  }, [inputValue, isStreaming, convId, send]);

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      {/* 消息列表 */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 py-4"
      >
        <div className="mx-auto max-w-3xl space-y-4">
          {localMessages.filter(m => m.role !== "tool").map((msg) => (
            <MessageBubble key={msg.id} message={msg} />
          ))}
          {isStreaming && streamingRef.current.text && (
            <div className="flex gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs">
                🤖
              </div>
              <div className="min-w-0 flex-1 space-y-2">
                {streamingRef.current.reasoning && (
                  <CollapsibleBlock title="思考过程" variant="reasoning">
                    <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                      {streamingRef.current.reasoning}
                    </p>
                  </CollapsibleBlock>
                )}
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {streamingRef.current.text}
                  </ReactMarkdown>
                </div>
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
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="输入消息... (Enter 发送, Shift+Enter 换行)"
              className="min-h-[40px] max-h-[160px] flex-1 resize-none rounded-lg border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              rows={1}
            />
            {isStreaming ? (
              <Button variant="destructive" className="shrink-0" onClick={abort}>
                停止
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
    <div className={cn("flex gap-3", isUser && "flex-row-reverse")}>
      <div
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs",
          isUser ? "bg-primary/10 text-primary" : "bg-muted",
        )}
      >
        {isUser ? "👤" : "🤖"}
      </div>
      <div className={cn("min-w-0 max-w-[80%] space-y-2", isUser && "text-right")}>
        <div
          className={cn(
            "inline-block rounded-lg px-3 py-2 text-sm",
            isUser ? "bg-primary text-primary-foreground" : "bg-muted",
          )}
        >
          {isUser ? (
            <p className="whitespace-pre-wrap">{message.content}</p>
          ) : (
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {message.content || ""}
              </ReactMarkdown>
            </div>
          )}
        </div>
        {message.tool_calls?.map((tc) => (
          <CollapsibleBlock
            key={tc.id}
            title={`🔧 ${tc.function.name}`}
            variant="tool"
          >
            <pre className="overflow-x-auto text-xs text-muted-foreground">
              {tc.function.arguments}
            </pre>
          </CollapsibleBlock>
        ))}
      </div>
    </div>
  );
}

// ── 折叠块 ──
function CollapsibleBlock({
  title,
  variant,
  children,
}: {
  title: string;
  variant: "reasoning" | "tool";
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const borderColor = variant === "reasoning" ? "border-l-warning" : "border-l-primary";

  return (
    <div className={cn("rounded-md border-l-2 bg-muted/50", borderColor)}>
      <button
        className="flex w-full items-center gap-1 px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
        onClick={() => setOpen(!open)}
      >
        <span className={cn("transition-transform", open && "rotate-90")}>▶</span>
        {title}
      </button>
      {open && <div className="px-3 pb-2">{children}</div>}
    </div>
  );
}

