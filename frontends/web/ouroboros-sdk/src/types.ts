/**
 * TabOption 额外参数接口
 * @param title tab 标题
 * @param breadcrumbs 当前路径的层级关系
 * @param callback 回调方法
 * @param icon tab 图标
 */
export interface TabOption {
  title?: string // tab 标题
  breadcrumbs?: Object[] // 当前路径的层级关系
  callback?: Function // 回调方法
  icon?: string // tab 图标
}

/**
 * 菜单信息对象
 * @param path 菜单的链接地址
 * @param title 菜单的标题
 * @param parent 菜单的父级标识
 * @param icon 菜单的图标
 * @param showMode 页面打开形式，支持 tab、newWindow、fullScreen，默认为 tab
 */
export interface MenuInfo {
  path: string // 菜单的链接地址
  title?: string // 菜单的标题
  parent?: string // 菜单的父级标识
  icon?: string // 菜单的图标
  showMode?: 'tab' | 'newWindow' | 'fullScreen' // 页面打开形式
}

/**
 * 确认对话框配置选项
 * @param className 指定确认对话框的类名
 * @param closeOnEsc 是否允许按下 Esc 关闭对话框
 * @param size 指定对话框的尺寸
 * @param confirmBtnLevel 确认按钮的样式等级
 * @param cancelBtnLevel 取消按钮的样式等级
 * @param confirmText 确认按钮文本
 * @param cancelText 取消按钮文本
 */
export interface ConfirmOptions {
  className?: string // 指定确认对话框的类名
  closeOnEsc?: boolean // 是否允许按下 Esc 关闭对话框
  size?: '' | 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'full' // 指定对话框的尺寸
  confirmBtnLevel?: string // 确认按钮的样式等级
  cancelBtnLevel?: string // 取消按钮的样式等级
  confirmText?: string // 确认按钮文本
  cancelText?: string // 取消按钮文本
}

/**
 * amis - toast 提示
 * @param container Toast 容器
 * @param success 成功类提示信息
 * @param error 错误类提示信息
 * @param info 消息类提示信息
 * @param warning 警告类提示信息
 */
export interface toast {
  container: HTMLElement | null // Toast 容器
  success: (content: string, conf?: any) => void // 成功类提示信息
  error: (content: string, conf?: any) => void // 错误类提示信息
  info: (content: string, conf?: any) => void // 消息类提示信息
  warning: (content: string, conf?: any) => void // 警告类提示信息
}

/**
 * 事件总线，集中式事件处理机制，允许不同的组件进行彼此通信而又不需要相互依赖
 * @param subscribeOnce 一次性订阅
 * @param subscribe 订阅事件
 * @param unsubscribe 取消订阅
 * @param publish 发布事件
 */
export interface EventBus {
  /**
   * 一次性订阅
   * @param event 事件名
   * @param handler 事件处理函数
   */
  subscribeOnce(event: string, handler: Function): void
  /**
   * 一次性订阅（带过滤器）
   * @param event 事件名
   * @param handler 事件处理函数
   * @param filter 过滤函数
   */
  subscribeOnce(event: string, handler: Function, filter: Function): void

  /**
   * 订阅事件
   * @param event 事件名
   * @param handler 事件处理函数
   */
  subscribe(event: string, handler: Function): void
  /**
   * 订阅事件（带过滤器）
   * @param event 事件名
   * @param handler 事件处理函数
   * @param filter 过滤函数
   */
  subscribe(event: string, handler: Function, filter: Function): void

  /**
   * 取消订阅
   * @param event 事件名
   * @param handler 事件处理函数
   */
  unsubscribe(event: string, handler: Function): void

  /**
   * 取消所有订阅
   * @param event 事件名
   */
  unsubscribeAll(event: string): void

  /**
   * 发布事件
   * @param event 事件名
   * @param data 事件数据
   * @param options 事件选项
   */
  publish(event: string, data: any, options?: { replayScope?: 'SESSION'; replayStage?: string }): void
}

/**
 * 用户登录操作 - 登录参数对象
 * @param username 用户名
 * @param password 密码
 * @param success 登陆成功后跳转地址或自定义逻辑
 * @param error 登录失败自定义处理逻辑
 */
export interface LoginParams {
  username: string // 用户名
  password: string // 密码
  success: string | Function // 登陆成功后跳转地址或自定义逻辑
  error: Function // 登录失败自定义处理逻辑
}

export interface MicroAppToken {
  accessToken?: any
  refreshToken?: any
  [key: string]: any
}

export interface ExternalAuthProviderInfo {
  id?: string
  type?: string
  name?: string
  title?: string
  icon?: string
  [key: string]: any
}

export interface MicroAppCommonUtils {
  getToken?: () => Promise<MicroAppToken | null | undefined>
  loginHandler?: (params: any) => Promise<any>
  logoutHandler?: () => Promise<any>
  getUserInfo?: () => Promise<any>
  listExternalProviders?: () => Promise<ExternalAuthProviderInfo[]>
  isLocalPasswordLoginEnabled?: () => boolean
  startRedirectLogin?: (provider: ExternalAuthProviderInfo, returnUrl?: string) => string | null
  loginWithLdap?: (params: any) => Promise<any>
  exchangeLoginCode?: (loginCode: string) => Promise<any>
  bindExternalAccount?: (params: any) => Promise<any>
  resolveReturnUrl?: (input?: any) => string
  mapAuthError?: (code?: string | number) => string
  [key: string]: any
}

export interface MicroAppI18n {
  getLocale: () => string
  getLanguages: () => any[]
  switchLanguage: (locale: string) => Promise<void>
  t: (key: string, defaultText?: string, params?: Record<string, any>) => string
  tn: (
    namespace: string,
    key: string,
    defaultText?: string,
    params?: Record<string, any>
  ) => string
  tMenu: (key: string, defaultText?: string) => string
  tCommon: (key: string, defaultText?: string, params?: Record<string, any>) => string
  useNamespace: (
    namespace: string
  ) => (key: string, defaultText?: string, params?: Record<string, any>) => string
  getLocaleData: () => any
  onLocaleChange: (callback: (locale: string) => void) => () => void
}

export interface MicroAppCommonProps {
  token?: MicroAppToken | null
  apiHost?: string
  mainWindow?: Window
  appInfo?: Record<string, any>
  config?: Record<string, any>
  __utils__?: MicroAppCommonUtils
  i18n?: MicroAppI18n
  [key: string]: any
}

export interface StompHeaders {
  [key: string]: string
}

export interface IMessage {
  ack: (headers?: StompHeaders) => void
  nack: (headers?: StompHeaders) => void
  body: string
  binaryBody: Uint8Array
  headers: StompHeaders
}

export interface SubscribeWithInitialOptions {
  initialDestination?: string
  createInitialRequest?: () => any
  initialBody?: any
  initialTimeoutMs?: number
  keepSingleListener?: boolean
  splitInitialHandlers?: boolean
  onInitialLive?: (message: any, rawMessage: IMessage) => void
  onInitialData?: (message: any, rawMessage: IMessage) => void
  onInitialComplete?: (message: any, rawMessage: IMessage) => void
  onInitialError?: (message: any, rawMessage: IMessage) => void
}

export interface SubscribeInitialOptions {
  initialDestination?: string
  createInitialRequest?: () => any
  initialBody?: any
  initialTimeoutMs?: number
  splitInitialHandlers?: boolean
  onInitialData?: (message: any, rawMessage: IMessage) => void
  onInitialLive?: (message: any, rawMessage: IMessage) => void
  onInitialComplete?: (message: any, rawMessage: IMessage) => void
  onInitialError?: (message: any, rawMessage: IMessage) => void
}

export interface SubscribeOptions extends SubscribeInitialOptions {
  keepSingleListener?: boolean
}

export interface SubscribeWithInitialHandle {
  bootstrapDone: Promise<void>
  unsubscribe: () => void
}

/**
 * Stomp 消息订阅
 */
export interface Stomp {
  /**
   * 订阅主题
   * @param topic 订阅的主题
   * @param listener 消息监听器
   * @param keepSingleListener 是否保持单一的监听器，即订阅同一个目的地时，之前的监听器会被移除，默认为 true
   * @returns {function} 取消订阅函数
   */
  subscribeTopic: (
    topic: string,
    listener: (message: any, rawMessage: IMessage) => void,
    keepSingleListenerOrOptions?: boolean | SubscribeOptions
  ) => () => void

  /**
   * 订阅点对点队列
   * @param queue 点对点队列名称
   * @param listener 消息监听器
   * @param keepSingleListener 是否保持单一的监听器，即订阅同一个目的地时，之前的监听器会被移除，默认为 true
   * @returns {function} 取消订阅函数
   */
  subscribeQueue: (
    queue: string,
    listener: (message: any, rawMessage: IMessage) => void,
    keepSingleListenerOrOptions?: boolean | SubscribeOptions
  ) => () => void

  /**
   * 订阅用户主题
   * @param topic 订阅的主题
   * @param listener 消息监听器
   * @param keepSingleListener 是否保持单一的监听器，即订阅同一个目的地时，之前的监听器会被移除，默认为 true
   * @returns {function} 取消订阅函数
   */
  subscribeUserTopic: (
    topic: string,
    listener: (message: any, rawMessage: IMessage) => void,
    keepSingleListenerOrOptions?: boolean | SubscribeOptions
  ) => () => void

  /**
   * 订阅带初始数据的 Stomp 消息
   * @param destination 主订阅目的地（live subscription）
   * @param listener 默认消息监听器，live / bootstrap-data 默认都会进入该监听器
   * @param options 订阅选项
   * @returns 可取消的订阅句柄
   */
  subscribeWithInitial: (
    destination: string,
    listener: (message: any, rawMessage: IMessage) => void,
    options?: SubscribeWithInitialOptions
  ) => SubscribeWithInitialHandle

  /**
   * 订阅消息
   * @param destination 订阅的目的地
   * @param listener 消息监听器
   * @param keepSingleListener 是否保持单一的监听器，即订阅同一个目的地时，之前的监听器会被移除，默认为 true
   * @returns {function} 取消订阅函数
   */
  subscribe: (
    destination: string,
    listener: (message: any, rawMessage: IMessage) => void,
    keepSingleListenerOrOptions?: boolean | SubscribeOptions
  ) => () => void

  /**
   * 取消订阅主题
   * @param topic 订阅的主题
   * @param {function} [listener] 取消订阅的监听器，留空则取消该主题的所有监听器
   */
  unsubscribeTopic: (
    topic: string,
    listener?: (message: any, rawMessage: IMessage) => void
  ) => void

  /**
   * 取消订阅点对点队列
   * @param queue 点对点队列名称
   * @param {function} [listener] 取消订阅的监听器，留空则取消该队列的所有监听器
   */
  unsubscribeQueue: (
    queue: string,
    listener?: (message: any, rawMessage: IMessage) => void
  ) => void

  /**
   * 取消订阅用户主题
   * @param topic 订阅的主题
   * @param {function} [listener] 取消订阅的监听器，留空则取消该主题的所有监听器
   */
  unsubscribeUserTopic: (
    topic: string,
    listener?: (message: any, rawMessage: IMessage) => void
  ) => void

  /**
   * 取消订阅
   * @param destination 取消订阅的目的地
   * @param {function} [listener] 取消订阅的监听器，留空则取消该目的地的所有监听器
   */
  unsubscribe: (
    destination: string,
    listener?: (message: any, rawMessage: IMessage) => void
  ) => void

  /**
   * 取消订阅所有
   */
  unsubscribeAll: () => void

  /**
   * 取消订阅所有主题
   */
  unsubscribeAllTopics: () => void

  /**
   * 取消订阅所有点对点队列
   */
  unsubscribeAllQueues: () => void

  /**
   * 取消订阅所有用户主题
   */
  unsubscribeAllUserTopics: () => void

  /**
   * 发送二进制消息
   * @param destination 目的地
   * @param body 消息体
   * @param headers 消息头
   * @returns Promise<void>
   */
  sendBinary: (destination: string, body: Uint8Array, headers?: any) => Promise<void>

  /**
   * 发送文本消息
   * @param destination 目的地
   * @param body 消息体
   * @param headers 消息头
   * @returns Promise<void>
   */
  sendText: (destination: string, body: string, headers?: any) => Promise<void>

  /**
   * 发送 JSON 消息
   * @param destination 目的地
   * @param body 消息体
   * @param headers 消息头
   * @returns Promise<void>
   */
  sendJson: (destination: string, body: any, headers?: any) => Promise<void>

  /**
   * 发送消息
   * @param destination 目的地
   * @param body 消息体
   * @param headers 消息头
   * @returns Promise<void>
   */
  send: (destination: string, body: any, headers?: any) => Promise<void>

  /**
   * 连接服务器
   * @returns Promise<void>
   */
  connect: () => Promise<void>

  /**
   * 断开连接
   * @param force 是否强制断开连接,默认false
   * @returns Promise<void>
   */
  disconnect: (force?: boolean) => Promise<void>

  /**
   * 重新连接
   * @returns {Promise<void>}
   */
  reconnect: () => Promise<void>

  /**
   * 检查是否已连接
   * @returns 是否已连接
   */
  isConnected: () => boolean

  /**
   * 检查是否已激活（包括正在连接和已连接状态）
   * @returns 是否已激活
   */
  isActive: () => boolean

  /**
   * 检查是否已认证
   * @returns 是否已认证
   */
  isStompAuthenticated: () => boolean

  /**
   * 订阅 Stomp 连接成功事件（包括首次连接和重连）
   * @param handler 事件处理函数
   * @returns 取消订阅的函数
   */
  onStompConnected: (
    handler: (data: { isReconnect: boolean; timestamp: number; message: any }) => void
  ) => () => void

  /**
   * 订阅 Stomp 断开连接事件
   * @param handler 事件处理函数
   * @returns 取消订阅的函数
   */
  onStompDisconnected: (
    handler: (data: { timestamp: number }) => void
  ) => () => void
}

/**
 * HTTP 请求函数类型
 */
export interface request {
  (config: any): Promise<any>
  get(url: string, config?: any): Promise<any>
  post(url: string, data?: any, config?: any): Promise<any>
  put(url: string, data?: any, config?: any): Promise<any>
  delete(url: string, config?: any): Promise<any>
  patch(url: string, data?: any, config?: any): Promise<any>
}

/**
 * amis 工具类
 */
export interface amisUtils {
  [key: string]: any
}

/**
 * Dialog/Drawer 通用配置
 */
export interface BaseDialogSchema {
  localeNamespace?: string
  title?: string | any
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'full'
  closeOnEsc?: boolean
  showCloseButton?: boolean
  showErrorMsg?: boolean
  disabled?: boolean
  className?: string
  headerClassName?: string
  bodyClassName?: string
  footerClassName?: string
  actions?: any[]
  data?: any
}

/**
 * Dialog 配置
 */
export interface OuroborosDialogSchema extends BaseDialogSchema {
  type?: string
  url?: string
  schemaId?: string
  body?: any // SchemaNode
  resizable?: boolean
  sizeSwitchable?: boolean
  sizeOptions?: Array<'' | 'sm' | 'md' | 'lg' | 'xl' | 'full'>
  onConfirm?: (values: any[]) => void
  onClose?: () => void
}

/**
 * Drawer 配置
 */
export interface OuroborosDrawerSchema extends BaseDialogSchema {
  type?: string
  url?: string
  schemaId?: string
  body?: any // SchemaNode
  position?: 'left' | 'right' | 'top' | 'bottom'
  overlay?: boolean
  resizable?: boolean
  width?: number | string
  height?: number | string
  onConfirm: (values: any[]) => void
  onClose: () => void
}

/**
 * Modal 上下文
 */
export interface OuroborosModalContext {
  [fieldName: string]: any
}

/**
 * 微前端初始化参数 - initMicroApp
 */
export interface InitMicroAppOptions {
  /**
   * 渲染函数，必须返回一个实例（vue实例或者react组件）
   */
  render?: (props: MicroAppCommonProps) => Promise<any>
  /**
   * 挂载前钩子
   */
  beforeMount?: (props: MicroAppCommonProps) => Promise<void>
  /**
   * 挂载后钩子
   */
  afterMount?: (props: MicroAppCommonProps) => Promise<void>
  /**
   * 更新后钩子
   */
  afterUpdate?: (props: MicroAppCommonProps) => Promise<void>
  /**
   * 卸载后钩子
   */
  afterUnmount?: (props: MicroAppCommonProps, instance: any) => Promise<void>
  /**
   * 初始化钩子
   */
  onBootstrap?: () => Promise<void>
}

/**
 * 布局组件初始化参数 - initLayoutComponent
 */
export interface InitLayoutComponentOptions {
  /**
   * 渲染函数，必须返回一个实例（vue实例或者react组件）
   */
  render?: (props: MicroAppCommonProps) => Promise<any>
  /**
   * 挂载前钩子
   */
  beforeMount?: (props: MicroAppCommonProps) => Promise<void>
  /**
   * 更新后钩子
   */
  afterUpdate?: (props: MicroAppCommonProps) => Promise<void>
  /**
   * 卸载后钩子
   */
  afterUnmount?: (props: MicroAppCommonProps, instance: any) => Promise<void>
  /**
   * 初始化钩子
   */
  onBootstrap?: () => Promise<void>
}

/**
 * Amis 组件库初始化参数 - initAmisComponentLib
 */
export interface InitAmisComponentLibOptions {
  /**
   * 挂载前钩子
   */
  beforeMount?: (props: MicroAppCommonProps) => Promise<void>
  /**
   * 更新后钩子
   */
  afterUpdate?: (props: MicroAppCommonProps) => Promise<void>
  /**
   * 卸载后钩子
   */
  afterUnmount?: (props: MicroAppCommonProps, instance: any) => Promise<void>
  /**
   * 初始化钩子
   */
  onBootstrap?: () => Promise<void>
}

/**
 * 菜单徽标类型
 */
export type MenuBadgeTone = 'danger' | 'warning' | 'success' | 'info' | 'neutral'

export interface MenuBadgeBase {
  /** 语义色，缺省 danger；color 优先于 tone */
  tone?: MenuBadgeTone
  /** 自定义颜色（CSS 色值），覆盖 tone */
  color?: string
}

export type MenuBadge =
  | ({ type: 'number'; value: number; max?: number; showZero?: boolean } & MenuBadgeBase)
  | ({ type: 'dot' } & MenuBadgeBase)
  | ({ type: 'text'; text: string } & MenuBadgeBase)
  | ({ type: 'ribbon'; text: string; position?: 'top-left' | 'top-right' } & MenuBadgeBase)

export type MenuScope = 'main' | 'secondary' | 'all'

/**
 * 菜单项信息（查询 / 遍历输出形态，含徽标状态）
 */
export interface MenuItemInfo {
  fullName?: string // 菜单全名（寻址主键；addMenuItem 时必填）
  key?: string
  title?: string
  displayTitle?: string
  path?: string
  url?: string
  fullPath?: string
  icon?: any
  showMode?: string
  opened?: boolean
  active?: boolean
  parent?: string
  /** flat 拍平输出时的层级，根为 1 */
  level?: number
  children?: MenuItemInfo[]
  /** 徽标状态（查询 / 遍历时返回） */
  badge?: MenuBadge
}

export interface MenuTreeResult {
  main?: MenuItemInfo[]
  secondary?: MenuItemInfo[]
}

export interface GetMenusOptions {
  scope?: MenuScope
  flat?: boolean
}

export interface AddMenuItemOptions {
  scope: 'main' | 'secondary'
  item: MenuItemInfo
  /** 父菜单引用（fullName/path 等），缺省追加到对应 scope 根 */
  parentFullName?: string
  /** 在父节点 children 中的插入位置，缺省追加到末尾 */
  index?: number
}

/**
 * 用户菜单项上下文（注册项的 visible / onClick 渲染时注入）
 */
export interface UserMenuContext {
  userInfo: any
  theme: string
  themeList: string[]
  isLockTheme: boolean
  lockTheme: string
  dispatch: (action: string, payload?: any) => Promise<unknown> | unknown
  openDialog: (schema: any, ctx?: any) => Promise<any>
}

/**
 * 用户菜单注册项
 */
export interface UserMenuItem {
  /** 注册返回的唯一 id（register 时可不传） */
  id?: string
  /** 稳定业务键：同 key 重复注册视为覆盖（幂等） */
  key?: string
  title: string
  icon?: string
  /** 升序渲染，缺省 100 */
  order?: number
  /** 用户菜单项徽标（复用徽标机制） */
  badge?: MenuBadge
  /** 分组线 */
  divider?: boolean
  visible?: (ctx: UserMenuContext) => boolean
  disabled?: (ctx: UserMenuContext) => boolean
  /** 点击后收起下拉，缺省 true */
  closeOnClick?: boolean
  onClick: (ctx: UserMenuContext) => void | Promise<void>
}

/**
 * 菜单 API（徽标 + 菜单树查询 / 遍历 / 增删）
 */
export interface MenuApi {
  /** 设置 / 修改 / 清除菜单徽标；badge 为 null 时清除 */
  setMenuBadge(fullName: string, badge: MenuBadge | null): void
  getMenuBadge(fullName: string): MenuBadge | undefined
  getMenu(ref: string): MenuItemInfo | undefined
  getMenus(options?: GetMenusOptions): MenuItemInfo[] | MenuTreeResult
  traverseMenus(
    visitor: (item: MenuItemInfo, parents: MenuItemInfo[]) => boolean | void,
    options?: { scope?: MenuScope }
  ): void
  addMenuItem(options: AddMenuItemOptions): boolean
  removeMenuItem(ref: string): boolean
}

/**
 * 用户菜单 API（注册 / 移除 / 查询遍历）
 */
export interface UserMenuApi {
  /**
   * 注册用户菜单项，返回 id。
   * @param item 注册项
   * @param owner 注册归属（微应用名）；SDK 内部自动传入，普通调用方无需关心
   */
  register(item: UserMenuItem, owner?: string): string
  unregister(id: string): void
  getItems(): UserMenuItem[]
  unregisterAll(owner: string): void
}

/**
 * 微前端生命周期函数
 */
export interface MicroAppLifecycle {
  mount: (props: MicroAppCommonProps) => Promise<void>
  unmount: (props: MicroAppCommonProps) => Promise<void>
  update: (props: MicroAppCommonProps) => Promise<void>
  bootstrap: () => Promise<void>
}
