import { apiClient } from "@/lib/api-client";

export interface DatasourceListItem {
  id: number;
  name: string;
  db_type: "mysql" | "redis" | "tdengine";
  host: string;
  port: number;
  created_at: string;
}

export interface DatasourceDetail {
  id: number;
  name: string;
  db_type: "mysql" | "redis" | "tdengine";
  host: string;
  port: number;
  database_name: string | null;
  username: string | null;
  password: string;  // 始终是 "******"
  extra_config: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface DatasourceCreate {
  name: string;
  db_type: "mysql" | "redis" | "tdengine";
  host: string;
  port: number;
  database_name?: string;
  username?: string;
  password: string;
  extra_config?: Record<string, unknown>;
}

export interface DatasourceUpdate {
  name?: string;
  host?: string;
  port?: number;
  database_name?: string;
  username?: string;
  password?: string;  // 空字符串 = 保留原密码
  extra_config?: Record<string, unknown>;
}

export interface TestResult {
  success: boolean;
  message: string;
  latency_ms: number;
}

export const datasourceApi = {
  list: (projectId: number) =>
    apiClient.get<{ items: DatasourceListItem[]; total: number }>(
      `/api/projects/${projectId}/datasources`,
    ),

  get: (projectId: number, dsId: number) =>
    apiClient.get<DatasourceDetail>(
      `/api/projects/${projectId}/datasources/${dsId}`,
    ),

  create: (projectId: number, data: DatasourceCreate) =>
    apiClient.post<DatasourceListItem>(
      `/api/projects/${projectId}/datasources`,
      data,
    ),

  update: (projectId: number, dsId: number, data: DatasourceUpdate) =>
    apiClient.put<DatasourceDetail>(
      `/api/projects/${projectId}/datasources/${dsId}`,
      data,
    ),

  delete: (projectId: number, dsId: number) =>
    apiClient.delete<void>(
      `/api/projects/${projectId}/datasources/${dsId}`,
    ),

  test: (projectId: number, dsId: number) =>
    apiClient.post<TestResult>(
      `/api/projects/${projectId}/datasources/${dsId}/test`,
    ),
};
