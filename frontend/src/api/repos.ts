import { apiClient } from "@/lib/api-client";

export interface Repo {
  id: number;
  name: string;
  url: string;
  current_branch: string;
  created_at: string;
}

export interface Branches {
  local_branches: string[];
  remote_branches: string[];
  current_branch: string;
}

interface PaginatedResponse<T> {
  items: T[];
  total: number;
}

export const repoApi = {
  list: (projectId: number) =>
    apiClient.get<PaginatedResponse<Repo>>(
      `/api/projects/${projectId}/repos`,
    ),
  create: (projectId: number, data: { name: string; url: string }) =>
    apiClient.post<Repo>(`/api/projects/${projectId}/repos`, data),
  delete: (projectId: number, repoId: number) =>
    apiClient.delete<void>(
      `/api/projects/${projectId}/repos/${repoId}`,
    ),
  getBranches: (projectId: number, repoId: number) =>
    apiClient.get<Branches>(
      `/api/projects/${projectId}/repos/${repoId}/branches`,
    ),
  checkout: (projectId: number, repoId: number, branch: string) =>
    apiClient.post<{ current_branch: string }>(
      `/api/projects/${projectId}/repos/${repoId}/checkout`,
      { branch },
    ),
};
