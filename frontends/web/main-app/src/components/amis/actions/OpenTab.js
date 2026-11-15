import { registerAction } from 'amis-core'
import Tabs from '@/common/tabs'
import { appendQueryParams } from '@/utils/url'
import { normalizeReceiveActions } from './tabActionHelpers'

export class OpenTab {
  async run({ args = {}, ...actionProps }, renderer) {
    const url = args.url || actionProps.url
    const title = args.title || actionProps.title
    const isFixed = args.isFixed ?? args.isFixedTab ?? actionProps.isFixed ?? actionProps.isFixedTab
    const reloadOnReceive = args.reloadOnReceive ?? actionProps.reloadOnReceive ?? false
    const params = args.params || actionProps.params || {}
    const receiveActions = args.receiveActions || actionProps.receiveActions
    const callback = normalizeReceiveActions(receiveActions, renderer) || (reloadOnReceive
      ? (payload) => payload && renderer.props.onAction('', { actionType: 'reload' })
      : undefined)
    const result = await Tabs.openTab(appendQueryParams(url, params), {
      title,
      callback,
      ...(isFixed === undefined ? {} : { isFixed }),
    })
    return result
  }
}

registerAction('openTab', new OpenTab())
