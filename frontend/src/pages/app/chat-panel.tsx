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
import { useSSE, type StreamEventType, type ApprovalRequestEvent, type ToolCallEvent, type ToolResultEvent, type ToolDeniedEvent } from "@/hooks/use-sse";
import { useAutoScroll } from "@/hooks/use-auto-scroll";
import type { Message, StreamingEvent, UsageInfo } from "@/api/conversations";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "@/lib/format";
import { useState, useCallback, useRef, useEffect } from "react";
import MarkdownContent from "@/components/chat/markdown-content";
import { ToolApprovalDialog, type ApprovalRequest } from "@/components/app/tool-approval-dialog";
import UsagePanel from "@/components/chat/usage-panel";
import { toolPermissionApi } from "@/api/tool-permissions";
import { toast } from "sonner";
// ── 中栏标题 + 新建按钮 ──
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
export function ChatViewContent({ convId, pid }: { convId: number; pid: number }) {
  const navigate = useNavigate();

  const { data: conversation, isLoading } = useConversation(convId);
  const [localMessages, setLocalMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  // 流式状态 — 用统一的 events 列表保持时间顺序
  const streamingRef = useRef({
    events: [] as StreamingEvent[],
    reasoning: "",
  });
  const [, forceRender] = useState(0);

  // 审批状态
  const [approvalRequests, setApprovalRequests] = useState<ApprovalRequest[]>([]);
  const [showApproval, setShowApproval] = useState(false);
  const pendingApprovalsRef = useRef<ApprovalRequest[]>([]);
  const submittedRef = useRef(false);  // 防止 Dialog onOpenChange 触发二次提交

  // 用量面板
  const [showUsage, setShowUsage] = useState(true);
  const [usageInfo, setUsageInfo] = useState<UsageInfo | null>(null);
  const hasReceivedLiveUsage = useRef(false);

  // 切换对话时重置用量状态
  useEffect(() => {
    setUsageInfo(null);
    setLocalMessages([]);
    setInputValue("");
    streamingRef.current = { events: [], reasoning: "" };
    hasReceivedLiveUsage.current = false;
  }, [convId]);

  // 同步服务端消息
  useEffect(() => {
    if (conversation?.messages) {
      setLocalMessages(conversation.messages);
    }
  }, [conversation]);

  // 从历史数据恢复用量统计（仅在从未收到 SSE 推送时执行）
  useEffect(() => {
    if (conversation && conversation.total_tokens && conversation.total_tokens > 0
        && !hasReceivedLiveUsage.current && usageInfo === null) {
      // 找到最新的 assistant 消息，提取其 token 数据作为"上一轮"参考
      const lastAssistant = [...(conversation.messages || [])]
        .reverse()
        .find(m => m.role === 'assistant' && m.total_tokens);
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
      // tool_call 来自流式 delta，同一 tool_call_id 可能收到多次增量更新
      // 合并到最后一个同 id 的 tool_call 事件，或追加新事件
      const evts = streamingRef.current.events;
      const idx = evts.findIndex(
        (e) => e.type === "tool_call" && e.tool_call_id === event.tool_call_id,
      );
      if (idx >= 0) {
        evts[idx] = { type: "tool_call", ...event };
      } else {
        evts.push({ type: "tool_call", ...event });
      }
      // 同步 activeToolCalls（用于实时显示旋转指示器）
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
        // 从事件列表中提取 content 和 tool_calls（兼容后端 Message 结构）
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
      // 清理审批状态
      pendingApprovalsRef.current = [];
      setApprovalRequests([]);
      setShowApproval(false);
      submittedRef.current = false;
    }, []),
    onError: useCallback((err: Error) => {
      console.error("SSE error:", err);
    }, []),
    onToolApprovalRequired: useCallback((req: ApprovalRequestEvent) => {
      // 如果上一批审批已提交（submittedRef=true），说明是新一轮审批，清空旧的
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
      toast.error(`工具 ${event.tool_name} 被拒绝：${event.reason === "policy_deny" ? "项目策略禁止" : "已拒绝"}`);
    }, []),
    onUsageInfo: useCallback((usage: UsageInfo) => {
      hasReceivedLiveUsage.current = true;
      setUsageInfo(usage);
    }, []),
  });

  // 提交审批决定
  const handleApprovalSubmit = useCallback(
    async (decisions: { tool_call_id: string; decision: "approved" | "denied"; scope: "once" | "conversation" }[]) => {
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
    // 已通过 handleApprovalSubmit 提交，跳过二次提交
    if (submittedRef.current) return;
    // 超时或手动关闭：全部拒绝
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
      { id: Date.now(), role: "user", content: text, created_at: new Date().toISOString() },
    ]);
    setInputValue("");
    streamingRef.current = { events: [], reasoning: "" };
    pendingApprovalsRef.current = [];
    setApprovalRequests([]);
    // 不清空 usageInfo：保留累计统计，等待新一轮 SSE 覆盖
    hasReceivedLiveUsage.current = false;
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
    <div className="flex flex-1 overflow-hidden min-h-0">
      {/* 主内容区 */}
      <div className="flex flex-1 flex-col overflow-hidden min-h-0">
        {/* 工具栏 */}
        <div className="flex items-center justify-end gap-1 border-b px-3 py-1.5">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            title="对话统计"
            onClick={() => setShowUsage(!showUsage)}
          >
            <BarChart3 className="h-3.5 w-3.5 text-muted-foreground" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            title="项目权限设置"
            onClick={() => navigate(`/projects/${pid}/settings`)}
          >
            <Shield className="h-3.5 w-3.5 text-muted-foreground" />
          </Button>
        </div>

        {/* 消息列表 */}
        <div
          ref={containerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto min-h-0 px-4 py-4"
        >
          <div className="mx-auto max-w-3xl space-y-4">
            {localMessages.filter(m => m.role !== "tool").map((msg) => (
              <MessageBubble key={msg.id} message={msg} />
            ))}
            {isStreaming && (streamingRef.current.events.length > 0 || streamingRef.current.reasoning) && (
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
                  {/* 按时间顺序渲染事件 */}
                  <StreamingEventsList events={streamingRef.current.events} />
                  {/* 无事件也无reasoning时显示思考中 */}
                  {streamingRef.current.events.length === 0 && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      <span>⏳ AI 正在思考...</span>
                    </div>
                  )}
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

      {/* 右侧用量面板 */}
      {showUsage && (
        <UsagePanel
          usage={usageInfo}
          onClose={() => setShowUsage(false)}
        />
      )}

      {/* 审批弹窗 */}
      <ToolApprovalDialog
        open={showApproval && approvalRequests.length > 0}
        requests={approvalRequests}
        onSubmit={handleApprovalSubmit}
        onCancel={handleApprovalCancel}
      />
    </div>
  );
}

// ── 按时间顺序渲染流式事件 ──
function StreamingEventsList({ events }: { events: StreamingEvent[] }) {
  if (!events.length) return null;

  // 将连续的 text 事件合并为一个 MarkdownContent 块
  const merged: Array<{ key: string; node: React.ReactNode }> = [];
  let textBuffer = "";

  const flushText = () => {
    if (textBuffer) {
      merged.push({
        key: `text-${merged.length}`,
        node: (
          <div className="inline-block max-w-full rounded-lg bg-muted px-3 py-2 text-sm">
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
            <CollapsibleBlock title={`🔧 ${ev.tool_name}`} variant="tool">
              <pre className="overflow-x-auto text-xs text-muted-foreground">
                {ev.arguments}
              </pre>
            </CollapsibleBlock>
          ),
        });
      } else if (ev.type === "tool_result") {
        merged.push({
          key: `tr-${ev.tool_call_id}`,
          node: (
            <CollapsibleBlock title={`✅ ${ev.tool_name} 结果`} variant="tool">
              <pre className="overflow-x-auto text-xs text-muted-foreground">
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
              <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                {ev.content}
              </p>
            </CollapsibleBlock>
          ),
        });
      }
    }
  }
  flushText();

  return (
    <div className="space-y-2">
      {merged.map((item) => (
        <div key={item.key}>{item.node}</div>
      ))}
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
        {/* 有 events 时按时间顺序渲染；否则走旧路径 */}
        {message.events && message.events.length > 0 ? (
          <StreamingEventsList events={message.events} />
        ) : (
          <>
            <div
              className={cn(
                "inline-block max-w-full rounded-lg px-3 py-2 text-sm",
                isUser ? "bg-primary text-primary-foreground" : "bg-muted",
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
                title={`🔧 ${tc.function.name}`}
                variant="tool"
              >
                <pre className="overflow-x-auto text-xs text-muted-foreground">
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

