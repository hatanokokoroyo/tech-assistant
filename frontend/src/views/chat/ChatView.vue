<template>
    <div class="chat-view">
        <div class="chat-header">
            <span>{{ title }}</span>
        </div>
        <MessageList :messages="messages" />
        <ChatInput
            :disabled="loading"
            @send="handleSend"
        />
    </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { getConversation, type MessageItem } from '@/api/conversations'
import { streamChat, type StreamMessage } from '@/utils/sse'
import MessageList from './components/MessageList.vue'
import ChatInput from './components/ChatInput.vue'

const props = defineProps<{ conversationId: number }>()

const messages = ref<MessageItem[]>([])
const title = ref('')
const loading = ref(false)

watch(() => props.conversationId, () => loadMessages(), { immediate: true })

async function loadMessages() {
    try {
        const res = await getConversation(props.conversationId)
        messages.value = res.data.messages
        title.value = res.data.title || '新对话'
    } catch {
        messages.value = []
    }
}

function handleSend(content: string) {
    if (loading.value) return
    loading.value = true

    // 追加用户消息
    messages.value.push({ id: -1, role: 'user', content, tool_calls: null, tool_call_id: null, tool_name: null, created_at: '' })

    // 追加一条空的 assistant 占位
    const aiIdx = messages.value.length
    messages.value.push({ id: -2, role: 'assistant', content: '', tool_calls: null, tool_call_id: null, tool_name: null, created_at: '' })

    // 用于收集 tool call 结果
    const toolResults: Record<string, { name: string; content: string }> = {}

    streamChat(
        props.conversationId,
        content,
        (msg: StreamMessage) => {
            const aiMsg = messages.value[aiIdx]
            if (!aiMsg) return

            if (msg.type === 'text') {
                aiMsg.content = (aiMsg.content || '') + (msg.content || '')
            } else if (msg.type === 'reasoning') {
                if (!aiMsg.tool_calls) aiMsg.tool_calls = []
                const last = aiMsg.tool_calls[aiMsg.tool_calls.length - 1]
                if (last && last._reasoning !== undefined) {
                    last._reasoning += msg.content
                } else {
                    aiMsg.tool_calls.push({ _reasoning: msg.content || '' })
                }
            } else if (msg.type === 'tool_call_progress') {
                if (!aiMsg.tool_calls) aiMsg.tool_calls = []
                // 合并相同 tool_call_id 的进度
                const existing = aiMsg.tool_calls.find((tc: any) => tc._tc_id === msg.tool_call_id)
                if (existing) {
                    existing._tc_name = msg.tool_name
                } else {
                    aiMsg.tool_calls.push({ _tc_id: msg.tool_call_id, _tc_name: msg.tool_name, _tc_result: null })
                }
            } else if (msg.type === 'tool_result') {
                toolResults[msg.tool_call_id!] = { name: msg.tool_name!, content: msg.content || '' }
                // 更新 UI 中的工具调用结果
                if (aiMsg.tool_calls) {
                    const tc = aiMsg.tool_calls.find((tc: any) => tc._tc_id === msg.tool_call_id)
                    if (tc) {
                        tc._tc_result = msg.content || ''
                    }
                }
            }
        },
        (err) => {
            const aiMsg = messages.value[aiIdx]
            if (aiMsg) aiMsg.content = (aiMsg.content || '') + `\n\n[错误: ${err}]`
            loading.value = false
        },
        () => {
            loading.value = false
            // 刷新消息以获取持久化后的 id
            setTimeout(() => loadMessages(), 500)
        },
    )
}
</script>

<style scoped>
.chat-view {
    display: flex; flex-direction: column; height: 100vh;
}
.chat-header {
    padding: 12px 16px; border-bottom: 1px solid #e4e7ed;
    font-size: 15px; font-weight: 500; color: #303133;
}
</style>
