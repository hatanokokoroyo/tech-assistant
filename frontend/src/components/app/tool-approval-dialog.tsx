import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ShieldAlert, Check, X, Repeat } from "lucide-react";

export interface ApprovalRequest {
  tool_call_id: string;
  tool_name: string;
  arguments: Record<string, unknown>;
}

interface ToolApprovalDialogProps {
  open: boolean;
  requests: ApprovalRequest[];
  onSubmit: (decisions: { tool_call_id: string; decision: "approved" | "denied"; scope: "once" | "conversation" }[]) => void;
  onCancel: () => void;
}

const TOOL_LABELS: Record<string, string> = {
  run_command: "执行命令",
  read_file: "读取文件",
  write_file: "写入文件",
  search_content: "搜索内容",
  list_directory: "列出目录",
  delete_file: "删除文件",
};

function formatArgs(args: Record<string, unknown>): string {
  const entries = Object.entries(args).filter(([, v]) => v !== undefined && v !== null && v !== "");
  if (entries.length === 0) return "无参数";
  return entries
    .map(([k, v]) => {
      const val = typeof v === "string" ? (v.length > 60 ? v.slice(0, 60) + "…" : v) : JSON.stringify(v);
      return `${k}: ${val}`;
    })
    .join("\n");
}

export function ToolApprovalDialog({ open, requests, onSubmit, onCancel }: ToolApprovalDialogProps) {
  if (requests.length === 0) return null;

  const handleApproveAll = () => {
    onSubmit(
      requests.map((r) => ({
        tool_call_id: r.tool_call_id,
        decision: "approved" as const,
        scope: "once" as const,
      })),
    );
  };

  const handleApproveAllPermanent = () => {
    onSubmit(
      requests.map((r) => ({
        tool_call_id: r.tool_call_id,
        decision: "approved" as const,
        scope: "conversation" as const,
      })),
    );
  };

  const handleDenyAll = () => {
    onSubmit(
      requests.map((r) => ({
        tool_call_id: r.tool_call_id,
        decision: "denied" as const,
        scope: "once" as const,
      })),
    );
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onCancel(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-yellow-500" />
            AI 请求执行工具操作
          </DialogTitle>
          <DialogDescription>
            AI 需要执行以下 {requests.length} 个工具操作。请确认是否允许。
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-64 overflow-y-auto space-y-3 py-2">
          {requests.map((req, i) => (
            <div key={req.tool_call_id}>
              {i > 0 && <Separator className="my-3" />}
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">
                    {req.tool_name}
                  </code>
                  <span className="text-xs text-muted-foreground">
                    {TOOL_LABELS[req.tool_name] || req.tool_name}
                  </span>
                </div>
                <pre className="overflow-x-auto rounded bg-muted/50 p-2 text-[11px] text-muted-foreground whitespace-pre-wrap break-all">
                  {formatArgs(req.arguments)}
                </pre>
              </div>
            </div>
          ))}
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <div className="flex gap-2 w-full">
            <Button
              variant="default"
              size="sm"
              className="flex-1"
              onClick={handleApproveAll}
            >
              <Check className="mr-1.5 h-4 w-4" />
              允许本次 ({requests.length})
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={handleApproveAllPermanent}
            >
              <Repeat className="mr-1.5 h-4 w-4" />
              本对话始终允许
            </Button>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-destructive hover:text-destructive"
            onClick={handleDenyAll}
          >
            <X className="mr-1.5 h-4 w-4" />
            全部拒绝
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
