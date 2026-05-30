<template>
    <div class="tool-call">
        <div class="header" @click="open = !open">
            <span>{{ open ? '🔧' : '🔧' }} {{ toolCall._tc_name || '工具调用' }} {{ open ? '▲' : '▼' }}</span>
            <span v-if="toolCall._tc_result !== undefined" class="status-dot" :class="{ success: toolCall._tc_result !== null }"></span>
        </div>
        <div v-if="open && toolCall._tc_result !== undefined" class="body">{{ toolCall._tc_result }}</div>
    </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
defineProps<{ toolCall: any }>()
const open = ref(false)
</script>

<style scoped>
.tool-call { margin: 6px 0; }
.header {
    display: flex; justify-content: space-between; align-items: center;
    font-size: 12px; color: #909399; cursor: pointer;
    padding: 4px 8px; border-radius: 4px;
}
.header:hover { background: #ebeef5; }
.status-dot {
    width: 8px; height: 8px; border-radius: 50%;
    background: #e6a23c;
}
.status-dot.success { background: #67c23a; }
.body {
    padding: 8px 12px; font-size: 13px; color: #606266;
    background: #f5f7fa; border-left: 3px solid #409eff;
    border-radius: 0 4px 4px 0; margin-top: 4px;
    white-space: pre-wrap; max-height: 300px; overflow-y: auto;
}
</style>
