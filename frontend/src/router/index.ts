import { createRouter, createWebHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
    {
        path: '/login',
        name: 'Login',
        component: () => import('@/views/Login.vue')
    },
    {
        path: '/register',
        name: 'Register',
        component: () => import('@/views/Register.vue')
    },
    {
        path: '/',
        component: () => import('@/layouts/AppLayout.vue'),
        redirect: '/projects',
        children: [
            {
                path: 'projects',
                name: 'ProjectList',
                component: () => import('@/views/project/ProjectList.vue')
            },
            {
                path: 'projects/:id',
                name: 'ProjectDetail',
                component: () => import('@/views/project/ProjectDetail.vue')
            }
        ]
    }
]

const router = createRouter({
    history: createWebHistory(),
    routes
})

router.beforeEach((to, _from, next) => {
    const token = localStorage.getItem('token')
    if (to.name !== 'Login' && to.name !== 'Register' && !token) {
        next({ name: 'Login' })
    } else {
        next()
    }
})

export default router
