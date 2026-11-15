import rootGettersDefinition from '../getters'

declare const require: any

type GetterHandler = (
  state: any,
  getters?: Record<string, any>,
  rootState?: any,
  rootGetters?: Record<string, any>
) => any

type MutationHandler = (state: any, payload?: any) => any
type ActionHandler = (context: any, payload?: any) => any

interface StoreModule {
  namespaced?: boolean
  state?: any
  getters?: Record<string, GetterHandler>
  mutations?: Record<string, MutationHandler>
  actions?: Record<string, ActionHandler>
}

interface MutationDescriptor {
  type: string
  payload?: any
}

type StateSubscriber = (mutation: MutationDescriptor, state: any) => void

const moduleFiles = require.context('../modules', true, /\.js$/)

const moduleDefinitions = moduleFiles.keys().reduce((allModules: Record<string, StoreModule>, modulePath: string) => {
  const moduleName = modulePath.replace(/^\.\/(.*)\.\w+$/, '$1')
  const value = moduleFiles(modulePath)
  allModules[moduleName] = value.default
  return allModules
}, {} as Record<string, StoreModule>)

const subscriberSet = new Set<StateSubscriber>()

let state = buildInitialState()

const rootGetterHandlers = rootGettersDefinition as Record<string, GetterHandler>
const getterProxyCache = new Map<string, Record<string, any>>()

function buildInitialState() {
  return Object.keys(moduleDefinitions).reduce((nextState, moduleName) => ({
    ...nextState,
    [moduleName]: cloneValue(moduleDefinitions[moduleName]?.state || {}),
  }), {} as Record<string, any>)
}

function cloneValue(value: any): any {
  if (Array.isArray(value)) {
    return value.map((item) => cloneValue(item))
  }

  if (value && Object.prototype.toString.call(value) === '[object Object]') {
    return Object.keys(value).reduce((nextValue, key) => {
      nextValue[key] = cloneValue(value[key])
      return nextValue
    }, {} as Record<string, any>)
  }

  return value
}

function createGetterProxy(namespace?: string) {
  const cacheKey = namespace || '__root__'
  const cached = getterProxyCache.get(cacheKey)

  if (cached) {
    return cached
  }

  const proxy = new Proxy(
    {},
    {
      get(_target, property) {
        if (typeof property !== 'string') {
          return undefined
        }

        return namespace
          ? resolveGetterValue(`${namespace}/${property}`)
          : resolveGetterValue(property)
      },
      has(_target, property) {
        if (typeof property !== 'string') {
          return false
        }

        return resolveGetterKey(namespace, property) !== null
      },
      ownKeys() {
        return namespace ? listModuleGetterKeys(namespace) : listRootGetterKeys()
      },
      getOwnPropertyDescriptor() {
        return {
          configurable: true,
          enumerable: true,
        }
      },
    }
  ) as Record<string, any>

  getterProxyCache.set(cacheKey, proxy)
  return proxy
}

function listModuleGetterKeys(namespace: string) {
  const moduleDefinition = moduleDefinitions[namespace]
  return Object.keys(moduleDefinition?.getters || {})
}

function listRootGetterKeys() {
  const moduleGetterKeys = Object.keys(moduleDefinitions).flatMap((moduleName) => {
    return listModuleGetterKeys(moduleName).map((getterName) => `${moduleName}/${getterName}`)
  })

  return [...Object.keys(rootGetterHandlers), ...moduleGetterKeys]
}

function resolveGetterKey(namespace: string | undefined, property: string) {
  const getterKey = namespace ? `${namespace}/${property}` : property
  if (getterKey.includes('/')) {
    const { moduleName, propertyName } = parseNamespacedType(getterKey)
    const moduleDefinition = moduleDefinitions[moduleName]
    if (moduleDefinition?.getters?.[propertyName]) {
      return getterKey
    }
  }

  if (!namespace && rootGetterHandlers[property]) {
    return property
  }

  return null
}

function resolveGetterValue(type: string) {
  if (type.includes('/')) {
    const { moduleName, propertyName } = parseNamespacedType(type)
    const moduleDefinition = moduleDefinitions[moduleName]
    const getter = moduleDefinition?.getters?.[propertyName]

    if (!getter) {
      return undefined
    }

    return getter(
      state[moduleName],
      createGetterProxy(moduleName),
      state,
      createGetterProxy()
    )
  }

  const getter = rootGetterHandlers[type]
  if (!getter) {
    return undefined
  }

  return getter(state, createGetterProxy(), state, createGetterProxy())
}

function parseNamespacedType(type: string) {
  const index = type.indexOf('/')
  return {
    moduleName: type.slice(0, index),
    propertyName: type.slice(index + 1),
  }
}

function resolveMutationHandler(type: string) {
  const { moduleName, propertyName } = parseNamespacedType(type)
  const moduleDefinition = moduleDefinitions[moduleName]
  return {
    moduleName,
    handler: moduleDefinition?.mutations?.[propertyName],
  }
}

function resolveActionHandler(type: string) {
  const { moduleName, propertyName } = parseNamespacedType(type)
  const moduleDefinition = moduleDefinitions[moduleName]
  return {
    moduleName,
    handler: moduleDefinition?.actions?.[propertyName],
  }
}

function normalizeDispatchType(type: string, namespace?: string, options?: { root?: boolean }) {
  if (options?.root || type.includes('/')) {
    return type
  }

  return namespace ? `${namespace}/${type}` : type
}

function notifySubscribers(mutation: MutationDescriptor) {
  subscriberSet.forEach((listener) => {
    listener(mutation, state)
  })
}

function createModuleContext(namespace: string) {
  return {
    state: state[namespace],
    getters: createGetterProxy(namespace),
    rootState: state,
    rootGetters: createGetterProxy(),
    commit(type: string, payload?: any, options?: { root?: boolean }) {
      return storeRuntime.commit(normalizeDispatchType(type, namespace, options), payload)
    },
    dispatch(type: string, payload?: any, options?: { root?: boolean }) {
      return storeRuntime.dispatch(normalizeDispatchType(type, namespace, options), payload)
    },
  }
}

const storeRuntime = {
  get state() {
    return state
  },
  get getters() {
    return createGetterProxy()
  },
  commit(type: string, payload?: any) {
    const resolvedType = normalizeDispatchType(type)
    const mutationEntry = resolveMutationHandler(resolvedType)

    if (!mutationEntry.handler) {
      throw new Error(`Unknown store mutation: ${resolvedType}`)
    }

    mutationEntry.handler(state[mutationEntry.moduleName], payload)
    notifySubscribers({ type: resolvedType, payload })
    return undefined
  },
  dispatch(type: string, payload?: any) {
    const resolvedType = normalizeDispatchType(type)
    const actionEntry = resolveActionHandler(resolvedType)

    if (!actionEntry.handler) {
      throw new Error(`Unknown store action: ${resolvedType}`)
    }

    return actionEntry.handler(createModuleContext(actionEntry.moduleName), payload)
  },
  subscribe(listener: StateSubscriber) {
    subscriberSet.add(listener)
    return () => {
      subscriberSet.delete(listener)
    }
  },
  reset() {
    state = buildInitialState()
    notifySubscribers({ type: '@@store/reset' })
  },
}

export default storeRuntime
