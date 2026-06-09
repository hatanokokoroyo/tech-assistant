import { useState, useEffect, useCallback } from "react";
import { useFile, useUpdateFile } from "@/queries/use-files";
import { toast } from "sonner";

export function useFileEditor(pid: number, filePath: string) {
  const { data: fileData, isLoading } = useFile(pid, filePath);
  const updateFile = useUpdateFile(pid);

  const [content, setContent] = useState("");
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (fileData) {
      setContent(fileData.content);
      setDirty(false);
    }
  }, [fileData]);

  const handleSave = useCallback(async () => {
    if (!dirty || !filePath) return;
    try {
      await updateFile.mutateAsync({ filePath, content });
      setDirty(false);
      toast.success("文件已保存");
    } catch {
      toast.error("保存失败");
    }
  }, [dirty, filePath, content, updateFile]);

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

  return {
    content,
    dirty,
    setDirty,
    setContent,
    handleSave,
    saving: updateFile.isPending,
    isLoading,
  };
}
