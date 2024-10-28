<template>
  <router-view />
  <!-- 当 isLoading 为真时，显示加载指示器 -->
  <ProgressSpinner
    v-if="isLoading"
    class="absolute inset-0 flex justify-center items-center h-screen"
  />
  <!-- 全局对话框组件 -->
  <GlobalDialog />
  <!-- 根据 isLoading 状态阻止用户与页面交互 -->
  <BlockUI full-screen :blocked="isLoading" />
</template>

<script setup lang="ts">
import config from '@/config'
import { computed, onMounted } from 'vue'
import { useWorkspaceStore } from '@/stores/workspaceStateStore'
import BlockUI from 'primevue/blockui'
import ProgressSpinner from 'primevue/progressspinner'
import GlobalDialog from '@/components/dialog/GlobalDialog.vue'
import { useEventListener } from '@vueuse/core'

// 获取工作区存储实例
const workspaceStore = useWorkspaceStore()
// 计算属性，用于判断是否正在加载
const isLoading = computed<boolean>(() => workspaceStore.spinner)
// 处理键盘事件，更新 shiftDown 状态
const handleKey = (e: KeyboardEvent) => {
  workspaceStore.shiftDown = e.shiftKey
}
// 监听窗口的 keydown 和 keyup 事件
useEventListener(window, 'keydown', handleKey)
useEventListener(window, 'keyup', handleKey)

// 组件挂载后，设置全局版本号并打印日志
onMounted(() => {
  window['__COMFYUI_FRONTEND_VERSION__'] = config.app_version
  console.log('ComfyUI Front-end version:', config.app_version)
})
</script>
