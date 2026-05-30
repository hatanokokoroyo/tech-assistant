import request from './request'

interface RepoBrief {
    id: number
    name: string
    current_branch: string
}

export interface ProjectInfo {
    id: number
    user_id: number
    name: string
    description: string | null
    created_at: string
    repos: RepoBrief[]
}

export interface ProjectListItem {
    id: number
    name: string
    description: string | null
    repo_count: number
    created_at: string
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

export function listProjects() {
    return request.get<any, ListResponse<ProjectListItem>>('/projects')
}

export function createProject(data: { name: string; description?: string }) {
    return request.post<any, DataResponse<ProjectInfo>>('/projects', data)
}

export function getProject(id: number) {
    return request.get<any, DataResponse<ProjectInfo>>(`/projects/${id}`)
}

export function updateProject(id: number, data: { name?: string; description?: string }) {
    return request.put<any, DataResponse<ProjectInfo>>(`/projects/${id}`, data)
}

export function deleteProject(id: number) {
    return request.delete<any, { code: number }>(`/projects/${id}`)
}
