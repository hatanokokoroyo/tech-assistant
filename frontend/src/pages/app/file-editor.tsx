import { useState, useEffect, useCallback } from "react";
import { useParams } from "react-router";
import { Save, File, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useFile, useUpdateFile } from "@/queries/use-files";
import { toast } from "sonner";

export default function FileEditor() {
  const { projectId, "*": filePath } = useParams();
  const pid = Number(projectId);
  const decodedPath = filePath ? decodeURIComponent(filePath) : "";

  const { data: fileData, isLoading } = useFile(pid, decodedPath);
  const updateFile = useUpdateFile(pid);

  const [content, setContent] = useState("");
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (fileData) {
      setContent(fileData.content);
      setDirty(false);
    }
  }, [fileData]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setContent(e.target.value);
      setDirty(true);
    },
    [],
  );

  const handleSave = useCallback(async () => {
    if (!dirty || !decodedPath) return;
    try {
      await updateFile.mutateAsync({ filePath: decodedPath, content });
      setDirty(false);
      toast.success("文件已保存");
    } catch {
      toast.error("保存失败");
    }
  }, [dirty, decodedPath, content, updateFile]);

  // Ctrl+S 快捷键
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleSave]);

  if (!decodedPath) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        <div className="space-y-2 text-center">
          <File className="mx-auto h-10 w-10 opacity-30" />
          <p className="text-sm">选择一个文件开始编辑</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* 工具栏 */}
      <div className="flex items-center justify-between border-b px-4 py-2">
        <div className="flex items-center gap-2">
          <File className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">{decodedPath}</span>
          {dirty && (
            <span className="h-2 w-2 rounded-full bg-warning" title="未保存" />
          )}
        </div>
        <Button
          size="sm"
          onClick={handleSave}
          disabled={!dirty || updateFile.isPending}
        >
          {updateFile.isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Save className="h-3.5 w-3.5" />
          )}
          保存
        </Button>
      </div>

      {/* 编辑器 */}
      <div className="flex-1 overflow-auto">
        <Textarea
          value={content}
          onChange={handleChange}
          className="h-full resize-none rounded-none border-0 font-mono text-sm leading-relaxed focus-visible:ring-0"
          spellCheck={false}
        />
      </div>
    </div>
  );
}
