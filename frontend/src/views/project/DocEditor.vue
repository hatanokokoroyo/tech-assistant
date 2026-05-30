<template>
    <div class="doc-editor">
        <div class="toolbar">
            <span class="file-name">{{ filePath }}</span>
            <el-button
                type="primary"
                size="small"
                :loading="saving"
                :disabled="!dirty"
                @click="handleSave"
            >
                保存
            </el-button>
        </div>
        <div class="editor-area">
            <textarea
                v-model="content"
                class="editor-textarea"
                placeholder="加载中..."
                @input="dirty = true"
            />
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { getFile, updateFile } from '@/api/files'

const props = defineProps<{ projectId: number; filePath: string }>()

const content = ref('')
const dirty = ref(false)
const saving = ref(false)

watch(() => [props.projectId, props.filePath], () => loadFile(), { immediate: true })

async function loadFile() {
    try {
        const res = await getFile(props.projectId, props.filePath)
        content.value = res.data.content
        dirty.value = false
    } catch {
        content.value = '加载失败'
    }
}

async function handleSave() {
    saving.value = true
    try {
        await updateFile(props.projectId, props.filePath, content.value)
        dirty.value = false
        ElMessage.success('已保存')
    } catch (err: any) {
        ElMessage.error(err?.response?.data?.detail || '保存失败')
    } finally {
        saving.value = false
    }
}
</script>

<style scoped>
.doc-editor {
    display: flex;
    flex-direction: column;
    height: 100vh;
}

.toolbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 16px;
    border-bottom: 1px solid #e4e7ed;
    background: #fff;
}

.file-name {
    font-size: 14px;
    color: #303133;
    font-weight: 500;
}

.editor-area {
    flex: 1;
    overflow: hidden;
}

.editor-textarea {
    width: 100%;
    height: 100%;
    border: none;
    outline: none;
    resize: none;
    padding: 16px;
    font-family: 'Menlo', 'Monaco', monospace;
    font-size: 14px;
    line-height: 1.6;
}
</style>
