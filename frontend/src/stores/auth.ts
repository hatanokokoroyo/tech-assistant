import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { UserInfo } from '@/api/auth'

export const useAuthStore = defineStore('auth', () => {
    const token = ref(localStorage.getItem('token') || '')
    const user = ref<UserInfo | null>(null)

    function setToken(val: string) {
        token.value = val
        localStorage.setItem('token', val)
    }

    function setUser(val: UserInfo) {
        user.value = val
    }

    function logout() {
        token.value = ''
        user.value = null
        localStorage.removeItem('token')
    }

    return { token, user, setToken, setUser, logout }
})
