// 导入 ComfyWorkflowJSON 类型，该类型定义了 ComfyUI 工作流的 JSON 结构
import type { ComfyWorkflowJSON } from '@/types/comfyWorkflow'
// 导入各种 API 响应类型，这些类型定义了从 API 返回的数据结构
import {
  type DownloadModelStatus,
  type HistoryTaskItem,
  type PendingTaskItem,
  type RunningTaskItem,
  type ComfyNodeDef,
  type EmbeddingsResponse,
  type ExtensionsResponse,
  type PromptResponse,
  type SystemStats,
  type User,
  type Settings,
  type UserDataFullInfo,
  validateComfyNodeDef
} from '@/types/apiTypes'
// 导入 axios 库，用于发送 HTTP 请求
import axios from 'axios'

/**
 * 定义一个接口，用于描述队列提示请求的主体。
 */
interface QueuePromptRequestBody {
  // 客户端ID，用于标识请求的客户端。
  client_id: string
  // 从节点ID到节点信息和输入值的映射。
  // TODO: 对此进行类型化。
  prompt: Record<number, any>
  // 额外的数据，包含额外的png信息。
  extra_data: {
    // 额外的png信息，包含工作流的JSON数据。
    extra_pnginfo: {
      // 工作流的JSON数据。
      workflow: ComfyWorkflowJSON
    }
  }
  // 是否将提示添加到队列的前面。
  front?: boolean
  // 提示在队列中的位置。
  number?: number
}

/**
 * 定义一个类，用于与ComfyUI的API进行交互。
 */
class ComfyApi extends EventTarget {
  // 已注册的事件类型集合。
  #registered = new Set()
  // API的主机地址。
  api_host: string
  // API的基础路径。
  api_base: string
  /**
   * 从初始会话存储中获取的客户端ID。
   */
  initialClientId: string | null
  /**
   * 从WebSocket状态更新中获取的当前客户端ID。
   */
  clientId?: string
  // 用户标识。
  user: string
  // WebSocket连接实例。
  socket: WebSocket | null = null

  // 已报告的未知消息类型集合。
  reportedUnknownMessageTypes = new Set<string>()

  /**
   * 构造函数，初始化API主机和基础路径。
   */
  constructor() {
    super()
    // api.user 由 ComfyApp.setup() 设置。
    this.user = ''
    this.api_host = location.host
    this.api_base = location.pathname.split('/').slice(0, -1).join('/')
    console.log('Running on', this.api_host)
    this.initialClientId = sessionStorage.getItem('clientId')
  }

  /**
   * 获取内部URL。
   * @param route - 路由路径。
   * @returns 完整的内部URL。
   */
  internalURL(route: string): string {
    return this.api_base + '/internal' + route
  }

  /**
   * 获取API URL。
   * @param route - 路由路径。
   * @returns 完整的API URL。
   */
  apiURL(route: string): string {
    return this.api_base + '/api' + route
  }

  /**
   * 获取文件URL。
   * @param route - 路由路径。
   * @returns 完整的文件URL。
   */
  fileURL(route: string): string {
    return this.api_base + route
  }

  /**
   * 发送API请求。
   * @param route - 路由路径。
   * @param options - 请求选项。
   * @returns 请求响应。
   */
  fetchApi(route: string, options?: RequestInit): Promise<Response> {
    if (!options) {
      options = {}
    }
    if (!options.headers) {
      options.headers = {}
    }
    if (!options.cache) {
      options.cache = 'no-cache'
    }

    if (Array.isArray(options.headers)) {
      options.headers.push(['Comfy-User', this.user])
    } else if (options.headers instanceof Headers) {
      options.headers.set('Comfy-User', this.user)
    } else {
      options.headers['Comfy-User'] = this.user
    }
    return fetch(this.apiURL(route), options)
  }

  /**
   * 添加事件监听器。
   * @param type - 事件类型。
   * @param callback - 事件回调函数。
   * @param options - 事件监听器选项。
   */
  addEventListener(
    type: string,
    callback: any,
    options?: AddEventListenerOptions
  ): void {
    super.addEventListener(type, callback, options)
    this.#registered.add(type)
  }

  /**
   * 轮询状态以支持不支持 WebSocket 的 Colab 等。
   */
  #pollQueue() {
    setInterval(async () => {
      try {
        const resp = await this.fetchApi('/prompt')
        const status = await resp.json()
        this.dispatchEvent(new CustomEvent('status', { detail: status }))
      } catch (error) {
        this.dispatchEvent(new CustomEvent('status', { detail: null }))
      }
    }, 1000)
  }

  /**
   * 创建并连接一个 WebSocket 以获取实时更新
   * @param {boolean} isReconnect 如果是重新连接尝试，则为 true
   */
  #createSocket(isReconnect?: boolean) {
    if (this.socket) {
      return
    }

    let opened = false
    let existingSession = window.name
    if (existingSession) {
      existingSession = '?clientId=' + existingSession
    }
    this.socket = new WebSocket(
      `ws${window.location.protocol === 'https:' ? 's' : ''}://${this.api_host}${this.api_base}/ws${existingSession}`
    )
    this.socket.binaryType = 'arraybuffer'

    this.socket.addEventListener('open', () => {
      opened = true
      if (isReconnect) {
        this.dispatchEvent(new CustomEvent('reconnected'))
      }
    })

    this.socket.addEventListener('error', () => {
      if (this.socket) this.socket.close()
      if (!isReconnect && !opened) {
        this.#pollQueue()
      }
    })

    this.socket.addEventListener('close', () => {
      setTimeout(() => {
        this.socket = null
        this.#createSocket(true)
      }, 300)
      if (opened) {
        this.dispatchEvent(new CustomEvent('status', { detail: null }))
        this.dispatchEvent(new CustomEvent('reconnecting'))
      }
    })

    this.socket.addEventListener('message', (event) => {
      try {
        if (event.data instanceof ArrayBuffer) {
          const view = new DataView(event.data)
          const eventType = view.getUint32(0)
          const buffer = event.data.slice(4)
          switch (eventType) {
            case 1:
              const view2 = new DataView(event.data)
              const imageType = view2.getUint32(0)
              let imageMime
              switch (imageType) {
                case 1:
                default:
                  imageMime = 'image/jpeg'
                  break
                case 2:
                  imageMime = 'image/png'
              }
              const imageBlob = new Blob([buffer.slice(4)], {
                type: imageMime
              })
              this.dispatchEvent(
                new CustomEvent('b_preview', { detail: imageBlob })
              )
              break
            default:
              throw new Error(
                `Unknown binary websocket message of type ${eventType}`
              )
          }
        } else {
          const msg = JSON.parse(event.data)
          switch (msg.type) {
            case 'status':
              if (msg.data.sid) {
                const clientId = msg.data.sid
                this.clientId = clientId
                window.name = clientId // 使用窗口名称，这样在复制标签时就不会重用
                sessionStorage.setItem('clientId', clientId) // 将其存储在会话存储中，以便复制的标签可以加载正确的工作流
              }
              this.dispatchEvent(
                new CustomEvent('status', { detail: msg.data.status })
              )
              break
            case 'progress':
              this.dispatchEvent(
                new CustomEvent('progress', { detail: msg.data })
              )
              break
            case 'executing':
              this.dispatchEvent(
                new CustomEvent('executing', {
                  detail: msg.data.display_node || msg.data.node
                })
              )
              break
            case 'executed':
              this.dispatchEvent(
                new CustomEvent('executed', { detail: msg.data })
              )
              break
            case 'execution_start':
              this.dispatchEvent(
                new CustomEvent('execution_start', { detail: msg.data })
              )
              break
            case 'execution_success':
              this.dispatchEvent(
                new CustomEvent('execution_success', { detail: msg.data })
              )
              break
            case 'execution_error':
              this.dispatchEvent(
                new CustomEvent('execution_error', { detail: msg.data })
              )
              break
            case 'execution_cached':
              this.dispatchEvent(
                new CustomEvent('execution_cached', { detail: msg.data })
              )
              break
            case 'download_progress':
              this.dispatchEvent(
                new CustomEvent('download_progress', { detail: msg.data })
              )
              break
            default:
              if (this.#registered.has(msg.type)) {
                this.dispatchEvent(
                  new CustomEvent(msg.type, { detail: msg.data })
                )
              } else if (!this.reportedUnknownMessageTypes.has(msg.type)) {
                this.reportedUnknownMessageTypes.add(msg.type)
                throw new Error(`Unknown message type ${msg.type}`)
              }
          }
        }
      } catch (error) {
        console.warn('Unhandled message:', event.data, error)
      }
    })
  }

  /**
   * Initialises sockets and realtime updates
   */
  /**
   * 初始化方法
   *
   * 初始化时，会调用私有方法 `#createSocket()` 来创建socket连接。
   */
  init() {
    this.#createSocket()
  }

  /**
   * 获取扩展列表的URL
   * 该方法用于通过网络请求异步获取扩展信息列表，以JSON格式返回。
   * 请求 '/extensions' 端点，并避免使用缓存。
   *
   * @returns {Promise<ExtensionsResponse>} 返回一个解析后的扩展信息对象的Promise。
   */
  async getExtensions(): Promise<ExtensionsResponse> {
    const resp = await this.fetchApi('/extensions', { cache: 'no-store' })
    return await resp.json()
  }

  /**
   * 获取嵌入名称列表
   * 此方法用于从API获取嵌入资源的名称列表。
   * 该方法不接受任何参数。
   *
   * @returns {Promise<EmbeddingsResponse>} 返回一个Promise，解析后为包含嵌入名称列表的EmbeddingsResponse实例。
   */
  async getEmbeddings(): Promise<EmbeddingsResponse> {
    // 调用fetchApi方法向'/embeddings' API端点发送请求，并设置请求不被缓存。
    // 等待响应并将其转换为JSON格式。
    const resp = await this.fetchApi('/embeddings', { cache: 'no-store' })
    // 返回解析后的JSON数据。
    return await resp.json()
  }

  /**
   * 加载图的节点对象定义
   * @param { { validate?: boolean } } options - 是否进行验证的选项，默认为 false
   * @returns {Promise<Record<string, ComfyNodeDef>>} 节点定义
   */
  async getNodeDefs({ validate = false }: { validate?: boolean } = {}): Promise<
    Record<string, ComfyNodeDef>
  > {
    // 从 API 获取节点定义信息
    const resp = await this.fetchApi('/object_info', { cache: 'no-store' })
    // 解析 JSON 响应
    const objectInfoUnsafe = await resp.json()
    // 如果不需要验证，直接返回原始信息
    if (!validate) {
      return objectInfoUnsafe
    }
    // 验证节点定义是否符合 zod 模式（较慢）
    const objectInfo: Record<string, ComfyNodeDef> = {}
    // 遍历每个节点定义进行验证
    for (const key in objectInfoUnsafe) {
      // 验证每个节点定义并处理错误
      const validatedDef = validateComfyNodeDef(
        objectInfoUnsafe[key],
        /* onError=*/ (errorMessage: string) => {
          // 跳过无效的节点定义并记录警告信息
          console.warn(
            `跳过无效的节点定义: ${key}。请查看调试日志以获取更多信息。`
          )
          // 在调试模式下记录详细的错误信息
          console.debug(errorMessage)
        }
      )
      // 如果节点定义有效，将其添加到返回对象中
      if (validatedDef !== null) {
        objectInfo[key] = validatedDef
      }
    }
    // 返回包含所有有效节点定义的对象
    return objectInfo
  }

  /**
   * 异步将提示信息排队到指定位置。
   *
   * 此函数通过发送 POST 请求到 API 端点来排队一个提示对象。可以通过 `number` 参数指定排队的位置。
   * 如果传递 `-1`，提示将被插入到队列的前面。提示数据包括输出对象和工作流信息。
   *
   * @param {number} number 提示排队的位置，传递 -1 将把提示插入到队列的前面
   * @param {object} prompt 要排队的提示数据
   */
  async queuePrompt(
    number: number,
    {
      output,
      workflow
    }: { output: Record<number, any>; workflow: ComfyWorkflowJSON }
  ): Promise<PromptResponse> {
    // 构建请求体，包括客户端 ID、提示数据和额外的工作流信息
    const body: QueuePromptRequestBody = {
      client_id: this.clientId ?? '', // TODO: 统一客户端 ID 访问
      prompt: output,
      extra_data: { extra_pnginfo: { workflow } }
    }

    // 如果 number 是 -1，设置 front 属性为 true，将提示排队到队列前面
    if (number === -1) {
      body.front = true
    } else if (number != 0) {
      // 如果 number 不是 0，设置 number 属性，将提示排队到指定位置
      body.number = number
    }

    // 发送 POST 请求到 API 端点以排队提示
    const res = await this.fetchApi('/prompt', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    })

    // 如果响应状态码不是 200，抛出带有响应数据的错误
    if (res.status !== 200) {
      throw {
        response: await res.json()
      }
    }

    // 返回解析后的 JSON 响应
    return await res.json()
  }

  /**
   * Gets a list of model folder keys (eg ['checkpoints', 'loras', ...])
   * @returns The list of model folder keys
   */
  async getModelFolders(): Promise<string[]> {
    const res = await this.fetchApi(`/models`)
    if (res.status === 404) {
      return []
    }
    return await res.json()
  }

  /**
   * Gets a list of models in the specified folder
   * @param {string} folder The folder to list models from, such as 'checkpoints'
   * @returns The list of model filenames within the specified folder
   */
  async getModels(folder: string) {
    const res = await this.fetchApi(`/models/${folder}`)
    if (res.status === 404) {
      return null
    }
    return await res.json()
  }

  /**
   * Gets the metadata for a model
   * @param {string} folder The folder containing the model
   * @param {string} model The model to get metadata for
   * @returns The metadata for the model
   */
  async viewMetadata(folder: string, model: string) {
    const res = await this.fetchApi(
      `/view_metadata/${folder}?filename=${encodeURIComponent(model)}`
    )
    const rawResponse = await res.text()
    if (!rawResponse) {
      return null
    }
    try {
      return JSON.parse(rawResponse)
    } catch (error) {
      console.error(
        'Error viewing metadata',
        res.status,
        res.statusText,
        rawResponse,
        error
      )
      return null
    }
  }

  /**
   * Tells the server to download a model from the specified URL to the specified directory and filename
   * @param {string} url The URL to download the model from
   * @param {string} model_directory The main directory (eg 'checkpoints') to save the model to
   * @param {string} model_filename The filename to save the model as
   * @param {number} progress_interval The interval in seconds at which to report download progress (via 'download_progress' event)
   */
  async internalDownloadModel(
    url: string,
    model_directory: string,
    model_filename: string,
    progress_interval: number,
    folder_path: string
  ): Promise<DownloadModelStatus> {
    const res = await this.fetchApi('/internal/models/download', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        url,
        model_directory,
        model_filename,
        progress_interval,
        folder_path
      })
    })
    return await res.json()
  }

  /**
   * Loads a list of items (queue or history)
   * @param {string} type The type of items to load, queue or history
   * @returns The items of the specified type grouped by their status
   */
  async getItems(type: 'queue' | 'history') {
    if (type === 'queue') {
      return this.getQueue()
    }
    return this.getHistory()
  }

  /**
   * Gets the current state of the queue
   * @returns The currently running and queued items
   */
  async getQueue(): Promise<{
    Running: RunningTaskItem[]
    Pending: PendingTaskItem[]
  }> {
    try {
      const res = await this.fetchApi('/queue')
      const data = await res.json()
      return {
        // Running action uses a different endpoint for cancelling
        Running: data.queue_running.map((prompt: Record<number, any>) => ({
          taskType: 'Running',
          prompt,
          remove: { name: 'Cancel', cb: () => api.interrupt() }
        })),
        Pending: data.queue_pending.map((prompt: Record<number, any>) => ({
          taskType: 'Pending',
          prompt
        }))
      }
    } catch (error) {
      console.error(error)
      return { Running: [], Pending: [] }
    }
  }

  /**
   * Gets the prompt execution history
   * @returns Prompt history including node outputs
   */
  async getHistory(
    max_items: number = 200
  ): Promise<{ History: HistoryTaskItem[] }> {
    try {
      const res = await this.fetchApi(`/history?max_items=${max_items}`)
      const json: Promise<HistoryTaskItem[]> = await res.json()
      return {
        History: Object.values(json).map((item) => ({
          ...item,
          taskType: 'History'
        }))
      }
    } catch (error) {
      console.error(error)
      return { History: [] }
    }
  }

  /**
   * Gets system & device stats
   * @returns System stats such as python version, OS, per device info
   */
  async getSystemStats(): Promise<SystemStats> {
    const res = await this.fetchApi('/system_stats')
    return await res.json()
  }

  /**
   * Sends a POST request to the API
   * @param {*} type The endpoint to post to
   * @param {*} body Optional POST data
   */
  async #postItem(type: string, body: any) {
    try {
      await this.fetchApi('/' + type, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: body ? JSON.stringify(body) : undefined
      })
    } catch (error) {
      console.error(error)
    }
  }

  /**
   * Deletes an item from the specified list
   * @param {string} type The type of item to delete, queue or history
   * @param {number} id The id of the item to delete
   */
  async deleteItem(type: string, id: string) {
    await this.#postItem(type, { delete: [id] })
  }

  /**
   * Clears the specified list
   * @param {string} type The type of list to clear, queue or history
   */
  async clearItems(type: string) {
    await this.#postItem(type, { clear: true })
  }

  /**
   * Interrupts the execution of the running prompt
   */
  async interrupt() {
    await this.#postItem('interrupt', null)
  }

  /**
   * Gets user configuration data and where data should be stored
   */
  async getUserConfig(): Promise<User> {
    return (await this.fetchApi('/users')).json()
  }

  /**
   * Creates a new user
   * @param { string } username
   * @returns The fetch response
   */
  createUser(username: string) {
    return this.fetchApi('/users', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ username })
    })
  }

  /**
   * Gets all setting values for the current user
   * @returns { Promise<string, unknown> } A dictionary of id -> value
   */
  async getSettings(): Promise<Settings> {
    return (await this.fetchApi('/settings')).json()
  }

  /**
   * Gets a setting for the current user
   * @param { string } id The id of the setting to fetch
   * @returns { Promise<unknown> } The setting value
   */
  async getSetting(id: keyof Settings): Promise<Settings[keyof Settings]> {
    return (await this.fetchApi(`/settings/${encodeURIComponent(id)}`)).json()
  }

  /**
   * Stores a dictionary of settings for the current user
   */
  async storeSettings(settings: Settings) {
    return this.fetchApi(`/settings`, {
      method: 'POST',
      body: JSON.stringify(settings)
    })
  }

  /**
   * Stores a setting for the current user
   */
  async storeSetting(id: keyof Settings, value: Settings[keyof Settings]) {
    return this.fetchApi(`/settings/${encodeURIComponent(id)}`, {
      method: 'POST',
      body: JSON.stringify(value)
    })
  }

  /**
   * Gets a user data file for the current user
   */
  async getUserData(file: string, options?: RequestInit) {
    return this.fetchApi(`/userdata/${encodeURIComponent(file)}`, options)
  }

  /**
   * Stores a user data file for the current user
   * @param { string } file The name of the userdata file to save
   * @param { unknown } data The data to save to the file
   * @param { RequestInit & { stringify?: boolean, throwOnError?: boolean } } [options]
   * @returns { Promise<Response> }
   */
  async storeUserData(
    file: string,
    data: any,
    options: RequestInit & {
      overwrite?: boolean
      stringify?: boolean
      throwOnError?: boolean
    } = { overwrite: true, stringify: true, throwOnError: true }
  ): Promise<Response> {
    const resp = await this.fetchApi(
      `/userdata/${encodeURIComponent(file)}?overwrite=${options.overwrite}`,
      {
        method: 'POST',
        body: options?.stringify ? JSON.stringify(data) : data,
        ...options
      }
    )
    if (resp.status !== 200 && options.throwOnError !== false) {
      throw new Error(
        `Error storing user data file '${file}': ${resp.status} ${(await resp).statusText}`
      )
    }

    return resp
  }

  /**
   * Deletes a user data file for the current user
   * @param { string } file The name of the userdata file to delete
   */
  async deleteUserData(file: string) {
    const resp = await this.fetchApi(`/userdata/${encodeURIComponent(file)}`, {
      method: 'DELETE'
    })
    return resp
  }

  /**
   * Move a user data file for the current user
   * @param { string } source The userdata file to move
   * @param { string } dest The destination for the file
   */
  async moveUserData(
    source: string,
    dest: string,
    options = { overwrite: false }
  ) {
    const resp = await this.fetchApi(
      `/userdata/${encodeURIComponent(source)}/move/${encodeURIComponent(dest)}?overwrite=${options?.overwrite}`,
      {
        method: 'POST'
      }
    )
    return resp
  }

  /**
   * @overload
   * Lists user data files for the current user
   * @param { string } dir The directory in which to list files
   * @param { boolean } [recurse] If the listing should be recursive
   * @param { true } [split] If the paths should be split based on the os path separator
   * @returns { Promise<string[][]> } The list of split file paths in the format [fullPath, ...splitPath]
   */
  /**
   * @overload
   * Lists user data files for the current user
   * @param { string } dir The directory in which to list files
   * @param { boolean } [recurse] If the listing should be recursive
   * @param { false | undefined } [split] If the paths should be split based on the os path separator
   * @returns { Promise<string[]> } The list of files
   */
  async listUserData(
    dir: string,
    recurse: boolean,
    split?: true
  ): Promise<string[][]>
  async listUserData(
    dir: string,
    recurse: boolean,
    split?: false
  ): Promise<string[]>
  /**
   * @deprecated Use `listUserDataFullInfo` instead.
   */
  async listUserData(dir: string, recurse: boolean, split?: boolean) {
    const resp = await this.fetchApi(
      `/userdata?${new URLSearchParams({
        recurse: recurse ? 'true' : 'false',
        dir,
        split: split ? 'true' : 'false'
      })}`
    )
    if (resp.status === 404) return []
    if (resp.status !== 200) {
      throw new Error(
        `Error getting user data list '${dir}': ${resp.status} ${resp.statusText}`
      )
    }
    return resp.json()
  }

  async listUserDataFullInfo(dir: string): Promise<UserDataFullInfo[]> {
    const resp = await this.fetchApi(
      `/userdata?dir=${encodeURIComponent(dir)}&recurse=true&split=false&full_info=true`
    )
    if (resp.status === 404) return []
    if (resp.status !== 200) {
      throw new Error(
        `Error getting user data list '${dir}': ${resp.status} ${resp.statusText}`
      )
    }
    return resp.json()
  }

  async getLogs(): Promise<string> {
    return (await axios.get(this.internalURL('/logs'))).data
  }

  async getFolderPaths(): Promise<Record<string, string[]>> {
    return (await axios.get(this.internalURL('/folder_paths'))).data
  }
}

export const api = new ComfyApi()
