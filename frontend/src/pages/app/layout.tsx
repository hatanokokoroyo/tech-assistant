import { useEffect } from "react";
import { Outlet, useNavigate, useParams } from "react-router";
import {
  FolderOpen,
  MessageSquare,
  GitBranch,
  Settings,
  LogOut,
  ChevronLeft,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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

const panelTabs = [
  { key: "files", label: "文件", icon: FolderOpen, path: "files" },
  { key: "chat", label: "对话", icon: MessageSquare, path: "chat" },
  { key: "repos", label: "仓库", icon: GitBranch, path: "repos" },
] as const;

export default function AppLayout() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const { selectedProjectId, setSelectedProjectId } = useAppStore();

  // 同步 URL 中的 projectId 到 store
  useEffect(() => {
    if (projectId) {
      setSelectedProjectId(Number(projectId));
    } else {
      setSelectedProjectId(null);
    }
  }, [projectId, setSelectedProjectId]);

  const currentProjectId = selectedProjectId ?? (projectId ? Number(projectId) : null);

  // 判断当前激活的 tab
  const currentPath = window.location.pathname;
  const activeTab = panelTabs.find((t) => currentPath.includes(`/${t.path}`))?.key ?? "files";

  const handleTabClick = (path: string) => {
    if (currentProjectId) {
      navigate(`/projects/${currentProjectId}/${path}`);
    }
  };

  const handleBack = () => {
    setSelectedProjectId(null);
    navigate("/projects");
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* ── 左侧栏：项目列表 ── */}
      <aside className="flex w-60 flex-col border-r bg-card">
        {/* 项目列表内容区 */}
        <ScrollArea className="flex-1">
          <div className="p-3">
            {currentProjectId ? (
              <div className="space-y-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="mb-2 w-full justify-start gap-2 text-muted-foreground"
                  onClick={handleBack}
                >
                  <ChevronLeft className="h-4 w-4" />
                  所有项目
                </Button>
                <Separator className="mb-2" />
              </div>
            ) : null}
            <ProjectListContent />
          </div>
        </ScrollArea>

        {/* 底部用户信息 */}
        <div className="border-t p-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="w-full justify-start gap-2">
                <Avatar className="h-6 w-6">
                  <AvatarFallback className="bg-primary/10 text-xs text-primary">
                    {(user?.alias_name || user?.username || "U").charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="truncate text-sm">
                  {user?.alias_name || user?.username || "用户"}
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48">
              <DropdownMenuItem>
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
        </div>
      </aside>

      {/* ── 中栏 + 右栏 ── */}
      <div className="flex flex-1 overflow-hidden">
        {currentProjectId ? (
          <>
            {/* ── 中栏：功能 Tab ── */}
            <aside className="flex w-70 flex-col border-r bg-muted/30">
              {/* Tab 按钮 */}
              <div className="flex border-b px-2 py-1.5">
                {panelTabs.map((tab) => (
                  <Tooltip key={tab.key}>
                    <TooltipTrigger asChild>
                      <Button
                        variant={activeTab === tab.key ? "secondary" : "ghost"}
                        size="sm"
                        className="flex-1 gap-1.5"
                        onClick={() => handleTabClick(tab.path)}
                      >
                        <tab.icon className="h-4 w-4" />
                        <span className="text-xs">{tab.label}</span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{tab.label}</TooltipContent>
                  </Tooltip>
                ))}
              </div>

              {/* Tab 内容 */}
              <ScrollArea className="flex-1">
                <Outlet />
              </ScrollArea>
            </aside>
          </>
        ) : (
          /* 未选中项目时的占位 */
          <div className="flex flex-1 items-center justify-center text-muted-foreground">
            <div className="space-y-3 text-center">
              <FolderOpen className="mx-auto h-12 w-12 opacity-30" />
              <p className="text-sm">选择一个项目开始工作</p>
            </div>
          </div>
        )}

        {/* ── 右栏：内容区 ── */}
        {currentProjectId && (
          <main className="flex-1 overflow-hidden">
            <Outlet />
          </main>
        )}
      </div>
    </div>
  );
}

// ── 项目列表子组件 ──
function ProjectListContent() {
  const navigate = useNavigate();
  const { selectedProjectId, setSelectedProjectId } = useAppStore();
  const { data: projects, isLoading } = useProjects();

  const handleSelect = (id: number) => {
    setSelectedProjectId(id);
    navigate(`/projects/${id}/files`);
  };

  if (isLoading) {
    return (
      <div className="space-y-2 p-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-10 animate-pulse rounded-md bg-muted" />
        ))}
      </div>
    );
  }

  if (!projects?.length) {
    return (
      <div className="p-4 text-center text-sm text-muted-foreground">
        还没有项目
      </div>
    );
  }

  return (
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
          <FolderOpen className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="truncate">{project.name}</span>
        </button>
      ))}
    </div>
  );
}
