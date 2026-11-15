import { createBusinessActions } from './business-actions'
export type { BusinessActionIdentity, BusinessActionInput, BusinessActionAvailability, BusinessActionFile } from './business-actions'

import type {
  TabOption,
  MenuInfo,
  ConfirmOptions,
  LoginParams,
  StompHeaders,
  IMessage,
  request as RequestType,
  amisUtils as AmisUtilsType,
  InitMicroAppOptions,
  InitLayoutComponentOptions,
  InitAmisComponentLibOptions,
  MicroAppLifecycle,
  MicroAppCommonProps,
  MicroAppCommonUtils,
  MicroAppToken,
  ExternalAuthProviderInfo,
  OuroborosDialogSchema,
  OuroborosDrawerSchema,
  OuroborosModalContext,
  Stomp as StompApi,
  SubscribeInitialOptions,
  SubscribeOptions,
  SubscribeWithInitialOptions,
  SubscribeWithInitialHandle,
  MenuBadge,
  MenuItemInfo,
  MenuTreeResult,
  GetMenusOptions,
  AddMenuItemOptions,
  MenuScope,
  UserMenuItem,
  UserMenuContext,
  MenuApi,
  UserMenuApi,
} from './types'

// 重新导出纯类型
export type {
  TabOption,
  MenuInfo,
  ConfirmOptions,
  LoginParams,
  StompHeaders,
  IMessage,
  InitMicroAppOptions,
  InitLayoutComponentOptions,
  InitAmisComponentLibOptions,
  MicroAppLifecycle,
  MicroAppCommonProps,
  MicroAppCommonUtils,
  MicroAppToken,
  ExternalAuthProviderInfo,
  OuroborosDialogSchema,
  OuroborosDrawerSchema,
  OuroborosModalContext,
  SubscribeInitialOptions,
  SubscribeOptions,
  SubscribeWithInitialOptions,
  SubscribeWithInitialHandle,
  MenuBadge,
  MenuItemInfo,
  MenuTreeResult,
  GetMenusOptions,
  AddMenuItemOptions,
  MenuScope,
  UserMenuItem,
  UserMenuContext,
  MenuApi,
  UserMenuApi,
}

/**
 * ============================================================================
 * ES6 模块活绑定（Live Binding）说明
 * ============================================================================
 * 
 * 本 SDK 使用 ES6 模块的活绑定特性来实现平台能力的动态注入。
 * 
 * 工作原理：
 * 1. SDK 初始化时，导出的对象（toast, EventBus, Stomp 等）是桩对象（stub）
 * 2. 微前端挂载时，平台通过 props 传入真实的实现对象
 * 3. commonPropsFn 中使用直接赋值（如 Stomp = stomp）更新模块变量
 * 4. 由于 ES6 的活绑定特性，所有导入者自动获得更新后的对象引用
 * 
 * 示例：
 * ```javascript
 * // SDK 内部
 * let Stomp = createStompStub()  // 初始桩对象
 * export { Stomp }
 * 
 * // 挂载时
 * Stomp = props.stomp  // 重新赋值
 * 
 * // 使用者代码
 * import { Stomp } from 'ouroboros-sdk'
 * Stomp.connect()  // ✅ 自动调用平台注入的真实对象
 * ```
 * 
 * 注意：这种方式要求使用 `export { variable }` 而不是 `export default`
 * ============================================================================
 */

let registeredComponents = []

/**
 * 平台能力函数（活绑定桩对象）
 * 这些函数在微前端挂载时由平台注入
 */
let openDialog = (schema, ctx) => {
  console.warn('请通过平台加载openDialog方法')
}
let openDrawer = (schema, ctx) => {
  console.warn('请通过平台加载openDrawer方法')
}
let openTab = (fullPath, tabOption) => {
  console.warn('请通过平台加载openTab方法')
}
let closeTab = (id, result) => {
  console.warn('请通过平台加载closeTab方法')
}
let openMenu = (menu) => {
  console.warn('请通过平台加载openMenu方法')
}
let openOrSwitchTab = (fullPath, switchTabOptions) => {
  console.warn('请通过平台加载openOrSwitchTab方法')
}
let sendToOpenerTab = (id, data) => {
  console.warn('请通过平台加载sendToOpenerTab方法')
}
let updateTabTitle = (id, title) => {
  console.warn('请通过平台加载updateTabTitle方法')
}
let renderAmisSchema = (containerEl, schema, props, env) => {
  console.warn('请通过平台加载renderAmisSchema方法')
}
let hasAuth = (authKey) => {
  console.warn('请通过平台加载hasAuth方法')
}
let login = (params) => {
  console.warn('请通过平台加载login方法')
}
let logout = () => {
  console.warn('请通过平台加载logout方法')
}
let onConfirm = (params, reload) => {
  console.warn('请通过平台加载onConfirm方法')
}
let onCancel = () => {
  console.warn('请通过平台加载onCancel方法')
}
let confirm = (content, title, optionsOrConfirmText, cancelText) => {
  console.warn('请通过平台加载confirm方法')
}
let alert = (content, title, className) => {
  console.warn('请通过平台加载alert方法')
}
let prompt = (controls, defaultValue, title, confirmText) => {
  console.warn('请通过平台加载prompt方法')
}
let getUserInfo = () => {
  console.warn('请通过平台加载getUserInfo方法')
}
let getToken = () => {
  console.warn('请通过平台加载getToken方法')
  return Promise.resolve(null)
}
let listExternalProviders = () => {
  console.warn('请通过平台加载listExternalProviders方法')
  return Promise.resolve([])
}
let isLocalPasswordLoginEnabled = () => {
  console.warn('请通过平台加载isLocalPasswordLoginEnabled方法')
  return false
}
let startRedirectLogin = (provider, returnUrl) => {
  console.warn('请通过平台加载startRedirectLogin方法')
  return null
}
let loginWithLdap = (params) => {
  console.warn('请通过平台加载loginWithLdap方法')
  return Promise.resolve(null)
}
let exchangeLoginCode = (loginCode) => {
  console.warn('请通过平台加载exchangeLoginCode方法')
  return Promise.resolve(null)
}
let bindExternalAccount = (params) => {
  console.warn('请通过平台加载bindExternalAccount方法')
  return Promise.resolve(null)
}
let resolveReturnUrl = (input) => {
  console.warn('请通过平台加载resolveReturnUrl方法')
  return typeof input === 'string' ? input : '/'
}
let mapAuthError = (code) => {
  console.warn('请通过平台加载mapAuthError方法')
  return typeof code === 'string' ? code : ''
}
let addRule = (ruleName, validatorFn, errorMessage) => {
  // @ts-ignore
  registeredComponents.push({ type: 'Rule', ruleName, validatorFn, errorMessage })
}

let registerIcon = (key, component) => {
  // @ts-ignore
  registeredComponents.push({ type: 'Icon', key, component })
}

/**
 * amis 注册自定义类型
 * @param {*} renderProps
 * @returns
 */
let FormItem = (renderProps) => {
  return (component) => {
    // @ts-ignore
    registeredComponents.push({ type: 'FormItem', component, renderProps })
  }
}
/**
 * amis 表单项扩展
 * @param {*} renderProps
 * @returns
 */
let Renderer = (renderProps) => {
  return (component) => {
    // @ts-ignore
    registeredComponents.push({ type: 'Renderer', component, renderProps })
  }
}

/**
 *自定义动作
 * @param {string} actionType - 动作名
 * @param {Function} action - 动作处理函数
 * @returns
 */
let registerAction = (actionType, action) => {
  // @ts-ignore
  registeredComponents.push({ type: 'Action', actionType, action })
}

/**
 * amis 注册公式
 */
let registerFormula = (name, fn) => {
  // @ts-ignore
  registeredComponents.push({ type: 'Formula', name, fn })
}

/**
 * amis 注册验证器
 */
let registerValidator = (name, fn) => {
  // @ts-ignore
  registeredComponents.push({ type: 'Validator', name, fn })
}

/**
 * amis 编辑器插件注册
 */
let registerEditorPlugin = (plugin) => {
  // @ts-ignore
  registeredComponents.push({ type: 'EditorPlugin', plugin })
}

/**
 * amis 动作面板注册
 */
let registerActionPanel = (panel) => {
  // @ts-ignore
  registeredComponents.push({ type: 'ActionPanel', panel })
}

/**
 * amis OptionsControl 组件
 */
let OptionsControl = (renderProps) => {
  return (component) => {
    // @ts-ignore
    registeredComponents.push({ type: 'OptionsControl', component, renderProps })
  }
}

/**
 * 主题相关
 */
let getTheme = () => {
  console.warn('请通过平台加载getTheme方法')
}

let setTheme = (theme) => {
  console.warn('请通过平台加载setTheme方法')
}

/**
 * 国际化相关
 */
let i18n = {
  getLocale: () => {
    console.warn('请通过平台加载i18n.getLocale方法')
    return 'zh-CN'
  },
  getLanguages: () => {
    console.warn('请通过平台加载i18n.getLanguages方法')
    return []
  },
  switchLanguage: (locale) => {
    console.warn('请通过平台加载i18n.switchLanguage方法')
    return Promise.resolve()
  },
  t: (key, defaultText, params) => {
    console.warn('请通过平台加载i18n.t方法')
    return defaultText || key
  },
  tn: (namespace, key, defaultText, params) => {
    console.warn('请通过平台加载i18n.tn方法')
    return defaultText || key
  },
  tMenu: (key, defaultText) => {
    console.warn('请通过平台加载i18n.tMenu方法')
    return defaultText || key
  },
  tCommon: (key, defaultText, params) => {
    console.warn('请通过平台加载i18n.tCommon方法')
    return defaultText || key
  },
  useNamespace: (namespace) => {
    console.warn('请通过平台加载i18n.useNamespace方法')
    return (key, defaultText, params) => defaultText || key
  },
  getLocaleData: () => {
    console.warn('请通过平台加载i18n.getLocaleData方法')
    return {}
  },
  onLocaleChange: (callback) => {
    console.warn('请通过平台加载i18n.onLocaleChange方法')
    return () => {}
  }
}

let toast = {
  container: null,
  success: (content, conf) => {
    console.warn('请通过平台加载success方法')
  },
  error: (content, conf) => {
    console.warn('请通过平台加载error方法')
  },
  info: (content, conf) => {
    console.warn('请通过平台加载info方法')
  },
  warning: (content, conf) => {
    console.warn('请通过平台加载warning方法')
  },
}

let EventBus = {
  /**
   * 一次性订阅
   * @type{{
   *  (event: string, handler: Function): void
   *  (event: string, handler: Function, filter: Function): void
   * }}
   */
  subscribeOnce: (event, ...args) => {
    console.warn('请通过平台加载subscribeOnce方法')
  },
  /**
   * 订阅事件
   * @type{{
   *  (event: string, handler: Function): void
   *  (event: string, handler: Function, filter: Function): void
   * }}
   */
  subscribe: (event, ...args) => {
    console.warn('请通过平台加载subscribe方法')
  },
  /**
   * 取消订阅
   * @param {string} event 事件名
   * @param {Function} handler 事件处理函数
   */
  unsubscribe: (event: string, handler: Function) => {
    console.warn('请通过平台加载unsubscribe方法')
  },
  /**
   * 发布事件
   * @param {string} event 事件名
   * @param {any} data 事件数据
   * @param {{ replayScope?: 'SESSION', replayStage?: string }} options 事件选项
   */
  publish: (event: string, data: any, options?: object) => {
    console.warn('请通过平台加载publish方法')
  },
}

// Stomp 待处理订阅列表
interface PendingSubscription {
  id: number
  method: string
  args: any[]
  cancelled: boolean
  realUnsubscribe: (() => void) | null
}

interface PendingSubscribeWithInitial {
  cancelled: boolean
  options: {
    destination: string
    listener: (message: any, rawMessage: IMessage) => void
    options?: SubscribeWithInitialOptions
  }
  handle: SubscribeWithInitialHandle
  resolveBootstrapDone: (() => void) | null
  rejectBootstrapDone: ((reason?: any) => void) | null
  realUnsubscribe: (() => void) | null
}

let pendingStompSubscriptions: PendingSubscription[] = []
let pendingStompSubscribeWithInitials: PendingSubscribeWithInitial[] = []
let stompSubscriptionId = 0
let realStomp: any = null

// 创建 Stomp 桩对象的工厂函数
function createStompStub() {
  const subscriptionMethods = ['subscribeTopic', 'subscribeQueue', 'subscribeUserTopic', 'subscribe']
  const unsubscribeMethods = ['unsubscribeTopic', 'unsubscribeQueue', 'unsubscribeUserTopic', 'unsubscribe', 'unsubscribeAll', 'unsubscribeAllTopics', 'unsubscribeAllQueues', 'unsubscribeAllUserTopics']
  const sendMethods = ['sendBinary', 'sendText', 'sendJson', 'send']
  const connectionMethods = ['connect', 'disconnect', 'reconnect']
  const statusMethods = ['isConnected', 'isActive', 'isStompAuthenticated']
  const eventMethods = ['onStompConnected', 'onStompDisconnected']

  const stub: any = {}

  stub.subscribeWithInitial = (
    destination: string,
    listener: (message: any, rawMessage: IMessage) => void,
    options?: SubscribeWithInitialOptions
  ) => {
    if (realStomp) {
      return realStomp.subscribeWithInitial(destination, listener, options)
    }

    let resolveBootstrapDone: (() => void) | null = null
    let rejectBootstrapDone: ((reason?: any) => void) | null = null
    const bootstrapDone = new Promise<void>((resolve, reject) => {
      resolveBootstrapDone = resolve
      rejectBootstrapDone = reject
    })
    bootstrapDone.catch(() => undefined)

    const pending: PendingSubscribeWithInitial = {
      cancelled: false,
      options: {
        destination,
        listener,
        options,
      },
      handle: {
        bootstrapDone,
        unsubscribe: () => {
          if (pending.cancelled) {
            return
          }

          pending.cancelled = true
          const index = pendingStompSubscribeWithInitials.indexOf(pending)
          if (index > -1) {
            pendingStompSubscribeWithInitials.splice(index, 1)
          }
          pending.realUnsubscribe?.()
          rejectBootstrapDone?.(new Error('subscribeWithInitial 已取消'))
        },
      },
      resolveBootstrapDone,
      rejectBootstrapDone,
      realUnsubscribe: null,
    }

    pendingStompSubscribeWithInitials.push(pending)
    return pending.handle
  }

  // 订阅方法：收集订阅信息，返回动态取消订阅函数
  subscriptionMethods.forEach(method => {
    stub[method] = (...args: any[]) => {
      // 如果已注入真实 Stomp，直接调用
      if (realStomp) {
        return realStomp[method](...args)
      }

      // 收集待处理订阅
      const subscription: PendingSubscription = {
        id: ++stompSubscriptionId,
        method,
        args,
        cancelled: false,
        realUnsubscribe: null,
      }
      pendingStompSubscriptions.push(subscription)

      // 返回动态取消订阅函数
      return () => {
        if (subscription.realUnsubscribe) {
          // 已注入，调用真实取消订阅
          subscription.realUnsubscribe()
        } else {
          // 未注入，标记为已取消
          subscription.cancelled = true
          const index = pendingStompSubscriptions.indexOf(subscription)
          if (index > -1) {
            pendingStompSubscriptions.splice(index, 1)
          }
        }
      }
    }
  })

  // 取消订阅方法
  unsubscribeMethods.forEach(method => {
    stub[method] = (...args: any[]) => {
      if (realStomp) {
        return realStomp[method](...args)
      }
      console.warn(`Stomp 尚未注入，${method} 调用被忽略`)
    }
  })

  // 发送方法
  sendMethods.forEach(method => {
    stub[method] = (...args: any[]) => {
      if (realStomp) {
        return realStomp[method](...args)
      }
      console.warn(`Stomp 尚未注入，${method} 调用被忽略`)
    }
  })

  // 连接方法
  connectionMethods.forEach(method => {
    stub[method] = (...args: any[]) => {
      if (realStomp) {
        return realStomp[method](...args)
      }
      console.warn(`Stomp 尚未注入，${method} 调用被忽略`)
    }
  })

  // 状态检查方法（返回 false 作为默认值）
  statusMethods.forEach(method => {
    stub[method] = () => {
      if (realStomp) {
        return realStomp[method]()
      }
      return false
    }
  })

  // 事件订阅方法
  eventMethods.forEach(method => {
    stub[method] = (handler: Function) => {
      if (realStomp) {
        return realStomp[method](handler)
      }

      // 收集待处理事件订阅
      const subscription: PendingSubscription = {
        id: ++stompSubscriptionId,
        method,
        args: [handler],
        cancelled: false,
        realUnsubscribe: null,
      }
      pendingStompSubscriptions.push(subscription)

      return () => {
        if (subscription.realUnsubscribe) {
          subscription.realUnsubscribe()
        } else {
          subscription.cancelled = true
          const index = pendingStompSubscriptions.indexOf(subscription)
          if (index > -1) {
            pendingStompSubscriptions.splice(index, 1)
          }
        }
      }
    }
  })

  return stub
}

// 注入真实 Stomp 对象并处理待处理订阅
function injectRealStomp(stomp: any) {
  realStomp = stomp

  // 处理待处理订阅
  const pending = pendingStompSubscriptions
  pendingStompSubscriptions = []

  for (const subscription of pending) {
    if (subscription.cancelled) continue

    const realUnsubscribe = stomp[subscription.method](...subscription.args)
    if (typeof realUnsubscribe === 'function') {
      subscription.realUnsubscribe = realUnsubscribe
    }
  }

  const pendingInitials = pendingStompSubscribeWithInitials
  pendingStompSubscribeWithInitials = []

  for (const subscription of pendingInitials) {
    if (subscription.cancelled) {
      continue
    }

    const { destination, listener, options } = subscription.options
    const handle = stomp.subscribeWithInitial(destination, listener, options)
    subscription.realUnsubscribe = handle.unsubscribe
    handle.bootstrapDone.then(
      () => subscription.resolveBootstrapDone?.(),
      (error: any) => subscription.rejectBootstrapDone?.(error)
    )
  }
}

let Stomp: StompApi = createStompStub()

/**
 * 创建 request 桩对象
 */
function createRequestStub(): RequestType {
  const stub: any = (config: any) => {
    console.warn('请通过平台加载request方法')
    return Promise.reject(new Error('请通过平台加载request方法'))
  }
  
  stub.get = (url: string, config?: any) => {
    console.warn('请通过平台加载request.get方法')
    return Promise.reject(new Error('请通过平台加载request.get方法'))
  }
  
  stub.post = (url: string, data?: any, config?: any) => {
    console.warn('请通过平台加载request.post方法')
    return Promise.reject(new Error('请通过平台加载request.post方法'))
  }
  
  stub.put = (url: string, data?: any, config?: any) => {
    console.warn('请通过平台加载request.put方法')
    return Promise.reject(new Error('请通过平台加载request.put方法'))
  }
  
  stub.delete = (url: string, config?: any) => {
    console.warn('请通过平台加载request.delete方法')
    return Promise.reject(new Error('请通过平台加载request.delete方法'))
  }
  
  stub.patch = (url: string, data?: any, config?: any) => {
    console.warn('请通过平台加载request.patch方法')
    return Promise.reject(new Error('请通过平台加载request.patch方法'))
  }
  
  return stub as RequestType
}

/**
 * 请求能力（活绑定桩对象）
 */
let request = createRequestStub()

export const businessActions = createBusinessActions(() => request)

/**
 * amis 内部用的常用工具方法（活绑定桩对象）
 */
let amisUtils: AmisUtilsType = {}

// ============================================================================
// 菜单扩展能力（menu / userMenu）—— 活绑定桩 + 注入前 pending 队列
// ============================================================================
// 命令式调用（setMenuBadge / addMenuItem / removeMenuItem / register）在平台能力
// 注入前进入 pending 队列，注入后按调用顺序 flush，避免微应用挂载早于注入时丢失调用。
// 查询类（getMenuBadge / getMenu / getMenus / traverseMenus / getItems）在注入前
// 返回空结果，挂载后（beforeMount/afterMount 之后）方可获得真实数据。

let realMenu: MenuApi | null = null
let realUserMenu: UserMenuApi | null = null
const pendingMenuOps: Array<() => void> = []
// Calls made before any init lifecycle have no owning unmount hook, so this fallback set is intentionally never auto-cleaned.
const defaultUserMenuItemIds = new Set<string>()
let sdkOwner = 'unknown'
let pendingUserMenuSeq = 0

function flushPendingMenuOps() {
  if (pendingMenuOps.length === 0) {
    return
  }
  const ops = pendingMenuOps.splice(0)
  for (const op of ops) {
    op()
  }
}

function cleanupSdkUserMenuRegistrations(registeredUserMenuItemIds: Set<string>) {
  if (registeredUserMenuItemIds.size === 0) {
    return
  }
  registeredUserMenuItemIds.forEach((id) => {
    realUserMenu?.unregister(id)
  })
  registeredUserMenuItemIds.clear()
}

function createMenuStub(): MenuApi {
  return {
    setMenuBadge: (fullName, badge) => {
      if (realMenu) {
        realMenu.setMenuBadge(fullName, badge)
        return
      }
      pendingMenuOps.push(() => realMenu?.setMenuBadge(fullName, badge))
    },
    getMenuBadge: (fullName) => {
      return realMenu ? realMenu.getMenuBadge(fullName) : undefined
    },
    getMenu: (ref) => {
      return realMenu ? realMenu.getMenu(ref) : undefined
    },
    getMenus: (options) => {
      return realMenu ? realMenu.getMenus(options) : []
    },
    traverseMenus: (visitor, options) => {
      if (realMenu) {
        realMenu.traverseMenus(visitor, options)
      }
    },
    addMenuItem: (options) => {
      if (realMenu) {
        return realMenu.addMenuItem(options)
      }
      pendingMenuOps.push(() => {
        realMenu?.addMenuItem(options)
      })
      return false
    },
    removeMenuItem: (ref) => {
      if (realMenu) {
        return realMenu.removeMenuItem(ref)
      }
      pendingMenuOps.push(() => {
        realMenu?.removeMenuItem(ref)
      })
      return false
    },
  }
}

function createUserMenuStub(registeredUserMenuItemIds: Set<string>): UserMenuApi {
  return {
    register: (item) => {
      if (realUserMenu) {
        const id = realUserMenu.register(item, sdkOwner)
        if (id) {
          registeredUserMenuItemIds.add(id)
        }
        return id
      }
      pendingMenuOps.push(() => {
        const id = realUserMenu?.register(item, sdkOwner)
        if (id) {
          registeredUserMenuItemIds.add(id)
        }
      })
      return `__pending-user-menu-${++pendingUserMenuSeq}`
    },
    unregister: (id) => {
      registeredUserMenuItemIds.delete(id)
      if (realUserMenu) {
        realUserMenu.unregister(id)
      }
    },
    getItems: () => {
      return realUserMenu ? realUserMenu.getItems() : []
    },
    unregisterAll: (owner) => {
      if (realUserMenu) {
        realUserMenu.unregisterAll(owner)
      }
    },
  }
}

/**
 * 菜单扩展能力（活绑定桩对象）
 * 微应用挂载时由平台注入真实实现
 */
let menu: MenuApi = createMenuStub()
let userMenu: UserMenuApi = createUserMenuStub(defaultUserMenuItemIds)

// 导出所有平台能力（使用 ES6 活绑定）
export {
  toast,
  EventBus,
  Stomp,
  request,
  amisUtils,
  openDialog,
  openDrawer,
  openTab,
  closeTab,
  openMenu,
  openOrSwitchTab,
  sendToOpenerTab,
  updateTabTitle,
  renderAmisSchema,
  hasAuth,
  login,
  logout,
  onConfirm,
  onCancel,
  confirm,
  alert,
  prompt,
  getUserInfo,
  getToken,
  listExternalProviders,
  isLocalPasswordLoginEnabled,
  startRedirectLogin,
  loginWithLdap,
  exchangeLoginCode,
  bindExternalAccount,
  resolveReturnUrl,
  mapAuthError,
  addRule,
  registerIcon,
  FormItem,
  Renderer,
  registerAction,
  OptionsControl,
  registerFormula,
  registerValidator,
  registerEditorPlugin,
  registerActionPanel,
  getTheme,
  setTheme,
  i18n,
  menu,
  userMenu,
}
/**
 * 公共props 处理逻辑
 * @param {object} props
 */
function commonPropsFn(props) {
  const { __utils__ = props } = props
  const {
    mainWindow = {},
    eventBus,
    openDialog: openDialogFn,
    openDrawer: openDrawerFn,
    openTab: openTabFn,
    closeTab: closeTabFn,
    openMenu: openMenuFn,
    openOrSwitchTab: openOrSwitchTabFn,
    sendToOpenerTab: sendToOpenerTabFn,
    updateTabTitle: updateTabTitleFn,
    hasAuth: hasAuthFn,
    FormItem: FormItemFn,
    Renderer: RendererFn,
    OptionsControl: OptionsControlFn,
    registerAction: registerActionFn,
    registerFormula: registerFormulaFn,
    registerValidator: registerValidatorFn,
    registerEditorPlugin: registerEditorPluginFn,
    registerActionPanel: registerActionPanelFn,
    renderAmisSchema: renderAmisSchemaFn,
    addRule: addRuleFn,
    confirm: confirmFn,
    alert: alertFn,
    prompt: promptFn,
    toast: mainToast,
    request: mainRequest,
    amisUtils: utils,
    loginHandler,
    logoutHandler,
    getToken: getTokenFn = getToken,
    listExternalProviders: listExternalProvidersFn = listExternalProviders,
    isLocalPasswordLoginEnabled: isLocalPasswordLoginEnabledFn = isLocalPasswordLoginEnabled,
    startRedirectLogin: startRedirectLoginFn = startRedirectLogin,
    loginWithLdap: loginWithLdapFn = loginWithLdap,
    exchangeLoginCode: exchangeLoginCodeFn = exchangeLoginCode,
    bindExternalAccount: bindExternalAccountFn = bindExternalAccount,
    resolveReturnUrl: resolveReturnUrlFn = resolveReturnUrl,
    mapAuthError: mapAuthErrorFn = mapAuthError,
    stomp,
    registerIcon: registerIconFn,
    getUserInfo: getUserInfoFn,
    getTheme: getThemeFn,
    setTheme: setThemeFn,
    menu: menuFn,
    userMenu: userMenuFn,
  } = __utils__
  const { appInfo = {} } = props

  // 菜单扩展能力注入（先确定 owner、完成全部赋值后再 flush pending，
  // 避免先 flush 时另一能力尚未注入导致排队操作丢失）
  sdkOwner = appInfo?.name || 'unknown'
  if (menuFn) {
    realMenu = menuFn
  }
  if (userMenuFn) {
    realUserMenu = userMenuFn
  }
  flushPendingMenuOps()

  // 使用 ES6 活绑定，直接赋值更新所有导出变量
  openDialog = openDialogFn
  openDrawer = openDrawerFn
  openTab = openTabFn
  closeTab = closeTabFn
  openMenu = openMenuFn
  openOrSwitchTab = openOrSwitchTabFn
  sendToOpenerTab = sendToOpenerTabFn
  updateTabTitle = updateTabTitleFn
  hasAuth = hasAuthFn
  FormItem = FormItemFn
  Renderer = RendererFn
  OptionsControl = OptionsControlFn
  registerAction = registerActionFn
  registerFormula = registerFormulaFn
  registerValidator = registerValidatorFn
  registerEditorPlugin = registerEditorPluginFn
  registerActionPanel = registerActionPanelFn
  renderAmisSchema = renderAmisSchemaFn
  addRule = addRuleFn
  confirm = confirmFn
  alert = alertFn
  prompt = promptFn
  login = loginHandler
  logout = logoutHandler
  getToken = getTokenFn
  listExternalProviders = listExternalProvidersFn
  isLocalPasswordLoginEnabled = isLocalPasswordLoginEnabledFn
  startRedirectLogin = startRedirectLoginFn
  loginWithLdap = loginWithLdapFn
  exchangeLoginCode = exchangeLoginCodeFn
  bindExternalAccount = bindExternalAccountFn
  resolveReturnUrl = resolveReturnUrlFn
  mapAuthError = mapAuthErrorFn
  registerIcon = registerIconFn
  getUserInfo = getUserInfoFn
  getTheme = getThemeFn
  setTheme = setThemeFn
  EventBus = eventBus
  toast = mainToast
  request = mainRequest
  amisUtils = utils

  // 注入真实 Stomp 并处理待处理订阅
  if (stomp) {
    injectRealStomp(stomp)
  }

  // 注入 i18n
  if (props.i18n) {
    i18n = props.i18n
  }

  // @ts-ignore
  window.mainWindow = mainWindow

  // 处理注册的组件
  let componentDefine
  while ((componentDefine = registeredComponents.pop())) {
    if (componentDefine.type === 'FormItem' && FormItem) {
      FormItem(componentDefine.renderProps)(componentDefine.component)
    }
    if (componentDefine.type === 'Renderer' && Renderer) {
      Renderer(componentDefine.renderProps)(componentDefine.component)
    }
    if (componentDefine.type === 'Action' && registerAction) {
      registerAction(componentDefine.actionType, componentDefine.action)
    }
    if (componentDefine.type === 'Rule' && addRule) {
      addRule(
        componentDefine.ruleName,
        componentDefine.validatorFn,
        componentDefine.errorMessage
      )
    }
    if (componentDefine.type === 'Icon' && registerIcon) {
      registerIcon(componentDefine.key, componentDefine.component)
    }
    if (componentDefine.type === 'OptionsControl' && OptionsControl) {
      OptionsControl(componentDefine.renderProps)(componentDefine.component)
    }
    if (componentDefine.type === 'Formula' && registerFormula) {
      registerFormula(componentDefine.name, componentDefine.fn)
    }
    if (componentDefine.type === 'Validator' && registerValidator) {
      registerValidator(componentDefine.name, componentDefine.fn)
    }
    if (componentDefine.type === 'EditorPlugin' && registerEditorPlugin) {
      registerEditorPlugin(componentDefine.plugin)
    }
    if (componentDefine.type === 'ActionPanel' && registerActionPanel) {
      registerActionPanel(componentDefine.panel)
    }
  }
}

/**
 * 微前端生命周期函数（活绑定导出）
 * 通过 initMicroApp/initLayoutComponent/initAmisComponentLib 初始化后自动更新
 */
let mount = null
let unmount = null
let update = null
let bootstrap = null

export { mount, unmount, update, bootstrap }

/**
 * 初始化微前端，返回生命周期函数
 *
 * @param initOptions 微前端初始化参数
 * @returns 生命周期函数对象
 */
export function initMicroApp(initOptions: InitMicroAppOptions): MicroAppLifecycle {
  const registeredUserMenuItemIds = new Set<string>()
  userMenu = createUserMenuStub(registeredUserMenuItemIds)
  const {
    render = async (props) => {},
    beforeMount = async () => {},
    afterMount = async () => {},
    afterUnmount = async () => {},
    afterUpdate = async () => {},
    onBootstrap = async () => {},
  } = initOptions
  
  let app = null
  
  // @ts-ignore
  if (window.__POWERED_BY_QIANKUN__) {
    // @ts-ignore
    __webpack_public_path__ = window.__INJECTED_PUBLIC_PATH_BY_QIANKUN__
  } else {
    render({})
  }

  mount = async (props) => {
    await beforeMount(props)

    const { onCancel: onCancelFn, onConfirm: onConfirmFn, ...commonProps } = props
    commonPropsFn(commonProps)

    if (onCancelFn) onCancel = onCancelFn
    if (onConfirmFn) onConfirm = onConfirmFn

    app = await render(props)
    await afterMount(props)
  }
  unmount = async (props) => {
    await afterUnmount(props, app)
    cleanupSdkUserMenuRegistrations(registeredUserMenuItemIds)
  }
  update = async (props) => {
    await afterUpdate(props)
  }
  bootstrap = async () => {
    await onBootstrap()
  }
  return {
    mount,
    unmount,
    update,
    bootstrap,
  }
}

// 单组件微前端初始化
export { initMicroApp as initSingleComponent }

/**
 * 初始化业务组件式微前端，返回生命周期函数
 *
 * @param initOptions 微前端初始化参数
 * @returns 生命周期函数对象
 */
export function initLayoutComponent(initOptions: InitLayoutComponentOptions): MicroAppLifecycle {
  const registeredUserMenuItemIds = new Set<string>()
  userMenu = createUserMenuStub(registeredUserMenuItemIds)
  const {
    render = async (props) => {},
    beforeMount = async () => {},
    afterUpdate = async () => {},
    afterUnmount = async () => {},
    onBootstrap = async () => {},
  } = initOptions

  let layoutComApp = null

  // @ts-ignore
  if (window.__POWERED_BY_QIANKUN__) {
    // @ts-ignore
    __webpack_public_path__ = window.__INJECTED_PUBLIC_PATH_BY_QIANKUN__
  } else {
    render({})
  }

  mount = async (props) => {
    await beforeMount(props)
    const {
      container,
      appName,
      logo,
      menu,
      theme,
      userInfo,
      breadcrumb,
      currentPath,
      sidebarStatus,
      onThemeChanged,
      onSidebarWidthChange,
      themeList,
      showXsNavbar,
      ...commonProps
    } = props

    commonPropsFn(commonProps)

    layoutComApp = await render({
      container,
      appName,
      logo,
      menu,
      theme,
      userInfo,
      breadcrumb,
      currentPath,
      sidebarStatus,
      onThemeChanged,
      onSidebarWidthChange,
      themeList,
      showXsNavbar,
      ...commonProps
    })
  }
  unmount = async (props) => {
    await afterUnmount(props, layoutComApp)
    cleanupSdkUserMenuRegistrations(registeredUserMenuItemIds)
  }
  update = async (props) => {
    await afterUpdate(props)
  }
  bootstrap = async () => {
    await onBootstrap()
  }

  return {
    mount,
    unmount,
    update,
    bootstrap,
  }
}
/**
 * 初始化微前端amis组件，返回生命周期函数
 *
 * @param initOptions 微前端初始化参数
 * @returns 生命周期函数对象
 */
export function initAmisComponentLib(initOptions: InitAmisComponentLibOptions): MicroAppLifecycle {
  const registeredUserMenuItemIds = new Set<string>()
  userMenu = createUserMenuStub(registeredUserMenuItemIds)
  const {
    beforeMount = async () => {},
    afterUnmount = async () => {},
    afterUpdate = async () => {},
    onBootstrap = async () => {},
  } = initOptions
  // @ts-ignore
  if (window.__POWERED_BY_QIANKUN__) {
    // @ts-ignore
    __webpack_public_path__ = window.__INJECTED_PUBLIC_PATH_BY_QIANKUN__
  }

  mount = async (props) => {
    await beforeMount(props)
    commonPropsFn(props)
  }
  unmount = async (props) => {
    await afterUnmount(props, null)
    cleanupSdkUserMenuRegistrations(registeredUserMenuItemIds)
  }
  update = async (props) => {
    await afterUpdate(props)
  }
  bootstrap = async () => {
    await onBootstrap()
  }

  return {
    mount,
    unmount,
    update,
    bootstrap,
  }
}
