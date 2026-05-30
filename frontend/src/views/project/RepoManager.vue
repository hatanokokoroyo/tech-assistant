<template>
    <div class="repo-manager">
        <div class="section-title">
            代码仓库
            <el-button type="primary" size="small" circle @click="showAdd = true">+</el-button>
        </div>

        <div v-if="repos.length === 0" class="empty">暂无仓库</div>

        <div v-for="r in repos" :key="r.id" class="repo-item">
            <div class="repo-name">{{ r.name }}</div>
            <div class="repo-row">
                <el-tag size="small" type="info">{{ r.current_branch }}</el-tag>
                <el-button size="small" @click="showBranches(r)">切换</el-button>
                <el-button size="small" type="danger" plain @click="handleDelete(r)">删除</el-button>
            </div>
        </div>

        <!-- Add repo dialog -->
        <el-dialog v-model="showAdd" title="添加代码仓库" width="420px">
            <el-form :model="addForm">
                <el-form-item label="仓库名称">
                    <el-input v-model="addForm.name" placeholder="如 data-api" />
                </el-form-item>
                <el-form-item label="Git URL">
                    <el-input v-model="addForm.url" placeholder="git@github.com:org/repo.git" />
                </el-form-item>
            </el-form>
            <template #footer>
                <el-button @click="showAdd = false">取消</el-button>
                <el-button type="primary" :loading="adding" @click="handleAdd">添加</el-button>
            </template>
        </el-dialog>

        <!-- Branches dialog -->
        <el-dialog v-model="showBranchDialog" title="分支列表" width="420px">
            <div class="branch-section">
                <div class="branch-label">本地分支</div>
                <div
                    v-for="b in branches.local_branches"
                    :key="b"
                    class="branch-row"
                    :class="{ current: b === branches.current_branch }"
                    @click="doCheckout(b)"
                >
                    {{ b }} {{ b === branches.current_branch ? '← 当前' : '' }}
                </div>
            </div>
            <div class="branch-section">
                <div class="branch-label">远程分支</div>
                <div
                    v-for="b in branches.remote_branches"
                    :key="b"
                    class="branch-row"
                    @click="doCheckout(b.replace('origin/', ''))"
                >
                    {{ b }}
                </div>
            </div>
        </el-dialog>
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { listRepos, addRepo, deleteRepo, getBranches, checkoutBranch, type RepoInfo, type BranchData } from '@/api/repos'

const props = defineProps<{ projectId: number }>()

const repos = ref<RepoInfo[]>([])
const showAdd = ref(false)
const adding = ref(false)
const addForm = ref({ name: '', url: '' })
const showBranchDialog = ref(false)
const selectedRepo = ref<RepoInfo | null>(null)
const branches = ref<BranchData>({ local_branches: [], remote_branches: [], current_branch: '' })

onMounted(() => fetchRepos())

async function fetchRepos() {
    const res = await listRepos(props.projectId)
    repos.value = res.data.items
}

async function handleAdd() {
    if (!addForm.value.name || !addForm.value.url) return
    adding.value = true
    try {
        await addRepo(props.projectId, addForm.value)
        ElMessage.success('克隆成功')
        showAdd.value = false
        addForm.value = { name: '', url: '' }
        await fetchRepos()
    } catch (err: any) {
        ElMessage.error(err?.response?.data?.detail || '克隆失败')
    } finally {
        adding.value = false
    }
}

async function handleDelete(repo: RepoInfo) {
    try {
        await ElMessageBox.confirm(`确定删除仓库 "${repo.name}"？`, '确认删除', { type: 'warning' })
    } catch {
        return
    }
    try {
        await deleteRepo(props.projectId, repo.id)
        ElMessage.success('已删除')
        await fetchRepos()
    } catch (err: any) {
        ElMessage.error(err?.response?.data?.detail || '删除失败')
    }
}

async function showBranches(repo: RepoInfo) {
    selectedRepo.value = repo
    showBranchDialog.value = true
    try {
        const res = await getBranches(props.projectId, repo.id)
        branches.value = res.data
    } catch (err: any) {
        ElMessage.error(err?.response?.data?.detail || '获取分支失败')
        showBranchDialog.value = false
    }
}

async function doCheckout(branch: string) {
    if (!selectedRepo.value) return
    try {
        await checkoutBranch(props.projectId, selectedRepo.value.id, branch)
        ElMessage.success(`已切换到 ${branch}`)
        showBranchDialog.value = false
        await fetchRepos()
    } catch (err: any) {
        ElMessage.error(err?.response?.data?.detail || '切换失败')
    }
}
</script>

<style scoped>
.section-title {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 12px;
    font-size: 13px;
    color: #909399;
    border-bottom: 1px solid #e4e7ed;
}
.repo-item {
    padding: 10px 12px;
    border-bottom: 1px solid #ebeef5;
}
.repo-name {
    font-size: 14px;
    font-weight: 500;
    margin-bottom: 6px;
}
.repo-row {
    display: flex;
    gap: 6px;
    align-items: center;
}
.empty {
    padding: 20px;
    text-align: center;
    color: #909399;
    font-size: 13px;
}
.branch-section {
    margin-bottom: 12px;
}
.branch-label {
    font-size: 13px;
    color: #909399;
    margin-bottom: 4px;
}
.branch-row {
    padding: 6px 8px;
    cursor: pointer;
    font-size: 13px;
    border-radius: 4px;
}
.branch-row:hover { background: #ecf5ff; }
.branch-row.current { color: #409eff; font-weight: 500; }
</style>
