import request from './request'

export interface UserInfo {
    id: number
    username: string
    alias_name: string | null
    role: string
    created_at: string
}

export interface LoginResponse {
    token: string
    user: UserInfo
}

interface ApiResponse<T> {
    code: number
    message: string
    data: T
}

export function register(data: { username: string; password: string; alias_name?: string }) {
    return request.post<any, ApiResponse<UserInfo>>('/auth/register', data)
}

export function login(data: { username: string; password: string }) {
    return request.post<any, ApiResponse<LoginResponse>>('/auth/login', data)
}

export function getMe() {
    return request.get<any, ApiResponse<UserInfo>>('/auth/me')
}

export function updateMe(data: { alias_name: string }) {
    return request.put<any, ApiResponse<UserInfo>>('/auth/me', data)
}
