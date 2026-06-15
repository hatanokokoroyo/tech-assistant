import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useParams } from "react-router";
import { ChevronDown, GitBranch, Plus, Trash2, RefreshCw, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
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
  useFetchAllRepos,
} from "@/queries/use-repos";
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
  const fetchAll = useFetchAllRepos(pid);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState("");
  const [gitUrl, setGitUrl] = useState("");
  const nameManuallyEdited = useRef(false);
  const createRepo = useCreateRepo(pid);

  // 从 Git URL 提取仓库名：取最后一段，去掉 .git 后缀
  const extractNameFromUrl = useCallback((url: string): string => {
    const match = url.match(/([^/]+?)(?:\.git)?$/);
    return match ? match[1] : "";
  }, []);

  // 当 Git URL 变化且名称未被手动编辑时，自动填入仓库名
  useEffect(() => {
    if (nameManuallyEdited.current || !gitUrl.trim()) return;
    const extracted = extractNameFromUrl(gitUrl);
    if (extracted && extracted !== name) {
      setName(extracted);
    }
  }, [gitUrl, extractNameFromUrl, name]);

  const handleDialogOpenChange = (open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      setName("");
      setGitUrl("");
      nameManuallyEdited.current = false;
    }
  };

  const handleCreate = async () => {
    if (!name.trim() || !gitUrl.trim()) return;
    try {
      await createRepo.mutateAsync({ name: name.trim(), url: gitUrl.trim() });
      setName("");
      setGitUrl("");
      nameManuallyEdited.current = false;
      setDialogOpen(false);
      toast.success("仓库已添加");
    } catch {
      toast.error("添加仓库失败");
    }
  };

  const handleRefresh = async () => {
    try {
      const res = await fetchAll.mutateAsync();
      const { results } = res;
      const okCount = results.filter((r) => r.status === "ok").length;
      const errCount = results.filter((r) => r.status === "error").length;
      if (errCount === 0) {
        toast.success(`已刷新 ${okCount} 个仓库的远程分支`);
      } else {
        toast.success(`已刷新 ${okCount} 个仓库，${errCount} 个失败`);
      }
    } catch {
      toast.error("刷新远程分支失败");
    }
  };

  return (
    <>
      <div className="flex items-center justify-between border-b px-3 py-2">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          仓库
        </span>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleRefresh} disabled={fetchAll.isPending}>
            {fetchAll.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
          </Button>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleDialogOpenChange(true)}>
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={handleDialogOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>添加仓库</DialogTitle>
            <DialogDescription>添加一个 Git 仓库到项目中</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="repo-name">仓库名称</Label>
              <Input id="repo-name" placeholder="my-repo" value={name} onChange={(e) => { nameManuallyEdited.current = true; setName(e.target.value); }} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="git-url">Git URL</Label>
              <Input id="git-url" placeholder="https://github.com/user/repo.git" value={gitUrl} onChange={(e) => setGitUrl(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => handleDialogOpenChange(false)}>取消</Button>
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

  const currentBranch = branches?.current_branch ?? repo.current_branch;

  // 去重合并本地+远程分支：远程去掉 origin/ 前缀，合并去重，current_branch 排最前
  const mergedBranches = useMemo(() => {
    if (!branches) return { all: [], localOnly: [], remoteOnly: [] };
    const local = branches.local_branches ?? [];
    const remoteStripped = (branches.remote_branches ?? []).map((b) => b.replace(/^origin\//, ""));
    const all = [...new Set([...local, ...remoteStripped])].sort((a, b) => a.localeCompare(b));
    const cur = branches.current_branch;
    if (cur && all.includes(cur)) {
      all.splice(all.indexOf(cur), 1);
      all.unshift(cur);
    }
    return {
      all,
      localOnly: local,
      remoteOnly: [...new Set(remoteStripped.filter((b) => !local.includes(b)))],
    };
  }, [branches]);

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
          <p className="break-all text-xs text-muted-foreground">{repo.url}</p>
        </div>
        <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={onDelete}>
          <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
        </Button>
      </div>

      {/* 分支选择 - DropdownMenu */}
      <div className="mt-2">
        {!branches ? (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            加载分支...
          </div>
        ) : (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs transition-colors hover:bg-accent">
                <GitBranch className="h-3.5 w-3.5 text-muted-foreground" />
                <span>{currentBranch}</span>
                <ChevronDown className="h-3 w-3 text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="max-h-64 overflow-y-auto">
              <DropdownMenuLabel>本地分支</DropdownMenuLabel>
              {mergedBranches.localOnly.length === 0 && (
                <DropdownMenuItem disabled className="text-muted-foreground">
                  无本地分支
                </DropdownMenuItem>
              )}
              {mergedBranches.localOnly.map((branch) => (
                <DropdownMenuItem key={branch} onClick={() => handleCheckout(branch)} disabled={checkout.isPending}>
                  {branch === currentBranch && <Check className="h-3.5 w-3.5 text-primary" />}
                  {branch === currentBranch ? <span className="font-medium">{branch}</span> : branch}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuLabel>远程分支</DropdownMenuLabel>
              {mergedBranches.remoteOnly.length === 0 && (
                <DropdownMenuItem disabled className="text-muted-foreground">
                  无远程分支
                </DropdownMenuItem>
              )}
              {mergedBranches.remoteOnly.map((branch) => (
                <DropdownMenuItem key={branch} onClick={() => handleCheckout(branch)} disabled={checkout.isPending}>
                  {branch}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </div>
  );
}
