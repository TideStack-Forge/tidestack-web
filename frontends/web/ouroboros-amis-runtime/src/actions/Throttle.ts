import {
  ListenerAction,
  ListenerContext,
  registerAction,
  RendererAction,
  RendererEvent,
} from 'amis-core'

interface ThrottleAction extends ListenerAction {
  actionType: 'throttle'
  args: {
    /** 节流标识 */
    key?: string
    /** 节流间隔等待 */
    wait?: number
  }
  /** 节流标识 */
  key?: string
  /** 节流间隔等待 */
  wait?: number
}

/**
 * 节流
 */
export class Throttle implements RendererAction {
  throttleMap: { [key: string]: any } = {}

  async run(action: ThrottleAction, ctx: ListenerContext, event: RendererEvent<any>) {
    const key = action.args?.key ?? action.key ?? ctx.props.$path + ':' + event.type
    const wait = action.args?.wait ?? action.wait ?? 1000

    return new Promise<void>((resolve) => {
      const current = this.throttleMap[key]
      if (current) {
        current.clear()
      }
      const timer = setTimeout(() => {
        delete this.throttleMap[key]
        resolve()
      }, wait)
      this.throttleMap[key] = {
        time: Date.now(),
        clear: () => {
          clearTimeout(timer)
          event.stopPropagation()
          delete this.throttleMap[key]
          resolve()
        },
      }
    })
  }
}

registerAction('throttle', new Throttle())
