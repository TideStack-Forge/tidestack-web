// 常量定义
const REPLAY_STORAGE_KEY = 'OuroborosReplayEvents'

// 枚举定义
export enum ReplayScope {
  LOCAL = 'LOCAL',
  SESSION = 'SESSION'
}

// 类型定义
export type EventHandler<T = any> = (data: T) => void
export type EventFilter<T = any> = (data: T) => boolean

export interface EventHandlerConfig<T = any> {
  filter: EventFilter<T>
  handler: EventHandler<T>
}

export interface PublishOptions {
  replayScope?: ReplayScope | keyof typeof ReplayScope
  replayStage?: string
}

export interface ReplayEvent {
  event: string
  data: any
  replayStage?: string
}

export interface EventBusType {
  eventsHandlers: Record<string, EventHandlerConfig[]>
  subscribeOnce<T = any>(event: string, handler: EventHandler<T>, filter?: EventFilter<T>): void
  subscribe<T = any>(event: string, handler: EventHandler<T>, filter?: EventFilter<T>): void
  unsubscribe<T = any>(event: string, handler: EventHandler<T>): void
  unsubscribeAll(event: string): void
  publish<T = any>(event: string, data: T, options?: PublishOptions): void
  removeAllReplayEvents(replayScope?: ReplayScope | keyof typeof ReplayScope | 'ALL'): void
  removeReplayEvent(event: string, replayScope: ReplayScope | keyof typeof ReplayScope): void
}

export const EventBus = {
  eventsHandlers: {} as Record<string, EventHandlerConfig[]>,

  /**
   * 一次性订阅
   * @param event - 事件名
   * @param handler - 事件处理函数
   * @param filter - 过滤函数，默认返回true
   */
  subscribeOnce<T = any>(
    event: string, 
    handler: EventHandler<T>, 
    filter: EventFilter<T> = () => true
  ): void {
    const onceHandler: EventHandler<T> = (data: T) => {
      handler(data)
      this.unsubscribe(event, onceHandler)
    }
    this.subscribe(event, onceHandler, filter)
  },

  /**
   * 订阅事件
   * @param event - 事件名
   * @param handler - 事件处理函数
   * @param filter - 过滤函数，默认返回true
   */
  subscribe<T = any>(
    event: string, 
    handler: EventHandler<T>, 
    filter: EventFilter<T> = () => true
  ): void {
    if (!this.eventsHandlers[event]) {
      this.eventsHandlers[event] = []
    }
    
    // 如果已经订阅过了，就不再订阅
    if (this.eventsHandlers[event].some((h) => h.handler === handler)) {
      return
    }
    
    this.eventsHandlers[event].push({ filter, handler })
  },

  /**
   * 取消订阅
   * @param event - 事件名
   * @param handler - 事件处理函数
   */
  unsubscribe<T = any>(event: string, handler: EventHandler<T>): void {
    if (this.eventsHandlers[event]) {
      this.eventsHandlers[event] = this.eventsHandlers[event].filter(
        ({ handler: h }) => h !== handler
      )
    }
  },

  /**
   * 取消订阅所有事件
   * @param event - 事件名
   */
  unsubscribeAll(event: string): void {
    if (this.eventsHandlers[event]) {
      delete this.eventsHandlers[event]
    }
  },

  /**
   * 发布事件
   * @param event - 事件名
   * @param data - 事件数据
   * @param options - 事件选项
   */
  publish<T = any>(event: string, data: T, options: PublishOptions = {}): void {
    // 发布给现有订阅者
    if (this.eventsHandlers[event]) {
      this.eventsHandlers[event].forEach(
        ({ filter, handler }) => {
          if (filter(data)) {
            handler(data)
          }
        }
      )
    }

    // 如果有回放的需求，就把事件记录下来
    if (options.replayScope) {
      this._storeReplayEvent(event, data, options)
    }
  },

  /**
   * 移除所有重放事件
   * @param replayScope - 重放范围
   */
  removeAllReplayEvents(replayScope?: ReplayScope | keyof typeof ReplayScope | 'ALL'): void {
    switch (replayScope) {
      case ReplayScope.SESSION:
        sessionStorage.removeItem(REPLAY_STORAGE_KEY)
        break
      case ReplayScope.LOCAL:
        localStorage.removeItem(REPLAY_STORAGE_KEY)
        break
      case undefined:
      case 'ALL':
        localStorage.removeItem(REPLAY_STORAGE_KEY)
        sessionStorage.removeItem(REPLAY_STORAGE_KEY)
        break
    }
  },

  /**
   * 移除特定重放事件
   * @param event - 事件名
   * @param replayScope - 重放范围
   */
  removeReplayEvent(event: string, replayScope: ReplayScope | keyof typeof ReplayScope): void {
    const storage = this._getStorage(replayScope)
    if (!storage) return

    const replayEvents = this._getReplayEvents(storage)
    const filteredEvents = replayEvents.filter((e) => e.event !== event)
    
    this._setReplayEvents(storage, filteredEvents)
  },

  /**
   * 存储重放事件（私有方法）
   */
  _storeReplayEvent(event: string, data: any, options: PublishOptions): void {
    const storage = this._getStorage(options.replayScope!)
    if (!storage) return

    const replayEvents = this._getReplayEvents(storage)
    
    // 移除同名事件（避免重复）
    const filteredEvents = replayEvents.filter((e) => e.event !== event)
    
    // 添加新事件
    filteredEvents.push({
      event,
      data,
      replayStage: options.replayStage,
    })

    this._setReplayEvents(storage, filteredEvents)
  },

  /**
   * 获取存储对象（私有方法）
   */
  _getStorage(scope: ReplayScope | keyof typeof ReplayScope): Storage | null {
    switch (scope) {
      case ReplayScope.SESSION:
        return sessionStorage
      case ReplayScope.LOCAL:
        return localStorage
      default:
        return null
    }
  },

  /**
   * 获取重放事件列表（私有方法）
   */
  _getReplayEvents(storage: Storage): ReplayEvent[] {
    const replayEventData = storage.getItem(REPLAY_STORAGE_KEY) || '[]'
    try {
      return JSON.parse(replayEventData) as ReplayEvent[]
    } catch (e) {
      console.error('replayEventData is not valid json:', e)
      return []
    }
  },

  /**
   * 设置重放事件列表（私有方法）
   */
  _setReplayEvents(storage: Storage, events: ReplayEvent[]): void {
    try {
      storage.setItem(REPLAY_STORAGE_KEY, JSON.stringify(events))
    } catch (e) {
      console.error('Failed to store replay events:', e)
    }
  }
}