import { apiClient } from "@/lib/api-client";

interface LoginRequest {
  username: string;
  password: string;
}

interface RegisterRequest {
  username: string;
  password: string;
  alias_name?: string;
}

interface LoginResponse {
  access_token: string;
  token_type: string;
}

export interface UserInfo {
  id: number;
  username: string;
  alias_name: string | null;
  created_at: string;
}

export const authApi = {
  login: (data: LoginRequest) =>
    apiClient.post<LoginResponse>("/api/auth/login", data),
  register: (data: RegisterRequest) =>
    apiClient.post<unknown>("/api/auth/register", data),
  getMe: () => apiClient.get<UserInfo>("/api/auth/me"),
};
