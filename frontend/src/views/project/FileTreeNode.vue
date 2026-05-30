<template>
    <div class="tree-node">
        <div
            v-if="node.type === 'directory'"
            class="dir-row"
            @click="expanded = !expanded"
        >
            <span class="arrow">{{ expanded ? '▼' : '▶' }}</span>
            <span class="icon">📁</span>
            <span class="name">{{ node.name }}</span>
        </div>
        <div
            v-else
            class="file-row"
            :class="{ active: activePath === node.path }"
            @click="$emit('select', node.path)"
        >
            <span class="icon">📄</span>
            <span class="name">{{ node.name }}</span>
        </div>
        <div v-if="expanded && node.children" class="children">
            <FileTreeNode
                v-for="child in node.children"
                :key="child.path"
                :node="child"
                :active-path="activePath"
                @select="$emit('select', $event)"
            />
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import type { FileNode } from '@/api/files'

defineProps<{ node: FileNode; activePath: string | null }>()
defineEmits<{ select: [path: string] }>()

const expanded = ref(false)
</script>

<style scoped>
.dir-row, .file-row {
    display: flex;
    align-items: center;
    padding: 4px 12px;
    cursor: pointer;
    font-size: 13px;
    color: #606266;
    gap: 4px;
}
.dir-row:hover, .file-row:hover {
    background: #ebeef5;
}
.file-row.active {
    background: #ecf5ff;
    color: #409eff;
}
.arrow { font-size: 10px; width: 14px; }
.icon { font-size: 13px; }
.name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.children { padding-left: 16px; }
</style>
