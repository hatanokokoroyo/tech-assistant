import { apiClient } from "@/lib/api-client";
import { useAuthStore } from "@/stores/auth-store";

export interface SshKey {
  id: number;
  fingerprint: string | null;
  created_at: string;
}

export const sshKeyApi = {
  get: () => apiClient.get<SshKey | null>("/api/ssh-keys"),
  upload: (formData: FormData) => {
    const token = useAuthStore.getState().token;
    return fetch("/api/ssh-keys", {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    }).then(async (res) => {
      if (!res.ok) throw new Error(`上传失败 (${res.status})`);
      const json = await res.json();
      if (json.code !== 0) throw new Error(json.message || "上传失败");
      return json.data as SshKey;
    });
  },
  uploadText: (data: { name: string; public_key: string }) =>
    apiClient.post<SshKey>("/api/ssh-keys", data),
  delete: (id: number) => apiClient.delete<void>(`/api/ssh-keys/${id}`),
};
