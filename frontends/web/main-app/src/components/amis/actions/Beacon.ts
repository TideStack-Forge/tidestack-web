import {
  registerAction,
  RendererAction,
  ListenerAction,
  ListenerContext,
  RendererEvent,
  dispatchEvent,
  createObject,
} from 'amis-core'
import { isEqual } from 'lodash'

/**
 *
 */
interface IBeaconAction extends ListenerAction {
  actionType: 'beacon'
  args: {
    /** 持续广播的事件名称 */
    eventName?: string
    /** 持续广播的间隔时间 */
    interval?: number
    /** 是否清除信标 */
    clear?: boolean
  }
  /** 持续广播的事件名称 */
  eventName?: string
  /** 持续广播的间隔时间 */
  interval?: number
  /** 是否清除信标 */
  clear?: boolean
}

/**
 * 持续触发广播的信标
 */
class Beacon implements RendererAction {
  beaconMap: {
    [key: string]: {
      interval: number
      data: any
      clear: () => void
    }
  } = {}
  async run(action: IBeaconAction, ctx: ListenerContext, event: RendererEvent<any>) {
    const interval = action.args?.interval ?? action.interval ?? 1000
    const eventName = action.args?.eventName ?? action.eventName ?? 'beacon_event'
    const clear = action.args?.clear ?? action.clear ?? false
    const beacon = this.beaconMap[eventName]
    const data = action.data

    // 如果是清除事件，直接清除
    if (clear) {
      beacon?.clear()
      return
    }

    if (!beacon || beacon.interval !== interval || !isEqual(beacon.data, data)) {
      beacon?.clear()
      const intervalHandle = setInterval(() => {
        // 作为一个新的事件，需要把广播动作的args参数追加到事件数据中
        event.setData(createObject(event.data, action.data ?? {}))

        // 直接触发对应的动作
        dispatchEvent(eventName, ctx, event.context.scoped, data, event)
      }, interval)
      this.beaconMap[eventName] = {
        interval,
        data,
        clear: () => {
          clearInterval(intervalHandle)
          delete this.beaconMap[eventName]
        },
      }
    }
  }
}

registerAction('beacon', new Beacon())
