import { useNavigate, useParams } from "react-router";
import { FolderOpen, File, ChevronRight, ChevronDown, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useFileTree } from "@/queries/use-files";
import type { FileTreeNode } from "@/api/files";
import { cn } from "@/lib/utils";
import { useState, useCallback } from "react";

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
          className={cn(
            "flex w-full items-center gap-1 rounded-md px-2 py-1 text-left text-sm transition-colors hover:bg-accent",
          )}
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
        {expanded && node.children && (
          <div>
            {node.children.map((child: FileTreeNode) => (
              <FileTreeNodeComponent
                key={child.path}
                node={child}
                depth={depth + 1}
                selectedPath={selectedPath}
                onSelect={onSelect}
              />
            ))}
          </div>
        )}
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

export default function FilePanel() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const pid = Number(projectId);
  const { data: tree, isLoading, refetch } = useFileTree(pid);

  // 从 URL 中提取当前选中的文件路径
  const currentPath = window.location.pathname;
  const filesMatch = currentPath.match(/\/projects\/\d+\/files\/(.+)/);
  const selectedPath = filesMatch ? decodeURIComponent(filesMatch[1]) : "";

  const handleSelect = useCallback(
    (path: string) => {
      navigate(`/projects/${pid}/files/${encodeURIComponent(path)}`);
    },
    [navigate, pid],
  );

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b px-3 py-2">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          文件
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={() => refetch()}
        >
          <RefreshCw className="h-3 w-3" />
        </Button>
      </div>
      <div className="flex-1 overflow-auto p-1">
        {isLoading ? (
          <div className="space-y-1 p-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="h-6 animate-pulse rounded bg-muted"
                style={{ width: `${60 + Math.random() * 40}%` }}
              />
            ))}
          </div>
        ) : !tree?.length ? (
          <div className="p-4 text-center text-xs text-muted-foreground">
            暂无文件
          </div>
        ) : (
          tree.map((node) => (
            <FileTreeNodeComponent
              key={node.path}
              node={node}
              depth={0}
              selectedPath={selectedPath}
              onSelect={handleSelect}
            />
          ))
        )}
      </div>
    </div>
  );
}
