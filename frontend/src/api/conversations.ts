import request from './request'

export interface ConversationInfo {
    id: number
    title: string
    message_count: number
    created_at: string
    updated_at: string
}

export interface MessageItem {
    id: number
    role: string
    content: string | null
    tool_calls: any[] | null
    tool_call_id: string | null
    tool_name: string | null
    created_at: string
}

export interface ConversationDetail {
    id: number
    title: string
    messages: MessageItem[]
    created_at: string
    updated_at: string
}

interface ListResponse<T> {
    code: number
    message: string
    data: { items: T[]; total: number }
}

interface DataResponse<T> {
    code: number
    message: string
    data: T
}

export function listConversations(projectId: number) {
    return request.get<any, ListResponse<ConversationInfo>>(`/projects/${projectId}/conversations`)
}

export function createConversation(projectId: number, title?: string) {
    return request.post<any, DataResponse<ConversationInfo>>(`/projects/${projectId}/conversations`, { title })
}

export function getConversation(id: number) {
    return request.get<any, DataResponse<ConversationDetail>>(`/conversations/${id}`)
}

export function deleteConversation(id: number) {
    return request.delete<any>(`/conversations/${id}`)
}
