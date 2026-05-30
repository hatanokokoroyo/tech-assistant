<template>
    <el-container class="app-layout">
        <el-aside width="220px" class="sidebar-left">
            <div class="logo">Tech Assistant</div>
            <ProjectList @select="onSelectProject" />
        </el-aside>
        <el-container v-if="selectedProjectId">
            <el-aside width="260px" class="sidebar-mid">
                <div class="mid-header">
                    <el-button text @click="selectedProjectId = null">← 返回</el-button>
                </div>
                <el-tabs v-model="midTab">
                    <el-tab-pane label="文件" name="files">
                        <FilePanel
                            :project-id="selectedProjectId"
                            @select="onSelectFile"
                        />
                    </el-tab-pane>
                    <el-tab-pane label="对话" name="chat">
                        <ChatPanel
                            :project-id="selectedProjectId"
                            :active-id="selectedConversationId"
                            @select="onSelectConversation"
                        />
                    </el-tab-pane>
                    <el-tab-pane label="仓库" name="repos">
                        <RepoManager :project-id="selectedProjectId" />
                    </el-tab-pane>
                </el-tabs>
            </el-aside>
            <el-main class="content-right">
                <template v-if="midTab === 'files' && selectedFilePath">
                    <DocEditor
                        :project-id="selectedProjectId"
                        :file-path="selectedFilePath"
                    />
                </template>
                <template v-else-if="midTab === 'chat' && selectedConversationId">
                    <ChatView :conversation-id="selectedConversationId" />
                </template>
                <div v-else class="placeholder">
                    请从左侧选择一个文件查看或开始对话
                </div>
            </el-main>
        </el-container>
        <el-main v-else class="content-placeholder">
            <div class="placeholder">请选择一个定制项目</div>
        </el-main>
    </el-container>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import ProjectList from '@/views/project/ProjectList.vue'
import FilePanel from '@/views/project/FilePanel.vue'
import DocEditor from '@/views/project/DocEditor.vue'
import RepoManager from '@/views/project/RepoManager.vue'
import ChatPanel from '@/views/chat/ChatPanel.vue'
import ChatView from '@/views/chat/ChatView.vue'

const selectedProjectId = ref<number | null>(null)
const selectedFilePath = ref<string | null>(null)
const selectedConversationId = ref<number | null>(null)
const midTab = ref('files')

function onSelectProject(id: number) {
    selectedProjectId.value = id
    selectedFilePath.value = null
    selectedConversationId.value = null
    midTab.value = 'files'
}

function onSelectFile(path: string) {
    selectedFilePath.value = path
}

function onSelectConversation(id: number) {
    selectedConversationId.value = id
}
</script>

<style scoped>
.app-layout {
    height: 100vh;
}

.sidebar-left {
    background: #1d1e1f;
    color: #fff;
    overflow-y: auto;
}

.logo {
    padding: 18px 16px;
    font-size: 18px;
    font-weight: 600;
    border-bottom: 1px solid #333;
}

.sidebar-mid {
    background: #f7f8fa;
    border-right: 1px solid #e4e7ed;
    overflow-y: auto;
}

.mid-header {
    padding: 10px 12px;
    border-bottom: 1px solid #e4e7ed;
}

.content-right {
    padding: 0;
    overflow: hidden;
}

.content-placeholder {
    display: flex;
    align-items: center;
    justify-content: center;
}

.placeholder {
    color: #909399;
    font-size: 14px;
    text-align: center;
}
</style>
