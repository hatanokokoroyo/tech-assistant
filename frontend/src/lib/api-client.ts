import { useAuthStore } from "@/stores/auth-store";

export interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
}

export class ApiError extends Error {
  status: number;
  apiMessage: string;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.apiMessage = message;
  }
}

function getToken(): string | null {
  // 直接从 Zustand 内存状态读取（同步，无竞态）
  return useAuthStore.getState().token;
}

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = getToken();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(path, {
    ...options,
    headers,
  });

  if (res.status === 401) {
    localStorage.removeItem("tech-assistant-auth");
    window.location.href = "/login";
    throw new ApiError(401, "未授权，请重新登录");
  }

  if (!res.ok) {
    let message = `请求失败 (${res.status})`;
    try {
      const body = await res.json();
      message = body.message || body.detail || message;
    } catch {
      // ignore
    }
    throw new ApiError(res.status, message);
  }

  const json = (await res.json()) as ApiResponse<T>;

  if (json.code !== 0) {
    throw new ApiError(json.code, json.message || "请求失败");
  }

  return json.data;
}

export const apiClient = {
  get: <T>(path: string) => request<T>(path),

  post: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: "POST",
      body: body ? JSON.stringify(body) : undefined,
    }),

  put: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: "PUT",
      body: body ? JSON.stringify(body) : undefined,
    }),

  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};
