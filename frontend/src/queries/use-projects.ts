import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { projectApi } from "@/api/projects";
import { queryKeys } from "./keys";

export function useProjects() {
  return useQuery({
    queryKey: queryKeys.projects,
    queryFn: async () => {
      const res = await projectApi.list();
      return res.items;
    },
  });
}

export function useProject(id: number) {
  return useQuery({
    queryKey: queryKeys.project(id),
    queryFn: () => projectApi.get(id),
    enabled: !!id && !Number.isNaN(id),
  });
}

export function useCreateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; description?: string }) =>
      projectApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.projects });
    },
  });
}

export function useUpdateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      id: number;
      data: { name?: string; description?: string };
    }) => projectApi.update(vars.id, vars.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.projects });
    },
  });
}

export function useDeleteProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => projectApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.projects });
    },
  });
}
