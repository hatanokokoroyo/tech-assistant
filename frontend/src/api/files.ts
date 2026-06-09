import { apiClient } from "@/lib/api-client";

export interface FileTreeNode {
  name: string;
  path: string;
  type: "file" | "directory";
  children?: FileTreeNode[];
}

export interface FileContent {
  path: string;
  content: string;
  size: number;
  modified_at: string;
}

export const fileApi = {
  getTree: (projectId: number) =>
    apiClient.get<FileTreeNode[]>(`/api/projects/${projectId}/files`),
  get: (projectId: number, filePath: string) =>
    apiClient.get<FileContent>(
      `/api/projects/${projectId}/files/${encodeURIComponent(filePath)}`,
    ),
  update: (projectId: number, filePath: string, content: string) =>
    apiClient.put<unknown>(
      `/api/projects/${projectId}/files/${encodeURIComponent(filePath)}`,
      { content },
    ),
};
