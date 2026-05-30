<template>
    <div class="auth-container">
        <el-card class="auth-card">
            <h1 class="title">创建账号</h1>
            <el-form
                ref="formRef"
                :model="form"
                :rules="rules"
                label-position="top"
                @keyup.enter="handleRegister"
            >
                <el-form-item label="用户名" prop="username">
                    <el-input v-model="form.username" placeholder="请输入用户名" />
                </el-form-item>
                <el-form-item label="真实姓名（选填）" prop="alias_name">
                    <el-input v-model="form.alias_name" placeholder="请输入真实姓名" />
                </el-form-item>
                <el-form-item label="密码" prop="password">
                    <el-input
                        v-model="form.password"
                        type="password"
                        placeholder="请输入密码（至少6位）"
                        show-password
                    />
                </el-form-item>
                <el-form-item label="确认密码" prop="confirmPassword">
                    <el-input
                        v-model="form.confirmPassword"
                        type="password"
                        placeholder="请再次输入密码"
                        show-password
                    />
                </el-form-item>
                <el-form-item>
                    <el-button type="primary" :loading="loading" class="submit-btn" @click="handleRegister">
                        注 册
                    </el-button>
                </el-form-item>
            </el-form>
            <div class="footer-link">
                已有账号？<router-link to="/login">立即登录</router-link>
            </div>
        </el-card>
    </div>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import { register } from '@/api/auth'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const authStore = useAuthStore()
const formRef = ref<FormInstance>()
const loading = ref(false)

const form = reactive({
    username: '',
    alias_name: '',
    password: '',
    confirmPassword: ''
})

const validateConfirm = (_rule: any, value: string, callback: any) => {
    if (value !== form.password) {
        callback(new Error('两次输入的密码不一致'))
    } else {
        callback()
    }
}

const rules: FormRules = {
    username: [
        { required: true, message: '请输入用户名', trigger: 'blur' },
        { min: 2, max: 100, message: '用户名长度为 2-100 个字符', trigger: 'blur' }
    ],
    password: [
        { required: true, message: '请输入密码', trigger: 'blur' },
        { min: 6, message: '密码至少 6 位', trigger: 'blur' }
    ],
    confirmPassword: [
        { required: true, message: '请再次输入密码', trigger: 'blur' },
        { validator: validateConfirm, trigger: 'blur' }
    ]
}

async function handleRegister() {
    const valid = await formRef.value?.validate().catch(() => false)
    if (!valid) return

    loading.value = true
    try {
        await register({
            username: form.username,
            password: form.password,
            alias_name: form.alias_name || undefined
        })
        ElMessage.success('注册成功，请登录')
        router.push('/login')
    } catch (err: any) {
        const msg = err?.response?.data?.detail || '注册失败'
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
