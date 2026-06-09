import { useState } from "react";
import { useNavigate } from "react-router";
import { Plus, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { useProjects, useCreateProject } from "@/queries/use-projects";
import { useAppStore } from "@/stores/app-store";
import { cn } from "@/lib/utils";

export default function ProjectList() {
  const navigate = useNavigate();
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
      // error handled by mutation
    }
  };

  const handleSelect = (id: number) => {
    setSelectedProjectId(id);
    navigate(`/projects/${id}/files`);
  };

  return (
    <div className="flex h-full flex-col">
      {/* 标题栏 */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <h2 className="text-sm font-semibold">项目</h2>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => setDialogOpen(true)}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {/* 项目列表 */}
      <div className="flex-1 overflow-auto p-2">
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-12 animate-pulse rounded-md bg-muted" />
            ))}
          </div>
        ) : !projects?.length ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <FolderOpen className="mb-3 h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">还没有项目</p>
            <Button
              variant="link"
              size="sm"
              className="mt-1"
              onClick={() => setDialogOpen(true)}
            >
              创建第一个项目
            </Button>
          </div>
        ) : (
          <div className="space-y-0.5">
            {projects.map((project) => (
              <button
                key={project.id}
                onClick={() => handleSelect(project.id)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left transition-colors hover:bg-accent",
                  selectedProjectId === project.id && "bg-accent",
                )}
              >
                <FolderOpen
                  className={cn(
                    "h-4 w-4 shrink-0",
                    selectedProjectId === project.id
                      ? "text-primary"
                      : "text-muted-foreground",
                  )}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{project.name}</p>
                  {project.description && (
                    <p className="truncate text-xs text-muted-foreground">
                      {project.description}
                    </p>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 创建项目对话框 */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>创建项目</DialogTitle>
            <DialogDescription>创建一个新的项目工作区</DialogDescription>
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
            <Button onClick={handleCreate} disabled={!name.trim() || createProject.isPending}>
              创建
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
