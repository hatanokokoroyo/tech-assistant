import { useState } from "react";
import { useParams } from "react-router";
import { GitBranch, Plus, Trash2, RefreshCw, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
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
import PanelLayout from "@/components/shared/panel-layout";
import {
  useRepos,
  useCreateRepo,
  useDeleteRepo,
  useBranches,
  useCheckoutBranch,
} from "@/queries/use-repos";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export default function RepoPanel() {
  const { projectId } = useParams();
  const pid = Number(projectId);

  return (
    <PanelLayout
      activeTab="repos"
      middleHeader={<RepoPanelHeader pid={pid} />}
      middleContent={<RepoListContent pid={pid} />}
      rightContent={
        <div className="flex flex-1 items-center justify-center text-muted-foreground">
          <div className="space-y-2 text-center">
            <GitBranch className="mx-auto h-10 w-10 opacity-30" />
            <p className="text-sm">选择仓库查看详情</p>
          </div>
        </div>
      }
    />
  );
}

function RepoPanelHeader({ pid }: { pid: number }) {
  const { refetch } = useRepos(pid);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState("");
  const [gitUrl, setGitUrl] = useState("");
  const createRepo = useCreateRepo(pid);

  const handleCreate = async () => {
    if (!name.trim() || !gitUrl.trim()) return;
    try {
      await createRepo.mutateAsync({ name: name.trim(), url: gitUrl.trim() });
      setName("");
      setGitUrl("");
      setDialogOpen(false);
      toast.success("仓库已添加");
    } catch {
      toast.error("添加仓库失败");
    }
  };

  return (
    <>
      <div className="flex items-center justify-between border-b px-3 py-2">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          仓库
        </span>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => refetch()}>
            <RefreshCw className="h-3 w-3" />
          </Button>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setDialogOpen(true)}>
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>添加仓库</DialogTitle>
            <DialogDescription>添加一个 Git 仓库到项目中</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="repo-name">仓库名称</Label>
              <Input id="repo-name" placeholder="my-repo" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="git-url">Git URL</Label>
              <Input id="git-url" placeholder="https://github.com/user/repo.git" value={gitUrl} onChange={(e) => setGitUrl(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>取消</Button>
            <Button onClick={handleCreate} disabled={!name.trim() || !gitUrl.trim() || createRepo.isPending}>
              {createRepo.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              添加
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function RepoListContent({ pid }: { pid: number }) {
  const { data: repos, isLoading } = useRepos(pid);
  const deleteRepo = useDeleteRepo(pid);
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);

  const handleDelete = async () => {
    if (deleteTarget === null) return;
    try {
      await deleteRepo.mutateAsync(deleteTarget);
      toast.success("仓库已移除");
    } catch {
      toast.error("移除仓库失败");
    }
    setDeleteTarget(null);
  };

  if (isLoading) {
    return (
      <div className="space-y-2 p-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-20 animate-pulse rounded-md bg-muted" />
        ))}
      </div>
    );
  }

  if (!repos?.length) {
    return (
      <div className="flex flex-col items-center py-12 text-center">
        <GitBranch className="mb-2 h-8 w-8 text-muted-foreground/30" />
        <p className="text-xs text-muted-foreground">还没有仓库</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-2 p-2">
        {repos.map((repo) => (
          <RepoCard key={repo.id} repo={repo} projectId={pid} onDelete={() => setDeleteTarget(repo.id)} />
        ))}
      </div>

      <AlertDialog open={deleteTarget !== null} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>移除仓库</AlertDialogTitle>
            <AlertDialogDescription>确定移除此仓库？本地数据将被清除。</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              移除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function RepoCard({
  repo,
  projectId,
  onDelete,
}: {
  repo: { id: number; name: string; url: string; current_branch: string };
  projectId: number;
  onDelete: () => void;
}) {
  const { data: branches } = useBranches(projectId, repo.id);
  const checkout = useCheckoutBranch(projectId);

  const handleCheckout = async (branch: string) => {
    try {
      await checkout.mutateAsync({ repoId: repo.id, branch });
      toast.success(`已切换到 ${branch}`);
    } catch {
      toast.error("切换分支失败");
    }
  };

  return (
    <div className="rounded-md border p-3">
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{repo.name}</p>
          <p className="truncate text-xs text-muted-foreground">{repo.url}</p>
        </div>
        <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={onDelete}>
          <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
        </Button>
      </div>

      {/* 当前分支 */}
      <div className="mt-2 flex items-center gap-1.5">
        <GitBranch className="h-3.5 w-3.5 text-muted-foreground" />
        <Badge variant="secondary" className="text-xs">
          {branches?.current_branch ?? repo.current_branch}
        </Badge>
      </div>

      {/* 分支列表 */}
      {branches && (
        <div className="mt-2 flex flex-wrap gap-1">
          {branches.local_branches.map((branch) => (
            <button
              key={branch}
              onClick={() => handleCheckout(branch)}
              className={cn(
                "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs transition-colors hover:bg-accent",
                branch === (branches?.current_branch ?? repo.current_branch) && "border-primary bg-primary/5",
              )}
              disabled={checkout.isPending}
            >
              {branch === (branches?.current_branch ?? repo.current_branch) && <Check className="h-3 w-3 text-primary" />}
              {branch}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
