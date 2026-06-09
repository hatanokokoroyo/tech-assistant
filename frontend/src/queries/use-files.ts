import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fileApi } from "@/api/files";
import { queryKeys } from "./keys";

export function useFileTree(projectId: number) {
  return useQuery({
    queryKey: queryKeys.files(projectId),
    queryFn: async () => {
      const res = await fileApi.getTree(projectId);
      return res.tree;
    },
    enabled: !!projectId && !Number.isNaN(projectId),
  });
}

export function useFile(projectId: number, filePath: string) {
  return useQuery({
    queryKey: queryKeys.file(projectId, filePath),
    queryFn: () => fileApi.get(projectId, filePath),
    enabled: !!projectId && !Number.isNaN(projectId) && !!filePath,
  });
}

export function useUpdateFile(projectId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { filePath: string; content: string }) =>
      fileApi.update(projectId, vars.filePath, vars.content),
    onSuccess: (_: unknown, variables: { filePath: string; content: string }) => {
      qc.invalidateQueries({
        queryKey: queryKeys.file(projectId, variables.filePath),
      });
    },
  });
}
