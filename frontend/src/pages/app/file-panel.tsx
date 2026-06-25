import { useNavigate } from "react-router";
import { File, RefreshCw, FolderOpen, ChevronRight, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useFileTree } from "@/queries/use-files";
import type { FileTreeNode } from "@/api/files";
import { useFileEditor } from "./file-editor-hook";
import { cn } from "@/lib/utils";
import { useState, useCallback } from "react";
// ── 中栏标题 ──
export function FilePanelHeader({ pid }: { pid: number }) {
  return (
    <div className="flex items-center justify-between border-b px-3 py-2">
      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
        文件
      </span>
      <RefreshButton pid={pid} />
    </div>
  );
}

function RefreshButton({ pid }: { pid: number }) {
  const { refetch } = useFileTree(pid);
  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-6 w-6"
      onClick={() => refetch()}
    >
      <RefreshCw className="h-3 w-3" />
    </Button>
  );
}

// ── 中栏文件树 ──
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
      <div className="space-y-1 p-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="h-6 animate-pulse rounded bg-muted"
            style={{ width: `${60 + Math.random() * 40}%` }}
          />
        ))}
      </div>
    );
  }

  if (!tree?.length) {
    return (
      <div className="p-4 text-center text-xs text-muted-foreground">
        暂无文件
      </div>
    );
  }

  return (
    <div className="p-1">
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
  const [expanded, setExpanded] = useState(depth < 2);

  if (node.type === "directory") {
    return (
      <div>
        <button
          className="flex w-full items-center gap-1 rounded-md px-2 py-1 text-left text-sm transition-colors hover:bg-accent"
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? (
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          )}
          <FolderOpen className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="truncate">{node.name}</span>
        </button>
        {expanded && node.children?.map((child: FileTreeNode) => (
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

  return (
    <button
      className={cn(
        "flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-left text-sm transition-colors hover:bg-accent",
        selectedPath === node.path && "bg-accent font-medium",
      )}
      style={{ paddingLeft: `${depth * 12 + 20}px` }}
      onClick={() => onSelect(node.path)}
    >
      <File className="h-4 w-4 shrink-0 text-muted-foreground" />
      <span className="truncate">{node.name}</span>
    </button>
  );
}

// ── 右栏文件编辑器 ──
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
      <div className="flex flex-1 items-center justify-center text-muted-foreground">
        <div className="space-y-2 text-center">
          <File className="mx-auto h-10 w-10 opacity-30" />
          <p className="text-sm">选择一个文件开始编辑</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      {/* 工具栏 */}
      <div className="flex items-center justify-between border-b px-4 py-2">
        <div className="flex items-center gap-2">
          <File className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">{filePath}</span>
          {dirty && (
            <span className="h-2 w-2 rounded-full bg-warning" title="未保存" />
          )}
        </div>
        <Button size="sm" onClick={handleSave} disabled={!dirty || saving}>
          {saving ? "保存中..." : "保存"}
        </Button>
      </div>

      {/* 编辑器 */}
      <div className="flex-1 overflow-auto">
        <textarea
          value={content}
          onChange={(e) => {
            setContent(e.target.value);
            setDirty(true);
          }}
          className="h-full w-full resize-none border-0 bg-transparent p-4 font-mono text-sm leading-relaxed focus:outline-none"
          spellCheck={false}
        />
      </div>
    </div>
  );
}
