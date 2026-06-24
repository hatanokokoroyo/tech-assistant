import { useState } from "react";
import { useParams, useNavigate } from "react-router";
import { ArrowLeft, Shield, Loader2, Database, Plus, Trash2, Edit2, Wifi, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { useToolPermissions, useUpdateToolPermissions } from "@/queries/use-tool-permissions";
import {
  useDatasources,
  useCreateDatasource,
  useUpdateDatasource,
  useDeleteDatasource,
  useTestDatasource,
} from "@/queries/use-datasources";
import type { DatasourceCreate, DatasourceUpdate, DatasourceListItem } from "@/api/datasources";
import { toast } from "sonner";

const TOOL_META: Record<string, { label: string; description: string; risk: "low" | "medium" | "high" }> = {
  read_file: { label: "读取文件", description: "读取沙箱内的文件内容", risk: "low" },
  search_content: { label: "搜索内容", description: "在代码项目中搜索文本", risk: "low" },
  list_directory: { label: "列出目录", description: "列出指定目录下的文件列表", risk: "low" },
  write_file: { label: "写入文件", description: "创建或覆盖沙箱内的文件", risk: "medium" },
  run_command: { label: "执行命令", description: "在沙箱内执行 Shell 命令", risk: "high" },
  delete_file: { label: "删除文件", description: "删除沙箱内的指定文件", risk: "high" },
  list_datasources: { label: "列出数据源", description: "列出项目已配置的数据库数据源", risk: "low" },
  query_mysql: { label: "查询 MySQL", description: "对 MySQL 数据源执行只读查询", risk: "medium" },
  query_redis: { label: "查询 Redis", description: "对 Redis 数据源执行只读命令", risk: "medium" },
  query_tdengine: { label: "查询 TDengine", description: "对 TDengine 数据源执行只读查询", risk: "medium" },
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
          <DatasourceSection projectId={pid} />
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


// ═══════════════════════════════════════════════════════
// 数据源管理
// ═══════════════════════════════════════════════════════

const DB_TYPE_LABELS: Record<string, string> = {
  mysql: "MySQL",
  redis: "Redis",
  tdengine: "TDengine",
};

const DB_TYPE_COLORS: Record<string, string> = {
  mysql: "text-blue-600 bg-blue-50 border-blue-200",
  redis: "text-red-600 bg-red-50 border-red-200",
  tdengine: "text-green-600 bg-green-50 border-green-200",
};

function DatasourceSection({ projectId }: { projectId: number }) {
  const { data: datasources, isLoading, error } = useDatasources(projectId);
  const createDs = useCreateDatasource(projectId);
  const updateDs = useUpdateDatasource(projectId);
  const deleteDs = useDeleteDatasource(projectId);
  const testDs = useTestDatasource(projectId);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingDs, setEditingDs] = useState<DatasourceListItem | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<DatasourceListItem | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  // 表单状态
  const [formName, setFormName] = useState("");
  const [formType, setFormType] = useState<string>("mysql");
  const [formHost, setFormHost] = useState("");
  const [formPort, setFormPort] = useState("3306");
  const [formDb, setFormDb] = useState("");
  const [formUser, setFormUser] = useState("");
  const [formPassword, setFormPassword] = useState("");

  const resetForm = () => {
    setFormName("");
    setFormType("mysql");
    setFormHost("");
    setFormPort("3306");
    setFormDb("");
    setFormUser("");
    setFormPassword("");
    setShowPassword(false);
  };

  const openCreate = () => {
    resetForm();
    setEditingDs(null);
    setDialogOpen(true);
  };

  const openEdit = (ds: DatasourceListItem) => {
    setFormName(ds.name);
    setFormType(ds.db_type);
    setFormHost(ds.host);
    setFormPort(String(ds.port));
    setFormDb("");
    setFormUser("");
    setFormPassword("");
    setEditingDs(ds);
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!formName || !formHost || !formPort) return;

    if (editingDs) {
      const data: DatasourceUpdate = {
        name: formName !== editingDs.name ? formName : undefined,
        host: formHost,
        port: Number(formPort),
        database_name: formDb || undefined,
        username: formUser || undefined,
        password: formPassword,
      };
      try {
        await updateDs.mutateAsync({ dsId: editingDs.id, data });
        toast.success("数据源已更新");
        setDialogOpen(false);
      } catch {
        toast.error("更新失败");
      }
    } else {
      const data: DatasourceCreate = {
        name: formName,
        db_type: formType as "mysql" | "redis" | "tdengine",
        host: formHost,
        port: Number(formPort),
        database_name: formDb || undefined,
        username: formUser || undefined,
        password: formPassword,
      };
      try {
        await createDs.mutateAsync(data);
        toast.success("数据源已创建");
        setDialogOpen(false);
      } catch {
        toast.error("创建失败");
      }
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    try {
      await deleteDs.mutateAsync(deleteConfirm.id);
      toast.success(`数据源 "${deleteConfirm.name}" 已删除`);
      setDeleteConfirm(null);
    } catch {
      toast.error("删除失败");
    }
  };

  const handleTest = async (dsId: number) => {
    try {
      const result = await testDs.mutateAsync(dsId);
      if (result.success) {
        toast.success(`连接成功 (${result.latency_ms}ms)`);
      } else {
        toast.error(`连接失败: ${result.message}`);
      }
    } catch {
      toast.error("测试失败");
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-16 animate-pulse rounded-md bg-muted" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-md border border-destructive/50 bg-destructive/5 p-4 text-sm text-destructive">
        加载数据源列表失败
      </div>
    );
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Database className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-base font-semibold">数据源</h2>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <Button size="sm" onClick={openCreate}>
            <Plus className="mr-1 h-3.5 w-3.5" />
            新增数据源
          </Button>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{editingDs ? "编辑数据源" : "新增数据源"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-4">
              <div className="space-y-1.5">
                <Label htmlFor="ds-name">名称</Label>
                <Input
                  id="ds-name"
                  placeholder="例如：生产MySQL"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                />
              </div>

              {!editingDs && (
                <div className="space-y-1.5">
                  <Label htmlFor="ds-type">类型</Label>
                  <select
                    id="ds-type"
                    value={formType}
                    onChange={(e) => {
                      setFormType(e.target.value);
                      setFormPort(
                        e.target.value === "mysql" ? "3306"
                        : e.target.value === "redis" ? "6379"
                        : "6030"
                      );
                    }}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                  >
                    <option value="mysql">MySQL</option>
                    <option value="redis">Redis</option>
                    <option value="tdengine">TDengine</option>
                  </select>
                </div>
              )}

              <div className="grid grid-cols-[2fr_1fr] gap-2">
                <div className="space-y-1.5">
                  <Label htmlFor="ds-host">主机</Label>
                  <Input
                    id="ds-host"
                    placeholder="127.0.0.1"
                    value={formHost}
                    onChange={(e) => setFormHost(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ds-port">端口</Label>
                  <Input
                    id="ds-port"
                    type="number"
                    value={formPort}
                    onChange={(e) => setFormPort(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="ds-db">数据库名{formType === "redis" ? "（可选）" : ""}</Label>
                <Input
                  id="ds-db"
                  placeholder={formType === "redis" ? "" : "mydb"}
                  value={formDb}
                  onChange={(e) => setFormDb(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="ds-user">用户名{formType === "redis" ? "（可选）" : ""}</Label>
                <Input
                  id="ds-user"
                  placeholder={formType === "redis" ? "" : "root"}
                  value={formUser}
                  onChange={(e) => setFormUser(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="ds-password">
                  密码{editingDs ? "（留空则不修改）" : ""}
                </Label>
                <div className="relative">
                  <Input
                    id="ds-password"
                    type={showPassword ? "text" : "password"}
                    placeholder={editingDs ? "留空则不修改" : ""}
                    value={formPassword}
                    onChange={(e) => setFormPassword(e.target.value)}
                    className="pr-9"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                取消
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={!formName || !formHost || !formPort || (!editingDs && !formPassword)}
              >
                {createDs.isPending || updateDs.isPending ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : null}
                {editingDs ? "保存" : "创建"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <p className="text-sm text-muted-foreground">
        配置项目可访问的数据库。Agent 可通过这些数据源进行只读查询。
      </p>

      {!datasources || datasources.length === 0 ? (
        <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
          <Database className="mx-auto mb-2 h-8 w-8 opacity-30" />
          暂无数据源，点击"新增数据源"开始配置
        </div>
      ) : (
        <div className="space-y-2">
          {datasources.map((ds) => (
            <div key={ds.id} className="rounded-md border p-4">
              <div className="flex items-start justify-between">
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{ds.name}</span>
                    <span className={`rounded border px-1.5 py-0.5 text-[10px] ${DB_TYPE_COLORS[ds.db_type] || ""}`}>
                      {DB_TYPE_LABELS[ds.db_type] || ds.db_type}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {ds.host}:{ds.port}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => handleTest(ds.id)}
                    disabled={testDs.isPending}
                    title="测试连接"
                  >
                    {testDs.isPending ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Wifi className="h-3.5 w-3.5" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => openEdit(ds)}
                    title="编辑"
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive hover:text-destructive"
                    onClick={() => setDeleteConfirm(ds)}
                    title="删除"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <AlertDialog
        open={!!deleteConfirm}
        onOpenChange={(open) => !open && setDeleteConfirm(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除数据源</AlertDialogTitle>
            <AlertDialogDescription>
              确定删除数据源 "{deleteConfirm?.name}"？Agent 将无法再访问此数据库。
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
    </section>
  );
}
