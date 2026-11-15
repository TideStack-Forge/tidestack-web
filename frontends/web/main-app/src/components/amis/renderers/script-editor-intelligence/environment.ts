/** Load transport only for an active code context, keeping ordinary JSON editing independent of it. */
export function subscribeCodeEnvironment(appName: string, invalidate: () => void) {
  let disposed = false
  let cleanup: (() => void) | undefined
  void import('@/utils/Stomp')
    .then(({ onStompConnected, subscribeTopic }) => {
      if (disposed) return
      const unsubscribe = subscribeTopic(
        `/dev-helper/${appName}`,
        () => invalidate(),
        false
      )
      const disconnect = onStompConnected(invalidate)
      cleanup = () => {
        unsubscribe()
        disconnect()
      }
    })
    .catch((error) => {
      if (!disposed) console.warn('代码提示环境订阅失败', error)
    })
  return () => {
    disposed = true
    cleanup?.()
  }
}
