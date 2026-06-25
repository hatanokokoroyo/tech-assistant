import { useLocation, useParams } from "react-router";
import { useLayoutEffect, useMemo } from "react";
import { File, MessageSquare, GitBranch } from "lucide-react";
import { useAppStore } from "@/stores/app-store";
import PanelLayout from "@/components/shared/panel-layout";
import {
  FilePanelHeader,
  FileTreeContent,
  FileEditorContent,
} from "./file-panel";
import {
  ChatPanelHeader,
  ChatListContent,
  ChatViewContent,
} from "./chat-panel";
import { RepoPanelHeader, RepoListContent } from "./repo-panel";

type PanelTab = "files" | "chat" | "repos";

// ── URL 解析工具 ──

/** 从 URL 路径解析当前激活的 tab */
function getTabFromUrl(pathname: string, projectId: number): PanelTab {
  const prefix = `/projects/${projectId}/`;
  const rest = pathname.slice(prefix.length);
  const firstSegment = rest.split("/")[0];
  if (firstSegment === "chat") return "chat";
  if (firstSegment === "repos") return "repos";
  return "files";
}

/** 从 URL 路径解析选中的文件路径 */
function getFilePathFromUrl(
  pathname: string,
  projectId: number,
): string | null {
  const prefix = `/projects/${projectId}/files/`;
  if (!pathname.startsWith(prefix)) return null;
  const encoded = pathname.slice(prefix.length);
  return encoded ? decodeURIComponent(encoded) : null;
}

/** 从 URL 路径解析选中的对话 ID */
function getConversationIdFromUrl(
  pathname: string,
  projectId: number,
): number | null {
  const prefix = `/projects/${projectId}/chat/`;
  if (!pathname.startsWith(prefix)) return null;
  const idStr = pathname.slice(prefix.length).split("/")[0];
  const id = Number(idStr);
  return Number.isNaN(id) ? null : id;
}

/**
 * 项目详情页（统一组件）
 *
 * 替代原来的 FilePanel / ChatPanel / RepoPanel，解决切换 tab 时
 * 右栏内容被清空的问题：
 * - 中栏内容由当前 URL 对应的 tab 决定
 * - 右栏内容由 store 中的 activeContent 驱动，仅在用户点击具体
 *   文件/对话时才切换，切换 tab 不会清空右栏
 */
export default function ProjectDetail() {
  const { projectId } = useParams();
  const location = useLocation();
  const pid = Number(projectId);

  const { activeContent, setActiveContent } = useAppStore();

  // ── 从 URL 解析当前 tab 和选中项 ──
  const activeTab = useMemo(
    () => getTabFromUrl(location.pathname, pid),
    [location.pathname, pid],
  );

  const filePath = useMemo(
    () => getFilePathFromUrl(location.pathname, pid),
    [location.pathname, pid],
  );

  const conversationId = useMemo(
    () => getConversationIdFromUrl(location.pathname, pid),
    [location.pathname, pid],
  );

  // 当 URL 中有明确的选中项时，同步到 store
  // 切换 tab 但未选中具体项时不更新 store → 保留之前的右栏内容
  // 使用 useLayoutEffect 确保在浏览器绘制前同步更新，避免一帧闪烁
  useLayoutEffect(() => {
    if (activeTab === "files" && filePath) {
      setActiveContent({ type: "file", projectId: pid, filePath });
    } else if (activeTab === "chat" && conversationId) {
      setActiveContent({
        type: "conversation",
        projectId: pid,
        conversationId,
      });
    }
  }, [activeTab, filePath, conversationId, pid, setActiveContent]);

  // ── 右栏：由 activeContent 决定，与当前 tab 无关 ──
  const rightContent = useMemo(() => {
    if (activeContent?.type === "file" && activeContent.projectId === pid) {
      return <FileEditorContent pid={pid} filePath={activeContent.filePath} />;
    }
    if (
      activeContent?.type === "conversation" &&
      activeContent.projectId === pid
    ) {
      return (
        <ChatViewContent convId={activeContent.conversationId} pid={pid} />
      );
    }
    return <EmptyPlaceholder tab={activeTab} />;
  }, [activeContent, pid, activeTab]);

  // ── 中栏头部 ──
  const middleHeader = useMemo(() => {
    switch (activeTab) {
      case "files":
        return <FilePanelHeader pid={pid} />;
      case "chat":
        return <ChatPanelHeader pid={pid} />;
      case "repos":
        return <RepoPanelHeader pid={pid} />;
    }
  }, [activeTab, pid]);

  // ── 中栏列表：由当前 tab 决定 ──
  const middleContent = useMemo(() => {
    switch (activeTab) {
      case "files":
        return <FileTreeContent pid={pid} selectedPath={filePath || ""} />;
      case "chat":
        return (
          <ChatListContent pid={pid} currentConvId={conversationId} />
        );
      case "repos":
        return <RepoListContent pid={pid} />;
    }
  }, [activeTab, pid, filePath, conversationId]);

  return (
    <PanelLayout
      activeTab={activeTab}
      middleHeader={middleHeader}
      middleContent={middleContent}
      rightContent={rightContent}
    />
  );
}

// ── 空状态占位 ──
function EmptyPlaceholder({ tab }: { tab: PanelTab }) {
  const config: Record<PanelTab, { icon: typeof File; label: string }> = {
    files: { icon: File, label: "选择一个文件开始编辑" },
    chat: { icon: MessageSquare, label: "选择或创建一个对话" },
    repos: { icon: GitBranch, label: "选择仓库查看详情" },
  };
  const { icon: Icon, label } = config[tab];

  return (
    <div className="flex flex-1 items-center justify-center text-muted-foreground">
      <div className="space-y-2 text-center">
        <Icon className="mx-auto h-10 w-10 opacity-30" />
        <p className="text-sm">{label}</p>
      </div>
    </div>
  );
}
