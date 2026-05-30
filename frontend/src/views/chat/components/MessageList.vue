<template>
    <div class="message-list" ref="listRef">
        <MessageItem
            v-for="msg in messages"
            :key="msg.id"
            :message="msg"
        />
    </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import type { MessageItem } from '@/api/conversations'
import MessageItemComp from './MessageItem.vue'

const props = defineProps<{ messages: MessageItem[] }>()
const listRef = ref<HTMLElement>()

watch(() => props.messages.length, () => {
    nextTick(() => {
        if (listRef.value) {
            listRef.value.scrollTop = listRef.value.scrollHeight
        }
    })
})
</script>

<style scoped>
.message-list {
    flex: 1;
    overflow-y: auto;
    padding: 16px;
}
</style>
