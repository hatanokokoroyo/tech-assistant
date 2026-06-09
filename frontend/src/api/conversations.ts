import { apiClient } from "@/lib/api-client";

export interface Conversation {
  id: number;
  title: string;
  message_count?: number;
  created_at: string;
  updated_at?: string;
}

export interface Message {
  id: number;
  role: "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: ToolCallInfo[] | null;
  tool_call_id?: string | null;
  tool_name?: string | null;
  created_at: string;
}

export interface ToolCallInfo {
  id: string;
  type: string;
  function: {
    name: string;
    arguments: string;
  };
}

export interface ConversationDetail extends Conversation {
  messages: Message[];
}

interface PaginatedResponse<T> {
  items: T[];
  total: number;
}

export const conversationApi = {
  list: (projectId: number) =>
    apiClient.get<PaginatedResponse<Conversation>>(
      `/api/projects/${projectId}/conversations`,
    ),
  get: (id: number) =>
    apiClient.get<ConversationDetail>(`/api/conversations/${id}`),
  create: (projectId: number, title?: string) =>
    apiClient.post<Conversation>(
      `/api/projects/${projectId}/conversations`,
      { title },
    ),
  delete: (id: number) => apiClient.delete<void>(`/api/conversations/${id}`),
};
