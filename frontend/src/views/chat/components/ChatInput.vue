<template>
    <div class="chat-input">
        <el-input
            v-model="text"
            type="textarea"
            :rows="2"
            placeholder="输入问题..."
            :disabled="disabled"
            resize="none"
            @keyup.enter.exact="onSend"
        />
        <el-button
            type="primary"
            :disabled="!text.trim() || disabled"
            :loading="disabled"
            @click="onSend"
        >
            发送
        </el-button>
    </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

defineProps<{ disabled: boolean }>()
const emit = defineEmits<{ send: [content: string] }>()

const text = ref('')

function onSend() {
    const val = text.value.trim()
    if (!val) return
    emit('send', val)
    text.value = ''
}
</script>

<style scoped>
.chat-input {
    display: flex; gap: 8px; padding: 12px 16px;
    border-top: 1px solid #e4e7ed; background: #fff;
}
.chat-input :deep(.el-textarea__inner) { font-size: 14px; }
.chat-input .el-button { align-self: flex-end; }
</style>
