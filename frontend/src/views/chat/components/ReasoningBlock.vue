<template>
    <div v-if="content" class="reasoning">
        <div class="header" @click="open = !open">
            <span>💭 思维链 {{ open ? '▲' : '▼' }}</span>
        </div>
        <div v-if="open" class="body">{{ content }}</div>
    </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
defineProps<{ content: string }>()
const open = ref(false)
</script>

<style scoped>
.reasoning { margin: 6px 0; }
.header {
    font-size: 12px; color: #909399; cursor: pointer;
    padding: 4px 8px; border-radius: 4px;
}
.header:hover { background: #ebeef5; }
.body {
    padding: 8px 12px; font-size: 13px; color: #606266;
    background: #fdf6ec; border-left: 3px solid #e6a23c;
    border-radius: 0 4px 4px 0; margin-top: 4px;
    white-space: pre-wrap; max-height: 300px; overflow-y: auto;
}
</style>
