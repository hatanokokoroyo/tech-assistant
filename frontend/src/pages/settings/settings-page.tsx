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

export default function SettingsPage() {
  const navigate = useNavigate();

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* 顶栏 */}
      <header className="flex items-center gap-3 border-b px-6 py-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-lg font-semibold">设置</h1>
      </header>

      {/* 内容 */}
      <main className="flex-1 overflow-auto">
        <div className="mx-auto max-w-2xl space-y-8 px-6 py-8">
          <SshKeySection />
          <Separator />
          <div className="text-xs text-muted-foreground">
            更多设置项将在后续版本中提供。
          </div>
        </div>
      </main>
    </div>
  );
}

// ── SSH 密钥管理 ──
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
    <section className="space-y-4">
      <div className="flex items-center gap-2">
        <Key className="h-5 w-5 text-muted-foreground" />
        <h2 className="text-base font-semibold">SSH 密钥</h2>
      </div>
      <p className="text-sm text-muted-foreground">
        上传 SSH 私钥用于 Git 仓库克隆。私钥保存在服务器的工作区目录中，
        公钥需在 Git 平台（GitHub / GitLab）自行配置。
      </p>

      {/* 当前密钥状态 */}
      {isLoading ? (
        <div className="h-16 animate-pulse rounded-md bg-muted" />
      ) : sshKey ? (
        <div className="flex items-center justify-between rounded-md border p-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Badge variant="secondary">已配置</Badge>
              <span className="text-sm font-medium">SSH 私钥</span>
            </div>
            <p className="font-mono text-xs text-muted-foreground">
              {sshKey.fingerprint || "指纹未获取（密钥可能格式不标准）"}
            </p>
            <p className="text-xs text-muted-foreground">
              上传于 {sshKey.created_at}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setDeleteTarget(sshKey.id)}
          >
            <Trash2 className="h-4 w-4 text-muted-foreground" />
          </Button>
        </div>
      ) : (
        <div className="rounded-md border border-dashed p-6 text-center">
          <Key className="mx-auto mb-2 h-8 w-8 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">尚未配置 SSH 密钥</p>
        </div>
      )}

      {/* 上传区域 */}
      {mode === "idle" && (
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setMode("file")}
          >
            <Upload className="mr-1.5 h-3.5 w-3.5" />
            上传私钥文件
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setMode("text")}
          >
            <FileText className="mr-1.5 h-3.5 w-3.5" />
            粘贴私钥内容
          </Button>
        </div>
      )}

      {mode === "file" && <FileUpload onComplete={() => setMode("idle")} />}
      {mode === "text" && <TextInput onComplete={() => setMode("idle")} />}

      {/* 删除确认 */}
      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={() => setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除 SSH 密钥</AlertDialogTitle>
            <AlertDialogDescription>
              删除后将无法使用此密钥进行 Git 仓库克隆，需要重新上传。
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

// ── 文件上传 ──
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
    <div className="space-y-3 rounded-md border p-4">
      <Label>选择私钥文件</Label>
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
      <p className="text-xs text-muted-foreground">
        支持 OpenSSH 格式的私钥文件（id_rsa）
      </p>
    </div>
  );
}

// ── 文本粘贴 ──
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
    <div className="space-y-3 rounded-md border p-4">
      <div className="flex items-center justify-between">
        <Label>粘贴私钥内容</Label>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1"
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
        className="h-40 w-full rounded-md border border-input bg-transparent p-3 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-ring"
        style={showKey ? {} : { WebkitTextSecurity: "disc" } as React.CSSProperties}
      />
      <div className="flex gap-2">
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
          上传
        </Button>
        <Button variant="ghost" size="sm" onClick={onComplete}>
          取消
        </Button>
      </div>
    </div>
  );
}
