import request from './request'

export interface RepoInfo {
    id: number
    name: string
    url: string
    current_branch: string
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

export interface BranchData {
    local_branches: string[]
    remote_branches: string[]
    current_branch: string
}

export function listRepos(projectId: number) {
    return request.get<any, ListResponse<RepoInfo>>(`/projects/${projectId}/repos`)
}

export function addRepo(projectId: number, data: { name: string; url: string }) {
    return request.post<any, DataResponse<RepoInfo>>(`/projects/${projectId}/repos`, data)
}

export function deleteRepo(projectId: number, repoId: number) {
    return request.delete<any, { code: number }>(`/projects/${projectId}/repos/${repoId}`)
}

export function getBranches(projectId: number, repoId: number) {
    return request.get<any, DataResponse<BranchData>>(`/projects/${projectId}/repos/${repoId}/branches`)
}

export function checkoutBranch(projectId: number, repoId: number, branch: string) {
    return request.post<any, DataResponse<{ current_branch: string }>>(`/projects/${projectId}/repos/${repoId}/checkout`, { branch })
}
