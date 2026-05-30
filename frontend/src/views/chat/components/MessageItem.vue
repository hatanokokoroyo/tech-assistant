<template>
    <div class="msg" :class="'msg-' + message.role">
        <div class="role-label">{{ roleLabel }}</div>
        <div v-if="message.content" class="content" v-text="message.content" />

        <!-- 思维链 -->
        <template v-if="message.tool_calls && message.tool_calls.length > 0">
            <ReasoningBlock
                v-if="reasoning"
                :content="reasoning"
            />
            <ToolCallBlock
                v-for="(tc, i) in toolCalls"
                :key="i"
                :tool-call="tc"
            />
        </template>
    </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { MessageItem } from '@/api/conversations'
import ReasoningBlock from './ReasoningBlock.vue'
import ToolCallBlock from './ToolCallBlock.vue'

const props = defineProps<{ message: MessageItem }>()

const roleLabel = computed(() => ({
    user: '👤 用户',
    assistant: '🤖 AI',
    tool: '🔧 工具',
    system: '系统',
}[props.message.role] || props.message.role))

const reasoning = computed(() => {
    if (!props.message.tool_calls) return ''
    const parts = props.message.tool_calls
        .filter((tc: any) => tc._reasoning)
        .map((tc: any) => tc._reasoning)
    return parts.join('\n')
})

const toolCalls = computed(() => {
    if (!props.message.tool_calls) return []
    return props.message.tool_calls.filter((tc: any) => tc._tc_id)
})
</script>

<style scoped>
.msg { margin-bottom: 16px; max-width: 85%; }
.msg-user { margin-left: auto; }
.msg-user .role-label { display: none; }
.msg-user .content {
    background: #409eff; color: #fff; border-radius: 8px 8px 0 8px;
    padding: 10px 14px; font-size: 14px; line-height: 1.6;
    word-wrap: break-word;
}
.msg-assistant .content, .msg-tool .content {
    background: #f0f2f5; border-radius: 8px;
    padding: 10px 14px; font-size: 14px; line-height: 1.6;
    word-wrap: break-word;
}
.role-label {
    font-size: 12px; color: #909399; margin-bottom: 4px;
}
</style>
