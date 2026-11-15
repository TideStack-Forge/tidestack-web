import storeRuntime from './engines/storeEngine'

export const store = storeRuntime

export function getStore() {
  return store
}

export function readState() {
  return store.state
}

export function readGetters() {
  return store.getters
}

export function dispatch(action: string, payload?: any) {
  return store.dispatch(action, payload)
}

export function commit(type: string, payload?: any) {
  return store.commit(type, payload)
}

export function subscribeState(listener: (mutation?: any, state?: any) => void) {
  return store.subscribe((mutation, state) => {
    listener(mutation, state)
  })
}

export function resetStore() {
  store.reset()
}
