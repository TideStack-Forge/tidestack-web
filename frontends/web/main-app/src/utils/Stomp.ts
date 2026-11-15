// 引入 stompjs
import { Client, IMessage, IPublishParams } from '@stomp/stompjs'
// 引入 SockJS
import SockJS from 'sockjs-client'
import { store } from '@/store/storeFacade'
import { Deferred } from '@/utils/Deferred'
import { EventBus } from '@/common/eventBus'

interface Message {
  destination: string
  body: any
  headers: { [key: string]: string }
}

type SubscribeWithInitialMessageListener = (message: any, rawMessage: IMessage) => void

export interface SubscribeInitialOptions {
  initialDestination?: string
  createInitialRequest?: () => any
  initialBody?: any
  initialTimeoutMs?: number
  splitInitialHandlers?: boolean
  onInitialData?: SubscribeWithInitialMessageListener
  onInitialLive?: SubscribeWithInitialMessageListener
  onInitialComplete?: (message: any, rawMessage: IMessage) => void
  onInitialError?: (message: any, rawMessage: IMessage) => void
}

export interface SubscribeOptions extends SubscribeInitialOptions {
  keepSingleListener?: boolean
}

export type SubscribeWithInitialOptions = SubscribeOptions

export interface SubscribeWithInitialHandle {
  bootstrapDone: Promise<void>
  unsubscribe: () => void
}

type BootstrapFrame = {
  kind?: string
  subscriptionToken?: string
  payload?: any
}

type SubscribeWithInitialCycle = {
  token: string
  bootstrapQueueDestination: string
  bootstrapDone: Deferred<void>
  timeoutTimer: ReturnType<typeof setTimeout> | null
  liveUnsubscribe: (() => void) | null
  bootstrapUnsubscribe: (() => void) | null
  reconnectUnsubscribe: (() => void) | null
  bootstrapRequestSent: boolean
  settled: boolean
}

type SubscribeWithInitialState = {
  active: boolean
  handle: SubscribeWithInitialHandle
  cycle: SubscribeWithInitialCycle | null
  reconnectUnsubscribe: (() => void) | null
}

const subscriptions: {
  [destination: string]: {
    unsubscribe?: () => void
    listeners: ((message: any, rawMessage: IMessage) => void)[]
  }
} = {}

const subscribeWithInitialStates: {
  [handleId: string]: SubscribeWithInitialState
} = {}

let subscribeWithInitialId = 0
let subscribeWithInitialCycleId = 0

const cachedMessages: Message[] = []

let isAuthenticated = false

// 标记是否曾经连接过，用于区分首次连接和重连
let hasConnectedBefore = false

let connectingDeferred: Deferred<void> | null = null

/**
 * 获取 WebSocket 连接地址
 * 优先使用 sessionStorage 中的 apiHost，其次使用环境变量
 */
function getWebSocketUrl(): string {
  // 优先从 sessionStorage 读取 apiHost（与 HTTP 请求保持一致）
  const apiHost =
    (typeof window !== 'undefined' &&
      window.sessionStorage &&
      window.sessionStorage.getItem('apiHost')) ||
    process.env.VUE_APP_API_HOST

  // 如果 apiHost 存在且不是相对路径，则使用完整 URL
  if (apiHost && apiHost !== '/' && !apiHost.startsWith('/')) {
    // 移除末尾的斜杠
    const baseUrl = apiHost.replace(/\/$/, '')
    return `${baseUrl}/websocket/stomp`
  }

  // 否则使用相对路径（默认行为）
  return '/websocket/stomp'
}

const stompClient = new Client({
  // 使用工厂函数，每次连接时动态获取 URL
  webSocketFactory: () => new SockJS(getWebSocketUrl()),
  // 自动重连配置
  reconnectDelay: 5000, // 断开后5秒自动重连
  heartbeatIncoming: 4000, // 接收心跳间隔（毫秒）
  heartbeatOutgoing: 4000, // 发送心跳间隔（毫秒）
})

// 登录成功后执行
function afterAuthenticated() {
  isAuthenticated = true

  // 重新订阅（重连场景，需要强制重新订阅）
  for (const destination in subscriptions) {
    if (!needAuthSubscribeDest(destination)) continue
    doSubscribe(destination, true) // 传入 true 表示是重连
  }

  // 发送缓存的消息
  while (cachedMessages.length > 0) {
    const message = cachedMessages.shift()
    if (message && needAuthSendDest(message.destination)) doSend(message)
  }
}

// 连接后执行
function afterConnected() {
  // 订阅无需登录的消息（重连场景，需要强制重新订阅）
  for (const destination in subscriptions) {
    if (needAuthSubscribeDest(destination)) continue
    doSubscribe(destination, true) // 传入 true 表示是重连
  }

  // 发送缓存的消息
  let i = 0
  while (i < cachedMessages.length) {
    const message = cachedMessages[i]
    // 如果需要认证，跳过这条消息
    if (needAuthSendDest(message?.destination)) {
      i++
      continue
    }
    // 发送并移除这条消息
    cachedMessages.splice(i, 1)
    if (message) doSend(message)
  }
}

// 连接之前获取 accessToken
stompClient.beforeConnect = () => {
  const accessToken = getAccessToken()
  if (!accessToken) {
    if (stompClient.connectHeaders?.token) {
      const restHeaders = { ...stompClient.connectHeaders }
      delete restHeaders.token
      stompClient.connectHeaders = restHeaders
    }
    isAuthenticated = false
    return
  }
  stompClient.connectHeaders = {
    ...(stompClient.connectHeaders ?? {}),
    token: accessToken,
  }
}

// 连接后执行订阅和发送消息
stompClient.onConnect = (message: IMessage) => {
  const isReconnect = hasConnectedBefore

  if (isReconnect) {
    console.log('[Stomp] 重连成功')
  } else {
    console.log('[Stomp] 连接成功')
    hasConnectedBefore = true
  }

  afterConnected()

  if (message?.headers?.['user-name']) {
    afterAuthenticated()
  }

  // 在恢复订阅后再发布连接成功事件，确保依赖订阅已可用。
  EventBus.publish('stomp:connected', {
    isReconnect,
    timestamp: Date.now(),
    message,
  })

  // 连接成功，resolve 并清空 deferred
  connectingDeferred?.resolve()
  connectingDeferred = null
}

// WebSocket 连接关闭时触发
stompClient.onWebSocketClose = () => {
  console.log('[Stomp] WebSocket 连接已关闭，将自动重连')
  isAuthenticated = false
  // 发布断开连接事件
  EventBus.publish('stomp:disconnected', { timestamp: Date.now() })
}

// STOMP 错误处理
stompClient.onStompError = (frame: IMessage) => {
  console.error('[Stomp] STOMP 错误:', frame.headers?.message || frame.body)
}

// 断开连接时触发
stompClient.onDisconnect = () => {
  console.log('[Stomp] 已断开连接')
  isAuthenticated = false
}

function needAuthSubscribeDest(destination: string) {
  return destination.startsWith('/user/')
}

function needAuthSendDest() {
  return false
}

function getAccessToken() {
  return store.getters.accessToken?.token
}

function addListener(
  destination: string,
  listener: (message: any, rawMessage: IMessage) => void
) {
  const sub = subscriptions[destination] || { listeners: [] }
  subscriptions[destination] = sub
  if (sub.listeners.includes(listener)) return
  sub.listeners.push(listener)
}

function removeListener(
  destination: string,
  listener?: (message: any, rawMessage: IMessage) => void
) {
  const listeners = subscriptions[destination]?.listeners
  if (!listeners) return
  if (!listener) {
    delete subscriptions[destination]
    return
  }

  const index = listeners.indexOf(listener)
  if (~index) listeners.splice(index, 1)

  if (listeners.length === 0) {
    const sub = subscriptions[destination] // 获取订阅
    sub?.unsubscribe?.() // 取消服务端订阅
    delete subscriptions[destination] // 然后删除本地记录
  }
}

function createBootstrapRequestBody(options: SubscribeWithInitialOptions) {
  const requestBody = options.createInitialRequest
    ? options.createInitialRequest()
    : options.initialBody

  if (requestBody && typeof requestBody === 'object' && !Array.isArray(requestBody)) {
    return requestBody
  }

  return {
    body: requestBody,
  }
}

function createBootstrapRequestHeaders(token: string) {
  return {
    subscriptionToken: token,
  }
}

function resolveSubscribeWithInitialHandlers(
  options: SubscribeWithInitialOptions,
  listener: SubscribeWithInitialMessageListener
) {
  if (!options.splitInitialHandlers) {
    return {
      onLive: listener,
      onBootstrapData: listener,
    }
  }

  return {
    onLive: options.onInitialLive ?? listener,
    onBootstrapData: options.onInitialData ?? listener,
  }
}

const INITIAL_SUBSCRIBE_OPTION_KEYS: (keyof SubscribeInitialOptions)[] = [
  'initialDestination',
  'createInitialRequest',
  'initialBody',
  'initialTimeoutMs',
  'splitInitialHandlers',
  'onInitialData',
  'onInitialLive',
  'onInitialComplete',
  'onInitialError',
]

function hasInitialSubscribeOptions(options?: SubscribeOptions) {
  if (!options) return false
  return INITIAL_SUBSCRIBE_OPTION_KEYS.some((key) =>
    Object.prototype.hasOwnProperty.call(options, key)
  )
}

function resolveSubscribeOptions(
  keepSingleListenerOrOptions?: boolean | SubscribeOptions
) {
  if (typeof keepSingleListenerOrOptions === 'boolean') {
    return {
      keepSingleListener: keepSingleListenerOrOptions,
      initial: undefined,
    }
  }

  return {
    keepSingleListener: keepSingleListenerOrOptions?.keepSingleListener ?? true,
    initial: hasInitialSubscribeOptions(keepSingleListenerOrOptions)
      ? keepSingleListenerOrOptions
      : undefined,
  }
}

function toSubscribeWithInitialOptions(
  initial: SubscribeInitialOptions,
  keepSingleListener: boolean
): SubscribeWithInitialOptions {
  return {
    initialDestination: initial.initialDestination,
    createInitialRequest: initial.createInitialRequest,
    initialBody: initial.initialBody,
    initialTimeoutMs: initial.initialTimeoutMs,
    keepSingleListener,
    splitInitialHandlers: initial.splitInitialHandlers,
    onInitialLive: initial.onInitialLive,
    onInitialData: initial.onInitialData,
    onInitialComplete: initial.onInitialComplete,
    onInitialError: initial.onInitialError,
  }
}

const STOMP_DESTINATION_PATH_RE =
  /^\/((?:[^/\\.\s]+\/)*[^/\\.\s]+)$/

const STOMP_INIT_DESTINATION_RE =
  /^\/app\/((?:[^/\\.\s]+\/)*[^/\\.\s]+)\/init$/

type StompDestinationDescriptor = {
  routePath: string
}

function parseStompDestination(
  destination: string,
  destinationType: 'live destination' | 'init destination'
): StompDestinationDescriptor {
  const destinationMatch = destination.match(STOMP_DESTINATION_PATH_RE)
  if (destinationMatch?.[1]) {
    return {
      routePath: destinationMatch[1],
    }
  }

  throw new Error(`subscribeWithInitial 需要合法的 ${destinationType}: ${destination}`)
}

function parseInitDestination(destination: string): StompDestinationDescriptor {
  const initMatch = destination.match(STOMP_INIT_DESTINATION_RE)
  if (initMatch?.[1]) {
    return {
      routePath: initMatch[1],
    }
  }

  throw new Error(`subscribeWithInitial 需要合法的 init destination: ${destination}`)
}

export function isStompInitDestination(destination: string) {
  return STOMP_INIT_DESTINATION_RE.test(destination)
}

function inferInitialDestination(destination: string) {
  parseStompDestination(destination, 'live destination')
  return `/app${destination}/init`
}

function resolveInitialDestination(
  destination: string,
  options: SubscribeWithInitialOptions
) {
  if (!options.initialDestination) {
    return inferInitialDestination(destination)
  }

  parseInitDestination(options.initialDestination)
  return options.initialDestination
}

function getBootstrapQueueDestination(destination: string, token: string) {
  parseStompDestination(destination, 'live destination')
  return `/queue/init${destination}/${token}`
}

function clearBootstrapCycleTimer(cycle: SubscribeWithInitialCycle) {
  if (cycle.timeoutTimer) {
    clearTimeout(cycle.timeoutTimer)
    cycle.timeoutTimer = null
  }
}

function cleanupBootstrapCycleSubscriptions(cycle: SubscribeWithInitialCycle) {
  if (cycle.bootstrapUnsubscribe) {
    cycle.bootstrapUnsubscribe()
    cycle.bootstrapUnsubscribe = null
  }

  if (cycle.liveUnsubscribe) {
    cycle.liveUnsubscribe()
    cycle.liveUnsubscribe = null
  }
}

function settleBootstrapCycle(
  cycle: SubscribeWithInitialCycle,
  status: 'resolve' | 'reject',
  reason?: any
) {
  if (cycle.settled) return
  cycle.settled = true
  clearBootstrapCycleTimer(cycle)
  if (status === 'resolve') {
    cycle.bootstrapDone.resolve()
  } else {
    cycle.bootstrapDone.reject(reason)
  }
  cycle.bootstrapUnsubscribe?.()
  cycle.bootstrapUnsubscribe = null
}

function startBootstrapCycle(
  handleId: string,
  destination: string,
  listener: SubscribeWithInitialMessageListener,
  options: SubscribeWithInitialOptions
) {
  const state = subscribeWithInitialStates[handleId]
  if (!state || !state.active) return

  const previousCycle = state.cycle
  if (previousCycle) {
    settleBootstrapCycle(
      previousCycle,
      'reject',
      new Error('subscribeWithInitial 周期已失效')
    )
    cleanupBootstrapCycleSubscriptions(previousCycle)
    previousCycle.reconnectUnsubscribe?.()
    previousCycle.reconnectUnsubscribe = null
  }

  const bootstrapDone = new Deferred<void>()
  bootstrapDone.promise.catch(() => undefined)
  const token = `${++subscribeWithInitialCycleId}-${handleId}`
  const resolvedInitialDestination = resolveInitialDestination(destination, options)
  const bootstrapQueueDestination = getBootstrapQueueDestination(destination, token)
  const cycle: SubscribeWithInitialCycle = {
    token,
    bootstrapQueueDestination,
    bootstrapDone,
    timeoutTimer: null,
    liveUnsubscribe: null,
    bootstrapUnsubscribe: null,
    reconnectUnsubscribe: null,
    bootstrapRequestSent: false,
    settled: false,
  }

  state.cycle = cycle
  state.handle.bootstrapDone = bootstrapDone.promise

  const { onLive, onBootstrapData } = resolveSubscribeWithInitialHandlers(
    options,
    listener
  )

  const keepSingleListener = options.keepSingleListener ?? true

  cycle.liveUnsubscribe = subscribe(
    destination,
    (message, rawMessage) => {
      if (!state.active || state.cycle !== cycle) return
      onLive(message, rawMessage)
    },
    keepSingleListener
  )

  cycle.bootstrapUnsubscribe = subscribe(
    bootstrapQueueDestination,
    (message, rawMessage) => {
      if (!state.active || state.cycle !== cycle || cycle.settled) return
      const frame = message as BootstrapFrame
      if (!frame || frame.subscriptionToken !== cycle.token) return

      if (frame.kind === 'init-data') {
        onBootstrapData(frame.payload, rawMessage)
        return
      }

      if (frame.kind === 'init-complete') {
        options.onInitialComplete?.(frame.payload, rawMessage)
        settleBootstrapCycle(cycle, 'resolve')
        return
      }

      if (frame.kind === 'init-error') {
        const error =
          frame.payload instanceof Error ? frame.payload : new Error('init-error')
        options.onInitialError?.(frame.payload, rawMessage)
        settleBootstrapCycle(cycle, 'reject', error)
        cleanupBootstrapCycleSubscriptions(cycle)
        if (state.cycle === cycle) {
          state.cycle = null
        }
      }
    },
    keepSingleListener
  )

  cycle.timeoutTimer = setTimeout(() => {
    if (state.active && state.cycle === cycle && !cycle.settled) {
      settleBootstrapCycle(
        cycle,
        'reject',
        new Error('subscribeWithInitial bootstrap 超时')
      )
      cleanupBootstrapCycleSubscriptions(cycle)
      state.cycle = null
    }
  }, options.initialTimeoutMs ?? 30000)

  const sendBootstrapRequest = () => {
    if (!state.active || state.cycle !== cycle || cycle.bootstrapRequestSent) return
    cycle.bootstrapRequestSent = true
    send(
      resolvedInitialDestination,
      createBootstrapRequestBody(options),
      createBootstrapRequestHeaders(token)
    )
  }

  state.reconnectUnsubscribe?.()
  state.reconnectUnsubscribe = onStompConnected(({ isReconnect }) => {
    if (!state.active) return
    if (isReconnect) {
      startBootstrapCycle(handleId, destination, listener, options)
      return
    }
    sendBootstrapRequest()
  })
  cycle.reconnectUnsubscribe = state.reconnectUnsubscribe

  if (stompClient.connected) {
    sendBootstrapRequest()
  }
}

export function subscribeWithInitial(
  destination: string,
  listener: SubscribeWithInitialMessageListener,
  options?: SubscribeWithInitialOptions
) {
  const resolvedOptions = options ?? ({} as SubscribeWithInitialOptions)
  const initialDestination = resolveInitialDestination(destination, resolvedOptions)

  const handleId = `${++subscribeWithInitialId}`
  const handle: SubscribeWithInitialHandle = {
    bootstrapDone: Promise.resolve(),
    unsubscribe: () => {
      const state = subscribeWithInitialStates[handleId]
      if (!state || !state.active) return

      state.active = false
      state.reconnectUnsubscribe?.()
      state.reconnectUnsubscribe = null

      const cycle = state.cycle
      if (cycle) {
        clearBootstrapCycleTimer(cycle)
        cleanupBootstrapCycleSubscriptions(cycle)
        if (!cycle.settled) {
          settleBootstrapCycle(cycle, 'reject', new Error('subscribeWithInitial 已取消'))
        }
      }

      delete subscribeWithInitialStates[handleId]
    },
  }

  subscribeWithInitialStates[handleId] = {
    active: true,
    handle,
    cycle: null,
    reconnectUnsubscribe: null,
  }

  startBootstrapCycle(handleId, destination, listener, {
    ...resolvedOptions,
    initialDestination,
  })
  return handle
}

// 发送缓存的消息
function doSend(message: Message) {
  const headers = message.headers ?? {}
  const msg: IPublishParams = {
    destination: message.destination,
    headers,
  }

  // 如果body是二进制数据，则需要设置content-type头
  if (typeof message.body === 'object' && message.body instanceof Uint8Array) {
    msg.binaryBody = message.body
    headers['content-type'] = 'application/octet-stream'
  } else {
    msg.body =
      typeof message.body === 'string' ? message.body : JSON.stringify(message.body)
    headers['content-type'] = 'application/json'
  }
  stompClient.publish(msg)
}

// 订阅
function doSubscribe(destination: string, forceResubscribe: boolean = false) {
  // 如果是强制重新订阅（重连场景），先取消已有的服务端订阅
  if (forceResubscribe) {
    const existingSub = subscriptions[destination]
    if (existingSub?.unsubscribe) {
      existingSub.unsubscribe()
    }
  }
  // 如果是正常订阅且已有服务端订阅，直接复用，不重复订阅
  else if (subscriptions[destination]?.unsubscribe) {
    return
  }

  const subResult = stompClient.subscribe(destination, (rawMessage: IMessage) => {
    const sub = subscriptions[destination]
    if (!sub || !sub.listeners?.length) return
    const listeners = sub.listeners
    const contentType = rawMessage.headers['content-type']
    let msg: any
    if (contentType === 'application/octet-stream') {
      msg = rawMessage.binaryBody
    } else if (contentType === 'application/json') {
      msg = JSON.parse(rawMessage.body)
    } else {
      msg = rawMessage.body
    }
    for (const listener of listeners) {
      listener(msg, rawMessage)
    }
  })
  const sub = subscriptions[destination] || { listeners: [] }
  subscriptions[destination] = sub
  sub.unsubscribe = subResult.unsubscribe
}

// 检查是否登录，若未登录则检查 accessToken，若有 accessToken 则重新连接
async function login() {
  if (isAuthenticated) {
    return
  }
  const accessToken = getAccessToken()
  if (accessToken) {
    return await reconnect()
  }
}

/**
 * 订阅主题
 * @param topic 订阅的主题
 * @param listener 消息监听器
 * @param keepSingleListener 是否保持单一的监听器，即订阅同一个目的地时，之前的监听器会被移除，默认为 true
 */
export function subscribeTopic(
  topic: string,
  listener: (message: any, rawMessage: IMessage) => void,
  keepSingleListenerOrOptions: boolean | SubscribeOptions = true
) {
  return subscribe(
    '/topic' + (topic.startsWith('/') ? '' : '/') + topic,
    listener,
    keepSingleListenerOrOptions
  )
}

/**
 * 订阅点对点队列
 * @param queue 点对点队列名称
 * @param listener 消息监听器
 * @param keepSingleListener 是否保持单一的监听器，即订阅同一个目的地时，之前的监听器会被移除，默认为 true
 */
export function subscribeQueue(
  queue: string,
  listener: (message: any, rawMessage: IMessage) => void,
  keepSingleListenerOrOptions: boolean | SubscribeOptions = true
) {
  return subscribe(
    '/queue' + (queue.startsWith('/') ? '' : '/') + queue,
    listener,
    keepSingleListenerOrOptions
  )
}

/**
 * 订阅主题
 * @param topic 订阅的主题
 * @param listener 消息监听器
 * @param keepSingleListener 是否保持单一的监听器，即订阅同一个目的地时，之前的监听器会被移除，默认为 true
 */
export function subscribeUserTopic(
  topic: string,
  listener: (message: any, rawMessage: IMessage) => void,
  keepSingleListenerOrOptions: boolean | SubscribeOptions = true
) {
  return subscribe(
    '/user/topic' + (topic.startsWith('/') ? '' : '/') + topic,
    listener,
    keepSingleListenerOrOptions
  )
}

/**
 * 订阅消息
 * @param destination 订阅的目的地
 * @param listener 消息监听器
 * @param keepSingleListener 是否保持单一的监听器，即订阅同一个目的地时，之前的监听器会被移除，默认为 true
 */
export function subscribe(
  destination: string,
  listener: (message: any, rawMessage: IMessage) => void,
  keepSingleListenerOrOptions: boolean | SubscribeOptions = true
) {
  const { keepSingleListener, initial } = resolveSubscribeOptions(
    keepSingleListenerOrOptions
  )

  if (initial) {
    const handle = subscribeWithInitial(
      destination,
      listener,
      toSubscribeWithInitialOptions(initial, keepSingleListener)
    )
    return handle.unsubscribe
  }

  const isNewSubscription = !subscriptions[destination]
  if (keepSingleListener) {
    const sub = subscriptions[destination]
    if (sub) {
      sub.listeners = [listener]
    } else {
      subscriptions[destination] = { listeners: [listener] }
    }
  } else {
    addListener(destination, listener)
  }

  // 如果需要登录且未登录，则触发登录动作
  if (needAuthSubscribeDest(destination) && !isAuthenticated) {
    login()
  }
  // 如果未激活，则激活
  else if (!stompClient.active) {
    connect()
  }

  // 如果未连接，则跳出（在连接成功后会自动订阅）
  // 返回取消订阅函数
  if (!stompClient.connected) {
    return () => unsubscribe(destination, listener)
  }

  // 如果不是新订阅的，则跳出
  if (!isNewSubscription) return () => unsubscribe(destination, listener)

  // 订阅 destination
  doSubscribe(destination)

  return () => unsubscribe(destination, listener)
}

/**
 * 取消订阅主题
 * @param topic 订阅的主题
 * @param listener 取消订阅的监听器，留空则取消该主题的所有监听器
 */
export function unsubscribeTopic(
  topic: string,
  listener?: (message: any, rawMessage: IMessage) => void
) {
  unsubscribe('/topic' + (topic.startsWith('/') ? '' : '/') + topic, listener)
}

/**
 * 取消订阅点对点队列
 * @param queue 点对点队列名称
 * @param listener 取消订阅的监听器，留空则取消该队列的所有监听器
 */
export function unsubscribeQueue(
  queue: string,
  listener?: (message: any, rawMessage: IMessage) => void
) {
  unsubscribe('/queue' + (queue.startsWith('/') ? '' : '/') + queue, listener)
}

/**
 * 取消订阅用户主题
 * @param topic 订阅的主题
 * @param listener 取消订阅的监听器，留空则取消该主题的所有监听器
 */
export function unsubscribeUserTopic(
  topic: string,
  listener?: (message: any, rawMessage: IMessage) => void
) {
  unsubscribe('/user/topic' + (topic.startsWith('/') ? '' : '/') + topic, listener)
}

/**
 * 取消订阅
 * @param destination 取消订阅的目的地
 * @param listener 取消订阅的监听器，留空则取消该目的地的所有监听器
 */
export function unsubscribe(
  destination: string,
  listener?: (message: any, rawMessage: IMessage) => void
) {
  const sub = subscriptions[destination]
  // 如果不存在订阅，则跳出
  if (!sub) return

  // 移除 listener
  removeListener(destination, listener)

  // 如果未连接，则不需要取消订阅
  if (!stompClient.connected) return
}

/**
 * 取消订阅所有
 */
export function unsubscribeAll() {
  for (const destination in subscriptions) {
    unsubscribe(destination)
  }
}

/**
 * 取消订阅所有主题
 */
export function unsubscribeAllTopics() {
  for (const destination in subscriptions) {
    if (destination.startsWith('/topic/')) {
      unsubscribe(destination)
    }
  }
}

/**
 * 取消订阅所有点对点队列
 */
export function unsubscribeAllQueues() {
  for (const destination in subscriptions) {
    if (destination.startsWith('/queue/')) {
      unsubscribe(destination)
    }
  }
}

/**
 * 取消订阅所有用户主题
 */
export function unsubscribeAllUserTopics() {
  for (const destination in subscriptions) {
    if (destination.startsWith('/user/topic/')) {
      unsubscribe(destination)
    }
  }
}

/**
 * 发送二进制消息
 * @param destination 目的地
 * @param body 消息体
 * @param headers 消息头
 * @returns Promise<void>
 */
export async function sendBinary(destination: string, body: Uint8Array, headers?: any) {
  return await send(destination, body, headers)
}

/**
 * 发送文本消息
 * @param destination 目的地
 * @param body 消息体
 * @param headers 消息头
 * @returns Promise<void>
 */
export async function sendText(destination: string, body: string, headers?: any) {
  return await send(destination, body, headers)
}

/**
 * 发送 JSON 消息
 * @param destination 目的地
 * @param body 消息体
 * @param headers 消息头
 * @returns Promise<void>
 */
export async function sendJson(destination: string, body: any, headers?: any) {
  return await send(destination, body, headers)
}

/**
 * 发送消息
 * @param destination 目的地
 * @param body 消息体
 * @param headers 消息头
 * @returns Promise<void>
 */
export async function send(destination: string, body: any, headers?: any) {
  // 未连接，则先缓存消息，再触发连接
  if (!stompClient.connected) {
    cachedMessages.push({ destination, body, headers })
    return await connect()
  }

  // 已连接则直接发送消息
  doSend({ destination, body, headers })
}

/**
 * 连接服务器
 * @returns Promise<void>
 */
export async function connect() {
  // 如果正在连接，返回现有的 Promise
  if (stompClient.active && connectingDeferred) {
    return connectingDeferred.promise
  }

  // 如果已连接，直接返回
  if (stompClient.connected) {
    return Promise.resolve()
  }

  // 创建新的连接
  if (!stompClient.active) {
    connectingDeferred = new Deferred()
    stompClient.activate()
  }

  return connectingDeferred?.promise
}

/**
 * 断开连接
 * @param force 是否强制断开连接
 * @returns Promise<void>
 */
export async function disconnect(force: boolean = false) {
  if (!force && Object.keys(subscriptions).length > 0) {
    return
  }
  if (!stompClient.active) return
  return await stompClient.deactivate()
}

/**
 * 重新连接
 * @returns {Promise<void>}
 */
export async function reconnect() {
  if (stompClient.active) {
    await disconnect(true)
  }
  return await connect()
}

/**
 * 订阅 Stomp 连接成功事件（包括首次连接和重连）
 * @param handler 事件处理函数
 * @returns 取消订阅的函数
 */
export function onStompConnected(
  handler: (data: { isReconnect: boolean; timestamp: number; message: any }) => void
) {
  EventBus.subscribe('stomp:connected', handler)
  return () => EventBus.unsubscribe('stomp:connected', handler)
}

/**
 * 订阅 Stomp 断开连接事件
 * @param handler 事件处理函数
 * @returns 取消订阅的函数
 */
export function onStompDisconnected(handler: (data: { timestamp: number }) => void) {
  EventBus.subscribe('stomp:disconnected', handler)
  return () => EventBus.unsubscribe('stomp:disconnected', handler)
}

/**
 * 检查 Stomp 是否已连接
 * @returns 是否已连接
 */
export function isConnected(): boolean {
  return stompClient.connected
}

/**
 * 检查 Stomp 是否已激活（包括正在连接和已连接状态）
 * @returns 是否已激活
 */
export function isActive(): boolean {
  return stompClient.active
}

/**
 * 检查 Stomp 是否已认证
 * @returns 是否已认证
 */
export function isStompAuthenticated(): boolean {
  return isAuthenticated
}
