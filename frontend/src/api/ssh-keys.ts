import { apiClient } from "@/lib/api-client";

export interface SshKey {
  id: number;
  user_id: number;
  name: string;
  fingerprint: string;
  created_at: string;
}

export const sshKeyApi = {
  list: () => apiClient.get<SshKey[]>("/api/ssh-keys"),
  uploadText: (data: { name: string; public_key: string }) =>
    apiClient.post<SshKey>("/api/ssh-keys", data),
  uploadFile: (formData: FormData) =>
    fetch("/api/ssh-keys", {
      method: "POST",
      body: formData,
    }),
  delete: (id: number) => apiClient.delete<void>(`/api/ssh-keys/${id}`),
};
