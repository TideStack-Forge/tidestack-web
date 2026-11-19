import { subscribe } from '#ouroboros-host/utils/Stomp'
import { ServiceRenderer } from 'amis/lib/renderers/Service'
import { Renderer, dataMapping } from 'amis'
import { ServiceStore, autobind, filter, filterTarget, isVisible } from 'amis-core'

import type { ServiceProps } from 'amis/lib/renderers/Service'
import type { ActionObject, IScopedContext } from 'amis-core'

const ServiceRendererClass = (ServiceRenderer as any)
  .ComposedComponent as typeof ServiceRenderer

export interface ServiceState {
  subscribedTopic: string | null
}

@Renderer({
  type: 'service',
  name: 'OuroborosService',
  weight: -200,
  storeType: ServiceStore.name,
  override: true,
  isolateScope: true,
  storeExtendsData: (props: any) => !props.formStore,
})
export default class OuroborosService extends ServiceRendererClass {
  subscribedTopic: string | null
  stompUnsubscribe: (() => void) | null = null
  state: ServiceState = {
    subscribedTopic: null,
  }

  async componentDidMount() {
    const { data, dispatchEvent } = this.props
    this.mounted = true
    const rendererEvent = await dispatchEvent('init', data, this)

    if (rendererEvent?.prevented) {
      return
    }

    this.initFetch()
  }

  componentDidUpdate(prevProps: ServiceProps) {
    // 如果是stomp，且stomp配置发生变化，则重新订阅
    if (this.props.stomp) {
      const stompTopic = this.getStompTopic()
      if (
        !prevProps.stomp ||
        prevProps.stomp !== this.props.stomp ||
        stompTopic !== this.getStompTopic(prevProps.stomp, prevProps.data)
      ) {
        this.subscribeStomp(stompTopic)
      }
    }
    super.componentDidUpdate(prevProps)
  }

  componentWillUnmount() {
    this.unsubscribeStomp()

    super.componentWillUnmount()
  }

  @autobind
  initFetch() {
    super.initFetch()
    const { stomp } = this.props
    if (stomp) {
      this.subscribeStomp(this.getStompTopic())
    }
  }

  getStompTopic(stomp = this.props.stomp, data = this.props.data) {
    const stompTopicUrl = typeof stomp === 'object' ? stomp.url : stomp
    return dataMapping(stompTopicUrl, data)
  }

  subscribeStomp(topic: string) {
    this.unsubscribeStomp()
    this.stompUnsubscribe = subscribe(
      topic,
      this.stompListener,
      this.props.keepSingleListener ?? true
    )
    this.setState({ subscribedTopic: topic } as any)
  }

  stompListener = (message: any) => {
    if (message === undefined || message === null) {
      return
    }
    const nextData = this.normalizeStompPayload(message)
    const currentData = this.getCurrentStoreData()

    // 更新数据域
    this.props.store.updateData({
      ...currentData,
      ...nextData,
    })
  }

  normalizeStompPayload(message: any) {
    let normalized = message

    if (typeof message === 'string') {
      try {
        normalized = JSON.parse(message)
      } catch (error) {
        normalized = message
      }
    }

    if (normalized && typeof normalized === 'object' && !Array.isArray(normalized)) {
      return normalized
    }

    const key =
      typeof this.props.stomp === 'object' && this.props.stomp?.responseKey
        ? this.props.stomp.responseKey
        : 'data'
    return {
      [key]: normalized,
    }
  }

  getCurrentStoreData() {
    const storeData = this.props.store?.data
    if (storeData && typeof storeData === 'object') {
      return storeData
    }
    return this.props.data && typeof this.props.data === 'object' ? this.props.data : {}
  }

  unsubscribeStomp() {
    this.stompUnsubscribe?.()
    this.stompUnsubscribe = null
    if (!this.state.subscribedTopic) return
    this.setState({ subscribedTopic: null } as any)
  }

  setData(values: object, replace?: boolean) {
    return this.props.store.updateData(values, undefined, replace)
  }

  handleAction(
    e: React.UIEvent<any> | void,
    action: ActionObject,
    data: object,
    throwErrors: boolean = false,
    delegate?: IScopedContext
  ) {
    const { onAction, store, env, api, translate: __ } = this.props

    if (api && action.actionType === 'ajax') {
      store.setCurrentAction(action, this.props.resolveDefinitions)
      return store
        .saveRemote(action.api as string, data, {
          successMessage: __(action.messages && action.messages.success),
          errorMessage: __(action.messages && action.messages.failed),
        })
        .then(async (payload: any) => {
          this.afterDataFetch(payload)
          if (action.feedback && isVisible(action.feedback, store.data)) {
            await this.openFeedback(action.feedback, store.data)
          }

          const redirect = action.redirect && filter(action.redirect, store.data)
          redirect && env.jumpTo(redirect, action, store.data)
          action.reload &&
            this.reloadTarget(filterTarget(action.reload, store.data), store.data)
        })
        .catch((e) => {
          if (throwErrors || action.countDown) {
            throw e
          }
        })
    } else {
      return onAction(e, action, data, throwErrors, delegate || this.context)
    }
  }
}
