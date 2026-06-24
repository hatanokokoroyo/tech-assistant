import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { datasourceApi } from "@/api/datasources";
import type { DatasourceCreate, DatasourceUpdate } from "@/api/datasources";

export function useDatasources(projectId: number) {
  return useQuery({
    queryKey: ["datasources", projectId] as const,
    queryFn: async () => {
      const res = await datasourceApi.list(projectId);
      return res.items;
    },
    enabled: !!projectId && !Number.isNaN(projectId),
  });
}

export function useDatasource(projectId: number, dsId: number) {
  return useQuery({
    queryKey: ["datasources", projectId, dsId] as const,
    queryFn: () => datasourceApi.get(projectId, dsId),
    enabled: !!projectId && !Number.isNaN(projectId) && !!dsId && !Number.isNaN(dsId),
  });
}

export function useCreateDatasource(projectId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: DatasourceCreate) => datasourceApi.create(projectId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["datasources", projectId] });
    },
  });
}

export function useUpdateDatasource(projectId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ dsId, data }: { dsId: number; data: DatasourceUpdate }) =>
      datasourceApi.update(projectId, dsId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["datasources", projectId] });
    },
  });
}

export function useDeleteDatasource(projectId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dsId: number) => datasourceApi.delete(projectId, dsId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["datasources", projectId] });
    },
  });
}

export function useTestDatasource(projectId: number) {
  return useMutation({
    mutationFn: (dsId: number) => datasourceApi.test(projectId, dsId),
  });
}
