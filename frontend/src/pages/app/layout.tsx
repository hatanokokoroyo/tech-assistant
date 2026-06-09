import { Outlet, useNavigate, useParams } from "react-router";
import {
  FolderOpen,
  Plus,
  Settings,
  LogOut,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useAuthStore } from "@/stores/auth-store";
import { useAppStore } from "@/stores/app-store";
import { useProjects } from "@/queries/use-projects";
import { cn } from "@/lib/utils";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCreateProject } from "@/queries/use-projects";

/**
 * 顶层布局：
 * - 有 projectId → 子路由自己用 PanelLayout 渲染完整三栏
 * - 无 projectId → 显示侧栏（项目列表+创建）+ 右侧空状态
 */
export default function AppLayout() {
  const { projectId } = useParams();
  const hasProject = !!projectId;

  if (hasProject) {
    // 子路由（files/chat/repos）各自用 PanelLayout 渲染完整三栏
    return <Outlet />;
  }

  // 未选择项目：侧栏 + 右侧引导
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <main className="flex flex-1 items-center justify-center text-muted-foreground">
        <div className="space-y-3 text-center">
          <FolderOpen className="mx-auto h-12 w-12 opacity-30" />
          <p className="text-sm">选择一个项目开始工作</p>
        </div>
      </main>
    </div>
  );
}

// ── 侧栏（纯项目列表 + 用户菜单，无 Tab） ──
function Sidebar() {
  return (
    <aside className="flex w-60 shrink-0 flex-col border-r bg-card">
      <ScrollArea className="flex-1">
        <div className="p-3">
          <SidebarProjectList />
        </div>
      </ScrollArea>
      <div className="border-t p-3">
        <UserMenu />
      </div>
    </aside>
  );
}

function SidebarProjectList() {
  const navigate = useNavigate();
  const { selectedProjectId, setSelectedProjectId } = useAppStore();
  const { data: projects, isLoading } = useProjects();
  const createProject = useCreateProject();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const handleCreate = async () => {
    if (!name.trim()) return;
    try {
      const project = await createProject.mutateAsync({
        name: name.trim(),
        description: description.trim() || undefined,
      });
      setName("");
      setDescription("");
      setDialogOpen(false);
      setSelectedProjectId(project.id);
      navigate(`/projects/${project.id}/files`);
    } catch {
      // handled by mutation
    }
  };

  const handleSelect = (id: number) => {
    setSelectedProjectId(id);
    navigate(`/projects/${id}/files`);
  };

  return (
    <>
      {/* 标题 + 创建按钮 */}
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold">项目</h2>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => setDialogOpen(true)}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {/* 列表 */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-10 animate-pulse rounded-md bg-muted" />
          ))}
        </div>
      ) : !projects?.length ? (
        <div className="flex flex-col items-center py-8 text-center">
          <FolderOpen className="mb-2 h-8 w-8 text-muted-foreground/30" />
          <p className="text-xs text-muted-foreground">还没有项目</p>
          <Button
            variant="link"
            size="sm"
            className="mt-1"
            onClick={() => setDialogOpen(true)}
          >
            创建第一个项目
          </Button>
        </div>
      ) : (
        <div className="space-y-0.5">
          {projects.map((project) => (
            <button
              key={project.id}
              onClick={() => handleSelect(project.id)}
              className={cn(
                "flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-accent",
                selectedProjectId === project.id && "bg-accent font-medium",
              )}
            >
              <FolderOpen
                className={cn(
                  "h-4 w-4 shrink-0",
                  selectedProjectId === project.id
                    ? "text-primary"
                    : "text-muted-foreground",
                )}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate">{project.name}</p>
                {project.description && (
                  <p className="truncate text-xs text-muted-foreground">
                    {project.description}
                  </p>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* 创建项目对话框 */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>创建项目</DialogTitle>
            <DialogDescription>创建一个新的定制项目工作区</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="project-name">项目名称</Label>
              <Input
                id="project-name"
                placeholder="my-project"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="project-desc">
                描述 <span className="text-muted-foreground">(可选)</span>
              </Label>
              <Input
                id="project-desc"
                placeholder="项目描述"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              取消
            </Button>
            <Button
              onClick={handleCreate}
              disabled={!name.trim() || createProject.isPending}
            >
              创建
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function UserMenu() {
  const { user, logout } = useAuthStore();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="w-full justify-start gap-2">
          <Avatar className="h-6 w-6">
            <AvatarFallback className="bg-primary/10 text-xs text-primary">
              {(user?.alias_name || user?.username || "U")
                .charAt(0)
                .toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <span className="truncate text-sm">
            {user?.alias_name || user?.username || "用户"}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48">
        <DropdownMenuItem disabled>
          <Settings className="h-4 w-4" />
          设置
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={logout} className="text-destructive">
          <LogOut className="h-4 w-4" />
          退出登录
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
