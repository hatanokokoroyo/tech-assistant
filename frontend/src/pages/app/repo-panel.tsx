import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import {
  ChevronDown,
  GitBranch,
  Plus,
  Trash2,
  RefreshCw,
  Check,
  Loader2,
  Link2,
} from "lucide-react";
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
import {
  useRepos,
  useCreateRepo,
  useDeleteRepo,
  useBranches,
  useCheckoutBranch,
  useFetchAllRepos,
} from "@/queries/use-repos";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function RepoPanelHeader({ pid }: { pid: number }) {
  const fetchAll = useFetchAllRepos(pid);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState("");
  const [gitUrl, setGitUrl] = useState("");
  const nameManuallyEdited = useRef(false);
  const createRepo = useCreateRepo(pid);

  const extractNameFromUrl = useCallback((url: string): string => {
    const match = url.match(/([^/]+?)(?:\.git)?$/);
    return match ? match[1] : "";
  }, []);

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
      } else if (okCount === 0) {
        toast.error(`刷新失败：${errCount} 个仓库未成功同步`);
      } else {
        toast.warning(`已刷新 ${okCount} 个仓库，${errCount} 个失败`);
      }
    } catch {
      toast.error("刷新远程分支失败");
    }
  };

  return (
    <>
      <div className="border-b border-border/70 px-4 py-3">
        <div className="flex items-center justify-between gap-3 rounded-[14px] border border-border/70 bg-panel px-3 py-3 shadow-sm">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground/80">
              Repositories
            </p>
            <h2 className="mt-1 text-sm font-semibold text-foreground">代码仓库</h2>
          </div>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              className="gap-1.5"
              onClick={handleRefresh}
              disabled={fetchAll.isPending}
            >
              {fetchAll.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
              刷新
            </Button>
            <Button size="sm" className="gap-1.5" onClick={() => handleDialogOpenChange(true)}>
              <Plus className="h-3.5 w-3.5" />
              添加
            </Button>
          </div>
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={handleDialogOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>添加仓库</DialogTitle>
            <DialogDescription>添加一个 Git 仓库到当前项目工作区</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="repo-name">仓库名称</Label>
              <Input
                id="repo-name"
                placeholder="my-repo"
                value={name}
                onChange={(e) => {
                  nameManuallyEdited.current = true;
                  setName(e.target.value);
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="git-url">Git URL</Label>
              <Input
                id="git-url"
                placeholder="https://github.com/user/repo.git"
                value={gitUrl}
                onChange={(e) => setGitUrl(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => handleDialogOpenChange(false)}>
              取消
            </Button>
            <Button
              onClick={handleCreate}
              disabled={!name.trim() || !gitUrl.trim() || createRepo.isPending}
            >
              {createRepo.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              添加仓库
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function RepoListContent({ pid }: { pid: number }) {
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
      <div className="space-y-2 p-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-28 animate-pulse rounded-[18px] bg-panel" />
        ))}
      </div>
    );
  }

  if (!repos?.length) {
    return (
      <div className="px-4 py-10">
        <div className="rounded-[18px] border border-dashed border-border/80 bg-panel px-5 py-8 text-center shadow-sm">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-[16px] bg-primary-soft text-primary">
            <GitBranch className="h-5 w-5" />
          </div>
          <p className="text-sm font-medium text-foreground">还没有仓库</p>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            添加一个 Git 仓库，用于浏览分支、同步远程状态并组织项目代码来源。
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3 p-3">
        {repos.map((repo) => (
          <RepoCard
            key={repo.id}
            repo={repo}
            projectId={pid}
            onDelete={() => setDeleteTarget(repo.id)}
          />
        ))}
      </div>

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={() => setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>移除仓库</AlertDialogTitle>
            <AlertDialogDescription>
              确定移除此仓库？本地数据将被清除，此操作不可恢复。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
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

  const mergedBranches = useMemo(() => {
    if (!branches) return { all: [], localOnly: [], remoteOnly: [] };
    const local = branches.local_branches ?? [];
    const remoteStripped = (branches.remote_branches ?? []).map((b) =>
      b.replace(/^origin\//, ""),
    );
    const all = [...new Set([...local, ...remoteStripped])].sort((a, b) =>
      a.localeCompare(b),
    );
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
    <div className="max-w-full rounded-[18px] border border-border/80 bg-panel-elevated p-4 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-[14px] bg-primary-soft text-primary">
              <GitBranch className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-foreground">{repo.name}</p>
              <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Link2 className="h-3.5 w-3.5 shrink-0" />
                <p className="truncate">{repo.url}</p>
              </div>
            </div>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0 rounded-[10px]"
          onClick={onDelete}
        >
          <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
        </Button>
      </div>

      <div className="mt-4 rounded-[14px] border border-border/70 bg-panel px-3 py-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/80">
              Active branch
            </p>
            <p className="mt-1 flex min-w-0 items-center gap-2 text-sm font-medium text-foreground">
              <GitBranch className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="truncate">{currentBranch}</span>
            </p>
          </div>

          {!branches ? (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              加载分支...
            </div>
          ) : (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="inline-flex items-center gap-2 rounded-[10px] border border-border/80 bg-panel-elevated px-3 py-2 text-xs font-medium text-foreground shadow-sm transition-colors hover:bg-panel">
                  <span>切换分支</span>
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="max-h-72 w-56 overflow-y-auto">
                <DropdownMenuLabel>本地分支</DropdownMenuLabel>
                {mergedBranches.localOnly.length === 0 && (
                  <DropdownMenuItem disabled className="text-muted-foreground">
                    无本地分支
                  </DropdownMenuItem>
                )}
                {mergedBranches.localOnly.map((branch) => (
                  <DropdownMenuItem
                    key={branch}
                    onClick={() => handleCheckout(branch)}
                    disabled={checkout.isPending}
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      {branch === currentBranch ? (
                        <Check className="h-3.5 w-3.5 text-primary" />
                      ) : (
                        <span className="h-3.5 w-3.5" />
                      )}
                      <span className={cn(branch === currentBranch && "font-medium")}>
                        {branch}
                      </span>
                    </span>
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
                  <DropdownMenuItem
                    key={branch}
                    onClick={() => handleCheckout(branch)}
                    disabled={checkout.isPending}
                  >
                    {branch}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
    </div>
  );
}
