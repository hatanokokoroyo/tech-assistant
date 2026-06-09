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

  // 同步 URL projectId 到 store
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

  // 从 store 或 URL 获取当前项目 ID（未选择时为 null）
  const currentProjectId =
    selectedProjectId ?? (projectId && !Number.isNaN(pid) ? pid : null);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* ── 左侧栏：项目列表 ── */}
      <aside className="flex w-60 shrink-0 flex-col border-r bg-card">
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

        {/* 底部用户菜单 */}
        <div className="border-t p-3">
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
              <DropdownMenuItem>
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

      {/* ── 中栏：Tab + 列表 ── */}
      <aside className="flex w-70 shrink-0 flex-col border-r bg-muted/30">
        {/* Tab 按钮 */}
        <div className="flex border-b px-2 py-1.5">
          {panelTabs.map((tab) => (
            <Tooltip key={tab.key}>
              <TooltipTrigger asChild>
                <Button
                  variant={activeTab === tab.key ? "secondary" : "ghost"}
                  size="sm"
                  className="flex-1 gap-1.5"
                  onClick={() => handleTabClick(tab.segment)}
                >
                  <tab.icon className="h-4 w-4" />
                  <span className="text-xs">{tab.label}</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>{tab.label}</TooltipContent>
            </Tooltip>
          ))}
        </div>

        {/* 可选的中栏头部 */}
        {middleHeader}

        {/* 中栏列表内容 */}
        <ScrollArea className="flex-1">{middleContent}</ScrollArea>
      </aside>

      {/* ── 右栏：内容区 ── */}
      <main className="flex flex-1 flex-col overflow-hidden">
        {rightContent}
      </main>
    </div>
  );
}

// ── 项目列表子组件（左侧栏） ──
function ProjectListContent() {
  const navigate = useNavigate();
  const { selectedProjectId, setSelectedProjectId } = useAppStore();
  const { data: projects, isLoading } = useProjects();

  const handleSelect = (id: number) => {
    setSelectedProjectId(id);
    // 默认跳转到文件 tab
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
