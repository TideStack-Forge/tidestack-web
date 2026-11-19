import { IScopedContext, Renderer, RendererProps, ScopedContext, dataMapping } from 'amis'
import { MicroApp, loadMicroApp } from 'qiankun'
import React from 'react'
import {
  isCallable,
  isBoundedFunction,
  isConstructable,
  isPropertyFrozen,
} from 'qiankun/lib/utils'
import { uniqueId } from 'lodash'
import { getCommonProps } from '#ouroboros-host/common/micro/commonProps'
import { normalizeMicroEntry } from '#ouroboros-host/common/micro/utils'
import {
  createMicroEntryFetch,
  ensureSameOriginMicroEntryIsSafe,
} from '#ouroboros-host/common/micro/entryGuard'

interface LoadOptions {
  url: string
  entry: string
  container: any
  props: any
}
const functionBoundedValueMap = new WeakMap()

function rebindTarget2Fn(target: any, fn: any) {
  /*
    仅绑定 isCallable && !isBoundedFunction && !isConstructable 的函数对象，如 window.console、window.atob 这类，不然微应用中调用时会抛出 Illegal invocation 异常
    目前没有完美的检测方式，这里通过 prototype 中是否还有可枚举的拓展方法的方式来判断
    @warning 这里不要随意替换成别的判断方式，因为可能触发一些 edge case（比如在 lodash.isFunction 在 iframe 上下文中可能由于调用了 top window 对象触发的安全异常）
   */
  if (isCallable(fn) && !isBoundedFunction(fn) && !isConstructable(fn)) {
    const cachedBoundFunction = functionBoundedValueMap.get(fn)
    if (cachedBoundFunction) {
      return cachedBoundFunction
    }

    const boundValue = Function.prototype.bind.call(fn, target)

    // some callable function has custom fields, we need to copy the own props to boundValue. such as moment function.
    Object.getOwnPropertyNames(fn).forEach((key) => {
      // boundValue might be a proxy, we need to check the key whether exist in it
      if (!Object.prototype.hasOwnProperty.call(boundValue, key)) {
        Object.defineProperty(
          boundValue,
          key,
          Object.getOwnPropertyDescriptor(fn, key) as any
        )
      }
    })

    // copy prototype if bound function not have but target one have
    // as prototype is non-enumerable mostly, we need to copy it from target function manually
    if (
      Object.prototype.hasOwnProperty.call(fn, 'prototype') &&
      !Object.prototype.hasOwnProperty.call(boundValue, 'prototype')
    ) {
      // we should not use assignment operator to set boundValue prototype like `boundValue.prototype = fn.prototype`
      // as the assignment will also look up prototype chain while it hasn't own prototype property,
      // when the lookup succeed, the assignment will throw an TypeError like `Cannot assign to read only property 'prototype' of function` if its descriptor configured with writable false or just have a getter accessor
      Object.defineProperty(boundValue, 'prototype', {
        value: fn.prototype,
        enumerable: false,
        writable: true,
      })
    }

    // Some util, like `function isNative() {  return typeof Ctor === 'function' && /native code/.test(Ctor.toString()) }` relies on the original `toString()` result
    // but bound functions will always return "function() {[native code]}" for `toString`, which is misleading
    if (typeof fn.toString === 'function') {
      const valueHasInstanceToString =
        Object.prototype.hasOwnProperty.call(fn, 'toString') &&
        !Object.prototype.hasOwnProperty.call(boundValue, 'toString')
      const boundValueHasPrototypeToString =
        boundValue.toString === Function.prototype.toString

      if (valueHasInstanceToString || boundValueHasPrototypeToString) {
        const originToStringDescriptor = Object.getOwnPropertyDescriptor(
          valueHasInstanceToString ? fn : Function.prototype,
          'toString'
        )

        Object.defineProperty(
          boundValue,
          'toString',
          Object.assign(
            {},
            originToStringDescriptor,
            originToStringDescriptor?.get ? null : { value: () => fn.toString() }
          )
        )
      }
    }

    functionBoundedValueMap.set(fn, boundValue)
    return boundValue
  }

  return fn
}

async function load(options: LoadOptions) {
  const { url: originUrl = '/', entry, container, props } = options
  const popstateHandlers = []
  const finalUrl = originUrl.startsWith('/')
    ? window.location.origin + originUrl
    : originUrl.startsWith('http')
      ? originUrl
      : window.location.origin + '/' + originUrl
  const url = new URL(finalUrl)
  // 添加自定义属性
  const proxy: any = new Proxy(window, {
    get: (target, p: any) => {
      if (p === 'location') {
        // 覆写location
        const newLocation = {
          hash: url.hash,
          host: url.host,
          hostname: url.hostname,
          href: url.href,
          origin: url.origin,
          pathname: url.pathname,
          port: url.port,
          protocol: url.protocol,
          search: url.search,
          YEAH: true,
          assign: () => {},
          reload: () => {},
          replace: () => {},
        }
        return newLocation
      }
      if (p === 'history') {
        // 覆写history.pushState
        const newHistory = {
          state: {
            back: null,
            forward: null,
            current: url.pathname + url.search + url.hash,
            position: 0,
            replaced: true,
          },
          pushState: () => {},
          replaceState: () => {},
          go: () => {},
        }
        return newHistory
      }
      if (p === Symbol.unscopables) return Symbol.unscopables
      if (p === 'window' || p === 'self') return proxy

      // hijack globalWindow accessing with globalThis keyword
      if (p === 'globalThis') return proxy

      if (p === 'top' || p === 'parent') {
        if (target === target.parent) {
          return proxy
        }
        return target[p]
      }

      // proxy.hasOwnProperty would invoke getter firstly, then its value represented as globalContext.hasOwnProperty
      if (p === 'hasOwnProperty') {
        return Object.prototype.hasOwnProperty.bind(target)
      }

      if (p === 'document') {
        return target.document
      }

      if (p === 'eval') {
        const evalFn = Reflect.get(target, 'eval')
        return typeof evalFn === 'function' ? evalFn.bind(target) : evalFn
      }

      if (p === 'string') return target[p]

      let value = target[p] as any
      if (p === 'addEventListener') {
        const oldValue = value
        value = (eventName: string, handler: any) => {
          if (eventName === 'hashchange') {
            return
          }
          if (eventName === 'popstate') {
            popstateHandlers.push(handler)
            return
          }
          // if (eventName === 'locationChange') {
          // }
          return oldValue(eventName, handler)
        }
      }

      if (isPropertyFrozen(target, p)) {
        return value
      }

      return rebindTarget2Fn(target, value)
    },
    set: (target, p, value) => {
      if (p === 'location') {
        return true
      }
      return Reflect.set(target, p, value)
    },
    defineProperty: (target, p, attributes) => {
      if (p === 'location') {
        return true
      }
      return Reflect.defineProperty(target, p, attributes)
    },
    getPrototypeOf() {
      return Reflect.getPrototypeOf(window)
    },
  })
  const uniqueName = uniqueId('embed-' + originUrl.replaceAll(/[/|:]/g, '_'))
  const normalizedEntry = normalizeMicroEntry(entry)
  await ensureSameOriginMicroEntryIsSafe(normalizedEntry)
  return loadMicroApp(
    {
      name: uniqueName,
      entry: normalizedEntry,
      container,
      props: {
        ...getCommonProps(),
        ...props,
      },
    },
    { globalContext: proxy, fetch: createMicroEntryFetch() }
  )
}

class EmbedMicroApp extends React.Component<RendererProps> {
  static contextType = ScopedContext
  ref: any
  microApp: MicroApp
  destroyed = false
  constructor(props: any, context: IScopedContext) {
    super(props)
    this.context = context
  }

  buildMicroAppProps() {
    const { data } = this.props.$schema
    const { onAction } = this.props
    const contextData = this.props.data || {}
    const mappedData = dataMapping(data, contextData)
    const finalData = { ...contextData, ...mappedData }
    return {
      ...this.props,
      ...finalData,
      data: finalData,
      onConfirm: (data: any, reload: boolean = true) =>
        onAction?.(
          undefined,
          { actionType: 'confirm', from: 'embed-micro', reload },
          data
        ),
      onClose: () => onAction?.(undefined, { actionType: 'cancel' }),
      registerActions: this.registerActions.bind(this),
    }
  }

  componentDidMount() {
    this.destroyed = false
    void this.mountMicroApp()
  }

  async mountMicroApp() {
    const { url, entry } = this.props.$schema
    const props = this.buildMicroAppProps()
    this.registerActions([])
    try {
      const microApp = await load({ url, entry, container: this.ref, props })
      if (this.destroyed) {
        await Promise.resolve(microApp.unmount())
        return
      }
      this.microApp = microApp
    } catch (error) {
      if (!(error as any)?.isUnsafeMicroEntry) {
        console.warn('内嵌微应用加载失败', error)
      }
    }
  }

  componentDidUpdate(): void {
    if (this.microApp?.update) {
      this.microApp.update({
        ...getCommonProps(),
        ...this.buildMicroAppProps(),
      })
    }
  }

  registerActions(actions: any[]) {
    const scoped = this.context as IScopedContext
    if (['drawer', 'dialog'].includes(scoped.component?.props.type))
      scoped.component?.setState({ updatedActions: actions })
  }

  componentWillUnmount(): void {
    this.destroyed = true
    this.microApp?.unmount()
  }

  render(): any {
    return <div ref={(ref: any) => (this.ref = ref)}></div>
  }
}

Renderer({ type: 'embed-micro-app' })(EmbedMicroApp as any)

export default EmbedMicroApp
