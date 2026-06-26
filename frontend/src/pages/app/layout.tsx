import { Outlet, useNavigate, useLocation, useParams } from "react-router";
import {
  FolderOpen,
  Plus,
  Settings,
  LogOut,
  Sparkles,
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

export default function AppLayout() {
  const location = useLocation();
  const isInProject = location.pathname.startsWith("/projects/");

  if (isInProject) {
    return <Outlet />;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background p-3 text-foreground">
      <div className="flex min-h-0 flex-1 overflow-hidden rounded-[22px] border border-border/80 bg-panel shadow-md">
        <Sidebar />
        <main className="flex flex-1 overflow-hidden bg-panel-elevated">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export function ProjectPlaceholder() {
  return (
    <div className="flex flex-1 items-center justify-center px-8 text-muted-foreground">
      <div className="max-w-md rounded-[24px] border border-border/80 bg-panel px-8 py-10 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-[18px] bg-primary-soft text-primary">
          <FolderOpen className="h-6 w-6" />
        </div>
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground/80">
          Workspace Ready
        </p>
        <h2 className="mt-3 text-xl font-semibold text-foreground">
          选择一个项目开始工作
        </h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          从左侧项目列表进入文件、对话与仓库面板，建立一个更专注的开发工作流。
        </p>
      </div>
    </div>
  );
}

function Sidebar() {
  return (
    <aside className="flex w-72 shrink-0 flex-col border-r border-border/70 bg-sidebar text-sidebar-foreground">
      <div className="border-b border-white/8 px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-[14px] bg-white/6 ring-1 ring-white/8">
            <Sparkles className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-sidebar-foreground/50">
              Developer Workspace
            </p>
            <h1 className="mt-1 text-base font-semibold text-sidebar-foreground">
              Tech Assistant
            </h1>
          </div>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-3">
          <SidebarProjectList />
        </div>
      </ScrollArea>
      <div className="border-t border-white/8 p-3">
        <UserMenu />
      </div>
    </aside>
  );
}

function SidebarProjectList() {
  const navigate = useNavigate();
  const { projectId } = useParams<{ projectId: string }>();
  const routeProjectId = projectId ? Number(projectId) : null;
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
      <div className="mb-4 flex items-center justify-between px-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-sidebar-foreground/45">
            Projects
          </p>
          <h2 className="mt-1 text-sm font-semibold text-sidebar-foreground">
            项目工作区
          </h2>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 rounded-[12px] text-sidebar-foreground/72 hover:bg-white/6 hover:text-sidebar-foreground"
          onClick={() => setDialogOpen(true)}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-12 animate-pulse rounded-[12px] bg-white/6" />
          ))}
        </div>
      ) : !projects?.length ? (
        <div className="rounded-[18px] border border-white/8 bg-white/4 px-4 py-8 text-center">
          <FolderOpen className="mx-auto mb-3 h-9 w-9 text-sidebar-foreground/28" />
          <p className="text-sm font-medium text-sidebar-foreground/88">还没有项目</p>
          <p className="mt-1 text-xs leading-5 text-sidebar-foreground/48">
            创建第一个项目，开始组织文件、对话和仓库。
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-4 border-white/10 bg-white/6 text-sidebar-foreground hover:bg-white/10"
            onClick={() => setDialogOpen(true)}
          >
            创建第一个项目
          </Button>
        </div>
      ) : (
        <div className="space-y-1">
          {projects.map((project) => {
            const active =
              selectedProjectId === project.id || routeProjectId === project.id;
            return (
              <button
                key={project.id}
                onClick={() => handleSelect(project.id)}
                className={cn(
                  "group relative flex w-full items-center gap-3 rounded-[14px] border px-3 py-3 text-left transition-all",
                  active
                    ? "border-primary/25 bg-white/9 text-sidebar-foreground shadow-sm"
                    : "border-transparent text-sidebar-foreground/76 hover:border-white/8 hover:bg-white/5 hover:text-sidebar-foreground",
                )}
              >
                <span
                  className={cn(
                    "absolute inset-y-2 left-0 w-0.5 rounded-full bg-primary transition-opacity",
                    active ? "opacity-100" : "opacity-0 group-hover:opacity-60",
                  )}
                />
                <FolderOpen
                  className={cn(
                    "h-4 w-4 shrink-0",
                    active ? "text-primary" : "text-sidebar-foreground/42",
                  )}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{project.name}</p>
                  {project.description && (
                    <p className="mt-1 truncate text-xs text-sidebar-foreground/48">
                      {project.description}
                    </p>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}

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
  const navigate = useNavigate();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="h-11 w-full justify-start gap-3 rounded-[12px] px-3 text-sidebar-foreground/86 hover:bg-white/6 hover:text-sidebar-foreground"
        >
          <Avatar className="h-7 w-7 border border-white/10 bg-white/6">
            <AvatarFallback className="bg-primary/15 text-xs text-primary">
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
      <DropdownMenuContent align="start" className="w-52">
        <DropdownMenuItem onClick={() => navigate("/settings")}>
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
