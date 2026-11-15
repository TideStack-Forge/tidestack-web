/**
 * 开发工具 - 配置对话框
 *
 * 使用方式：
 * 1. 在浏览器控制台输入：__DEV_TOOL.config()
 * 2. 或者：window.__DEV_TOOL.config()
 *
 * 功能：
 * - 配置 API Host
 * - 拉取并配置微前端入口
 * - 方便前端开发联调
 */

import { Client } from '@/utils/http'
import { openDialog } from '@/common/modal'
import { clearEntryMapCache, isMicro } from '@/common/micro/utils'

/**
 * 获取当前配置
 */
function getCurrentConfig() {
  const apiHost = sessionStorage.getItem('apiHost') || ''
  const microEntries = sessionStorage.getItem('devMicroEntries')

  return {
    apiHost,
    microEntries: microEntries ? JSON.parse(microEntries) : [],
  }
}

/**
 * 拉取 webapp-info 并解析微前端配置
 */
async function fetchWebappInfo(apiHost?: string) {
  try {
    let url = '/api/sys/web-app-info'

    // 如果指定了 apiHost，构造完整 URL
    if (apiHost && apiHost.trim()) {
      const baseUrl = apiHost.replace(/\/$/, '') // 移除末尾斜杠
      url = `${baseUrl}/api/sys/web-app-info`
    }

    // 拉取 webapp-info
    // 使用 skipAuth 避免 401 时自动登出
    const res = await Client.get(url, null, { skipAuth: true })

    if (res.data.code === 0) {
      return res.data.data
    } else {
      throw new Error(res.data.msg || '拉取配置失败')
    }
  } catch (error: any) {
    console.error('拉取配置失败', error)
    // 提供更友好的错误信息
    if (error?.response?.status === 401) {
      throw new Error('未登录或登录已过期，请先登录目标环境')
    } else if (error?.code === 'ECONNABORTED') {
      throw new Error('请求超时，请检查 API Host 是否正确')
    } else if (error?.message) {
      throw new Error(error.message)
    } else {
      throw new Error('拉取配置失败，请检查 API Host 是否正确')
    }
  }
}

/**
 * 解析微前端配置
 */
function parseMicroEntries(webappInfo: any) {
  const entries: any[] = []
  const seen = new Set()

  // 辅助函数：添加 entry
  const addEntry = (entry: string, name: string, category: string) => {
    if (entry && !seen.has(entry)) {
      seen.add(entry)
      entries.push({
        original: entry,
        custom: '',
        name,
        category,
      })
    }
  }

  // 1. 从布局组件中提取
  if (webappInfo.headerEntry) {
    addEntry(webappInfo.headerEntry, '头部导航', '布局组件')
  }
  if (webappInfo.sidebarEntry) {
    addEntry(webappInfo.sidebarEntry, '侧边栏导航', '布局组件')
  }
  if (webappInfo.loginEntry) {
    addEntry(webappInfo.loginEntry, '登录页面', '布局组件')
  }

  // 2. 从平台组件库中提取
  if (webappInfo.amisLibrary) {
    const amisLib = webappInfo.amisLibrary
    if (typeof amisLib === 'string') {
      addEntry(amisLib, 'AMIS 组件库', '平台组件库')
    } else if (amisLib && typeof amisLib === 'object') {
      // 如果是对象，可能包含 entry 或 publicPath
      const entry = amisLib.entry || amisLib.publicPath
      if (entry) {
        addEntry(entry, amisLib.name || 'AMIS 组件库', '平台组件库')
      }
    }
  }

  // 3. 从 routes 中提取微前端配置
  const routes = webappInfo.routes || []

  // 递归解析路由（包括子路由）
  const parseRoutes = (routeList: any[]) => {
    routeList.forEach((route: any) => {
      // 获取路由类型（优先使用 type，其次使用 routeType）
      const routeType = route.type || route.routeType

      // 检查是否是微前端类型
      if (routeType && isMicro(routeType)) {
        const entry = route.entry || (route.config && route.config.entry)
        if (entry) {
          const name = route.title || route.name || getEntryName(entry, route)
          addEntry(entry, name, '业务微应用')
        }
      }

      // 递归处理子路由
      if (route.children && Array.isArray(route.children)) {
        parseRoutes(route.children)
      }
    })
  }

  parseRoutes(routes)

  return entries
}

/**
 * 从 entry 中提取名称
 */
function getEntryName(entry: string, route?: any): string {
  // 尝试从路由信息中提取名称
  if (route?.title) return route.title
  if (route?.name) return route.name

  // 从 entry URL 中提取名称
  try {
    const url = new URL(entry, window.location.origin)
    const pathParts = url.pathname.split('/').filter(Boolean)
    if (pathParts.length > 0) {
      return pathParts[pathParts.length - 1]
    }
  } catch (e) {
    // 如果不是有效 URL，直接使用 entry
  }

  return entry
}

/**
 * 保存配置
 */
function saveConfig(values: any) {
  // 保存 API Host
  if (values.apiHost) {
    sessionStorage.setItem('apiHost', values.apiHost)
  } else {
    sessionStorage.removeItem('apiHost')
  }

  // 保存微前端配置
  const microEntries = values.microEntries || []
  sessionStorage.setItem('devMicroEntries', JSON.stringify(microEntries))

  // 构建微前端 entry 映射
  const entryMap: Record<string, string> = {}
  microEntries.forEach((entry: any) => {
    if (entry.custom) {
      entryMap[entry.original] = entry.custom
    }
  })
  sessionStorage.setItem('devMicroEntryMap', JSON.stringify(entryMap))

  // 清除缓存，确保下次读取最新配置
  clearEntryMapCache()

  console.log('✅ 配置已保存，即将刷新页面...')

  // 延迟刷新，让用户看到提示
  setTimeout(() => {
    window.location.reload()
  }, 500)
}

/**
 * 重置配置
 */
function resetConfig() {
  sessionStorage.removeItem('apiHost')
  sessionStorage.removeItem('devMicroEntries')
  sessionStorage.removeItem('devMicroEntryMap')

  // 清除缓存
  clearEntryMapCache()

  console.log('✅ 配置已重置，即将刷新页面...')
  setTimeout(() => {
    window.location.reload()
  }, 500)
}

/**
 * 打开开发配置对话框
 */
async function openDevConfig() {
  const currentConfig = getCurrentConfig()

  const schema = {
    type: 'dialog',
    title: '🛠️ 开发环境配置',
    size: 'lg',
    closeOnEsc: true,
    body: {
      type: 'form',
      mode: 'normal',
      wrapWithPanel: false,
      body: [
        {
          type: 'group',
          label: 'API Host',
          body: [
            {
              type: 'input-text',
              name: 'apiHost',
              placeholder: 'http://localhost:8888',
              clearable: true,
              description: '留空使用默认配置',
              value: currentConfig.apiHost,
              validations: {
                isUrl: true,
              },
              validationErrors: {
                isUrl: '请输入有效的 URL 地址',
              },
            },
            {
              type: 'button',
              label: '拉取配置',
              level: 'primary',
              onEvent: {
                click: {
                  actions: [
                    {
                      actionType: 'custom',
                      script: async function (context: any, doAction: any, event: any) {
                        try {
                          // 安全地获取数据
                          const eventData = event?.data || {}
                          const apiHost = eventData.apiHost || ''

                          // 拉取配置
                          const webappInfo = await fetchWebappInfo(apiHost)
                          const entries = parseMicroEntries(webappInfo)

                          // 合并已有的自定义配置
                          const existingEntries = eventData.microEntries || []
                          const mergedEntries = entries.map((entry: any) => {
                            const existing = existingEntries.find(
                              (e: any) => e.original === entry.original
                            )
                            return {
                              ...entry,
                              custom: existing?.custom || '',
                            }
                          })

                          // 通过事件上下文传递数据
                          context.tempMicroEntries = mergedEntries

                          // 触发 setValue action
                          await doAction({
                            actionType: 'setValue',
                            componentId: 'microEntriesTable',
                            args: {
                              value: mergedEntries
                            }
                          })

                          // 显示成功提示
                          await doAction({
                            actionType: 'toast',
                            args: {
                              msg: '配置拉取成功',
                              level: 'success'
                            }
                          })
                        } catch (error: any) {
                          // 显示错误提示
                          await doAction({
                            actionType: 'toast',
                            args: {
                              msg: error.message || '拉取配置失败，请检查 API Host 是否正确',
                              level: 'error'
                            }
                          })
                        }
                      },
                    }
                  ],
                },
              },
            },
          ],
        },
        {
          type: 'divider',
        },
        {
          type: 'static',
          label: '微前端入口配置',
          value: '可单独覆盖每个微应用的入口地址，方便本地联调',
          labelClassName: 'font-bold',
        },
        {
          type: 'input-table',
          id: 'microEntriesTable',
          name: 'microEntries',
          addable: true,
          removable: true,
          needConfirm: false,
          showIndex: true,
          value: currentConfig.microEntries,
          columns: [
            {
              name: 'category',
              label: '分类',
              type: 'static',
              width: 120,
            },
            {
              name: 'name',
              label: '名称',
              type: 'input-text',
              placeholder: '请输入名称',
              required: true,
              width: 150,
            },
            {
              name: 'original',
              label: '原始入口',
              type: 'input-text',
              placeholder: '请输入原始入口',
              required: true,
            },
            {
              name: 'custom',
              label: '自定义入口',
              type: 'input-text',
              placeholder: '留空使用原始入口',
              quickEdit: {
                mode: 'inline',
                saveImmediately: true,
              },
            },
          ],
          placeholder: '暂无微前端配置，请点击"拉取配置"获取或手动添加',
        },
      ],
    },
    actions: [
      {
        type: 'button',
        label: '重置',
        level: 'secondary' as const,
        onEvent: {
          click: {
            actions: [
              {
                actionType: 'custom',
                script: function () {
                  if (confirm('确定要重置所有开发配置吗？')) {
                    resetConfig()
                  }
                },
              },
            ],
          },
        },
      },
      {
        type: 'button',
        label: '取消',
        level: 'secondary' as const,
        actionType: 'cancel',
      },
      {
        type: 'submit',
        label: '保存并刷新',
        level: 'primary' as const,
      },
    ],
  }

  const result = await openDialog(schema as any)
  if (result) {
    saveConfig(result[0])
  }
}

/**
 * 获取当前开发配置
 */
function getDevConfig() {
  const apiHost = sessionStorage.getItem('apiHost') || '(默认)'
  const microEntries = sessionStorage.getItem('devMicroEntries')
  const entryMap = sessionStorage.getItem('devMicroEntryMap')

  console.group('📋 当前开发配置')
  console.log('API Host:', apiHost)

  if (entryMap) {
    try {
      const map = JSON.parse(entryMap)
      console.log('微前端入口映射:')
      console.table(map)
    } catch (e) {
      console.log('微前端入口映射: (无)')
    }
  } else {
    console.log('微前端入口映射: (无)')
  }

  console.groupEnd()

  return {
    apiHost,
    microEntries: microEntries ? JSON.parse(microEntries) : [],
    entryMap: entryMap ? JSON.parse(entryMap) : {},
  }
}

/**
 * 清除开发配置
 */
function clearDevConfig() {
  resetConfig()
}

/**
 * 显示帮助信息
 */
function showDevHelp() {
  console.log(`
🛠️  开发工具命令

__DEV_TOOL.config()        - 打开配置对话框
__DEV_TOOL.getConfig()     - 查看当前配置
__DEV_TOOL.clearConfig()   - 清除所有配置
__DEV_TOOL.help()          - 显示帮助信息

配置说明：
1. API Host: 设置后端 API 地址，留空使用默认配置
2. 微前端入口: 可单独覆盖每个微应用的入口地址，方便本地联调

示例：
  __DEV_TOOL.config()                    // 打开配置对话框
  __DEV_TOOL.getConfig()                 // 查看当前配置
  __DEV_TOOL.clearConfig()               // 清除配置
  `)
}

/**
 * 初始化开发工具
 */
export function initDevTools() {
  // 注册全局命令
  const devTool = {
    config: openDevConfig,
    getConfig: getDevConfig,
    clearConfig: clearDevConfig,
    help: showDevHelp,
  }

  ;(window as any).__DEV_TOOL = devTool
}
