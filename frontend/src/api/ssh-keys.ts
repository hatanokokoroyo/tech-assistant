import request from './request'

export interface SshKeyInfo {
    id: number
    fingerprint: string | null
    created_at: string
}

interface DataResponse<T> {
    code: number
    message: string
    data: T
}

export function getSshKey() {
    return request.get<any, DataResponse<SshKeyInfo | null>>('/ssh-keys')
}

export function uploadSshKeyFile(file: File) {
    const form = new FormData()
    form.append('file', file)
    return request.post<any, DataResponse<SshKeyInfo>>('/ssh-keys', form)
}

export function uploadSshKeyText(privateKeyContent: string) {
    return request.post<any, DataResponse<SshKeyInfo>>('/ssh-keys', { private_key_content: privateKeyContent })
}

export function deleteSshKey(id: number) {
    return request.delete<any, { code: number }>(`/ssh-keys/${id}`)
}
