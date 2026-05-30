<template>
    <div class="project-list">
        <div class="section-title">
            定制项目
            <el-button type="primary" size="small" circle @click="showCreate = true">+</el-button>
        </div>
        <div
            v-for="p in projects"
            :key="p.id"
            class="project-item"
            :class="{ active: activeId === p.id }"
            @click="onClick(p.id)"
        >
            <span class="name">{{ p.name }}</span>
        </div>

        <el-dialog v-model="showCreate" title="创建定制项目" width="420px">
            <el-form :model="form">
                <el-form-item label="项目名称">
                    <el-input v-model="form.name" placeholder="请输入名称" />
                </el-form-item>
                <el-form-item label="描述">
                    <el-input v-model="form.description" type="textarea" :rows="3" placeholder="可选" />
                </el-form-item>
            </el-form>
            <template #footer>
                <el-button @click="showCreate = false">取消</el-button>
                <el-button type="primary" :loading="creating" @click="handleCreate">创建</el-button>
            </template>
        </el-dialog>
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { listProjects, createProject, type ProjectListItem } from '@/api/projects'

const emit = defineEmits<{ select: [id: number] }>()

const projects = ref<ProjectListItem[]>([])
const activeId = ref<number | null>(null)
const showCreate = ref(false)
const creating = ref(false)
const form = ref({ name: '', description: '' })

onMounted(() => fetchProjects())

async function fetchProjects() {
    const res = await listProjects()
    projects.value = res.data.items
}

function onClick(id: number) {
    activeId.value = id
    emit('select', id)
}

async function handleCreate() {
    if (!form.value.name.trim()) return
    creating.value = true
    try {
        const res = await createProject({ name: form.value.name, description: form.value.description })
        ElMessage.success('创建成功')
        showCreate.value = false
        form.value = { name: '', description: '' }
        await fetchProjects()
        emit('select', res.data.id)
    } catch (err: any) {
        ElMessage.error(err?.response?.data?.detail || '创建失败')
    } finally {
        creating.value = false
    }
}
</script>

<style scoped>
.project-list {
    padding: 8px 0;
}

.section-title {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 16px;
    font-size: 13px;
    color: #999;
    text-transform: uppercase;
}

.project-item {
    padding: 10px 16px;
    cursor: pointer;
    color: #bbb;
    border-left: 3px solid transparent;
    transition: all 0.15s;
}

.project-item:hover {
    background: #2a2b2c;
    color: #fff;
}

.project-item.active {
    background: #2a2b2c;
    color: #fff;
    border-left-color: #409eff;
}

.name {
    font-size: 14px;
}
</style>
