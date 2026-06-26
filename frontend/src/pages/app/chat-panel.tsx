import { useNavigate } from "react-router";
import { MessageSquare, Plus, Trash2, Shield, BarChart3 } from "lucide-react";
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
import {
  useConversations,
  useCreateConversation,
  useDeleteConversation,
  useConversation,
} from "@/queries/use-conversations";
import {
  useSSE,
  type StreamEventType,
  type ApprovalRequestEvent,
  type ToolCallEvent,
  type ToolResultEvent,
  type ToolDeniedEvent,
} from "@/hooks/use-sse";
import { useAutoScroll } from "@/hooks/use-auto-scroll";
import type { Message, StreamingEvent, UsageInfo } from "@/api/conversations";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "@/lib/format";
import { useState, useCallback, useRef, useEffect } from "react";
import MarkdownContent from "@/components/chat/markdown-content";
import {
  ToolApprovalDialog,
  type ApprovalRequest,
} from "@/components/app/tool-approval-dialog";
import UsagePanel from "@/components/chat/usage-panel";
import { toolPermissionApi } from "@/api/tool-permissions";
import { toast } from "sonner";

export function ChatPanelHeader({ pid }: { pid: number }) {
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
    <div className="border-b border-border/70 px-4 py-3">
      <div className="flex items-center justify-between gap-3 rounded-[14px] border border-border/70 bg-panel px-3 py-3 shadow-sm">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground/80">
            Conversations
          </p>
          <h2 className="mt-1 text-sm font-semibold text-foreground">对话历史</h2>
        </div>
        <Button
          variant="secondary"
          size="sm"
          className="gap-1.5"
          onClick={handleCreate}
          disabled={createConversation.isPending}
        >
          <Plus className="h-3.5 w-3.5" />
          新建
        </Button>
      </div>
    </div>
  );
}

export function ChatListContent({
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
      <div className="space-y-2 p-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-[76px] animate-pulse rounded-[16px] bg-panel" />
        ))}
      </div>
    );
  }

  if (!conversations?.length) {
    return (
      <div className="px-4 py-10">
        <div className="rounded-[18px] border border-dashed border-border/80 bg-panel px-5 py-8 text-center shadow-sm">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-[16px] bg-primary-soft text-primary">
            <MessageSquare className="h-5 w-5" />
          </div>
          <p className="text-sm font-medium text-foreground">还没有对话</p>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            新建一个会话，开始与 AI 协作处理文件、仓库和开发任务。
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-2 p-3">
        {conversations.map((conv) => {
          const active = currentConvId === conv.id;
          return (
            <div
              key={conv.id}
              className={cn(
                "group relative cursor-pointer rounded-[16px] border px-3 py-3 transition-all",
                active
                  ? "border-primary/30 bg-panel-elevated shadow-sm ring-1 ring-primary/10"
                  : "border-transparent bg-transparent hover:border-border/80 hover:bg-panel/80",
              )}
              onClick={() => navigate(`/projects/${pid}/chat/${conv.id}`)}
            >
              <span
                className={cn(
                  "absolute inset-y-3 left-0 w-0.5 rounded-full bg-primary transition-opacity",
                  active ? "opacity-100" : "opacity-0 group-hover:opacity-60",
                )}
              />
              <div className="flex items-start gap-3">
                <div
                  className={cn(
                    "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px]",
                    active ? "bg-primary-soft text-primary" : "bg-panel text-muted-foreground",
                  )}
                >
                  <MessageSquare className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="truncate text-sm font-medium text-foreground">
                      {conv.title || "新对话"}
                    </p>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0 rounded-[10px] opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteTarget(conv.id);
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                    </Button>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {conv.message_count ?? 0} 条消息
                    {conv.updated_at &&
                      ` · ${formatDistanceToNow(new Date(conv.updated_at))}`}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
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

export function ChatViewContent({ convId, pid }: { convId: number; pid: number }) {
  const navigate = useNavigate();

  const { data: conversation, isLoading } = useConversation(convId);
  const [localMessages, setLocalMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const streamingRef = useRef({
    events: [] as StreamingEvent[],
    reasoning: "",
  });
  const [, forceRender] = useState(0);

  const [approvalRequests, setApprovalRequests] = useState<ApprovalRequest[]>([]);
  const [showApproval, setShowApproval] = useState(false);
  const pendingApprovalsRef = useRef<ApprovalRequest[]>([]);
  const submittedRef = useRef(false);

  const [showUsage, setShowUsage] = useState(true);
  const [usageInfo, setUsageInfo] = useState<UsageInfo | null>(null);
  const hasReceivedLiveUsage = useRef(false);

  useEffect(() => {
    setUsageInfo(null);
    setLocalMessages([]);
    setInputValue("");
    streamingRef.current = { events: [], reasoning: "" };
    hasReceivedLiveUsage.current = false;
  }, [convId]);

  useEffect(() => {
    if (conversation?.messages) {
      setLocalMessages(conversation.messages);
    }
  }, [conversation]);

  useEffect(() => {
    if (
      conversation &&
      conversation.total_tokens &&
      conversation.total_tokens > 0 &&
      !hasReceivedLiveUsage.current &&
      usageInfo === null
    ) {
      const lastAssistant = [...(conversation.messages || [])]
        .reverse()
        .find((m) => m.role === "assistant" && m.total_tokens);
      setUsageInfo({
        round_prompt_tokens: lastAssistant?.prompt_tokens || 0,
        round_completion_tokens: lastAssistant?.completion_tokens || 0,
        round_total_tokens: lastAssistant?.total_tokens || 0,
        round_cache_hit_tokens: null,
        round_cache_miss_tokens: null,
        round_cost: lastAssistant?.cost || 0,
        total_prompt_tokens: conversation.total_prompt_tokens || 0,
        total_completion_tokens: conversation.total_completion_tokens || 0,
        total_tokens: conversation.total_tokens || 0,
        total_cache_hit_tokens: conversation.total_cache_hit_tokens || 0,
        total_cost: conversation.total_cost || 0,
        api_rounds: conversation.total_api_rounds || 0,
        model: undefined,
      });
    }
  }, [conversation, usageInfo]);

  const { containerRef, handleScroll } = useAutoScroll([
    localMessages,
    streamingRef.current.events,
  ]);

  const { send, abort, isStreaming } = useSSE({
    onToken: useCallback((type: StreamEventType, content: string) => {
      if (type === "text") {
        streamingRef.current.events.push({ type: "text", content });
      } else if (type === "reasoning") {
        streamingRef.current.reasoning += content;
      }
      forceRender((n) => n + 1);
    }, []),
    onToolCall: useCallback((event: ToolCallEvent) => {
      const evts = streamingRef.current.events;
      const idx = evts.findIndex(
        (e) => e.type === "tool_call" && e.tool_call_id === event.tool_call_id,
      );
      if (idx >= 0) {
        evts[idx] = { type: "tool_call", ...event };
      } else {
        evts.push({ type: "tool_call", ...event });
      }
      forceRender((n) => n + 1);
    }, []),
    onToolResult: useCallback((event: ToolResultEvent) => {
      streamingRef.current.events.push({ type: "tool_result", ...event });
      forceRender((n) => n + 1);
    }, []),
    onMessageEnd: useCallback((aborted?: boolean) => {
      const sc = streamingRef.current;
      const hasEvents = sc.events.length > 0 || aborted;
      if (hasEvents) {
        const textParts: string[] = [];
        const toolCallsForMsg: Message["tool_calls"] = [];
        for (const ev of sc.events) {
          if (ev.type === "text") textParts.push(ev.content);
          else if (ev.type === "tool_call") {
            toolCallsForMsg!.push({
              id: ev.tool_call_id,
              type: "function",
              function: { name: ev.tool_name, arguments: ev.arguments || "" },
            });
          }
        }
        const newMsg: Message = {
          id: Date.now(),
          role: "assistant",
          content: textParts.length > 0 ? textParts.join("") : null,
          tool_calls: toolCallsForMsg!.length > 0 ? toolCallsForMsg : null,
          events: [...sc.events],
          created_at: new Date().toISOString(),
        };
        setLocalMessages((prev) => [...prev, newMsg]);
      }
      streamingRef.current = { events: [], reasoning: "" };
      pendingApprovalsRef.current = [];
      setApprovalRequests([]);
      setShowApproval(false);
      submittedRef.current = false;
    }, []),
    onError: useCallback((err: Error) => {
      console.error("SSE error:", err);
    }, []),
    onToolApprovalRequired: useCallback((req: ApprovalRequestEvent) => {
      if (submittedRef.current) {
        pendingApprovalsRef.current = [];
      }
      submittedRef.current = false;
      pendingApprovalsRef.current = [
        ...pendingApprovalsRef.current,
        {
          tool_call_id: req.tool_call_id,
          tool_name: req.tool_name,
          arguments: req.arguments,
        },
      ];
      setApprovalRequests([...pendingApprovalsRef.current]);
      setShowApproval(true);
    }, []),
    onToolDenied: useCallback((event: ToolDeniedEvent) => {
      toast.error(
        `工具 ${event.tool_name} 被拒绝：${event.reason === "policy_deny" ? "项目策略禁止" : "已拒绝"}`,
      );
    }, []),
    onUsageInfo: useCallback((usage: UsageInfo) => {
      hasReceivedLiveUsage.current = true;
      setUsageInfo(usage);
    }, []),
  });

  const handleApprovalSubmit = useCallback(
    async (
      decisions: {
        tool_call_id: string;
        decision: "approved" | "denied";
        scope: "once" | "conversation";
      }[],
    ) => {
      submittedRef.current = true;
      setShowApproval(false);

      for (const d of decisions) {
        try {
          await toolPermissionApi.approve(convId, {
            tool_call_id: d.tool_call_id,
            decision: d.decision,
            scope: d.scope,
          });
        } catch {
          toast.error(`审批提交失败: ${d.tool_call_id}`);
        }
      }
    },
    [convId],
  );

  const handleApprovalCancel = useCallback(() => {
    if (submittedRef.current) return;
    const decisions = pendingApprovalsRef.current.map((r) => ({
      tool_call_id: r.tool_call_id,
      decision: "denied" as const,
      scope: "once" as const,
    }));
    handleApprovalSubmit(decisions);
  }, [handleApprovalSubmit]);

  const handleSend = useCallback(async () => {
    const text = inputValue.trim();
    if (!text || isStreaming) return;
    setLocalMessages((prev) => [
      ...prev,
      {
        id: Date.now(),
        role: "user",
        content: text,
        created_at: new Date().toISOString(),
      },
    ]);
    setInputValue("");
    streamingRef.current = { events: [], reasoning: "" };
    pendingApprovalsRef.current = [];
    setApprovalRequests([]);
    hasReceivedLiveUsage.current = false;
    await send(convId, text);
  }, [inputValue, isStreaming, convId, send]);

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center bg-panel-elevated">
        <div className="flex items-center gap-3 rounded-[18px] border border-border/80 bg-panel px-5 py-4 shadow-sm">
          <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-muted-foreground/50 border-t-transparent" />
          <span className="text-sm text-muted-foreground">正在加载对话...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden">
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-panel-elevated">
        <div className="border-b border-border/70 bg-panel/75 px-4 py-3 backdrop-blur-sm">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 rounded-[16px] border border-border/70 bg-panel-elevated px-4 py-3 shadow-sm">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground/80">
                Active conversation
              </p>
              <h3 className="mt-1 truncate text-sm font-semibold text-foreground">
                {conversation?.title || "新对话"}
              </h3>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant={showUsage ? "secondary" : "ghost"}
                size="icon"
                className="h-9 w-9 rounded-[12px]"
                title="对话统计"
                onClick={() => setShowUsage(!showUsage)}
              >
                <BarChart3 className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 rounded-[12px]"
                title="项目权限设置"
                onClick={() => navigate(`/projects/${pid}/settings`)}
              >
                <Shield className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        <div
          ref={containerRef}
          onScroll={handleScroll}
          className="min-h-0 flex-1 overflow-y-auto px-5 py-5"
        >
          <div className="mx-auto max-w-5xl space-y-5">
            {localMessages.filter((m) => m.role !== "tool").length === 0 && !isStreaming ? (
              <ChatEmptyState />
            ) : (
              localMessages
                .filter((m) => m.role !== "tool")
                .map((msg) => <MessageBubble key={msg.id} message={msg} />)
            )}

            {isStreaming &&
              (streamingRef.current.events.length > 0 ||
                streamingRef.current.reasoning) && (
                <div className="flex gap-4">
                  <AssistantAvatar />
                  <div className="min-w-0 flex-1 space-y-3">
                    {streamingRef.current.reasoning && (
                      <CollapsibleBlock title="思考过程" variant="reasoning">
                        <p className="whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
                          {streamingRef.current.reasoning}
                        </p>
                      </CollapsibleBlock>
                    )}
                    <StreamingEventsList events={streamingRef.current.events} />
                    {streamingRef.current.events.length === 0 && (
                      <div className="rounded-[16px] border border-border/70 bg-panel px-4 py-3 text-sm text-muted-foreground shadow-sm">
                        <div className="flex items-center gap-2">
                          <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                          <span>AI 正在思考...</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
          </div>
        </div>

        <div className="border-t border-border/70 bg-panel/82 px-5 py-4 backdrop-blur-sm">
          <div className="mx-auto max-w-5xl rounded-[20px] border border-border/80 bg-panel-elevated p-3 shadow-sm">
            <div className="flex gap-3">
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
                className="min-h-[52px] max-h-[180px] flex-1 resize-none rounded-[14px] border border-input/90 bg-panel px-4 py-3 text-sm leading-6 shadow-sm placeholder:text-muted-foreground/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/80"
                rows={1}
              />
              {isStreaming ? (
                <Button
                  variant="destructive"
                  className="h-auto shrink-0 self-stretch px-5"
                  onClick={abort}
                >
                  停止
                </Button>
              ) : (
                <Button
                  className="h-auto shrink-0 self-stretch px-5"
                  onClick={handleSend}
                  disabled={!inputValue.trim()}
                >
                  发送
                </Button>
              )}
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              当前工作台支持流式回答、工具审批与用量统计，建议围绕单一任务保持对话连续性。
            </p>
          </div>
        </div>
      </div>

      {showUsage && <UsagePanel usage={usageInfo} onClose={() => setShowUsage(false)} />}

      <ToolApprovalDialog
        open={showApproval && approvalRequests.length > 0}
        requests={approvalRequests}
        onSubmit={handleApprovalSubmit}
        onCancel={handleApprovalCancel}
      />
    </div>
  );
}

function StreamingEventsList({ events }: { events: StreamingEvent[] }) {
  if (!events.length) return null;

  const merged: Array<{ key: string; node: React.ReactNode }> = [];
  let textBuffer = "";

  const flushText = () => {
    if (textBuffer) {
      merged.push({
        key: `text-${merged.length}`,
        node: (
          <div className="rounded-[18px] border border-border/70 bg-panel-elevated px-4 py-3 text-sm text-foreground shadow-sm">
            <MarkdownContent content={textBuffer} />
          </div>
        ),
      });
      textBuffer = "";
    }
  };

  for (const ev of events) {
    if (ev.type === "text") {
      textBuffer += ev.content;
    } else {
      flushText();
      if (ev.type === "tool_call") {
        merged.push({
          key: `tc-${ev.tool_call_id}`,
          node: (
            <CollapsibleBlock title={`工具调用 · ${ev.tool_name}`} variant="tool">
              <pre className="overflow-x-auto rounded-[12px] bg-panel px-3 py-3 text-xs leading-6 text-muted-foreground">
                {ev.arguments}
              </pre>
            </CollapsibleBlock>
          ),
        });
      } else if (ev.type === "tool_result") {
        merged.push({
          key: `tr-${ev.tool_call_id}`,
          node: (
            <CollapsibleBlock title={`工具结果 · ${ev.tool_name}`} variant="tool">
              <pre className="overflow-x-auto rounded-[12px] bg-panel px-3 py-3 text-xs leading-6 text-muted-foreground">
                {ev.content}
              </pre>
            </CollapsibleBlock>
          ),
        });
      } else if (ev.type === "reasoning") {
        merged.push({
          key: `reason-${merged.length}`,
          node: (
            <CollapsibleBlock title="思考过程" variant="reasoning">
              <p className="whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
                {ev.content}
              </p>
            </CollapsibleBlock>
          ),
        });
      }
    }
  }
  flushText();

  return <div className="space-y-3">{merged.map((item) => <div key={item.key}>{item.node}</div>)}</div>;
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === "user";

  return (
    <div className={cn("flex gap-4", isUser && "flex-row-reverse")}>
      {isUser ? <UserAvatar /> : <AssistantAvatar />}
      <div className={cn("min-w-0 max-w-[82%] space-y-3", isUser && "text-right")}>
        {message.events && message.events.length > 0 ? (
          <StreamingEventsList events={message.events} />
        ) : (
          <>
            <div
              className={cn(
                "inline-block max-w-full rounded-[18px] border px-4 py-3 text-sm leading-6 shadow-sm",
                isUser
                  ? "border-primary/20 bg-primary text-primary-foreground"
                  : "border-border/70 bg-panel-elevated text-foreground",
              )}
            >
              {isUser ? (
                <p className="whitespace-pre-wrap">{message.content}</p>
              ) : (
                <MarkdownContent content={message.content || ""} />
              )}
            </div>
            {message.tool_calls?.map((tc) => (
              <CollapsibleBlock
                key={tc.id}
                title={`工具调用 · ${tc.function.name}`}
                variant="tool"
              >
                <pre className="overflow-x-auto rounded-[12px] bg-panel px-3 py-3 text-xs leading-6 text-muted-foreground">
                  {tc.function.arguments}
                </pre>
              </CollapsibleBlock>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

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
  const styles =
    variant === "reasoning"
      ? "border-warning/30 bg-warning/5"
      : "border-primary/18 bg-primary/5";

  return (
    <div className={cn("rounded-[16px] border shadow-sm", styles)}>
      <button
        className="flex w-full items-center gap-2 px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground transition-colors hover:text-foreground"
        onClick={() => setOpen(!open)}
      >
        <span className={cn("transition-transform", open && "rotate-90")}>▶</span>
        {title}
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}

function ChatEmptyState() {
  return (
    <div className="rounded-[24px] border border-dashed border-border/80 bg-panel px-8 py-10 text-center shadow-sm">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-[18px] bg-primary-soft text-primary">
        <MessageSquare className="h-6 w-6" />
      </div>
      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground/75">
        AI Collaboration
      </p>
      <h3 className="mt-3 text-xl font-semibold text-foreground">开始一个新的开发对话</h3>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        在这里描述你的需求、贴出错误信息，或让 AI 协助你浏览文件、执行工具和推进任务。
      </p>
    </div>
  );
}

function AssistantAvatar() {
  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] border border-border/70 bg-panel text-sm shadow-sm">
      🤖
    </div>
  );
}

function UserAvatar() {
  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] border border-primary/18 bg-primary-soft text-sm text-primary shadow-sm">
      👤
    </div>
  );
}
