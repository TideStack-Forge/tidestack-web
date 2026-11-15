import { registerAction } from 'amis-core'
import Tabs from '@/common/tabs'
import { appendQueryParams } from '@/utils/url'
import { normalizeReceiveActions } from './tabActionHelpers'

function asBooleanFlag(value, defaultValue = false) {
  if (value === undefined || value === null) {
    return defaultValue
  }
  if (typeof value === 'string') {
    return value.toLowerCase() === 'true'
  }
  return value === true
}

export class OpenOrSwitchTab {
  async run({ args = {}, ...actionProps }, renderer) {
    const url = args.url || actionProps.url
    const title = args.title || actionProps.title
    const isFixed = args.isFixed ?? args.isFixedTab ?? actionProps.isFixed ?? actionProps.isFixedTab
    const reloadOnReceive = args.reloadOnReceive ?? actionProps.reloadOnReceive ?? false
    const closeOtherTabs = asBooleanFlag(args.closeOtherTabs ?? actionProps.closeOtherTabs, false)
    const includeFixedTabs = asBooleanFlag(args.includeFixedTabs ?? actionProps.includeFixedTabs, false)
    const replaceCurrentTab = asBooleanFlag(args.replaceCurrentTab ?? actionProps.replaceCurrentTab, false)
    const params = args.params || actionProps.params || {}
    const receiveActions = args.receiveActions || actionProps.receiveActions

    const callback = normalizeReceiveActions(receiveActions, renderer) || (reloadOnReceive
      ? (payload) => payload && renderer.props.onAction('', { actionType: 'reload' })
      : undefined)

    const result = await Tabs.openOrSwitchTab(appendQueryParams(url, params), {
      title,
      callback,
      replaceCurrentTab,
      ...(isFixed === undefined ? {} : { isFixed }),
    })

    if (closeOtherTabs === true) {
      await Tabs.closeOtherTabs(result, { includeFixedTabs })
    }

    return result
  }
}

registerAction('openOrSwitchTab', new OpenOrSwitchTab())
