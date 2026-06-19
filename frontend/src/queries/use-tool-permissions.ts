import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toolPermissionApi } from "@/api/tool-permissions";

export function useToolPermissions(projectId: number) {
  return useQuery({
    queryKey: ["tool-permissions", projectId] as const,
    queryFn: () => toolPermissionApi.get(projectId),
    enabled: !!projectId && !Number.isNaN(projectId),
  });
}

export function useUpdateToolPermissions(projectId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (permissions: { tool_name: string; permission: string }[]) =>
      toolPermissionApi.update(projectId, permissions),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tool-permissions", projectId] });
    },
  });
}
