import { apiClient } from "@/lib/api-client";

export interface Conversation {
  id: number;
  title: string;
  message_count?: number;
  total_prompt_tokens?: number;
  total_completion_tokens?: number;
  total_tokens?: number;
  total_cost?: number;
  total_api_rounds?: number;
  total_cache_hit_tokens?: number;
  created_at: string;
  updated_at?: string;
}

export interface Message {
  id: number;
  role: "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: ToolCallInfo[] | null;
  /** 按时间顺序排列的流式事件，用于按序渲染 */
  events?: StreamingEvent[] | null;
  tool_call_id?: string | null;
  tool_name?: string | null;
  prompt_tokens?: number | null;
  completion_tokens?: number | null;
  total_tokens?: number | null;
  cost?: number | null;
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

/** 流式事件 — 按时间顺序排列，用于前端按序渲染 */
export type StreamingEvent =
  | { type: "text"; content: string }
  | { type: "reasoning"; content: string }
  | { type: "tool_call"; tool_call_id: string; tool_name: string; arguments: string }
  | { type: "tool_result"; tool_call_id: string; tool_name: string; content: string; is_error?: boolean };

export interface ConversationDetail extends Conversation {
  messages: Message[];
}

export interface UsageInfo {
  model?: string;
  context_length?: number;
  round_prompt_tokens: number;
  round_completion_tokens: number;
  round_total_tokens: number;
  round_cache_hit_tokens: number | null;
  round_cache_miss_tokens: number | null;
  round_cost: number;
  total_prompt_tokens: number;
  total_completion_tokens: number;
  total_tokens: number;
  total_cache_hit_tokens: number;
  total_cost: number;
  api_rounds: number;
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
