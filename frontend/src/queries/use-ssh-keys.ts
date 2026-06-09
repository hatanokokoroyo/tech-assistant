import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { sshKeyApi } from "@/api/ssh-keys";

export function useSshKey() {
  return useQuery({
    queryKey: ["ssh-keys"],
    queryFn: sshKeyApi.get,
  });
}

export function useUploadSshKeyFile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      return sshKeyApi.upload(formData);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ssh-keys"] });
    },
  });
}

export function useUploadSshKeyText() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (content: string) => {
      const formData = new FormData();
      formData.append("private_key_content", content);
      return sshKeyApi.upload(formData);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ssh-keys"] });
    },
  });
}

export function useDeleteSshKey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => sshKeyApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ssh-keys"] });
    },
  });
}
