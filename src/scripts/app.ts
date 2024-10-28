// 导入日志记录模块，用于记录系统运行时信息
import { ComfyLogging } from './logging'

// 导入组件构造器相关模块，用于创建和管理UI组件
import { ComfyWidgetConstructor, ComfyWidgets, initWidgets } from './widgets'

// 导入UI模块，用于构建和管理用户界面
import { ComfyUI, $el } from './ui'

// 导入API模块，用于处理与后端的通信
import { api } from './api'

// 导入默认图形模块，用于提供系统默认的工作流图形
import { defaultGraph } from './defaultGraph'

// 导入元数据处理模块，用于处理不同格式文件的元数据信息
import {
  getPngMetadata,
  getWebpMetadata,
  getFlacMetadata,
  importA1111,
  getLatentMetadata
} from './pnginfo'

// 导入DOM裁剪设置模块，用于在DOM元素中添加裁剪功能
import { addDomClippingSetting } from './domWidget'

// 导入图片托管和网格计算模块，用于处理图片预览和布局
import { createImageHost, calculateImageGrid } from './ui/imagePreview'

// 导入可拖拽列表模块，用于创建可拖动排序的列表
import { DraggableList } from './ui/draggableList'

// 导入文本替换和样式表添加工具模块
import { applyTextReplacements, addStylesheet } from './utils'

// 导入Extension类型，用于定义Comfy扩展的结构
import type { ComfyExtension } from '@/types/comfy'

// 导入工作流JSON类型和节点ID类型，用于处理工作流的JSON表示和节点ID
import {
  type ComfyWorkflowJSON,
  type NodeId,
  validateComfyWorkflow
} from '../types/comfyWorkflow'

// 导入API类型，用于定义API的结构
import { ComfyNodeDef, StatusWsMessageStatus } from '@/types/apiTypes'

// 导入颜色调整工具和颜色调整选项类型
import { adjustColor, ColorAdjustOptions } from '@/utils/colorUtil'

// 导入应用菜单模块，用于创建和管理应用的菜单
import { ComfyAppMenu } from './ui/menu/index'

// 导入存储值获取工具，用于从存储中获取值
import { getStorageValue } from './utils'

// 导入工作流管理器和工作流类型，用于创建和管理Comfy工作流
import { ComfyWorkflowManager, ComfyWorkflow } from './workflows'

// 导入LiteGraph相关模块，用于图形化编程
import {
  LGraphCanvas,
  LGraph,
  LGraphNode,
  LiteGraph
} from '@comfyorg/litegraph'

// 导入存储位置类型，用于定义存储位置
import { StorageLocation } from '@/types/settingTypes'

// 导入扩展管理器类型，用于定义扩展管理器的结构
import { ExtensionManager } from '@/types/extensionTypes'

// 导入节点定义实现和系统节点定义，以及节点定义存储的钩子
import {
  ComfyNodeDefImpl,
  SYSTEM_NODE_DEFS,
  useNodeDefStore
} from '@/stores/nodeDefStore'

// 导入输入插槽和向量2类型，用于定义节点的输入插槽和二维向量
import { INodeInputSlot, Vector2 } from '@comfyorg/litegraph'

// 导入lodash模块，用于提供实用的函数
import _ from 'lodash'

// 导入对话框服务模块，用于显示执行错误、工作流加载警告和模型缺失警告
import {
  showExecutionErrorDialog,
  showLoadWorkflowWarning,
  showMissingModelsWarning
} from '@/services/dialogService'

// 导入设置存储、Toast存储、模型存储和工作空间存储的钩子
import { useSettingStore } from '@/stores/settingStore'
import { useToastStore } from '@/stores/toastStore'
import { useModelStore } from '@/stores/modelStore'
import { useWorkspaceStore } from '@/stores/workspaceStateStore'

// 导入执行存储和扩展存储的钩子
import { useExecutionStore } from '@/stores/executionStore'
import { useExtensionStore } from '@/stores/extensionStore'

// 导入键绑定实现和键绑定存储的钩子
import { KeyComboImpl, useKeybindingStore } from '@/stores/keybindingStore'

// 导入命令存储的钩子
import { useCommandStore } from '@/stores/commandStore'

// 导入响应式对象创建工具，用于创建响应式对象
import { shallowReactive } from 'vue'

// 定义动画预览组件的标识符
export const ANIM_PREVIEW_WIDGET = '$$comfy_animation_preview'

/**
 * 清理节点名称中的特殊字符，以防止潜在的XSS攻击
 * @param {string} string 需要清理的节点名称字符串
 * @returns {string} 清理后的节点名称字符串
 */
function sanitizeNodeName(string) {
  // 定义特殊字符映射，将特殊字符映射为空字符串以移除它们
  let entityMap = {
    '&': '',
    '<': '',
    '>': '',
    '"': '',
    "'": '',
    '`': '',
    '=': ''
  }
  // 使用正则表达式替换所有特殊字符为空字符串
  return String(string).replace(/[&<>"'`=]/g, function fromEntityMap(s) {
    return entityMap[s]
  })
}

// 定义Clipspace类型，用于描述动画剪辑空间的数据结构
type Clipspace = {
  // 定义widgets属性，它是一个对象数组，每个对象代表一个动画预览组件
  widgets?: { type?: string; name?: string; value?: any }[] | null
  // 定义imgs属性，它是一个HTMLImageElement数组，用于存储处理后的图像元素
  imgs?: HTMLImageElement[] | null
  // 定义original_imgs属性，它是一个HTMLImageElement数组，用于存储原始的图像元素
  original_imgs?: HTMLImageElement[] | null
  // 定义images属性，它是一个任意类型的数组，用于存储与图像相关的数据
  images?: any[] | null
  // 定义selectedIndex属性，它是一个数字，用于指示当前选中的索引
  selectedIndex: number
  // 定义img_paste_mode属性，它是一个字符串，用于指示图像粘贴模式
  img_paste_mode: string
}

/**
 *
 * @typedef {import("types/comfy").ComfyExtension} ComfyExtension
 */
export class ComfyApp {
  /**
   * 待处理条目队列
   * @type {{number: number, batchCount: number}[]}
   */
  #queueItems = []
  /**
   * 队列是否正在处理中
   * @type {boolean}
   */
  #processingQueue = false

  /**
   * 内容剪贴板
   * @type {serialized node object}
   */
  static clipspace: Clipspace | null = null
  /**
   * 剪贴板失效处理函数
   * @type {(() => void) | null}
   */
  static clipspace_invalidate_handler: (() => void) | null = null
  /**
   * 打开遮罩编辑器的函数
   * @type {null}
   */
  static open_maskeditor = null
  /**
   * 从剪贴板返回节点的函数
   * @type {null}
   */
  static clipspace_return_node = null

  // 强制vite将utils.ts作为index的一部分导入。
  // 强制导入DraggableList。
  static utils = {
    applyTextReplacements,
    addStylesheet,
    DraggableList
  }

  /**
   * Vue应用是否已准备就绪
   * @type {boolean}
   */
  vueAppReady: boolean
  /**
   * 用户界面实例
   * @type {ComfyUI}
   */
  ui: ComfyUI
  /**
   * 日志记录实例
   * @type {ComfyLogging}
   */
  logging: ComfyLogging
  /**
   * 扩展列表
   * @type {ComfyExtension[]}
   */
  extensions: ComfyExtension[]
  /**
   * 扩展管理器实例
   * @type {ExtensionManager}
   */
  extensionManager: ExtensionManager
  /**
   * 节点输出记录
   * @type {Record<string, any>}
   */
  _nodeOutputs: Record<string, any>
  /**
   * 节点预览图片记录
   * @type {Record<string, typeof Image>}
   */
  nodePreviewImages: Record<string, typeof Image>
  /**
   * 图表实例
   * @type {LGraph}
   */
  graph: LGraph
  /**
   * 是否启用工作流视图恢复功能
   * @type {any}
   */
  enableWorkflowViewRestore: any
  /**
   * 画布实例
   * @type {LGraphCanvas}
   */
  canvas: LGraphCanvas
  /**
   * 当前拖拽的节点
   * @type {LGraphNode | null}
   */
  dragOverNode: LGraphNode | null
  /**
   * 画布元素
   * @type {HTMLCanvasElement}
   */
  canvasEl: HTMLCanvasElement
  /**
   * 缩放拖拽起始点
   * @type {[number, number, number] | null}
   */
  zoom_drag_start: [number, number, number] | null
  /**
   * 最近的节点错误记录
   * @type {any[] | null}
   */
  lastNodeErrors: any[] | null
  /**
   * 最近的执行错误记录
   * @type {{ node_id: number } | null}
   */
  lastExecutionError: { node_id: number } | null
  /**
   * 进度信息
   * @type {{ value: number; max: number } | null}
   */
  progress: { value: number; max: number } | null
  /**
   * 是否正在配置图表
   * @type {boolean}
   */
  configuringGraph: boolean
  /**
   * 是否为新用户会话
   * @type {boolean}
   */
  isNewUserSession: boolean
  /**
   * 存储位置
   * @type {StorageLocation}
   */
  storageLocation: StorageLocation
  /**
   * 是否为多用户服务器环境
   * @type {boolean}
   */
  multiUserServer: boolean
  /**
   * 画布渲染上下文
   * @type {CanvasRenderingContext2D}
   */
  ctx: CanvasRenderingContext2D
  /**
   * 小部件构造器记录
   * @type {Record<string, ComfyWidgetConstructor>}
   */
  widgets: Record<string, ComfyWidgetConstructor>
  /**
   * 工作流管理器实例
   * @type {ComfyWorkflowManager}
   */
  workflowManager: ComfyWorkflowManager
  /**
   * 顶部容器元素
   * @type {HTMLElement}
   */
  bodyTop: HTMLElement
  /**
   * 左侧容器元素
   * @type {HTMLElement}
   */
  bodyLeft: HTMLElement
  /**
   * 右侧容器元素
   * @type {HTMLElement}
   */
  bodyRight: HTMLElement
  /**
   * 底部容器元素
   * @type {HTMLElement}
   */
  bodyBottom: HTMLElement
  /**
   * 画布容器元素
   * @type {HTMLElement}
   */
  canvasContainer: HTMLElement
  /**
   * 菜单实例
   * @type {ComfyAppMenu}
   */
  menu: ComfyAppMenu
  /**
   * 绕过背景色
   * @type {string}
   */
  bypassBgColor: string
  /**
   * 打开Clipspace的函数，由Comfy.Clipspace扩展设置
   * @type {() => void}
   */
  openClipspace: () => void = () => {}

  /**
   * @deprecated 使用 useExecutionStore().executingNodeId 替代
   */
  get runningNodeId(): string | null {
    return useExecutionStore().executingNodeId
  }

  /**
   * @deprecated 使用 useWorkspaceStore().shiftDown 替代
   */
  get shiftDown(): boolean {
    return useWorkspaceStore().shiftDown
  }

  /**
   * ComfyUIApp 构造函数
   * 初始化 UI 组件、日志记录器、工作流管理器等
   */
  constructor() {
    // 初始化 Vue 应用状态
    this.vueAppReady = false
    // 初始化 UI 组件
    this.ui = new ComfyUI(this)
    // 初始化日志记录器
    this.logging = new ComfyLogging(this)
    // 初始化工作流管理器
    this.workflowManager = new ComfyWorkflowManager(this)
    // 创建并添加顶部容器元素到 body
    this.bodyTop = $el('div.comfyui-body-top', { parent: document.body })
    // 创建并添加左侧容器元素到 body
    this.bodyLeft = $el('div.comfyui-body-left', { parent: document.body })
    // 创建并添加右侧容器元素到 body
    this.bodyRight = $el('div.comfyui-body-right', { parent: document.body })
    // 创建并添加底部容器元素到 body
    this.bodyBottom = $el('div.comfyui-body-bottom', { parent: document.body })
    // 创建并添加画布容器元素到 body
    this.canvasContainer = $el('div.graph-canvas-container', {
      parent: document.body
    })
    // 初始化应用菜单
    this.menu = new ComfyAppMenu(this)
    // 设置绕行背景颜色
    this.bypassBgColor = '#FF00FF'

    /**
     * 注册到应用的扩展列表
     * @type {ComfyExtension[]}
     */
    this.extensions = []

    /**
     * 存储每个节点的执行输出数据
     * @type {Record<string, any>}
     */
    this.nodeOutputs = {}

    /**
     * 存储每个节点的预览图像数据
     * @type {Record<string, Image>}
     */
    this.nodePreviewImages = {}
  }
  /**
   * 获取节点输出的属性
   * @returns {any} 返回节点输出的值
   */
  get nodeOutputs() {
    return this._nodeOutputs
  }

  /**
   * 设置节点输出的属性
   * @param {any} value 要设置的节点输出的值
   */
  set nodeOutputs(value) {
    this._nodeOutputs = value
    this.#invokeExtensions('onNodeOutputsUpdated', value)
  }

  /**
   * 获取预览格式的参数
   * @returns {string} 返回预览格式的参数字符串，如果没有设置则返回空字符串
   */
  getPreviewFormatParam() {
    let preview_format = this.ui.settings.getSettingValue('Comfy.PreviewFormat')
    if (preview_format) return `&preview=${preview_format}`
    else return ''
  }

  /**
   * 获取随机参数
   * @returns {string} 返回一个带有随机数的参数字符串
   */
  getRandParam() {
    return '&rand=' + Math.random()
  }

  /**
   * 检查节点是否为图像节点
   * @param {any} node 要检查的节点
   * @returns {boolean} 如果节点是图像节点则返回true，否则返回false
   */
  static isImageNode(node) {
    return (
      node.imgs ||
      (node &&
        node.widgets &&
        node.widgets.findIndex((obj) => obj.name === 'image') >= 0)
    )
  }

  /**
   * 在Clipspace编辑器保存时调用
   * 如果存在返回节点，则从Clipspace粘贴到应用程序中
   */
  static onClipspaceEditorSave() {
    if (ComfyApp.clipspace_return_node) {
      ComfyApp.pasteFromClipspace(ComfyApp.clipspace_return_node)
    }
  }

  /**
   * 在Clipspace编辑器关闭时调用
   * 重置Clipspace返回节点
   */
  static onClipspaceEditorClosed() {
    ComfyApp.clipspace_return_node = null
  }

  /**
   * 将节点复制到Clipspace
   * @param {any} node 要复制的节点
   */
  static copyToClipspace(node) {
    var widgets = null
    if (node.widgets) {
      widgets = node.widgets.map(({ type, name, value }) => ({
        type,
        name,
        value
      }))
    }

    var imgs = undefined
    var orig_imgs = undefined
    if (node.imgs != undefined) {
      imgs = []
      orig_imgs = []

      for (let i = 0; i < node.imgs.length; i++) {
        imgs[i] = new Image()
        imgs[i].src = node.imgs[i].src
        orig_imgs[i] = imgs[i]
      }
    }

    var selectedIndex = 0
    if (node.imageIndex) {
      selectedIndex = node.imageIndex
    }

    ComfyApp.clipspace = {
      widgets: widgets,
      imgs: imgs,
      original_imgs: orig_imgs,
      images: node.images,
      selectedIndex: selectedIndex,
      img_paste_mode: 'selected' // reset to default im_paste_mode state on copy action
    }

    ComfyApp.clipspace_return_node = null

    if (ComfyApp.clipspace_invalidate_handler) {
      ComfyApp.clipspace_invalidate_handler()
    }
  }

  /**
   * 从Clipspace粘贴节点数据到指定节点
   * @param {any} node 要粘贴数据到的节点
   */
  static pasteFromClipspace(node) {
    if (ComfyApp.clipspace) {
      // image paste
      if (ComfyApp.clipspace.imgs && node.imgs) {
        if (node.images && ComfyApp.clipspace.images) {
          if (ComfyApp.clipspace['img_paste_mode'] == 'selected') {
            node.images = [
              ComfyApp.clipspace.images[ComfyApp.clipspace['selectedIndex']]
            ]
          } else {
            node.images = ComfyApp.clipspace.images
          }

          if (app.nodeOutputs[node.id + ''])
            app.nodeOutputs[node.id + ''].images = node.images
        }

        if (ComfyApp.clipspace.imgs) {
          // deep-copy to cut link with clipspace
          if (ComfyApp.clipspace['img_paste_mode'] == 'selected') {
            const img = new Image()
            img.src =
              ComfyApp.clipspace.imgs[ComfyApp.clipspace['selectedIndex']].src
            node.imgs = [img]
            node.imageIndex = 0
          } else {
            const imgs = []
            for (let i = 0; i < ComfyApp.clipspace.imgs.length; i++) {
              imgs[i] = new Image()
              imgs[i].src = ComfyApp.clipspace.imgs[i].src
              node.imgs = imgs
            }
          }
        }
      }

      if (node.widgets) {
        if (ComfyApp.clipspace.images) {
          const clip_image =
            ComfyApp.clipspace.images[ComfyApp.clipspace['selectedIndex']]
          const index = node.widgets.findIndex((obj) => obj.name === 'image')
          if (index >= 0) {
            if (
              node.widgets[index].type != 'image' &&
              typeof node.widgets[index].value == 'string' &&
              clip_image.filename
            ) {
              node.widgets[index].value =
                (clip_image.subfolder ? clip_image.subfolder + '/' : '') +
                clip_image.filename +
                (clip_image.type ? ` [${clip_image.type}]` : '')
            } else {
              node.widgets[index].value = clip_image
            }
          }
        }
        if (ComfyApp.clipspace.widgets) {
          ComfyApp.clipspace.widgets.forEach(({ type, name, value }) => {
            const prop = Object.values(node.widgets).find(
              // @ts-expect-errorg
              (obj) => obj.type === type && obj.name === name
            )
            // @ts-expect-error
            if (prop && prop.type != 'button') {
              if (
                // @ts-expect-error
                prop.type != 'image' &&
                // @ts-expect-error
                typeof prop.value == 'string' &&
                value.filename
              ) {
                // @ts-expect-error
                prop.value =
                  (value.subfolder ? value.subfolder + '/' : '') +
                  value.filename +
                  (value.type ? ` [${value.type}]` : '')
              } else {
                // @ts-expect-error
                prop.value = value
                // @ts-expect-error
                prop.callback(value)
              }
            }
          })
        }
      }

      app.graph.setDirtyCanvas(true)
    }
  }
  // 中文注释

  /**
   * 获取启用的扩展
   * 如果 Vue 应用未准备好，直接返回所有扩展
   * 否则，从扩展存储中返回启用的扩展
   */
  get enabledExtensions() {
    if (!this.vueAppReady) {
      return this.extensions
    }
    return useExtensionStore().enabledExtensions
  }

  /**
   * 调用扩展回调
   * @param {keyof ComfyExtension} method 要执行的扩展回调方法
   * @param  {any[]} args 要传递给回调的参数
   * @returns
   */
  #invokeExtensions(method, ...args) {
    let results = []
    for (const ext of this.enabledExtensions) {
      if (method in ext) {
        try {
          results.push(ext[method](...args, this))
        } catch (error) {
          console.error(
            `Error calling extension '${ext.name}' method '${method}'`,
            { error },
            { extension: ext },
            { args }
          )
        }
      }
    }
    return results
  }

  /**
   * 调用异步扩展回调
   * 每个回调将并行调用
   * @param {string} method 要执行的扩展回调方法
   * @param  {...any} args 要传递给回调的参数
   * @returns
   */
  async #invokeExtensionsAsync(method, ...args) {
    return await Promise.all(
      this.enabledExtensions.map(async (ext) => {
        if (method in ext) {
          try {
            return await ext[method](...args, this)
          } catch (error) {
            console.error(
              `Error calling extension '${ext.name}' method '${method}'`,
              { error },
              { extension: ext },
              { args }
            )
          }
        }
      })
    )
  }

  /**
   * 添加恢复工作流视图的功能
   * 修改 LGraph 的序列化过程，以在启用相应设置时包含视图状态信息
   */
  #addRestoreWorkflowView() {
    const serialize = LGraph.prototype.serialize
    const self = this
    LGraph.prototype.serialize = function () {
      const workflow = serialize.apply(this, arguments)

      // 如果启用了保存和恢复视图状态的设置，则在序列化的工作流中存储拖动和缩放信息
      if (self.enableWorkflowViewRestore.value) {
        if (!workflow.extra) {
          workflow.extra = {}
        }
        workflow.extra.ds = {
          scale: self.canvas.ds.scale,
          offset: self.canvas.ds.offset
        }
      } else if (workflow.extra?.ds) {
        // 清除旧的视图数据
        delete workflow.extra.ds
      }

      return workflow
    }
    this.enableWorkflowViewRestore = this.ui.settings.addSetting({
      id: 'Comfy.EnableWorkflowViewRestore',
      category: ['Comfy', 'Workflow', 'EnableWorkflowViewRestore'],
      name: 'Save and restore canvas position and zoom level in workflows',
      type: 'boolean',
      defaultValue: true
    })
  }
  /**
   * 为节点添加上下文菜单处理器。
   * @param {Object} node - 要添加菜单处理器的节点。
   */
  #addNodeContextMenuHandler(node) {
    /**
     * 生成复制图片的选项，如果支持的话。
     * @param {HTMLImageElement} img - 要复制的图片。
     * @returns {Array} 包含复制图片选项的数组，如果不支持则为空数组。
     */
    function getCopyImageOption(img) {
      if (typeof window.ClipboardItem === 'undefined') return []
      return [
        {
          content: 'Copy Image',
          callback: async () => {
            const url = new URL(img.src)
            url.searchParams.delete('preview')

            const writeImage = async (blob) => {
              await navigator.clipboard.write([
                new ClipboardItem({
                  [blob.type]: blob
                })
              ])
            }

            try {
              const data = await fetch(url)
              const blob = await data.blob()
              try {
                await writeImage(blob)
              } catch (error) {
                // Chrome 只支持 PNG 格式的图片，如果图片不是 PNG 格式，则转换后重试
                if (blob.type !== 'image/png') {
                  const canvas = $el('canvas', {
                    width: img.naturalWidth,
                    height: img.naturalHeight
                  }) as HTMLCanvasElement
                  const ctx = canvas.getContext('2d')
                  let image
                  if (typeof window.createImageBitmap === 'undefined') {
                    image = new Image()
                    const p = new Promise((resolve, reject) => {
                      image.onload = resolve
                      image.onerror = reject
                    }).finally(() => {
                      URL.revokeObjectURL(image.src)
                    })
                    image.src = URL.createObjectURL(blob)
                    await p
                  } else {
                    image = await createImageBitmap(blob)
                  }
                  try {
                    ctx.drawImage(image, 0, 0)
                    canvas.toBlob(writeImage, 'image/png')
                  } finally {
                    if (typeof image.close === 'function') {
                      image.close()
                    }
                  }

                  return
                }
                throw error
              }
            } catch (error) {
              useToastStore().addAlert(
                'Error copying image: ' + (error.message ?? error)
              )
            }
          }
        }
      ]
    }

    node.prototype.getExtraMenuOptions = function (_, options) {
      if (this.imgs) {
        // 如果节点包含图片，则添加“在新标签页中打开”选项
        let img
        if (this.imageIndex != null) {
          // 如果有选中的图片，则选择该图片
          img = this.imgs[this.imageIndex]
        } else if (this.overIndex != null) {
          // 没有选中的图片，但有悬停的图片
          img = this.imgs[this.overIndex]
        }
        if (img) {
          options.unshift(
            {
              content: 'Open Image',
              callback: () => {
                let url = new URL(img.src)
                url.searchParams.delete('preview')
                window.open(url, '_blank')
              }
            },
            ...getCopyImageOption(img),
            {
              content: 'Save Image',
              callback: () => {
                const a = document.createElement('a')
                let url = new URL(img.src)
                url.searchParams.delete('preview')
                a.href = url.toString()
                a.setAttribute(
                  'download',
                  new URLSearchParams(url.search).get('filename')
                )
                document.body.append(a)
                a.click()
                requestAnimationFrame(() => a.remove())
              }
            }
          )
        }
      }

      options.push({
        content: 'Bypass',
        callback: (obj) => {
          if (this.mode === 4) this.mode = 0
          else this.mode = 4
          this.graph.change()
        }
      })

      // 防止与剪贴板内容冲突
      if (!ComfyApp.clipspace_return_node) {
        options.push({
          content: 'Copy (Clipspace)',
          callback: (obj) => {
            ComfyApp.copyToClipspace(this)
          }
        })

        if (ComfyApp.clipspace != null) {
          options.push({
            content: 'Paste (Clipspace)',
            callback: () => {
              ComfyApp.pasteFromClipspace(this)
            }
          })
        }

        if (ComfyApp.isImageNode(this)) {
          options.push({
            content: 'Open in MaskEditor',
            callback: (obj) => {
              ComfyApp.copyToClipspace(this)
              ComfyApp.clipspace_return_node = this
              ComfyApp.open_maskeditor()
            }
          })
        }
      }
    }
  }

  /**
   * 为节点添加键盘事件处理器。
   * @param {Object} node - 要添加键盘事件处理器的节点。
   */
  #addNodeKeyHandler(node) {
    const app = this
    const origNodeOnKeyDown = node.prototype.onKeyDown

    node.prototype.onKeyDown = function (e) {
      if (origNodeOnKeyDown && origNodeOnKeyDown.apply(this, e) === false) {
        return false
      }

      if (this.flags.collapsed || !this.imgs || this.imageIndex === null) {
        return
      }

      let handled = false

      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        if (e.key === 'ArrowLeft') {
          this.imageIndex -= 1
        } else if (e.key === 'ArrowRight') {
          this.imageIndex += 1
        }
        this.imageIndex %= this.imgs.length

        if (this.imageIndex < 0) {
          this.imageIndex = this.imgs.length + this.imageIndex
        }
        handled = true
      } else if (e.key === 'Escape') {
        this.imageIndex = null
        handled = true
      }

      if (handled === true) {
        e.preventDefault()
        e.stopImmediatePropagation()
        return false
      }
    }
  }

  /**
   * 为节点添加自定义绘制逻辑
   * 例如：绘制图像并在输出图像的节点上处理缩略图导航
   * @param {*} node 要添加绘制处理器的节点
   */
  #addDrawBackgroundHandler(node) {
    const app = this
    /**
     * 获取节点图像的顶部偏移量
     * @param {*} node 节点
     * @returns {number} 图像顶部偏移量
     */
    function getImageTop(node) {
      let shiftY
      if (node.imageOffset != null) {
        shiftY = node.imageOffset
      } else {
        if (node.widgets?.length) {
          const w = node.widgets[node.widgets.length - 1]
          shiftY = w.last_y
          if (w.computeSize) {
            shiftY += w.computeSize()[1] + 4
          } else if (w.computedHeight) {
            shiftY += w.computedHeight
          } else {
            shiftY += LiteGraph.NODE_WIDGET_HEIGHT + 4
          }
        } else {
          shiftY = node.computeSize()[1]
        }
      }
      return shiftY
    }
    /**
     * 根据图像调整节点大小
     * @param {boolean} force 是否强制调整大小
     */
    node.prototype.setSizeForImage = function (force) {
      if (!force && this.animatedImages) return

      if (this.inputHeight || this.freeWidgetSpace > 210) {
        this.setSize(this.size)
        return
      }
      const minHeight = getImageTop(this) + 220
      if (this.size[1] < minHeight) {
        this.setSize([this.size[0], minHeight])
      }
    }
    /**
     * 绘制背景
     * @param {CanvasRenderingContext2D} ctx 绘制上下文
     */
    function unsafeDrawBackground(ctx) {
      if (!this.flags.collapsed) {
        let imgURLs = []
        let imagesChanged = false

        const output = app.nodeOutputs[this.id + '']
        if (output?.images) {
          this.animatedImages = output?.animated?.find(Boolean)
          if (this.images !== output.images) {
            this.images = output.images
            imagesChanged = true
            imgURLs = imgURLs.concat(
              output.images.map((params) => {
                return api.apiURL(
                  '/view?' +
                    new URLSearchParams(params).toString() +
                    (this.animatedImages ? '' : app.getPreviewFormatParam()) +
                    app.getRandParam()
                )
              })
            )
          }
        }

        const preview = app.nodePreviewImages[this.id + '']
        if (this.preview !== preview) {
          this.preview = preview
          imagesChanged = true
          if (preview != null) {
            imgURLs.push(preview)
          }
        }

        if (imagesChanged) {
          this.imageIndex = null
          if (imgURLs.length > 0) {
            Promise.all(
              imgURLs.map((src) => {
                return new Promise((r) => {
                  const img = new Image()
                  img.onload = () => r(img)
                  img.onerror = () => r(null)
                  img.src = src
                })
              })
            ).then((imgs) => {
              if (
                (!output || this.images === output.images) &&
                (!preview || this.preview === preview)
              ) {
                this.imgs = imgs.filter(Boolean)
                this.setSizeForImage?.()
                app.graph.setDirtyCanvas(true)
              }
            })
          } else {
            this.imgs = null
          }
        }
        /**
         * 检查所有图像是否具有相同的宽高比
         * @param {HTMLImageElement[]} imgs 图像数组
         * @returns {boolean} 是否所有图像具有相同的宽高比
         */
        const is_all_same_aspect_ratio = (imgs) => {
          // assume: imgs.length >= 2
          let ratio = imgs[0].naturalWidth / imgs[0].naturalHeight

          for (let i = 1; i < imgs.length; i++) {
            let this_ratio = imgs[i].naturalWidth / imgs[i].naturalHeight
            if (ratio != this_ratio) return false
          }

          return true
        }

        if (this.imgs?.length) {
          const widgetIdx = this.widgets?.findIndex(
            (w) => w.name === ANIM_PREVIEW_WIDGET
          )

          if (this.animatedImages) {
            // Instead of using the canvas we'll use a IMG
            if (widgetIdx > -1) {
              // Replace content
              const widget = this.widgets[widgetIdx]
              widget.options.host.updateImages(this.imgs)
            } else {
              const host = createImageHost(this)
              this.setSizeForImage(true)
              const widget = this.addDOMWidget(
                ANIM_PREVIEW_WIDGET,
                'img',
                host.el,
                {
                  host,
                  getHeight: host.getHeight,
                  onDraw: host.onDraw,
                  hideOnZoom: false
                }
              )
              widget.serializeValue = () => undefined
              widget.options.host.updateImages(this.imgs)
            }
            return
          }

          if (widgetIdx > -1) {
            this.widgets[widgetIdx].onRemove?.()
            this.widgets.splice(widgetIdx, 1)
          }

          const canvas = app.graph.list_of_graphcanvas[0]
          const mouse = canvas.graph_mouse
          if (!canvas.pointer_is_down && this.pointerDown) {
            if (
              mouse[0] === this.pointerDown.pos[0] &&
              mouse[1] === this.pointerDown.pos[1]
            ) {
              this.imageIndex = this.pointerDown.index
            }
            this.pointerDown = null
          }

          let imageIndex = this.imageIndex
          const numImages = this.imgs.length
          if (numImages === 1 && !imageIndex) {
            this.imageIndex = imageIndex = 0
          }

          const top = getImageTop(this)
          var shiftY = top

          let dw = this.size[0]
          let dh = this.size[1]
          dh -= shiftY

          if (imageIndex == null) {
            var cellWidth, cellHeight, shiftX, cell_padding, cols

            const compact_mode = is_all_same_aspect_ratio(this.imgs)
            if (!compact_mode) {
              // use rectangle cell style and border line
              cell_padding = 2
              // Prevent infinite canvas2d scale-up
              const largestDimension = this.imgs.reduce(
                (acc, current) =>
                  Math.max(acc, current.naturalWidth, current.naturalHeight),
                0
              )
              const fakeImgs = []
              fakeImgs.length = this.imgs.length
              fakeImgs[0] = {
                naturalWidth: largestDimension,
                naturalHeight: largestDimension
              }
              ;({ cellWidth, cellHeight, cols, shiftX } = calculateImageGrid(
                fakeImgs,
                dw,
                dh
              ))
            } else {
              cell_padding = 0
              ;({ cellWidth, cellHeight, cols, shiftX } = calculateImageGrid(
                this.imgs,
                dw,
                dh
              ))
            }

            let anyHovered = false
            this.imageRects = []
            for (let i = 0; i < numImages; i++) {
              const img = this.imgs[i]
              const row = Math.floor(i / cols)
              const col = i % cols
              const x = col * cellWidth + shiftX
              const y = row * cellHeight + shiftY
              if (!anyHovered) {
                anyHovered = LiteGraph.isInsideRectangle(
                  mouse[0],
                  mouse[1],
                  x + this.pos[0],
                  y + this.pos[1],
                  cellWidth,
                  cellHeight
                )
                if (anyHovered) {
                  this.overIndex = i
                  let value = 110
                  if (canvas.pointer_is_down) {
                    if (!this.pointerDown || this.pointerDown.index !== i) {
                      this.pointerDown = { index: i, pos: [...mouse] }
                    }
                    value = 125
                  }
                  ctx.filter = `contrast(${value}%) brightness(${value}%)`
                  canvas.canvas.style.cursor = 'pointer'
                }
              }
              this.imageRects.push([x, y, cellWidth, cellHeight])

              let wratio = cellWidth / img.width
              let hratio = cellHeight / img.height
              var ratio = Math.min(wratio, hratio)

              let imgHeight = ratio * img.height
              let imgY =
                row * cellHeight + shiftY + (cellHeight - imgHeight) / 2
              let imgWidth = ratio * img.width
              let imgX = col * cellWidth + shiftX + (cellWidth - imgWidth) / 2

              ctx.drawImage(
                img,
                imgX + cell_padding,
                imgY + cell_padding,
                imgWidth - cell_padding * 2,
                imgHeight - cell_padding * 2
              )
              if (!compact_mode) {
                // rectangle cell and border line style
                ctx.strokeStyle = '#8F8F8F'
                ctx.lineWidth = 1
                ctx.strokeRect(
                  x + cell_padding,
                  y + cell_padding,
                  cellWidth - cell_padding * 2,
                  cellHeight - cell_padding * 2
                )
              }

              ctx.filter = 'none'
            }

            if (!anyHovered) {
              this.pointerDown = null
              this.overIndex = null
            }
          } else {
            // Draw individual
            let w = this.imgs[imageIndex].naturalWidth
            let h = this.imgs[imageIndex].naturalHeight

            const scaleX = dw / w
            const scaleY = dh / h
            const scale = Math.min(scaleX, scaleY, 1)

            w *= scale
            h *= scale

            let x = (dw - w) / 2
            let y = (dh - h) / 2 + shiftY
            ctx.drawImage(this.imgs[imageIndex], x, y, w, h)

            const drawButton = (x, y, sz, text) => {
              const hovered = LiteGraph.isInsideRectangle(
                mouse[0],
                mouse[1],
                x + this.pos[0],
                y + this.pos[1],
                sz,
                sz
              )
              let fill = '#333'
              let textFill = '#fff'
              let isClicking = false
              if (hovered) {
                canvas.canvas.style.cursor = 'pointer'
                if (canvas.pointer_is_down) {
                  fill = '#1e90ff'
                  isClicking = true
                } else {
                  fill = '#eee'
                  textFill = '#000'
                }
              } else {
                this.pointerWasDown = null
              }

              ctx.fillStyle = fill
              ctx.beginPath()
              ctx.roundRect(x, y, sz, sz, [4])
              ctx.fill()
              ctx.fillStyle = textFill
              ctx.font = '12px Arial'
              ctx.textAlign = 'center'
              ctx.fillText(text, x + 15, y + 20)

              return isClicking
            }

            if (numImages > 1) {
              if (
                drawButton(
                  dw - 40,
                  dh + top - 40,
                  30,
                  `${this.imageIndex + 1}/${numImages}`
                )
              ) {
                let i =
                  this.imageIndex + 1 >= numImages ? 0 : this.imageIndex + 1
                if (!this.pointerDown || !this.pointerDown.index === i) {
                  this.pointerDown = { index: i, pos: [...mouse] }
                }
              }

              if (drawButton(dw - 40, top + 10, 30, `x`)) {
                if (!this.pointerDown || !this.pointerDown.index === null) {
                  this.pointerDown = { index: null, pos: [...mouse] }
                }
              }
            }
          }
        }
      }
    }

    node.prototype.onDrawBackground = function (ctx) {
      try {
        unsafeDrawBackground.call(this, ctx)
      } catch (error) {
        console.error('Error drawing node background', error)
      }
    }
  }

  /**
   * 添加一个处理器，允许通过拖放文件到窗口来加载工作流
   */
  #addDropHandler() {
    // 从拖放的 PNG 或 JSON 文件中获取提示
    document.addEventListener('drop', async (event) => {
      event.preventDefault()
      event.stopPropagation()

      const n = this.dragOverNode
      this.dragOverNode = null
      // 节点处理文件拖放，不使用内置的 onDropFile 处理器，因为它是有 bug 的
      // 如果拖动多个文件，它会多次调用同一个文件
      // @ts-expect-error 这不是一个标准事件。TODO 修复它。
      if (n && n.onDragDrop && (await n.onDragDrop(event))) {
        return
      }
      // 从 Chrome 拖动到 Firefox 时，文件可能是 bmp，忽略这种情况
      if (
        event.dataTransfer.files.length &&
        event.dataTransfer.files[0].type !== 'image/bmp'
      ) {
        await this.handleFile(event.dataTransfer.files[0])
      } else {
        // 尝试加载传输列表中的第一个 URI
        const validTypes = ['text/uri-list', 'text/x-moz-url']
        const match = [...event.dataTransfer.types].find((t) =>
          validTypes.find((v) => t === v)
        )
        if (match) {
          const uri = event.dataTransfer.getData(match)?.split('\n')?.[0]
          if (uri) {
            await this.handleFile(await (await fetch(uri)).blob())
          }
        }
      }
    })

    // 在拖动离开时始终清除悬停节点
    this.canvasEl.addEventListener('dragleave', async () => {
      if (this.dragOverNode) {
        this.dragOverNode = null
        this.graph.setDirtyCanvas(false, true)
      }
    })

    // 添加在特定节点上拖放的处理器
    this.canvasEl.addEventListener(
      'dragover',
      (e) => {
        this.canvas.adjustMouseEvent(e)
        // @ts-expect-error: canvasX 和 canvasY 是由 litegraph 中的 adjustMouseEvent 添加的
        const node = this.graph.getNodeOnPos(e.canvasX, e.canvasY)
        if (node) {
          // @ts-expect-error 这不是一个标准事件。TODO 修复它。
          if (node.onDragOver && node.onDragOver(e)) {
            this.dragOverNode = node

            // dragover 事件非常频繁地触发，因此在动画帧中运行此操作
            requestAnimationFrame(() => {
              this.graph.setDirtyCanvas(false, true)
            })
            return
          }
        }
        this.dragOverNode = null
      },
      false
    )
  }

  /**
   * Adds a handler on paste that extracts and loads images or workflows from pasted JSON data
   */
  #addPasteHandler() {
    document.addEventListener('paste', async (e: ClipboardEvent) => {
      // ctrl+shift+v is used to paste nodes with connections
      // this is handled by litegraph
      if (this.shiftDown) return

      // @ts-expect-error: Property 'clipboardData' does not exist on type 'Window & typeof globalThis'.
      // Did you mean 'Clipboard'?ts(2551)
      // TODO: Not sure what the code wants to do.
      let data = e.clipboardData || window.clipboardData
      const items = data.items

      // Look for image paste data
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          var imageNode = null

          // If an image node is selected, paste into it
          if (
            this.canvas.current_node &&
            this.canvas.current_node.is_selected &&
            ComfyApp.isImageNode(this.canvas.current_node)
          ) {
            imageNode = this.canvas.current_node
          }

          // No image node selected: add a new one
          if (!imageNode) {
            const newNode = LiteGraph.createNode('LoadImage')
            // @ts-expect-error array to Float32Array
            newNode.pos = [...this.canvas.graph_mouse]
            imageNode = this.graph.add(newNode)
            this.graph.change()
          }
          const blob = item.getAsFile()
          imageNode.pasteFile(blob)
          return
        }
      }

      // No image found. Look for node data
      data = data.getData('text/plain')
      let workflow: ComfyWorkflowJSON | null = null
      try {
        data = data.slice(data.indexOf('{'))
        workflow = JSON.parse(data)
      } catch (err) {
        try {
          data = data.slice(data.indexOf('workflow\n'))
          data = data.slice(data.indexOf('{'))
          workflow = JSON.parse(data)
        } catch (error) {
          workflow = null
        }
      }

      if (workflow && workflow.version && workflow.nodes && workflow.extra) {
        await this.loadGraphData(workflow)
      } else {
        if (
          (e.target instanceof HTMLTextAreaElement &&
            e.target.type === 'textarea') ||
          (e.target instanceof HTMLInputElement && e.target.type === 'text')
        ) {
          return
        }

        // Litegraph default paste
        this.canvas.pasteFromClipboard()
      }
    })
  }

  /**
   * Adds a handler on copy that serializes selected nodes to JSON
   */
  #addCopyHandler() {
    document.addEventListener('copy', (e) => {
      if (!(e.target instanceof Element)) {
        return
      }
      if (
        (e.target instanceof HTMLTextAreaElement &&
          e.target.type === 'textarea') ||
        (e.target instanceof HTMLInputElement && e.target.type === 'text')
      ) {
        // Default system copy
        return
      }
      const isTargetInGraph =
        e.target.classList.contains('litegraph') ||
        e.target.classList.contains('graph-canvas-container')

      // copy nodes and clear clipboard
      if (isTargetInGraph && this.canvas.selected_nodes) {
        this.canvas.copyToClipboard()
        e.clipboardData.setData('text', ' ') //clearData doesn't remove images from clipboard
        e.preventDefault()
        e.stopImmediatePropagation()
        return false
      }
    })
  }

  /**
   * Handle mouse
   *
   * Move group by header
   */
  #addProcessMouseHandler() {
    const self = this

    const origProcessMouseDown = LGraphCanvas.prototype.processMouseDown
    LGraphCanvas.prototype.processMouseDown = function (e) {
      // prepare for ctrl+shift drag: zoom start
      if (e.ctrlKey && e.shiftKey && e.buttons) {
        self.zoom_drag_start = [e.x, e.y, this.ds.scale]
        return
      }

      const res = origProcessMouseDown.apply(this, arguments)

      this.selected_group_moving = false

      if (this.selected_group && !this.selected_group_resizing) {
        var font_size =
          this.selected_group.font_size || LiteGraph.DEFAULT_GROUP_FONT_SIZE
        var height = font_size * 1.4

        // Move group by header
        if (
          LiteGraph.isInsideRectangle(
            e.canvasX,
            e.canvasY,
            this.selected_group.pos[0],
            this.selected_group.pos[1],
            this.selected_group.size[0],
            height
          )
        ) {
          this.selected_group_moving = true
        }
      }

      return res
    }
    const origProcessMouseMove = LGraphCanvas.prototype.processMouseMove
    LGraphCanvas.prototype.processMouseMove = function (e) {
      // handle ctrl+shift drag
      if (e.ctrlKey && e.shiftKey && self.zoom_drag_start) {
        // stop canvas zoom action
        if (!e.buttons) {
          self.zoom_drag_start = null
          return
        }

        // calculate delta
        let deltaY = e.y - self.zoom_drag_start[1]
        let startScale = self.zoom_drag_start[2]

        let scale = startScale - deltaY / 100

        this.ds.changeScale(scale, [
          self.zoom_drag_start[0],
          self.zoom_drag_start[1]
        ])
        this.graph.change()

        return
      }

      const orig_selected_group = this.selected_group

      if (
        this.selected_group &&
        !this.selected_group_resizing &&
        !this.selected_group_moving
      ) {
        this.selected_group = null
      }

      const res = origProcessMouseMove.apply(this, arguments)

      if (
        orig_selected_group &&
        !this.selected_group_resizing &&
        !this.selected_group_moving
      ) {
        this.selected_group = orig_selected_group
      }

      return res
    }
  }

  /**
   * Handle keypress
   */
  #addProcessKeyHandler() {
    const origProcessKey = LGraphCanvas.prototype.processKey
    LGraphCanvas.prototype.processKey = function (e: KeyboardEvent) {
      if (!this.graph) {
        return
      }

      var block_default = false

      if (e.target instanceof Element && e.target.localName == 'input') {
        return
      }

      if (e.type == 'keydown' && !e.repeat) {
        const keyCombo = KeyComboImpl.fromEvent(e)
        const keybindingStore = useKeybindingStore()
        const keybinding = keybindingStore.getKeybinding(keyCombo)
        if (keybinding && keybinding.targetSelector === '#graph-canvas') {
          useCommandStore().execute(keybinding.commandId)
          block_default = true
        }

        // Ctrl+C Copy
        if (e.key === 'c' && (e.metaKey || e.ctrlKey)) {
          // Trigger onCopy
          return true
        }

        // Ctrl+V Paste
        if (
          (e.key === 'v' || e.key == 'V') &&
          (e.metaKey || e.ctrlKey) &&
          !e.shiftKey
        ) {
          // Trigger onPaste
          return true
        }
      }

      this.graph.change()

      if (block_default) {
        e.preventDefault()
        e.stopImmediatePropagation()
        return false
      }

      // Fall through to Litegraph defaults
      return origProcessKey.apply(this, arguments)
    }
  }

  /**
   * Draws group header bar
   */
  #addDrawGroupsHandler() {
    const self = this
    const origDrawGroups = LGraphCanvas.prototype.drawGroups
    LGraphCanvas.prototype.drawGroups = function (canvas, ctx) {
      if (!this.graph) {
        return
      }

      var groups = this.graph.groups

      ctx.save()
      ctx.globalAlpha = 0.7 * this.editor_alpha

      for (var i = 0; i < groups.length; ++i) {
        var group = groups[i]

        if (!LiteGraph.overlapBounding(this.visible_area, group._bounding)) {
          continue
        } //out of the visible area

        ctx.fillStyle = group.color || '#335'
        ctx.strokeStyle = group.color || '#335'
        var pos = group._pos
        var size = group._size
        ctx.globalAlpha = 0.25 * this.editor_alpha
        ctx.beginPath()
        var font_size = group.font_size || LiteGraph.DEFAULT_GROUP_FONT_SIZE
        ctx.rect(pos[0] + 0.5, pos[1] + 0.5, size[0], font_size * 1.4)
        ctx.fill()
        ctx.globalAlpha = this.editor_alpha
      }

      ctx.restore()

      const res = origDrawGroups.apply(this, arguments)
      return res
    }
  }

  /**
   * Draws node highlights (executing, drag drop) and progress bar
   */
  #addDrawNodeHandler() {
    const origDrawNodeShape = LGraphCanvas.prototype.drawNodeShape
    const self = this
    LGraphCanvas.prototype.drawNodeShape = function (
      node,
      ctx,
      size,
      fgcolor,
      bgcolor,
      selected,
      mouse_over
    ) {
      const res = origDrawNodeShape.apply(this, arguments)

      const nodeErrors = self.lastNodeErrors?.[node.id]

      let color = null
      let lineWidth = 1
      if (node.id === +self.runningNodeId) {
        color = '#0f0'
      } else if (self.dragOverNode && node.id === self.dragOverNode.id) {
        color = 'dodgerblue'
      } else if (nodeErrors?.errors) {
        color = 'red'
        lineWidth = 2
      } else if (
        self.lastExecutionError &&
        +self.lastExecutionError.node_id === node.id
      ) {
        color = '#f0f'
        lineWidth = 2
      }

      if (color) {
        const shape =
          node._shape || node.constructor.shape || LiteGraph.ROUND_SHAPE
        ctx.lineWidth = lineWidth
        ctx.globalAlpha = 0.8
        ctx.beginPath()
        if (shape == LiteGraph.BOX_SHAPE)
          ctx.rect(
            -6,
            -6 - LiteGraph.NODE_TITLE_HEIGHT,
            12 + size[0] + 1,
            12 + size[1] + LiteGraph.NODE_TITLE_HEIGHT
          )
        else if (
          shape == LiteGraph.ROUND_SHAPE ||
          (shape == LiteGraph.CARD_SHAPE && node.flags.collapsed)
        )
          ctx.roundRect(
            -6,
            -6 - LiteGraph.NODE_TITLE_HEIGHT,
            12 + size[0] + 1,
            12 + size[1] + LiteGraph.NODE_TITLE_HEIGHT,
            this.round_radius * 2
          )
        else if (shape == LiteGraph.CARD_SHAPE)
          ctx.roundRect(
            -6,
            -6 - LiteGraph.NODE_TITLE_HEIGHT,
            12 + size[0] + 1,
            12 + size[1] + LiteGraph.NODE_TITLE_HEIGHT,
            [this.round_radius * 2, this.round_radius * 2, 2, 2]
          )
        else if (shape == LiteGraph.CIRCLE_SHAPE)
          ctx.arc(
            size[0] * 0.5,
            size[1] * 0.5,
            size[0] * 0.5 + 6,
            0,
            Math.PI * 2
          )
        ctx.strokeStyle = color
        ctx.stroke()
        ctx.strokeStyle = fgcolor
        ctx.globalAlpha = 1
      }

      if (self.progress && node.id === +self.runningNodeId) {
        ctx.fillStyle = 'green'
        ctx.fillRect(
          0,
          0,
          size[0] * (self.progress.value / self.progress.max),
          6
        )
        ctx.fillStyle = bgcolor
      }

      // Highlight inputs that failed validation
      if (nodeErrors) {
        ctx.lineWidth = 2
        ctx.strokeStyle = 'red'
        for (const error of nodeErrors.errors) {
          if (error.extra_info && error.extra_info.input_name) {
            const inputIndex = node.findInputSlot(error.extra_info.input_name)
            if (inputIndex !== -1) {
              let pos = node.getConnectionPos(true, inputIndex)
              ctx.beginPath()
              ctx.arc(
                pos[0] - node.pos[0],
                pos[1] - node.pos[1],
                12,
                0,
                2 * Math.PI,
                false
              )
              ctx.stroke()
            }
          }
        }
      }

      return res
    }

    const origDrawNode = LGraphCanvas.prototype.drawNode
    LGraphCanvas.prototype.drawNode = function (node, ctx) {
      const editor_alpha = this.editor_alpha
      const old_color = node.color
      const old_bgcolor = node.bgcolor

      if (node.mode === 2) {
        // never
        this.editor_alpha = 0.4
      }

      // ComfyUI's custom node mode enum value 4 => bypass/never.
      let bgColor: string
      if (node.mode === 4) {
        // never
        bgColor = app.bypassBgColor
        this.editor_alpha = 0.2
      } else {
        bgColor = old_bgcolor || LiteGraph.NODE_DEFAULT_BGCOLOR
      }

      const adjustments: ColorAdjustOptions = {}

      const opacity = useSettingStore().get('Comfy.Node.Opacity')
      if (opacity) adjustments.opacity = opacity

      if (useSettingStore().get('Comfy.ColorPalette') === 'light') {
        adjustments.lightness = 0.5

        // Lighten title bar of colored nodes on light theme
        if (old_color) {
          node.color = adjustColor(old_color, { lightness: 0.5 })
        }
      }

      node.bgcolor = adjustColor(bgColor, adjustments)

      const res = origDrawNode.apply(this, arguments)

      this.editor_alpha = editor_alpha
      node.color = old_color
      node.bgcolor = old_bgcolor

      return res
    }
  }

  /**
   * Handles updates from the API socket
   */
  #addApiUpdateHandlers() {
    api.addEventListener(
      'status',
      ({ detail }: CustomEvent<StatusWsMessageStatus>) => {
        this.ui.setStatus(detail)
      }
    )

    api.addEventListener('progress', ({ detail }) => {
      this.progress = detail
      this.graph.setDirtyCanvas(true, false)
    })

    api.addEventListener('executing', ({ detail }) => {
      this.progress = null
      this.graph.setDirtyCanvas(true, false)
      delete this.nodePreviewImages[this.runningNodeId]
    })

    api.addEventListener('executed', ({ detail }) => {
      const output = this.nodeOutputs[detail.display_node || detail.node]
      if (detail.merge && output) {
        for (const k in detail.output ?? {}) {
          const v = output[k]
          if (v instanceof Array) {
            output[k] = v.concat(detail.output[k])
          } else {
            output[k] = detail.output[k]
          }
        }
      } else {
        this.nodeOutputs[detail.display_node || detail.node] = detail.output
      }
      const node = this.graph.getNodeById(detail.display_node || detail.node)
      if (node) {
        // @ts-expect-error
        if (node.onExecuted)
          // @ts-expect-error
          node.onExecuted(detail.output)
      }
    })

    api.addEventListener('execution_start', ({ detail }) => {
      this.lastExecutionError = null
      this.graph.nodes.forEach((node) => {
        // @ts-expect-error
        if (node.onExecutionStart)
          // @ts-expect-error
          node.onExecutionStart()
      })
    })

    api.addEventListener('execution_error', ({ detail }) => {
      this.lastExecutionError = detail
      showExecutionErrorDialog(detail)
      this.canvas.draw(true, true)
    })

    api.addEventListener('b_preview', ({ detail }) => {
      const id = this.runningNodeId
      if (id == null) return

      const blob = detail
      const blobUrl = URL.createObjectURL(blob)
      // @ts-expect-error
      this.nodePreviewImages[id] = [blobUrl]
    })

    api.init()
  }

  #addConfigureHandler() {
    const app = this
    const configure = LGraph.prototype.configure
    // Flag that the graph is configuring to prevent nodes from running checks while its still loading
    LGraph.prototype.configure = function () {
      app.configuringGraph = true
      try {
        return configure.apply(this, arguments)
      } finally {
        app.configuringGraph = false
      }
    }
  }

  #addWidgetLinkHandling() {
    app.canvas.getWidgetLinkType = function (widget, node) {
      const nodeDefStore = useNodeDefStore()
      const nodeDef = nodeDefStore.nodeDefsByName[node.type]
      const input = nodeDef.input.getInput(widget.name)
      return input?.type
    }

    type ConnectingWidgetLink = {
      subType: 'connectingWidgetLink'
      widget: IWidget
      node: LGraphNode
      link: { node: LGraphNode; slot: number }
    }

    document.addEventListener(
      'litegraph:canvas',
      async (e: CustomEvent<ConnectingWidgetLink>) => {
        if (e.detail.subType === 'connectingWidgetLink') {
          const { convertToInput } = await import(
            '@/extensions/core/widgetInputs'
          )

          const { node, link, widget } = e.detail
          if (!node || !link || !widget) return

          const nodeData = node.constructor.nodeData
          if (!nodeData) return
          const all = {
            ...nodeData?.input?.required,
            ...nodeData?.input?.optional
          }
          const inputSpec = all[widget.name]
          if (!inputSpec) return

          const input = convertToInput(node, widget, inputSpec)
          if (!input) return

          const originNode = link.node

          originNode.connect(link.slot, node, node.inputs.lastIndexOf(input))
        }
      }
    )
  }

  #addAfterConfigureHandler() {
    const app = this
    const onConfigure = app.graph.onConfigure
    app.graph.onConfigure = function () {
      // Fire callbacks before the onConfigure, this is used by widget inputs to setup the config
      for (const node of app.graph.nodes) {
        // @ts-expect-error
        node.onGraphConfigured?.()
      }

      const r = onConfigure?.apply(this, arguments)

      // Fire after onConfigure, used by primitives to generate widget using input nodes config
      for (const node of app.graph.nodes) {
        node.onAfterGraphConfigured?.()
      }

      return r
    }
  }

  /**
   * Loads all extensions from the API into the window in parallel
   */
  async #loadExtensions() {
    useExtensionStore().loadDisabledExtensionNames()

    const extensions = await api.getExtensions()
    this.logging.addEntry('Comfy.App', 'debug', { Extensions: extensions })

    // Need to load core extensions first as some custom extensions
    // may depend on them.
    await import('../extensions/core/index')
    await Promise.all(
      extensions
        .filter((extension) => !extension.includes('extensions/core'))
        .map(async (ext) => {
          try {
            await import(/* @vite-ignore */ api.fileURL(ext))
          } catch (error) {
            console.error('Error loading extension', ext, error)
          }
        })
    )
  }

  async #migrateSettings() {
    this.isNewUserSession = true
    // Store all current settings
    const settings = Object.keys(this.ui.settings).reduce((p, n) => {
      const v = localStorage[`Comfy.Settings.${n}`]
      if (v) {
        try {
          p[n] = JSON.parse(v)
        } catch (error) {}
      }
      return p
    }, {})

    await api.storeSettings(settings)
  }

  async #setUser() {
    const userConfig = await api.getUserConfig()
    this.storageLocation = userConfig.storage
    if (typeof userConfig.migrated == 'boolean') {
      // Single user mode migrated true/false for if the default user is created
      if (!userConfig.migrated && this.storageLocation === 'server') {
        // Default user not created yet
        await this.#migrateSettings()
      }
      return
    }

    this.multiUserServer = true
    let user = localStorage['Comfy.userId']
    const users = userConfig.users ?? {}
    if (!user || !users[user]) {
      // Lift spinner / BlockUI for user selection.
      if (this.vueAppReady) useWorkspaceStore().spinner = false

      // This will rarely be hit so move the loading to on demand
      const { UserSelectionScreen } = await import('./ui/userSelection')

      this.ui.menuContainer.style.display = 'none'
      const { userId, username, created } =
        await new UserSelectionScreen().show(users, user)
      this.ui.menuContainer.style.display = ''

      user = userId
      localStorage['Comfy.userName'] = username
      localStorage['Comfy.userId'] = user

      if (created) {
        api.user = user
        await this.#migrateSettings()
      }
    }

    api.user = user

    this.ui.settings.addSetting({
      id: 'Comfy.SwitchUser',
      name: 'Switch User',
      type: (name) => {
        let currentUser = localStorage['Comfy.userName']
        if (currentUser) {
          currentUser = ` (${currentUser})`
        }
        return $el('tr', [
          $el('td', [
            $el('label', {
              textContent: name
            })
          ]),
          $el('td', [
            $el('button', {
              textContent: name + (currentUser ?? ''),
              onclick: () => {
                delete localStorage['Comfy.userId']
                delete localStorage['Comfy.userName']
                window.location.reload()
              }
            })
          ])
        ])
      },
      // TODO: Is that the correct default value?
      defaultValue: undefined
    })
  }

  /**
   * Set up the app on the page
   */
  async setup(canvasEl: HTMLCanvasElement) {
    this.canvasEl = canvasEl
    await this.#setUser()

    this.resizeCanvas()

    await Promise.all([
      this.workflowManager.loadWorkflows(),
      this.ui.settings.load()
    ])
    await this.#loadExtensions()

    addDomClippingSetting()
    this.#addProcessMouseHandler()
    this.#addProcessKeyHandler()
    this.#addConfigureHandler()
    this.#addApiUpdateHandlers()
    this.#addRestoreWorkflowView()

    this.graph = new LGraph()

    this.#addAfterConfigureHandler()

    // Make LGraphCanvas shallow reactive so that any change on the root object
    // triggers reactivity.
    this.canvas = shallowReactive(
      new LGraphCanvas(canvasEl, this.graph, {
        skip_events: true,
        skip_render: true
      })
    )
    // Bind event/ start rendering later, so that event handlers get reactive canvas reference.
    this.canvas.options.skip_events = false
    this.canvas.options.skip_render = false
    this.canvas.bindEvents()
    this.canvas.startRendering()

    this.ctx = canvasEl.getContext('2d')

    LiteGraph.alt_drag_do_clone_nodes = true

    this.graph.start()

    // Ensure the canvas fills the window
    this.resizeCanvas()
    window.addEventListener('resize', () => this.resizeCanvas())
    const ro = new ResizeObserver(() => this.resizeCanvas())
    ro.observe(this.bodyTop)
    ro.observe(this.bodyLeft)
    ro.observe(this.bodyRight)
    ro.observe(this.bodyBottom)

    await this.#invokeExtensionsAsync('init')
    await this.registerNodes()
    initWidgets(this)

    // Load previous workflow
    let restored = false
    try {
      const loadWorkflow = async (json) => {
        if (json) {
          const workflow = JSON.parse(json)
          const workflowName = getStorageValue('Comfy.PreviousWorkflow')
          await this.loadGraphData(workflow, true, true, workflowName)
          return true
        }
      }
      const clientId = api.initialClientId ?? api.clientId
      restored =
        (clientId &&
          (await loadWorkflow(
            sessionStorage.getItem(`workflow:${clientId}`)
          ))) ||
        (await loadWorkflow(localStorage.getItem('workflow')))
    } catch (err) {
      console.error('Error loading previous workflow', err)
    }

    // We failed to restore a workflow so load the default
    if (!restored) {
      await this.loadGraphData()
    }

    // Save current workflow automatically
    setInterval(() => {
      const workflow = JSON.stringify(this.serializeGraph())
      localStorage.setItem('workflow', workflow)
      if (api.clientId) {
        sessionStorage.setItem(`workflow:${api.clientId}`, workflow)
      }
    }, 1000)

    this.#addDrawNodeHandler()
    this.#addDrawGroupsHandler()
    this.#addDropHandler()
    this.#addCopyHandler()
    this.#addPasteHandler()
    this.#addWidgetLinkHandling()

    await this.#invokeExtensionsAsync('setup')
  }

  resizeCanvas() {
    // Limit minimal scale to 1, see https://github.com/comfyanonymous/ComfyUI/pull/845
    const scale = Math.max(window.devicePixelRatio, 1)

    // Clear fixed width and height while calculating rect so it uses 100% instead
    this.canvasEl.height = this.canvasEl.width = NaN
    const { width, height } = this.canvasEl.getBoundingClientRect()
    this.canvasEl.width = Math.round(width * scale)
    this.canvasEl.height = Math.round(height * scale)
    this.canvasEl.getContext('2d').scale(scale, scale)
    this.canvas?.draw(true, true)
  }

  private updateVueAppNodeDefs(defs: Record<string, ComfyNodeDef>) {
    // Frontend only nodes registered by custom nodes.
    // Example: https://github.com/rgthree/rgthree-comfy/blob/dd534e5384be8cf0c0fa35865afe2126ba75ac55/src_web/comfyui/fast_groups_bypasser.ts#L10
    const rawDefs = Object.fromEntries(
      Object.entries(LiteGraph.registered_node_types).map(([name, node]) => [
        name,
        {
          name,
          display_name: name,
          category: node.category || '__frontend_only__',
          input: { required: {}, optional: {} },
          output: [],
          output_name: [],
          output_is_list: [],
          python_module: 'custom_nodes.frontend_only',
          description: `Frontend only node for ${name}`
        }
      ])
    )

    const allNodeDefs = {
      ...rawDefs,
      ...defs,
      ...SYSTEM_NODE_DEFS
    }

    const nodeDefStore = useNodeDefStore()
    const nodeDefArray: ComfyNodeDef[] = Object.values(allNodeDefs)
    this.#invokeExtensions('beforeRegisterVueAppNodeDefs', nodeDefArray, this)
    nodeDefStore.updateNodeDefs(nodeDefArray)
    nodeDefStore.widgets = this.widgets
  }

  /**
   * Registers nodes with the graph
   */
  async registerNodes() {
    // Load node definitions from the backend
    const defs = await api.getNodeDefs({
      validate: useSettingStore().get('Comfy.Validation.NodeDefs')
    })
    await this.registerNodesFromDefs(defs)
    await this.#invokeExtensionsAsync('registerCustomNodes')
    if (this.vueAppReady) {
      this.updateVueAppNodeDefs(defs)
    }
  }

  getWidgetType(inputData, inputName) {
    const type = inputData[0]

    if (Array.isArray(type)) {
      return 'COMBO'
    } else if (`${type}:${inputName}` in this.widgets) {
      return `${type}:${inputName}`
    } else if (type in this.widgets) {
      return type
    } else {
      return null
    }
  }

  async registerNodeDef(nodeId: string, nodeData: ComfyNodeDef) {
    const self = this
    const node = class ComfyNode extends LGraphNode {
      static comfyClass? = nodeData.name
      // TODO: change to "title?" once litegraph.d.ts has been updated
      static title = nodeData.display_name || nodeData.name
      static nodeData? = nodeData
      static category?: string

      constructor(title?: string) {
        super(title)
        const requiredInputs = nodeData.input.required

        var inputs = nodeData['input']['required']
        if (nodeData['input']['optional'] != undefined) {
          inputs = Object.assign(
            {},
            nodeData['input']['required'],
            nodeData['input']['optional']
          )
        }
        const config = { minWidth: 1, minHeight: 1 }
        for (const inputName in inputs) {
          const inputData = inputs[inputName]
          const type = inputData[0]
          const inputIsRequired = requiredInputs && inputName in requiredInputs

          let widgetCreated = true
          const widgetType = self.getWidgetType(inputData, inputName)
          if (widgetType) {
            if (widgetType === 'COMBO') {
              Object.assign(
                config,
                self.widgets.COMBO(this, inputName, inputData, app) || {}
              )
            } else {
              Object.assign(
                config,
                self.widgets[widgetType](this, inputName, inputData, app) || {}
              )
            }
          } else {
            // Node connection inputs
            const inputOptions = inputIsRequired
              ? {}
              : { shape: LiteGraph.SlotShape.HollowCircle }
            this.addInput(inputName, type, inputOptions)
            widgetCreated = false
          }

          // @ts-expect-error
          if (widgetCreated && !inputIsRequired && config?.widget) {
            // @ts-expect-error
            if (!config.widget.options) config.widget.options = {}
            // @ts-expect-error
            config.widget.options.inputIsOptional = true
          }

          // @ts-expect-error
          if (widgetCreated && inputData[1]?.forceInput && config?.widget) {
            // @ts-expect-error
            if (!config.widget.options) config.widget.options = {}
            // @ts-expect-error
            config.widget.options.forceInput = inputData[1].forceInput
          }
          // @ts-expect-error
          if (widgetCreated && inputData[1]?.defaultInput && config?.widget) {
            // @ts-expect-error
            if (!config.widget.options) config.widget.options = {}
            // @ts-expect-error
            config.widget.options.defaultInput = inputData[1].defaultInput
          }
        }

        for (const o in nodeData['output']) {
          let output = nodeData['output'][o]
          if (output instanceof Array) output = 'COMBO'
          const outputName = nodeData['output_name'][o] || output
          const outputIsList = nodeData['output_is_list'][o]
          const outputOptions = outputIsList
            ? { shape: LiteGraph.GRID_SHAPE }
            : {}
          this.addOutput(outputName, output, outputOptions)
        }

        const s = this.computeSize()
        s[0] = Math.max(config.minWidth, s[0] * 1.5)
        s[1] = Math.max(config.minHeight, s[1])
        this.size = s
        this.serialize_widgets = true

        app.#invokeExtensionsAsync('nodeCreated', this)
      }

      configure(data: any) {
        // Keep 'name', 'type', and 'shape' information from the original node definition.
        const merge = (
          current: Record<string, any>,
          incoming: Record<string, any>
        ) => {
          const result = { ...incoming }
          if (current.widget === undefined && incoming.widget !== undefined) {
            // Field must be input as only inputs can be converted
            this.inputs.push(current as INodeInputSlot)
            return incoming
          }
          for (const key of ['name', 'type', 'shape']) {
            if (current[key] !== undefined) {
              result[key] = current[key]
            }
          }
          return result
        }
        for (const field of ['inputs', 'outputs']) {
          const slots = data[field] ?? []
          data[field] = slots.map((slot, i) =>
            merge(this[field][i] ?? {}, slot)
          )
        }
        super.configure(data)
      }
    }
    node.prototype.comfyClass = nodeData.name

    this.#addNodeContextMenuHandler(node)
    this.#addDrawBackgroundHandler(node)
    this.#addNodeKeyHandler(node)

    await this.#invokeExtensionsAsync('beforeRegisterNodeDef', node, nodeData)
    LiteGraph.registerNodeType(nodeId, node)
    // Note: Do not move this to the class definition, it will be overwritten
    node.category = nodeData.category
  }

  async registerNodesFromDefs(defs: Record<string, ComfyNodeDef>) {
    await this.#invokeExtensionsAsync('addCustomNodeDefs', defs)

    // Generate list of known widgets
    this.widgets = Object.assign(
      {},
      ComfyWidgets,
      ...(await this.#invokeExtensionsAsync('getCustomWidgets')).filter(Boolean)
    )

    // Register a node for each definition
    for (const nodeId in defs) {
      this.registerNodeDef(nodeId, defs[nodeId])
    }
  }

  loadTemplateData(templateData) {
    if (!templateData?.templates) {
      return
    }

    const old = localStorage.getItem('litegrapheditor_clipboard')

    var maxY, nodeBottom, node

    for (const template of templateData.templates) {
      if (!template?.data) {
        continue
      }

      localStorage.setItem('litegrapheditor_clipboard', template.data)
      app.canvas.pasteFromClipboard()

      // Move mouse position down to paste the next template below

      maxY = false

      for (const i in app.canvas.selected_nodes) {
        node = app.canvas.selected_nodes[i]

        nodeBottom = node.pos[1] + node.size[1]

        if (maxY === false || nodeBottom > maxY) {
          maxY = nodeBottom
        }
      }

      app.canvas.graph_mouse[1] = maxY + 50
    }

    localStorage.setItem('litegrapheditor_clipboard', old)
  }

  #showMissingNodesError(missingNodeTypes, hasAddedNodes = true) {
    if (useSettingStore().get('Comfy.Workflow.ShowMissingNodesWarning')) {
      showLoadWorkflowWarning({
        missingNodeTypes,
        hasAddedNodes
      })
    }

    this.logging.addEntry('Comfy.App', 'warn', {
      MissingNodes: missingNodeTypes
    })
  }

  #showMissingModelsError(missingModels, paths) {
    if (useSettingStore().get('Comfy.Workflow.ShowMissingModelsWarning')) {
      showMissingModelsWarning({
        missingModels,
        paths
      })
    }

    this.logging.addEntry('Comfy.App', 'warn', {
      MissingModels: missingModels
    })
  }

  async changeWorkflow(callback, workflow = null) {
    try {
      this.workflowManager.activeWorkflow?.changeTracker?.store()
    } catch (error) {
      console.error(error)
    }
    await callback()
    try {
      this.workflowManager.setWorkflow(workflow)
      this.workflowManager.activeWorkflow?.track()
    } catch (error) {
      console.error(error)
    }
  }

  /**
   * 加载图形数据。
   * @param graphData - 要加载的图形数据，默认为 undefined。
   * @param clean - 是否清理现有图形，默认为 true。
   * @param restore_view - 是否恢复视图状态，默认为 true。
   * @param workflow - 当前工作流，默认为 null。
   * @param options - 配置选项，包括是否显示缺失节点和模型的对话框。
   */
  async loadGraphData(
    graphData?: ComfyWorkflowJSON,
    clean: boolean = true,
    restore_view: boolean = true,
    workflow: string | null | ComfyWorkflow = null,
    { showMissingNodesDialog = true, showMissingModelsDialog = true } = {}
  ) {
    if (clean !== false) {
      this.clean()
    }

    let reset_invalid_values = false
    if (!graphData) {
      graphData = defaultGraph
      reset_invalid_values = true
    }

    if (typeof structuredClone === 'undefined') {
      graphData = JSON.parse(JSON.stringify(graphData))
    } else {
      graphData = structuredClone(graphData)
    }

    try {
      this.workflowManager.setWorkflow(workflow)
    } catch (error) {
      console.error(error)
    }

    if (useSettingStore().get('Comfy.Validation.Workflows')) {
      // TODO: 在对话框中显示验证错误。
      const validatedGraphData = await validateComfyWorkflow(
        graphData,
        (err) => {
          useToastStore().addAlert(err)
        }
      )
      // 如果验证失败，使用原始图形数据。
      // 理想情况下，我们不应该阻止用户加载工作流。
      graphData = validatedGraphData ?? graphData
    }

    const missingNodeTypes = []
    const missingModels = []
    await this.#invokeExtensionsAsync(
      'beforeConfigureGraph',
      graphData,
      missingNodeTypes
      // TODO: missingModels
    )

    for (let n of graphData.nodes) {
      // 修复 T2IAdapterLoader 到 ControlNetLoader，因为它们现在是同一个节点
      if (n.type == 'T2IAdapterLoader') n.type = 'ControlNetLoader'
      if (n.type == 'ConditioningAverage ') n.type = 'ConditioningAverage' // 修复拼写错误
      if (n.type == 'SDV_img2vid_Conditioning')
        n.type = 'SVD_img2vid_Conditioning' // 修复拼写错误

      // 查找缺失的节点类型
      if (!(n.type in LiteGraph.registered_node_types)) {
        missingNodeTypes.push(n.type)
        n.type = sanitizeNodeName(n.type)
      }
    }

    if (
      graphData.models &&
      useSettingStore().get('Comfy.Workflow.ShowMissingModelsWarning')
    ) {
      for (let m of graphData.models) {
        const models_available = await useModelStore().getModelsInFolderCached(
          m.directory
        )
        if (models_available === null) {
          // @ts-expect-error
          m.directory_invalid = true
          missingModels.push(m)
        } else if (!(m.name in models_available.models)) {
          missingModels.push(m)
        }
      }
    }

    try {
      this.graph.configure(graphData)
      if (
        restore_view &&
        this.enableWorkflowViewRestore.value &&
        graphData.extra?.ds
      ) {
        // @ts-expect-error
        // 需要设置 strict: true 以匹配类型 [number, number]
        // https://github.com/colinhacks/zod/issues/3056
        this.canvas.ds.offset = graphData.extra.ds.offset
        this.canvas.ds.scale = graphData.extra.ds.scale
      }

      try {
        this.workflowManager.activeWorkflow?.track()
      } catch (error) {
        // TODO: 是否在这里静默失败？
      }
    } catch (error) {
      let errorHint = []
      // 尝试提取文件名以查看是否是由扩展脚本引起的
      const filename =
        error.fileName ||
        (error.stack || '').match(/(\/extensions\/.*\.js)/)?.[1]
      const pos = (filename || '').indexOf('/extensions/')
      if (pos > -1) {
        errorHint.push(
          $el('span', {
            textContent: '这可能是由于以下脚本引起的问题:'
          }),
          $el('br'),
          $el('span', {
            style: {
              fontWeight: 'bold'
            },
            textContent: filename.substring(pos)
          })
        )
      }

      // 显示对话框，告知用户加载数据时出现问题
      this.ui.dialog.show(
        $el('div', [
          $el('p', {
            textContent: '由于重新加载工作流数据时出现错误，加载已中止'
          }),
          $el('pre', {
            style: { padding: '5px', backgroundColor: 'rgba(255,0,0,0.2)' },
            textContent: error.toString()
          }),
          $el('pre', {
            style: {
              padding: '5px',
              color: '#ccc',
              fontSize: '10px',
              maxHeight: '50vh',
              overflow: 'auto',
              backgroundColor: 'rgba(0,0,0,0.2)'
            },
            textContent: error.stack || '没有可用的堆栈跟踪'
          }),
          ...errorHint
        ]).outerHTML
      )

      return
    }

    for (const node of this.graph.nodes) {
      const size = node.computeSize()
      size[0] = Math.max(node.size[0], size[0])
      size[1] = Math.max(node.size[1], size[1])
      node.size = size
      if (node.widgets) {
        // 如果后端出现问题并希望在前端修补工作流，这是可以做的地方
        for (let widget of node.widgets) {
          if (node.type == 'KSampler' || node.type == 'KSamplerAdvanced') {
            if (widget.name == 'sampler_name') {
              if (
                typeof widget.value === 'string' &&
                widget.value.startsWith('sample_')
              ) {
                widget.value = widget.value.slice(7)
              }
            }
          }
          if (
            node.type == 'KSampler' ||
            node.type == 'KSamplerAdvanced' ||
            node.type == 'PrimitiveNode'
          ) {
            if (widget.name == 'control_after_generate') {
              if (widget.value === true) {
                // @ts-expect-error 将小部件类型从布尔值更改为字符串
                widget.value = 'randomize'
              } else if (widget.value === false) {
                // @ts-expect-error 将小部件类型从布尔值更改为字符串
                widget.value = 'fixed'
              }
            }
          }
          if (reset_invalid_values) {
            if (widget.type == 'combo') {
              if (
                !widget.options.values.includes(widget.value as string) &&
                widget.options.values.length > 0
              ) {
                widget.value = widget.options.values[0]
              }
            }
          }
        }
      }

      this.#invokeExtensions('loadedGraphNode', node)
    }

    // TODO: 正确处理同时缺少节点和模型的情况（连续对话框？）
    if (missingNodeTypes.length && showMissingNodesDialog) {
      this.#showMissingNodesError(missingNodeTypes)
    }
    if (missingModels.length && showMissingModelsDialog) {
      const paths = await api.getFolderPaths()
      this.#showMissingModelsError(missingModels, paths)
    }
    await this.#invokeExtensionsAsync('afterConfigureGraph', missingNodeTypes)
    requestAnimationFrame(() => {
      this.graph.setDirtyCanvas(true, true)
    })
  }

  /**
   * 使用用户首选设置序列化图形。
   * @param graph - 要序列化的 LiteGraph，默认为当前图形。
   * @returns 序列化后的图形（即工作流），包含用户首选设置。
   */
  serializeGraph(graph: LGraph = this.graph) {
    // 获取用户设置中的节点排序选项
    const sortNodes = useSettingStore().get('Comfy.Workflow.SortNodeIdOnSave')
    // 序列化图形，并根据用户设置决定是否排序节点
    return graph.serialize({ sortNodes })
  }

  /**
   * 将当前图形工作流转换为发送到 API 的格式。
   * 注意：节点小部件在序列化之前更新，以准备排队。
   * @param graph - 要转换的图形，默认为当前图形。
   * @param clean - 是否清理已删除节点的输入，默认为 true。
   * @returns 包含工作流和节点链接的对象。
   */
  async graphToPrompt(graph = this.graph, clean = true) {
    // 计算执行顺序并更新节点小部件
    for (const outerNode of this.graph.computeExecutionOrder(false)) {
      if (outerNode.widgets) {
        for (const widget of outerNode.widgets) {
          // 允许小部件在排队前运行回调，例如每次生成前的随机种子
          widget.beforeQueued?.()
        }
      }

      // 获取内部节点
      const innerNodes = outerNode['getInnerNodes']
        ? outerNode['getInnerNodes']()
        : [outerNode]
      for (const node of innerNodes) {
        if (node.isVirtualNode) {
          // 不序列化仅前端节点，但允许它们进行更改
          if (node.applyToGraph) {
            node.applyToGraph()
          }
        }
      }
    }

    // 序列化图形
    const workflow = this.serializeGraph(graph)
    const output = {}

    // 按执行顺序处理节点
    for (const outerNode of graph.computeExecutionOrder(false)) {
      const skipNode = outerNode.mode === 2 || outerNode.mode === 4
      const innerNodes =
        !skipNode && outerNode['getInnerNodes']
          ? outerNode['getInnerNodes']()
          : [outerNode]
      for (const node of innerNodes) {
        if (node.isVirtualNode) {
          continue
        }

        if (node.mode === 2 || node.mode === 4) {
          // 不序列化静音节点
          continue
        }

        const inputs = {}
        const widgets = node.widgets

        // 存储所有小部件值
        if (widgets) {
          for (const i in widgets) {
            const widget = widgets[i]
            if (!widget.options || widget.options.serialize !== false) {
              inputs[widget.name] = widget.serializeValue
                ? await widget.serializeValue(node, i)
                : widget.value
            }
          }
        }

        // 存储所有节点链接
        for (let i in node.inputs) {
          let parent = node.getInputNode(i)
          if (parent) {
            let link = node.getInputLink(i)
            while (parent.mode === 4 || parent.isVirtualNode) {
              let found = false
              if (parent.isVirtualNode) {
                link = parent.getInputLink(link.origin_slot)
                if (link) {
                  parent = parent.getInputNode(link.target_slot)
                  if (parent) {
                    found = true
                  }
                }
              } else if (link && parent.mode === 4) {
                let all_inputs = [link.origin_slot]
                if (parent.inputs) {
                  all_inputs = all_inputs.concat(Object.keys(parent.inputs))
                  for (let parent_input in all_inputs) {
                    parent_input = all_inputs[parent_input]
                    if (
                      parent.inputs[parent_input]?.type === node.inputs[i].type
                    ) {
                      link = parent.getInputLink(parent_input)
                      if (link) {
                        parent = parent.getInputNode(parent_input)
                      }
                      found = true
                      break
                    }
                  }
                }
              }

              if (!found) {
                break
              }
            }

            if (link) {
              if (parent?.updateLink) {
                link = parent.updateLink(link)
              }
              if (link) {
                inputs[node.inputs[i].name] = [
                  String(link.origin_id),
                  parseInt(link.origin_slot)
                ]
              }
            }
          }
        }

        let node_data = {
          inputs,
          class_type: node.comfyClass
        }

        if (this.ui.settings.getSettingValue('Comfy.DevMode')) {
          // 后端忽略
          node_data['_meta'] = {
            title: node.title
          }
        }

        output[String(node.id)] = node_data
      }
    }

    // 清理已删除节点的输入
    if (clean) {
      for (const o in output) {
        for (const i in output[o].inputs) {
          if (
            Array.isArray(output[o].inputs[i]) &&
            output[o].inputs[i].length === 2 &&
            !output[output[o].inputs[i][0]]
          ) {
            delete output[o].inputs[i]
          }
        }
      }
    }

    return { workflow, output }
  }

  #formatPromptError(error) {
    if (error == null) {
      return '(unknown error)'
    } else if (typeof error === 'string') {
      return error
    } else if (error.stack && error.message) {
      return error.toString()
    } else if (error.response) {
      let message = error.response.error.message
      if (error.response.error.details)
        message += ': ' + error.response.error.details
      for (const [nodeID, nodeError] of Object.entries(
        error.response.node_errors
      )) {
        // @ts-expect-error
        message += '\n' + nodeError.class_type + ':'
        // @ts-expect-error
        for (const errorReason of nodeError.errors) {
          message +=
            '\n    - ' + errorReason.message + ': ' + errorReason.details
        }
      }
      return message
    }
    return '(unknown error)'
  }

  /**
   * 将提示加入队列并处理。
   * @param number - 提示编号。
   * @param batchCount - 批次数量，默认为 1。
   */
  async queuePrompt(number, batchCount = 1) {
    this.#queueItems.push({ number, batchCount })

    // 只有一个动作处理队列项，以确保每个项都有一个唯一的种子
    if (this.#processingQueue) {
      return
    }

    this.#processingQueue = true
    this.lastNodeErrors = null

    try {
      while (this.#queueItems.length) {
        const { number, batchCount } = this.#queueItems.pop()

        for (let i = 0; i < batchCount; i++) {
          const p = await this.graphToPrompt()

          try {
            const res = await api.queuePrompt(number, p)
            this.lastNodeErrors = res.node_errors
            if (this.lastNodeErrors.length > 0) {
              this.canvas.draw(true, true)
            } else {
              try {
                this.workflowManager.storePrompt({
                  id: res.prompt_id,
                  nodes: Object.keys(p.output)
                })
              } catch (error) {}
            }
          } catch (error) {
            const formattedError = this.#formatPromptError(error)
            this.ui.dialog.show(formattedError)
            if (error.response) {
              this.lastNodeErrors = error.response.node_errors
              this.canvas.draw(true, true)
            }
            break
          }

          for (const n of p.workflow.nodes) {
            const node = this.graph.getNodeById(n.id)
            if (node.widgets) {
              for (const widget of node.widgets) {
                // 允许小部件在提示被加入队列后运行回调
                // 例如，每次生成后随机种子
                // @ts-expect-error
                if (widget.afterQueued) {
                  // @ts-expect-error
                  widget.afterQueued()
                }
              }
            }
          }

          this.canvas.draw(true, true)
          await this.ui.queue.update()
        }
      }
    } finally {
      this.#processingQueue = false
    }

    api.dispatchEvent(
      new CustomEvent('promptQueued', { detail: { number, batchCount } })
    )
    return !this.lastNodeErrors
  }

  showErrorOnFileLoad(file) {
    this.ui.dialog.show(
      $el('div', [
        $el('p', { textContent: `Unable to find workflow in ${file.name}` })
      ]).outerHTML
    )
  }

  /**
   * 从指定文件加载工作流数据。
   * @param {File} file - 要处理的文件。
   */
  async handleFile(file) {
    // 移除文件扩展名
    const removeExt = (f) => {
      if (!f) return f
      const p = f.lastIndexOf('.')
      if (p === -1) return f
      return f.substring(0, p)
    }
    const fileName = removeExt(file.name)

    // 处理 PNG 文件
    if (file.type === 'image/png') {
      const pngInfo = await getPngMetadata(file)
      if (pngInfo?.workflow) {
        await this.loadGraphData(
          JSON.parse(pngInfo.workflow),
          true,
          true,
          fileName
        )
      } else if (pngInfo?.prompt) {
        this.loadApiJson(JSON.parse(pngInfo.prompt), fileName)
      } else if (pngInfo?.parameters) {
        this.changeWorkflow(() => {
          importA1111(this.graph, pngInfo.parameters)
        }, fileName)
      } else {
        this.showErrorOnFileLoad(file)
      }
    }
    // 处理 WebP 文件
    else if (file.type === 'image/webp') {
      const pngInfo = await getWebpMetadata(file)
      // 支持从 WebP 自定义节点加载工作流
      const workflow = pngInfo?.workflow || pngInfo?.Workflow
      const prompt = pngInfo?.prompt || pngInfo?.Prompt

      if (workflow) {
        this.loadGraphData(JSON.parse(workflow), true, true, fileName)
      } else if (prompt) {
        this.loadApiJson(JSON.parse(prompt), fileName)
      } else {
        this.showErrorOnFileLoad(file)
      }
    }
    // 处理 FLAC 文件
    else if (file.type === 'audio/flac' || file.type === 'audio/x-flac') {
      const pngInfo = await getFlacMetadata(file)
      const workflow = pngInfo?.workflow || pngInfo?.Workflow
      const prompt = pngInfo?.prompt || pngInfo?.Prompt

      if (workflow) {
        this.loadGraphData(JSON.parse(workflow), true, true, fileName)
      } else if (prompt) {
        this.loadApiJson(JSON.parse(prompt), fileName)
      } else {
        this.showErrorOnFileLoad(file)
      }
    }
    // 处理 JSON 文件
    else if (file.type === 'application/json' || file.name?.endsWith('.json')) {
      const reader = new FileReader()
      reader.onload = async () => {
        const readerResult = reader.result as string
        const jsonContent = JSON.parse(readerResult)
        if (jsonContent?.templates) {
          this.loadTemplateData(jsonContent)
        } else if (this.isApiJson(jsonContent)) {
          this.loadApiJson(jsonContent, fileName)
        } else {
          await this.loadGraphData(
            JSON.parse(readerResult),
            true,
            false,
            fileName
          )
        }
      }
      reader.readAsText(file)
    }
    // 处理 .latent 和 .safetensors 文件
    else if (
      file.name?.endsWith('.latent') ||
      file.name?.endsWith('.safetensors')
    ) {
      const info = await getLatentMetadata(file)
      // TODO 定义 LatentMetadata 的模式
      // @ts-expect-error
      if (info.workflow) {
        await this.loadGraphData(
          // @ts-expect-error
          JSON.parse(info.workflow),
          true,
          true,
          fileName
        )
        // @ts-expect-error
      } else if (info.prompt) {
        // @ts-expect-error
        this.loadApiJson(JSON.parse(info.prompt))
      } else {
        this.showErrorOnFileLoad(file)
      }
    }
    // 处理未知文件类型
    else {
      this.showErrorOnFileLoad(file)
    }
  }

  isApiJson(data) {
    // @ts-expect-error
    return Object.values(data).every((v) => v.class_type)
  }

  loadApiJson(apiData, fileName: string) {
    const missingNodeTypes = Object.values(apiData).filter(
      // @ts-expect-error
      (n) => !LiteGraph.registered_node_types[n.class_type]
    )
    if (missingNodeTypes.length) {
      this.#showMissingNodesError(
        // @ts-expect-error
        missingNodeTypes.map((t) => t.class_type),
        false
      )
      return
    }

    const ids = Object.keys(apiData)
    app.graph.clear()
    for (const id of ids) {
      const data = apiData[id]
      const node = LiteGraph.createNode(data.class_type)
      node.id = isNaN(+id) ? id : +id
      node.title = data._meta?.title ?? node.title
      app.graph.add(node)
    }

    this.changeWorkflow(() => {
      for (const id of ids) {
        const data = apiData[id]
        const node = app.graph.getNodeById(id)
        for (const input in data.inputs ?? {}) {
          const value = data.inputs[input]
          if (value instanceof Array) {
            const [fromId, fromSlot] = value
            const fromNode = app.graph.getNodeById(fromId)
            let toSlot = node.inputs?.findIndex((inp) => inp.name === input)
            if (toSlot == null || toSlot === -1) {
              try {
                // Target has no matching input, most likely a converted widget
                const widget = node.widgets?.find((w) => w.name === input)
                // @ts-expect-error
                if (widget && node.convertWidgetToInput?.(widget)) {
                  toSlot = node.inputs?.length - 1
                }
              } catch (error) {}
            }
            if (toSlot != null || toSlot !== -1) {
              fromNode.connect(fromSlot, node, toSlot)
            }
          } else {
            const widget = node.widgets?.find((w) => w.name === input)
            if (widget) {
              widget.value = value
              widget.callback?.(value)
            }
          }
        }
      }
      app.graph.arrange()
    }, fileName)

    for (const id of ids) {
      const data = apiData[id]
      const node = app.graph.getNodeById(id)
      for (const input in data.inputs ?? {}) {
        const value = data.inputs[input]
        if (value instanceof Array) {
          const [fromId, fromSlot] = value
          const fromNode = app.graph.getNodeById(fromId)
          let toSlot = node.inputs?.findIndex((inp) => inp.name === input)
          if (toSlot == null || toSlot === -1) {
            try {
              // Target has no matching input, most likely a converted widget
              const widget = node.widgets?.find((w) => w.name === input)
              // @ts-expect-error
              if (widget && node.convertWidgetToInput?.(widget)) {
                toSlot = node.inputs?.length - 1
              }
            } catch (error) {}
          }
          if (toSlot != null || toSlot !== -1) {
            fromNode.connect(fromSlot, node, toSlot)
          }
        } else {
          const widget = node.widgets?.find((w) => w.name === input)
          if (widget) {
            widget.value = value
            widget.callback?.(value)
          }
        }
      }
    }

    app.graph.arrange()
  }

  /**
   * Registers a Comfy web extension with the app
   * @param {ComfyExtension} extension
   */
  registerExtension(extension: ComfyExtension) {
    if (this.vueAppReady) {
      useExtensionStore().registerExtension(extension)
    } else {
      // For jest testing.
      this.extensions.push(extension)
    }
  }

  /**
   * Refresh combo list on whole nodes
   */
  async refreshComboInNodes() {
    const requestToastMessage: ToastMessageOptions = {
      severity: 'info',
      summary: 'Update',
      detail: 'Update requested'
    }
    if (this.vueAppReady) {
      useToastStore().add(requestToastMessage)
      useModelStore().clearCache()
    }

    const defs = await api.getNodeDefs({
      validate: useSettingStore().get('Comfy.Validation.NodeDefs')
    })

    for (const nodeId in defs) {
      this.registerNodeDef(nodeId, defs[nodeId])
    }
    for (let nodeNum in this.graph.nodes) {
      const node = this.graph.nodes[nodeNum]
      const def = defs[node.type]
      // @ts-expect-error
      // Allow primitive nodes to handle refresh
      node.refreshComboInNode?.(defs)

      if (!def) continue

      for (const widgetNum in node.widgets) {
        const widget = node.widgets[widgetNum]
        if (
          widget.type == 'combo' &&
          def['input']['required'][widget.name] !== undefined
        ) {
          widget.options.values = def['input']['required'][widget.name][0]
        }
      }
    }

    await this.#invokeExtensionsAsync('refreshComboInNodes', defs)

    if (this.vueAppReady) {
      this.updateVueAppNodeDefs(defs)
      useToastStore().remove(requestToastMessage)
      useToastStore().add({
        severity: 'success',
        summary: 'Updated',
        detail: 'Node definitions updated',
        life: 1000
      })
    }
  }

  resetView() {
    app.canvas.ds.scale = 1
    app.canvas.ds.offset = [0, 0]
    app.graph.setDirtyCanvas(true, true)
  }

  /**
   * Clean current state
   */
  clean() {
    this.nodeOutputs = {}
    this.nodePreviewImages = {}
    this.lastNodeErrors = null
    this.lastExecutionError = null
  }

  addNodeOnGraph(
    nodeDef: ComfyNodeDef | ComfyNodeDefImpl,
    options: Record<string, any> = {}
  ): LGraphNode {
    const node = LiteGraph.createNode(
      nodeDef.name,
      nodeDef.display_name,
      options
    )
    this.graph.add(node)
    return node
  }

  clientPosToCanvasPos(pos: Vector2): Vector2 {
    const rect = this.canvasContainer.getBoundingClientRect()
    const containerOffsets = [rect.left, rect.top]
    return _.zip(pos, this.canvas.ds.offset, containerOffsets).map(
      ([p, o1, o2]) => (p - o2) / this.canvas.ds.scale - o1
    ) as Vector2
  }

  canvasPosToClientPos(pos: Vector2): Vector2 {
    const rect = this.canvasContainer.getBoundingClientRect()
    const containerOffsets = [rect.left, rect.top]
    return _.zip(pos, this.canvas.ds.offset, containerOffsets).map(
      ([p, o1, o2]) => (p + o1) * this.canvas.ds.scale + o2
    ) as Vector2
  }

  getCanvasCenter(): Vector2 {
    const dpi = Math.max(window.devicePixelRatio ?? 1, 1)
    const [x, y, w, h] = app.canvas.ds.visible_area
    return [x + w / dpi / 2, y + h / dpi / 2]
  }

  public goToNode(nodeId: NodeId) {
    const graphNode = this.graph.getNodeById(nodeId)
    if (!graphNode) return
    this.canvas.centerOnNode(graphNode)
  }
}

export const app = new ComfyApp()
