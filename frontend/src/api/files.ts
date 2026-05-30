import request from './request'

export interface FileNode {
    name: string
    type: string
    path: string
    children?: FileNode[] | null
}

export interface FileContent {
    path: string
    content: string
    updated_at: string | null
}

interface DataResponse<T> {
    code: number
    message: string
    data: T
}

export function getFileTree(projectId: number) {
    return request.get<any, DataResponse<{ tree: FileNode[] }>>(`/projects/${projectId}/files`)
}

export function getFile(projectId: number, filePath: string) {
    return request.get<any, DataResponse<FileContent>>(`/projects/${projectId}/files/${filePath}`)
}

export function updateFile(projectId: number, filePath: string, content: string) {
    return request.put<any, DataResponse<{ path: string }>>(`/projects/${projectId}/files/${filePath}`, { content })
}
