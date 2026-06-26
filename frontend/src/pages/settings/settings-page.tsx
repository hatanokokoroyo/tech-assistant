import { useState, useRef } from "react";
import { useNavigate } from "react-router";
import {
  ArrowLeft,
  Key,
  Upload,
  Trash2,
  Loader2,
  FileText,
  Eye,
  EyeOff,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
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
  useSshKey,
  useUploadSshKeyFile,
  useUploadSshKeyText,
  useDeleteSshKey,
} from "@/queries/use-ssh-keys";
import { toast } from "sonner";
import { formatDateTime } from "@/lib/format";

export default function SettingsPage() {
  const navigate = useNavigate();

  return (
    <div className="flex h-screen flex-col bg-background p-3 text-foreground">
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[22px] border border-border/80 bg-panel shadow-md">
        <header className="border-b border-border/70 bg-panel-elevated/85 px-5 py-4 backdrop-blur-sm">
          <div className="mx-auto flex max-w-5xl items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 rounded-[12px]"
              onClick={() => navigate(-1)}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground/80">
                Settings
              </p>
              <h1 className="mt-1 text-lg font-semibold text-foreground">个人设置</h1>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-auto">
          <div className="mx-auto flex max-w-5xl flex-col gap-8 px-6 py-8">
            <section className="rounded-[24px] border border-border/80 bg-panel-elevated p-6 shadow-sm">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-[16px] bg-primary-soft text-primary">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground/80">
                    Workspace security
                  </p>
                  <h2 className="mt-2 text-xl font-semibold text-foreground">工作区安全与访问配置</h2>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
                    在这里管理与代码仓库相关的基础凭证。当前版本提供 SSH 私钥配置，后续可继续扩展更多用户级设置项。
                  </p>
                </div>
              </div>
            </section>

            <SshKeySection />

            <Separator />

            <div className="rounded-[18px] border border-dashed border-border/80 bg-panel px-5 py-4 text-sm text-muted-foreground shadow-sm">
              更多用户级设置项将在后续版本中补充，包括默认偏好、通知与个性化工作区配置。
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

function SshKeySection() {
  const { data: sshKey, isLoading } = useSshKey();
  const deleteKey = useDeleteSshKey();
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);
  const [mode, setMode] = useState<"idle" | "file" | "text">("idle");

  const handleDelete = async () => {
    if (deleteTarget === null) return;
    try {
      await deleteKey.mutateAsync(deleteTarget);
      toast.success("SSH 密钥已删除");
    } catch {
      toast.error("删除失败");
    }
    setDeleteTarget(null);
  };

  return (
    <section className="rounded-[24px] border border-border/80 bg-panel-elevated p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-[14px] bg-primary-soft text-primary">
              <Key className="h-4.5 w-4.5" />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground/80">
                SSH Access
              </p>
              <h2 className="mt-1 text-lg font-semibold text-foreground">SSH 密钥</h2>
            </div>
          </div>
          <p className="mt-4 max-w-3xl text-sm leading-6 text-muted-foreground">
            上传 SSH 私钥用于 Git 仓库克隆。私钥保存在服务器工作区目录中，公钥需在 Git 平台（GitHub / GitLab）自行配置。
          </p>
        </div>

        {mode === "idle" && (
          <div className="flex shrink-0 gap-2">
            <Button variant="outline" size="sm" onClick={() => setMode("file")}>
              <Upload className="mr-1.5 h-3.5 w-3.5" />
              上传文件
            </Button>
            <Button size="sm" onClick={() => setMode("text")}>
              <FileText className="mr-1.5 h-3.5 w-3.5" />
              粘贴内容
            </Button>
          </div>
        )}
      </div>

      <div className="mt-6 space-y-4">
        {isLoading ? (
          <div className="h-28 animate-pulse rounded-[18px] bg-panel" />
        ) : sshKey ? (
          <div className="flex items-center justify-between gap-4 rounded-[18px] border border-border/80 bg-panel p-4 shadow-sm">
            <div className="min-w-0 space-y-2">
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="rounded-full px-2.5 py-0.5">
                  已配置
                </Badge>
                <span className="text-sm font-medium text-foreground">SSH 私钥</span>
              </div>
              <p className="font-mono text-xs leading-6 text-muted-foreground">
                {sshKey.fingerprint || "指纹未获取（密钥可能格式不标准）"}
              </p>
              <p className="text-xs text-muted-foreground">
                上传于 {formatDateTime(sshKey.created_at)}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-[12px]"
              onClick={() => setDeleteTarget(sshKey.id)}
            >
              <Trash2 className="h-4 w-4 text-muted-foreground" />
            </Button>
          </div>
        ) : (
          <div className="rounded-[18px] border border-dashed border-border/80 bg-panel px-6 py-8 text-center shadow-sm">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-[16px] bg-primary-soft text-primary">
              <Key className="h-5 w-5" />
            </div>
            <p className="text-sm font-medium text-foreground">尚未配置 SSH 密钥</p>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              你可以上传私钥文件，或直接粘贴密钥内容，用于后续仓库访问。
            </p>
          </div>
        )}

        {mode === "file" && <FileUpload onComplete={() => setMode("idle")} />}
        {mode === "text" && <TextInput onComplete={() => setMode("idle")} />}
      </div>

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={() => setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除 SSH 密钥</AlertDialogTitle>
            <AlertDialogDescription>
              删除后将无法继续使用此密钥进行 Git 仓库克隆，需要重新上传。
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

function FileUpload({ onComplete }: { onComplete: () => void }) {
  const uploadFile = useUploadSshKeyFile();
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    try {
      await uploadFile.mutateAsync(file);
      toast.success("SSH 密钥已上传");
      onComplete();
    } catch (err) {
      toast.error((err as Error).message || "上传失败");
    }
  };

  return (
    <div className="rounded-[18px] border border-border/80 bg-panel p-5 shadow-sm">
      <div className="space-y-3">
        <div>
          <Label>选择私钥文件</Label>
          <p className="mt-1 text-xs text-muted-foreground">
            支持 OpenSSH 格式的私钥文件（如 `id_rsa`）。
          </p>
        </div>
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
        />
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={uploadFile.isPending}
            onClick={() => inputRef.current?.click()}
          >
            {uploadFile.isPending ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Upload className="mr-1.5 h-3.5 w-3.5" />
            )}
            选择文件
          </Button>
          <Button variant="ghost" size="sm" onClick={onComplete}>
            取消
          </Button>
        </div>
      </div>
    </div>
  );
}

function TextInput({ onComplete }: { onComplete: () => void }) {
  const uploadText = useUploadSshKeyText();
  const [content, setContent] = useState("");
  const [showKey, setShowKey] = useState(false);

  const handleSubmit = async () => {
    if (!content.trim()) return;
    try {
      await uploadText.mutateAsync(content.trim());
      toast.success("SSH 密钥已上传");
      onComplete();
    } catch (err) {
      toast.error((err as Error).message || "上传失败");
    }
  };

  return (
    <div className="rounded-[18px] border border-border/80 bg-panel p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <Label>粘贴私钥内容</Label>
          <p className="mt-1 text-xs text-muted-foreground">
            请确认内容完整且来源可信。
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-1 rounded-[10px]"
          onClick={() => setShowKey(!showKey)}
        >
          {showKey ? (
            <EyeOff className="h-3.5 w-3.5" />
          ) : (
            <Eye className="h-3.5 w-3.5" />
          )}
          {showKey ? "隐藏" : "显示"}
        </Button>
      </div>
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="-----BEGIN OPENSSH PRIVATE KEY-----"
        className="mt-4 h-44 w-full rounded-[16px] border border-input/90 bg-panel-elevated p-4 font-mono text-xs leading-6 shadow-sm focus:outline-none focus:ring-2 focus:ring-ring/80"
        style={showKey ? {} : ({ WebkitTextSecurity: "disc" } as React.CSSProperties)}
      />
      <div className="mt-4 flex gap-2">
        <Button
          size="sm"
          disabled={!content.trim() || uploadText.isPending}
          onClick={handleSubmit}
        >
          {uploadText.isPending ? (
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          ) : (
            <Upload className="mr-1.5 h-3.5 w-3.5" />
          )}
          上传内容
        </Button>
        <Button variant="ghost" size="sm" onClick={onComplete}>
          取消
        </Button>
      </div>
    </div>
  );
}
