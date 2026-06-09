import { useState } from "react";
import { useNavigate, useParams } from "react-router";
import { Plus, MessageSquare, Trash2 } from "lucide-react";
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
} from "@/queries/use-conversations";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "@/lib/format";

export default function ChatPanel() {
  const { projectId, conversationId } = useParams();
  const navigate = useNavigate();
  const pid = Number(projectId);
  const currentConvId = conversationId ? Number(conversationId) : null;

  const { data: conversations, isLoading } = useConversations(pid);
  const createConversation = useCreateConversation(pid);
  const deleteConversation = useDeleteConversation(pid);
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);

  const handleCreate = async () => {
    try {
      const conv = await createConversation.mutateAsync("新对话");
      navigate(`/projects/${pid}/chat/${conv.id}`);
    } catch {
      // handled by mutation
    }
  };

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

  return (
    <div className="flex h-full flex-col">
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

      <div className="flex-1 overflow-auto p-1">
        {isLoading ? (
          <div className="space-y-1 p-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-14 animate-pulse rounded-md bg-muted" />
            ))}
          </div>
        ) : !conversations?.length ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <MessageSquare className="mb-2 h-8 w-8 text-muted-foreground/30" />
            <p className="text-xs text-muted-foreground">还没有对话</p>
          </div>
        ) : (
          <div className="space-y-0.5">
            {conversations.map((conv) => (
              <div
                key={conv.id}
                className={cn(
                  "group flex cursor-pointer items-center gap-2 rounded-md px-3 py-2.5 transition-colors hover:bg-accent",
                  currentConvId === conv.id && "bg-accent",
                )}
                onClick={() =>
                  navigate(`/projects/${pid}/chat/${conv.id}`)
                }
              >
                <MessageSquare className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">{conv.title || "新对话"}</p>
                  <p className="text-xs text-muted-foreground">
                    {conv.message_count} 条消息 ·{" "}
                    {formatRelativeTime(conv.updated_at)}
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
        )}
      </div>

      {/* 删除确认 */}
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
    </div>
  );
}

function formatRelativeTime(dateStr: string): string {
  try {
    return formatDistanceToNow(new Date(dateStr));
  } catch {
    return "";
  }
}
