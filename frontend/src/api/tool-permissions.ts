import { apiClient } from "@/lib/api-client";

export interface ToolPermissionOverride {
  id: number;
  tool_name: string;
  permission: "auto_approve" | "ask_user" | "deny";
  created_at: string;
  updated_at: string;
}

export interface EffectivePermissions {
  permissions: Record<string, "auto_approve" | "ask_user" | "deny">;
  overrides: ToolPermissionOverride[];
}

export interface ToolApprovalPayload {
  tool_call_id: string;
  decision: "approved" | "denied";
  scope?: "once" | "conversation";
}

export const toolPermissionApi = {
  get: (projectId: number) =>
    apiClient.get<EffectivePermissions>(
      `/api/projects/${projectId}/tool-permissions`,
    ),

  update: (projectId: number, permissions: { tool_name: string; permission: string }[]) =>
    apiClient.put<EffectivePermissions>(
      `/api/projects/${projectId}/tool-permissions`,
      { permissions },
    ),

  approve: (conversationId: number, payload: ToolApprovalPayload) =>
    apiClient.post<{ approved: boolean }>(
      `/api/conversations/${conversationId}/tool-approval`,
      payload,
    ),
};
