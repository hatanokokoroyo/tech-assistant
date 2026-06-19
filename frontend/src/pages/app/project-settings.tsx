import { useState } from "react";
import { useParams, useNavigate } from "react-router";
import { ArrowLeft, Shield, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useToolPermissions, useUpdateToolPermissions } from "@/queries/use-tool-permissions";
import { toast } from "sonner";

const TOOL_META: Record<string, { label: string; description: string; risk: "low" | "medium" | "high" }> = {
  read_file: { label: "读取文件", description: "读取沙箱内的文件内容", risk: "low" },
  search_content: { label: "搜索内容", description: "在代码项目中搜索文本", risk: "low" },
  list_directory: { label: "列出目录", description: "列出指定目录下的文件列表", risk: "low" },
  write_file: { label: "写入文件", description: "创建或覆盖沙箱内的文件", risk: "medium" },
  run_command: { label: "执行命令", description: "在沙箱内执行 Shell 命令", risk: "high" },
  delete_file: { label: "删除文件", description: "删除沙箱内的指定文件", risk: "high" },
};

const PERMISSION_OPTIONS = [
  { value: "auto_approve", label: "直接执行", desc: "AI 调用时自动执行" },
  { value: "ask_user", label: "申请执行", desc: "需用户确认后执行" },
  { value: "deny", label: "禁止执行", desc: "直接拒绝并告知 AI" },
] as const;

const RISK_COLORS: Record<string, string> = {
  low: "text-green-600 bg-green-50 border-green-200",
  medium: "text-yellow-600 bg-yellow-50 border-yellow-200",
  high: "text-red-600 bg-red-50 border-red-200",
};

export default function ProjectSettingsPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const pid = Number(projectId);

  return (
    <div className="flex h-full flex-col bg-background">
      <header className="flex items-center gap-3 border-b px-6 py-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(`/projects/${pid}/files`)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-lg font-semibold">项目设置</h1>
      </header>

      <main className="flex-1 overflow-auto">
        <div className="mx-auto max-w-2xl space-y-8 px-6 py-8">
          <ToolPermissionSection projectId={pid} />
          <Separator />
          <div className="text-xs text-muted-foreground">
            权限配置仅影响当前项目下的所有 AI 对话。
          </div>
        </div>
      </main>
    </div>
  );
}

function ToolPermissionSection({ projectId }: { projectId: number }) {
  const { data, isLoading, error } = useToolPermissions(projectId);
  const updatePermissions = useUpdateToolPermissions(projectId);
  const [draft, setDraft] = useState<Record<string, string>>({});

  // 初始化草稿
  const permissions = data?.permissions ?? {};

  const getValue = (toolName: string) => draft[toolName] ?? permissions[toolName] ?? "ask_user";
  const hasChanges = Object.keys(draft).length > 0;

  const handleChange = (toolName: string, value: string) => {
    setDraft((prev) => ({ ...prev, [toolName]: value }));
  };

  const handleSave = async () => {
    try {
      const payload = Object.entries(draft).map(([tool_name, permission]) => ({
        tool_name,
        permission,
      }));
      await updatePermissions.mutateAsync(payload);
      setDraft({});
      toast.success("权限配置已保存");
    } catch {
      toast.error("保存失败");
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-16 animate-pulse rounded-md bg-muted" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-md border border-destructive/50 bg-destructive/5 p-4 text-sm text-destructive">
        加载权限配置失败
      </div>
    );
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2">
        <Shield className="h-5 w-5 text-muted-foreground" />
        <h2 className="text-base font-semibold">Tool 权限配置</h2>
      </div>
      <p className="text-sm text-muted-foreground">
        控制 AI 对话中各工具的调用权限。
        未在上方明确配置的工具将使用全局默认策略。
      </p>

      <div className="space-y-2">
        {Object.entries(TOOL_META).map(([toolName, meta]) => (
          <div
            key={toolName}
            className="rounded-md border p-4"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-medium">{toolName}</span>
                  <span className={`rounded border px-1.5 py-0.5 text-[10px] ${RISK_COLORS[meta.risk]}`}>
                    {meta.risk === "low" ? "低风险" : meta.risk === "medium" ? "中风险" : "高风险"}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">{meta.description}</p>
              </div>

              <div className="flex shrink-0 gap-1">
                {PERMISSION_OPTIONS.map((opt) => {
                  const current = getValue(toolName);
                  const isGlobalDefault = !data?.overrides.some((o) => o.tool_name === toolName) && current === opt.value;

                  return (
                    <button
                      key={opt.value}
                      onClick={() => handleChange(toolName, opt.value)}
                      className={`rounded-md border px-2.5 py-1 text-xs transition-colors ${
                        current === opt.value
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-transparent text-muted-foreground hover:bg-accent"
                      }`}
                      title={opt.desc + (isGlobalDefault ? "（全局默认）" : "")}
                    >
                      {opt.label}
                      {isGlobalDefault && <span className="ml-0.5 opacity-50">·默认</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        ))}
      </div>

      {hasChanges && (
        <div className="flex gap-2">
          <Button size="sm" onClick={handleSave} disabled={updatePermissions.isPending}>
            {updatePermissions.isPending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
            保存更改
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setDraft({})}>
            取消
          </Button>
        </div>
      )}
    </section>
  );
}
