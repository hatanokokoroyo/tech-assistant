import { useEffect } from "react";
import { useNavigate, useParams } from "react-router";
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
  { key: "files", label: "文件", icon: FolderOpen, segment: "files" },
  { key: "chat", label: "对话", icon: MessageSquare, segment: "chat" },
  { key: "repos", label: "仓库", icon: GitBranch, segment: "repos" },
] as const;

type PanelTab = (typeof panelTabs)[number]["key"];

interface PanelLayoutProps {
  activeTab: PanelTab;
  /** 中栏顶部内容（Tab 下方，列表上方），如标题栏、新建按钮 */
  middleHeader?: React.ReactNode;
  /** 中栏列表内容 */
  middleContent: React.ReactNode;
  /** 右栏内容 */
  rightContent: React.ReactNode;
}

/**
 * 三栏 IDE 布局：
 * 左侧栏（项目列表）+ 中栏（Tab + 列表）+ 右栏（内容区）
 */
export default function PanelLayout({
  activeTab,
  middleHeader,
  middleContent,
  rightContent,
}: PanelLayoutProps) {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const { selectedProjectId, setSelectedProjectId } = useAppStore();
  const pid = Number(projectId);

  useEffect(() => {
    if (projectId && !Number.isNaN(pid)) {
      setSelectedProjectId(pid);
    }
  }, [projectId, pid, setSelectedProjectId]);

  const handleBack = () => {
    setSelectedProjectId(null);
    navigate("/projects");
  };

  const handleTabClick = (segment: string) => {
    navigate(`/projects/${pid}/${segment}`);
  };

  const currentProjectId =
    selectedProjectId ?? (projectId && !Number.isNaN(pid) ? pid : null);

  return (
    <div className="flex h-screen overflow-hidden bg-background p-3 text-foreground">
      <div className="flex min-h-0 flex-1 overflow-hidden rounded-[22px] border border-border/80 bg-panel shadow-md">
        <aside className="flex w-64 shrink-0 flex-col border-r border-border/70 bg-sidebar text-sidebar-foreground">
          <div className="border-b border-white/8 px-4 py-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-sidebar-foreground/55">
              Workspace
            </p>
            <h1 className="mt-2 text-base font-semibold text-sidebar-foreground">
              Tech Assistant
            </h1>
          </div>

          <ScrollArea className="flex-1">
            <div className="p-3">
              {currentProjectId ? (
                <div className="space-y-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start gap-2 text-sidebar-foreground/72 hover:bg-white/6 hover:text-sidebar-foreground"
                    onClick={handleBack}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    所有项目
                  </Button>
                  <Separator className="bg-white/8" />
                </div>
              ) : null}
              <ProjectListContent />
            </div>
          </ScrollArea>

          <div className="border-t border-white/8 p-3">
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
                <DropdownMenuItem
                  onClick={logout}
                  className="text-destructive"
                >
                  <LogOut className="h-4 w-4" />
                  退出登录
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </aside>

        <aside className="flex w-[23rem] shrink-0 flex-col border-r border-border/70 bg-panel-muted/86 backdrop-blur-sm">
          <div className="border-b border-border/70 p-2">
            <div className="grid grid-cols-3 gap-2 rounded-[14px] bg-panel p-1 shadow-sm">
              {panelTabs.map((tab) => (
                <Tooltip key={tab.key}>
                  <TooltipTrigger asChild>
                    <Button
                      variant={activeTab === tab.key ? "secondary" : "ghost"}
                      size="sm"
                      className={cn(
                        "h-10 gap-2 rounded-[10px]",
                        activeTab === tab.key
                          ? "bg-panel-elevated text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                      onClick={() => handleTabClick(tab.segment)}
                    >
                      <tab.icon className="h-4 w-4" />
                      <span className="text-xs font-medium">{tab.label}</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{tab.label}</TooltipContent>
                </Tooltip>
              ))}
            </div>
          </div>

          {middleHeader}

          <ScrollArea className="flex-1">{middleContent}</ScrollArea>
        </aside>

        <main className="flex flex-1 flex-col overflow-hidden bg-panel-elevated">
          {rightContent}
        </main>
      </div>
    </div>
  );
}

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
      <div className="space-y-2 p-1 pt-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="h-12 animate-pulse rounded-[12px] bg-white/6"
          />
        ))}
      </div>
    );
  }

  if (!projects?.length) {
    return (
      <div className="px-3 py-10 text-center text-sm text-sidebar-foreground/55">
        还没有项目
      </div>
    );
  }

  return (
    <div className="space-y-1 pt-3">
      {projects.map((project) => {
        const active = selectedProjectId === project.id;
        return (
          <button
            key={project.id}
            onClick={() => handleSelect(project.id)}
            className={cn(
              "group relative flex w-full items-center gap-3 rounded-[12px] border px-3 py-3 text-left transition-all",
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
                active ? "text-primary" : "text-sidebar-foreground/45",
              )}
            />
            <span className="truncate text-sm font-medium">{project.name}</span>
          </button>
        );
      })}
    </div>
  );
}
