import {
  registerAction,
  RendererAction,
  ListenerAction,
  ListenerContext,
  RendererEvent,
} from 'amis-core'

interface IDebounceAction extends ListenerAction {
  actionType: 'debounce'
  args: {
    /** 防抖标识 */
    key?: string
    /**  */
    wait?: number
    maxWait?: number
    leading?: boolean
    trailing?: boolean
  }
  key?: string
  wait?: number
  maxWait?: number
  leading?: boolean
  trailing?: boolean
}

/**
 * 防抖动
 */
export class Debounce implements RendererAction {
  debounceMap: {
    [key: string]: {
      time: number
      clear: () => void
    }
  }

  constructor() {
    this.debounceMap = {}
  }

  async run(action: IDebounceAction, ctx: ListenerContext, event: RendererEvent<any>) {
    const key = action.args?.key ?? action.key ?? ctx.props.$path + ':' + event.type
    const wait = action.args?.wait ?? action.wait ?? 1000
    const maxWait = action.args?.maxWait ?? action.maxWait ?? null
    const leading = action.args?.leading ?? action.leading ?? false
    const trailing = action.args?.trailing ?? action.trailing ?? true

    const renewPending = (timeoutContinue: boolean = true, timeout: number) =>
      new Promise<void>((resolve) => {
        const createClearPending = () => {
          const timer = setTimeout(() => {
            if (!timeoutContinue) event.stopPropagation()
            delete this.debounceMap[key]
            resolve()
          }, timeout)

          // 返回取消方法
          return () => {
            clearTimeout(timer)
            event.stopPropagation()
            resolve()
            delete this.debounceMap[key]
          }
        }
        this.debounceMap[key] = {
          time: this.debounceMap[key]?.time || Date.now(),
          clear: createClearPending(),
        }
      })

    const pendingObj = this.debounceMap[key]
    // 如果是首部执行，且没有pending，则创建pending并直接返回（即第一次会继续后面的action）
    if (leading && !pendingObj) {
      renewPending(false, wait)
      return
    }

    // 没有pending，则创建
    if (!pendingObj) {
      return renewPending(trailing, wait)
    }
    // 有pending，则续期
    else {
      const initTime = pendingObj.time
      pendingObj.clear?.()
      // 如果超过最大等待时间，则不再续期
      if (maxWait && Date.now() - initTime > maxWait) {
        return
      }
      return renewPending(trailing, wait)
    }
  }
}

registerAction('debounce', new Debounce())
