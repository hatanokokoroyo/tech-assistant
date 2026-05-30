<template>
    <div class="auth-container">
        <el-card class="auth-card">
            <h1 class="title">Tech Assistant</h1>
            <el-form
                ref="formRef"
                :model="form"
                :rules="rules"
                label-position="top"
                @keyup.enter="handleLogin"
            >
                <el-form-item label="用户名" prop="username">
                    <el-input v-model="form.username" placeholder="请输入用户名" />
                </el-form-item>
                <el-form-item label="密码" prop="password">
                    <el-input
                        v-model="form.password"
                        type="password"
                        placeholder="请输入密码"
                        show-password
                    />
                </el-form-item>
                <el-form-item>
                    <el-button type="primary" :loading="loading" class="submit-btn" @click="handleLogin">
                        登 录
                    </el-button>
                </el-form-item>
            </el-form>
            <div class="footer-link">
                还没有账号？<router-link to="/register">立即注册</router-link>
            </div>
        </el-card>
    </div>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import { login } from '@/api/auth'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const authStore = useAuthStore()
const formRef = ref<FormInstance>()
const loading = ref(false)

const form = reactive({
    username: '',
    password: ''
})

const rules: FormRules = {
    username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
    password: [{ required: true, message: '请输入密码', trigger: 'blur' }]
}

async function handleLogin() {
    const valid = await formRef.value?.validate().catch(() => false)
    if (!valid) return

    loading.value = true
    try {
        const res = await login(form)
        authStore.setToken(res.data.token)
        authStore.setUser(res.data.user)
        ElMessage.success('登录成功')
        router.push('/')
    } catch (err: any) {
        const msg = err?.response?.data?.detail || '登录失败'
        ElMessage.error(msg)
    } finally {
        loading.value = false
    }
}
</script>

<style scoped>
.auth-container {
    display: flex;
    justify-content: center;
    align-items: center;
    height: 100vh;
    background: #f0f2f5;
}

.auth-card {
    width: 420px;
    padding: 16px 8px;
}

.title {
    text-align: center;
    margin-bottom: 24px;
    font-size: 22px;
    color: #303133;
}

.submit-btn {
    width: 100%;
}

.footer-link {
    text-align: center;
    font-size: 13px;
    color: #909399;
}

.footer-link a {
    color: #409eff;
    text-decoration: none;
}
</style>
