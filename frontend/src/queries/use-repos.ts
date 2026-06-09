import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { repoApi } from "@/api/repos";
import { queryKeys } from "./keys";

export function useRepos(projectId: number) {
  return useQuery({
    queryKey: queryKeys.repos(projectId),
    queryFn: () => repoApi.list(projectId),
    enabled: !!projectId,
  });
}

export function useCreateRepo(projectId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; git_url: string }) =>
      repoApi.create(projectId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.repos(projectId) });
    },
  });
}

export function useDeleteRepo(projectId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (repoId: number) => repoApi.delete(projectId, repoId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.repos(projectId) });
    },
  });
}

export function useBranches(projectId: number, repoId: number) {
  return useQuery({
    queryKey: queryKeys.branches(projectId, repoId),
    queryFn: () => repoApi.getBranches(projectId, repoId),
    enabled: !!projectId && !!repoId,
  });
}

export function useCheckoutBranch(projectId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      repoId: number;
      branch: string;
    }) => repoApi.checkout(projectId, vars.repoId, vars.branch),
    onSuccess: (_: unknown, variables: { repoId: number; branch: string }) => {
      qc.invalidateQueries({
        queryKey: queryKeys.branches(projectId, variables.repoId),
      });
    },
  });
}
