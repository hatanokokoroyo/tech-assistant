<template>
    <div class="file-panel">
        <div v-if="tree.length === 0" class="empty">暂无文档</div>
        <FileTreeNode
            v-for="node in tree"
            :key="node.path"
            :node="node"
            :active-path="activePath"
            @select="$emit('select', $event)"
        />
    </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { getFileTree, type FileNode } from '@/api/files'
import FileTreeNode from './FileTreeNode.vue'

const props = defineProps<{ projectId: number }>()
const emit = defineEmits<{ select: [path: string] }>()

const tree = ref<FileNode[]>([])
const activePath = ref<string | null>(null)

watch(() => props.projectId, () => fetchTree(), { immediate: true })

async function fetchTree() {
    try {
        const res = await getFileTree(props.projectId)
        tree.value = res.data.tree
    } catch {
        tree.value = []
    }
}

defineExpose({ refresh: fetchTree })
</script>

<style scoped>
.file-panel {
    padding: 8px 0;
}
.empty {
    padding: 20px;
    text-align: center;
    color: #909399;
    font-size: 13px;
}
</style>
