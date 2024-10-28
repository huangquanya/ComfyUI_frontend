import {
  useQueueSettingsStore,
  useQueuePendingTaskCountStore
} from '@/stores/queueStore'
import { app } from '@/scripts/app'
import { api } from '@/scripts/api'

/**
 * 设置自动队列处理器。
 * 该函数会监听图形变化事件和队列待处理任务计数的变化，根据配置自动触发队列提示。
 */
export function setupAutoQueueHandler() {
  const queueCountStore = useQueuePendingTaskCountStore()
  const queueSettingsStore = useQueueSettingsStore()

  // 标记图形是否已更改
  let graphHasChanged = false
  // 内部计数器，用于跟踪队列中的任务数量
  let internalCount = 0

  // 监听图形更改事件
  api.addEventListener('graphChanged', () => {
    // 如果队列设置模式为 'change'
    if (queueSettingsStore.mode === 'change') {
      // 如果内部计数器大于 0，则标记图形已更改
      if (internalCount) {
        graphHasChanged = true
      }
      // 否则，标记图形未更改
      else {
        graphHasChanged = false
        // 立即将提示加入队列，数量为 batchCount
        app.queuePrompt(0, queueSettingsStore.batchCount)
        // 增加内部计数器
        internalCount++
      }
    }
  })

  // 订阅队列待处理任务计数的变化
  queueCountStore.$subscribe(
    () => {
      // 更新内部计数器
      internalCount = queueCountStore.count
      // 如果内部计数器为 0 且没有执行错误
      if (!internalCount && !app.lastExecutionError) {
        // 如果队列设置模式为 'instant' 或 ('change' 且图形已更改)
        if (
          queueSettingsStore.mode === 'instant' ||
          (queueSettingsStore.mode === 'change' && graphHasChanged)
        ) {
          // 标记图形未更改
          graphHasChanged = false
          // 将提示加入队列，数量为 batchCount
          app.queuePrompt(0, queueSettingsStore.batchCount)
        }
      }
    },
    { detached: true } // 在组件卸载后仍保持订阅
  )
}
