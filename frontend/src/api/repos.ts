import { apiClient } from "@/lib/api-client";

export interface Repo {
  id: number;
  project_id: number;
  name: string;
  git_url: string;
  local_path: string;
  created_at: string;
}

export interface Branch {
  name: string;
  is_current: boolean;
  is_remote: boolean;
}

export const repoApi = {
  list: (projectId: number) =>
    apiClient.get<Repo[]>(`/api/projects/${projectId}/repos`),
  create: (projectId: number, data: { name: string; git_url: string }) =>
    apiClient.post<Repo>(`/api/projects/${projectId}/repos`, data),
  delete: (projectId: number, repoId: number) =>
    apiClient.delete<void>(
      `/api/projects/${projectId}/repos/${repoId}`,
    ),
  getBranches: (projectId: number, repoId: number) =>
    apiClient.get<Branch[]>(
      `/api/projects/${projectId}/repos/${repoId}/branches`,
    ),
  checkout: (projectId: number, repoId: number, branch: string) =>
    apiClient.post<unknown>(
      `/api/projects/${projectId}/repos/${repoId}/checkout`,
      { branch },
    ),
};
