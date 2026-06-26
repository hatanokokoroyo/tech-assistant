import { useNavigate } from "react-router";
import {
  File,
  RefreshCw,
  FolderOpen,
  ChevronRight,
  ChevronDown,
  Dot,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useFileTree } from "@/queries/use-files";
import type { FileTreeNode } from "@/api/files";
import { useFileEditor } from "./file-editor-hook";
import { cn } from "@/lib/utils";
import { useState, useCallback } from "react";

export function FilePanelHeader({ pid }: { pid: number }) {
  return (
    <div className="border-b border-border/70 px-4 py-3">
      <div className="flex items-center justify-between gap-3 rounded-[14px] border border-border/70 bg-panel px-3 py-3 shadow-sm">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground/80">
            Files
          </p>
          <h2 className="mt-1 text-sm font-semibold text-foreground">项目文件</h2>
        </div>
        <RefreshButton pid={pid} />
      </div>
    </div>
  );
}

function RefreshButton({ pid }: { pid: number }) {
  const { refetch, isFetching } = useFileTree(pid);
  return (
    <Button
      variant="secondary"
      size="sm"
      className="gap-1.5"
      onClick={() => refetch()}
      disabled={isFetching}
    >
      <RefreshCw className={cn("h-3.5 w-3.5", isFetching && "animate-spin")} />
      {isFetching ? "刷新中..." : "刷新"}
    </Button>
  );
}

export function FileTreeContent({
  pid,
  selectedPath,
}: {
  pid: number;
  selectedPath: string;
}) {
  const navigate = useNavigate();
  const { data: tree, isLoading } = useFileTree(pid);

  const handleSelect = useCallback(
    (path: string) => {
      navigate(`/projects/${pid}/files/${encodeURIComponent(path)}`);
    },
    [navigate, pid],
  );

  if (isLoading) {
    return (
      <div className="space-y-2 p-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="h-9 animate-pulse rounded-[12px] bg-panel"
            style={{ width: `${65 + Math.random() * 28}%` }}
          />
        ))}
      </div>
    );
  }

  if (!tree?.length) {
    return (
      <div className="px-4 py-10">
        <div className="rounded-[18px] border border-dashed border-border/80 bg-panel px-5 py-8 text-center shadow-sm">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-[16px] bg-primary-soft text-primary">
            <FolderOpen className="h-5 w-5" />
          </div>
          <p className="text-sm font-medium text-foreground">暂无文件</p>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            当前项目还没有可编辑文件，稍后刷新文件树或检查仓库内容。
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1 p-3">
      {tree.map((node) => (
        <FileTreeNodeComponent
          key={node.path}
          node={node}
          depth={0}
          selectedPath={selectedPath}
          onSelect={handleSelect}
        />
      ))}
    </div>
  );
}

function FileTreeNodeComponent({
  node,
  depth,
  selectedPath,
  onSelect,
}: {
  node: FileTreeNode;
  depth: number;
  selectedPath: string;
  onSelect: (path: string) => void;
}) {
  const shouldExpandForSelected =
    node.type === "directory" &&
    !!selectedPath &&
    (selectedPath === node.path || selectedPath.startsWith(`${node.path}/`));
  const [expanded, setExpanded] = useState(depth < 2 || shouldExpandForSelected);

  if (node.type === "directory") {
    return (
      <div>
        <button
          className="group flex w-full items-center gap-2 rounded-[12px] px-3 py-2.5 text-left text-sm transition-all hover:bg-panel hover:text-foreground"
          style={{ paddingLeft: `${depth * 14 + 12}px` }}
          onClick={() => setExpanded(!expanded)}
        >
          <span className="flex h-5 w-5 items-center justify-center rounded-[8px] bg-panel text-muted-foreground group-hover:text-foreground">
            {expanded ? (
              <ChevronDown className="h-3.5 w-3.5 shrink-0" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 shrink-0" />
            )}
          </span>
          <FolderOpen className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="truncate font-medium text-foreground/88">{node.name}</span>
        </button>
        {expanded &&
          node.children?.map((child: FileTreeNode) => (
            <FileTreeNodeComponent
              key={child.path}
              node={child}
              depth={depth + 1}
              selectedPath={selectedPath}
              onSelect={onSelect}
            />
          ))}
      </div>
    );
  }

  const active = selectedPath === node.path;

  return (
    <button
      className={cn(
        "group relative flex w-full items-center gap-2 rounded-[12px] border px-3 py-2.5 text-left text-sm transition-all",
        active
          ? "border-primary/25 bg-panel-elevated shadow-sm ring-1 ring-primary/10"
          : "border-transparent hover:border-border/70 hover:bg-panel",
      )}
      style={{ paddingLeft: `${depth * 14 + 24}px` }}
      onClick={() => onSelect(node.path)}
    >
      <span
        className={cn(
          "absolute inset-y-2 left-0 w-0.5 rounded-full bg-primary transition-opacity",
          active ? "opacity-100" : "opacity-0 group-hover:opacity-60",
        )}
      />
      <File
        className={cn(
          "h-4 w-4 shrink-0",
          active ? "text-primary" : "text-muted-foreground",
        )}
      />
      <span className="truncate font-medium text-foreground/90">{node.name}</span>
    </button>
  );
}

export function FileEditorContent({
  pid,
  filePath,
}: {
  pid: number;
  filePath: string;
}) {
  const { content, dirty, setDirty, setContent, handleSave, saving, isLoading } =
    useFileEditor(pid, filePath);

  if (!filePath) {
    return (
      <div className="flex flex-1 items-center justify-center px-8 text-muted-foreground">
        <div className="max-w-md rounded-[24px] border border-dashed border-border/80 bg-panel px-8 py-10 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-[18px] bg-primary-soft text-primary">
            <File className="h-6 w-6" />
          </div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground/75">
            Editor Ready
          </p>
          <h3 className="mt-3 text-xl font-semibold text-foreground">选择一个文件开始编辑</h3>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            从左侧文件树选择目标文件，在这里查看内容、修改代码并通过快捷键完成保存。
          </p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center bg-panel-elevated">
        <div className="flex items-center gap-3 rounded-[18px] border border-border/80 bg-panel px-5 py-4 shadow-sm">
          <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-muted-foreground/50 border-t-transparent" />
          <span className="text-sm text-muted-foreground">正在加载文件...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col bg-panel-elevated">
      <div className="border-b border-border/70 bg-panel/75 px-4 py-3 backdrop-blur-sm">
        <div className="flex items-center justify-between gap-4 rounded-[16px] border border-border/70 bg-panel-elevated px-4 py-3 shadow-sm">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground/80">
              Active file
            </p>
            <div className="mt-1 flex items-center gap-2">
              <File className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="truncate font-mono text-sm text-foreground">{filePath}</span>
              {dirty && (
                <span
                  className="flex items-center gap-1 rounded-full bg-warning/14 px-2 py-0.5 text-[11px] font-medium text-warning"
                  title="未保存"
                >
                  <Dot className="h-4 w-4" />
                  已修改
                </span>
              )}
            </div>
          </div>
          <Button size="sm" onClick={handleSave} disabled={!dirty || saving}>
            {saving ? "保存中..." : "保存文件"}
          </Button>
        </div>
      </div>

      <div className="min-h-0 flex-1 px-4 py-4">
        <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-[20px] border border-border/80 bg-panel shadow-sm">
          <div className="flex items-center justify-between border-b border-border/70 px-4 py-2.5 text-xs text-muted-foreground">
            <span className="font-medium">编辑区</span>
            <span className="font-mono">⌘/Ctrl + S 保存</span>
          </div>
          <div className="flex-1 overflow-auto bg-panel-elevated">
            <textarea
              value={content}
              onChange={(e) => {
                setContent(e.target.value);
                setDirty(true);
              }}
              className="h-full w-full resize-none border-0 bg-transparent p-5 font-mono text-sm leading-7 text-foreground focus:outline-none"
              spellCheck={false}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
