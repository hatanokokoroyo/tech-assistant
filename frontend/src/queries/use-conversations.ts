import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { conversationApi } from "@/api/conversations";
import { queryKeys } from "./keys";

export function useConversations(projectId: number) {
  return useQuery({
    queryKey: queryKeys.conversations(projectId),
    queryFn: async () => {
      const res = await conversationApi.list(projectId);
      return res.items;
    },
    enabled: !!projectId && !Number.isNaN(projectId),
  });
}

export function useConversation(id: number) {
  return useQuery({
    queryKey: queryKeys.conversation(id),
    queryFn: () => conversationApi.get(id),
    enabled: !!id && !Number.isNaN(id),
  });
}

export function useCreateConversation(projectId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (title?: string) =>
      conversationApi.create(projectId, title),
    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: queryKeys.conversations(projectId),
      });
    },
  });
}

export function useDeleteConversation(projectId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => conversationApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: queryKeys.conversations(projectId),
      });
    },
  });
}
