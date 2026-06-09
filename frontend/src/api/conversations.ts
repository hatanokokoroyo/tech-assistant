import { apiClient } from "@/lib/api-client";

export interface Conversation {
  id: number;
  project_id: number;
  title: string;
  message_count: number;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: number;
  conversation_id: number;
  role: "user" | "assistant" | "system";
  content: string;
  reasoning?: string;
  tool_calls?: ToolCallInfo[];
  created_at: string;
}

export interface ToolCallInfo {
  id: string;
  name: string;
  arguments: string;
  result?: string;
}

export const conversationApi = {
  list: (projectId: number) =>
    apiClient.get<Conversation[]>(
      `/api/projects/${projectId}/conversations`,
    ),
  get: (id: number) => apiClient.get<Conversation>(`/api/conversations/${id}`),
  create: (projectId: number, title?: string) =>
    apiClient.post<Conversation>(
      `/api/projects/${projectId}/conversations`,
      { title },
    ),
  delete: (id: number) => apiClient.delete<void>(`/api/conversations/${id}`),
  getMessages: (id: number) =>
    apiClient.get<Message[]>(`/api/conversations/${id}/messages`),
};
