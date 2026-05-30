<template>
    <div class="chat-panel">
        <div class="section-title">
            对话
            <el-button type="primary" size="small" circle @click="handleCreate">+</el-button>
        </div>
        <div
            v-for="c in conversations"
            :key="c.id"
            class="conv-item"
            :class="{ active: activeId === c.id }"
            @click="$emit('select', c.id)"
        >
            <span class="conv-title">{{ c.title }}</span>
            <span class="conv-meta">{{ c.message_count }} 条 · {{ c.updated_at.slice(5, 16) }}</span>
        </div>
        <div v-if="conversations.length === 0" class="empty">暂无对话</div>
    </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { listConversations, createConversation, type ConversationInfo } from '@/api/conversations'

const props = defineProps<{ projectId: number; activeId: number | null }>()
const emit = defineEmits<{ select: [id: number] }>()

const conversations = ref<ConversationInfo[]>([])

watch(() => props.projectId, () => fetchList(), { immediate: true })

async function fetchList() {
    try {
        const res = await listConversations(props.projectId)
        conversations.value = res.data.items
    } catch { conversations.value = [] }
}

async function handleCreate() {
    try {
        const res = await createConversation(props.projectId)
        conversations.value.unshift({
            id: res.data.id,
            title: res.data.title || '新对话',
            message_count: 0,
            created_at: res.data.created_at,
            updated_at: res.data.created_at,
        })
        emit('select', res.data.id)
    } catch { /* ignore */ }
}

defineExpose({ refresh: fetchList })
</script>

<style scoped>
.chat-panel { padding: 8px 0; }
.section-title {
    display: flex; justify-content: space-between; align-items: center;
    padding: 10px 12px; font-size: 13px; color: #909399;
    border-bottom: 1px solid #e4e7ed;
}
.conv-item {
    padding: 10px 12px; cursor: pointer; border-bottom: 1px solid #ebeef5;
}
.conv-item:hover { background: #ecf5ff; }
.conv-item.active { background: #ecf5ff; border-left: 3px solid #409eff; }
.conv-title { font-size: 14px; display: block; margin-bottom: 2px; }
.conv-meta { font-size: 12px; color: #909399; }
.empty { padding: 20px; text-align: center; color: #909399; font-size: 13px; }
</style>
