import { apiClient } from "@/lib/api-client";

export interface Project {
  id: number;
  name: string;
  description: string | null;
  repo_count?: number;
  created_at: string;
  updated_at?: string;
}

interface PaginatedResponse<T> {
  items: T[];
  total: number;
}

interface CreateProjectDto {
  name: string;
  description?: string;
}

interface UpdateProjectDto {
  name?: string;
  description?: string;
}

export const projectApi = {
  list: () =>
    apiClient.get<PaginatedResponse<Project>>("/api/projects"),
  get: (id: number) => apiClient.get<Project>(`/api/projects/${id}`),
  create: (data: CreateProjectDto) =>
    apiClient.post<Project>("/api/projects", data),
  update: (id: number, data: UpdateProjectDto) =>
    apiClient.put<Project>(`/api/projects/${id}`, data),
  delete: (id: number) => apiClient.delete<void>(`/api/projects/${id}`),
};
