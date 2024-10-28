<template>
  <!-- 顶部菜单栏需要在 GraphCanvas 之前加载，因为它需要承载
  由传统扩展脚本添加的菜单按钮。-->
  <TopMenubar />
  <GraphCanvas @ready="onGraphReady" />
  <GlobalToast />
  <UnloadWindowConfirmDialog />
  <BrowserTabTitle />
</template>

<script setup lang="ts">
import GraphCanvas from '@/components/graph/GraphCanvas.vue'

import { computed, onMounted, onBeforeUnmount, watch, watchEffect } from 'vue'
import { app } from '@/scripts/app'
import { useSettingStore } from '@/stores/settingStore'
import { useI18n } from 'vue-i18n'
import { useWorkspaceStore } from '@/stores/workspaceStateStore'
import { api } from '@/scripts/api'
import { StatusWsMessageStatus } from '@/types/apiTypes'
import { useQueuePendingTaskCountStore } from '@/stores/queueStore'
import type { ToastMessageOptions } from 'primevue/toast'
import { useToast } from 'primevue/usetoast'
import { i18n } from '@/i18n'
import { useExecutionStore } from '@/stores/executionStore'
import {
  useWorkflowStore,
  useWorkflowBookmarkStore
} from '@/stores/workflowStore'
import GlobalToast from '@/components/toast/GlobalToast.vue'
import UnloadWindowConfirmDialog from '@/components/dialog/UnloadWindowConfirmDialog.vue'
import BrowserTabTitle from '@/components/BrowserTabTitle.vue'
import TopMenubar from '@/components/topbar/TopMenubar.vue'
import { setupAutoQueueHandler } from '@/services/autoQueueService'
import { useKeybindingStore } from '@/stores/keybindingStore'
import { useSidebarTabStore } from '@/stores/workspace/sidebarTabStore'
import { useNodeBookmarkStore } from '@/stores/nodeBookmarkStore'
import { useNodeDefStore, useNodeFrequencyStore } from '@/stores/nodeDefStore'
import { useBottomPanelStore } from '@/stores/workspace/bottomPanelStore'

// 初始化自动队列处理器
setupAutoQueueHandler()

// 获取国际化实例
const { t } = useI18n()
// 获取 Toast 实例
const toast = useToast()
// 获取设置存储实例
const settingStore = useSettingStore()
// 获取执行存储实例
const executionStore = useExecutionStore()

// 计算主题
const theme = computed<string>(() => settingStore.get('Comfy.ColorPalette'))

// 监视主题变化，更新 body 类名
watch(
  theme,
  (newTheme) => {
    const DARK_THEME_CLASS = 'dark-theme'
    const isDarkTheme = newTheme !== 'light'
    if (isDarkTheme) {
      document.body.classList.add(DARK_THEME_CLASS)
    } else {
      document.body.classList.remove(DARK_THEME_CLASS)
    }
  },
  { immediate: true }
)

// 监视文本区域字体大小设置，更新样式
watchEffect(() => {
  const fontSize = settingStore.get('Comfy.TextareaWidget.FontSize')
  document.documentElement.style.setProperty(
    '--comfy-textarea-font-size',
    `${fontSize}px`
  )
})

// 监视树浏览器项目填充设置，更新样式
watchEffect(() => {
  const padding = settingStore.get('Comfy.TreeExplorer.ItemPadding')
  document.documentElement.style.setProperty(
    '--comfy-tree-explorer-item-padding',
    `${padding}px`
  )
})

// 监视区域设置，更新国际化语言
watchEffect(() => {
  const locale = settingStore.get('Comfy.Locale')
  if (locale) {
    i18n.global.locale.value = locale as 'en' | 'zh'
  }
})

// 监视新菜单设置，更新菜单显示
watchEffect(() => {
  const useNewMenu = settingStore.get('Comfy.UseNewMenu')
  if (useNewMenu === 'Disabled') {
    app.ui.menuContainer.style.removeProperty('display')
    app.ui.restoreMenuPosition()
  } else {
    app.ui.menuContainer.style.setProperty('display', 'none')
  }
})

// 初始化函数
const init = () => {
  settingStore.addSettings(app.ui.settings)
  useKeybindingStore().loadCoreKeybindings()
  useSidebarTabStore().registerCoreSidebarTabs()
  useBottomPanelStore().registerCoreBottomPanelTabs()
  app.extensionManager = useWorkspaceStore()
}

// 获取队列待处理任务计数存储实例
const queuePendingTaskCountStore = useQueuePendingTaskCountStore()
// 处理状态事件
const onStatus = (e: CustomEvent<StatusWsMessageStatus>) => {
  queuePendingTaskCountStore.update(e)
}

// 重连消息
const reconnectingMessage: ToastMessageOptions = {
  severity: 'error',
  summary: t('reconnecting')
}

// 处理重连中事件
const onReconnecting = () => {
  toast.remove(reconnectingMessage)
  toast.add(reconnectingMessage)
}

// 处理重连成功事件
const onReconnected = () => {
  toast.remove(reconnectingMessage)
  toast.add({
    severity: 'success',
    summary: t('reconnected'),
    life: 2000
  })
}

// 获取工作流存储实例
const workflowStore = useWorkflowStore()
// 获取工作流书签存储实例
const workflowBookmarkStore = useWorkflowBookmarkStore()
// 绑定执行存储
app.workflowManager.executionStore = executionStore
// 绑定工作流存储
app.workflowManager.workflowStore = workflowStore
// 绑定工作流书签存储
app.workflowManager.workflowBookmarkStore = workflowBookmarkStore

// 挂载时初始化
onMounted(() => {
  api.addEventListener('status', onStatus)
  api.addEventListener('reconnecting', onReconnecting)
  api.addEventListener('reconnected', onReconnected)
  executionStore.bindExecutionEvents()

  try {
    init()
  } catch (e) {
    console.error('Failed to init ComfyUI frontend', e)
  }
})

// 卸载前清理
onBeforeUnmount(() => {
  api.removeEventListener('status', onStatus)
  api.removeEventListener('reconnecting', onReconnecting)
  api.removeEventListener('reconnected', onReconnected)
  executionStore.unbindExecutionEvents()
})

// 处理 GraphCanvas 准备就绪事件
const onGraphReady = () => {
  requestIdleCallback(
    () => {
      // 设置值现在在 comfyApp.setup 之后可用。
      // 加载键绑定。
      useKeybindingStore().loadUserKeybindings()

      // 迁移传统书签
      useNodeBookmarkStore().migrateLegacyBookmarks()

      // 节点定义现在在 comfyApp.setup 之后可用。
      // 显式初始化 nodeSearchService 以避免在触发节点搜索时出现索引延迟
      useNodeDefStore().nodeSearchService.endsWithFilterStartSequence('')

      // 非阻塞加载节点频率
      useNodeFrequencyStore().loadNodeFrequencies()
    },
    { timeout: 1000 }
  )
}
</script>
