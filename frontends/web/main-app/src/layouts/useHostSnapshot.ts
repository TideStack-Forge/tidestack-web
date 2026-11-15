import { useEffect, useRef, useState } from 'react'

import { subscribeRouteChanges } from '../router/routerFacade'
import { subscribeState } from '../store/storeFacade'

interface HostSnapshotOptions {
  store?: boolean
  router?: boolean
  shouldNotifyStore?: (mutation: any, state?: any) => boolean
  shouldNotifyRoute?: (route: any, from?: any) => boolean
}

export function useHostSnapshot({
  store = true,
  router = true,
  shouldNotifyStore,
  shouldNotifyRoute,
}: HostSnapshotOptions = {}) {
  const [version, setVersion] = useState(0)
  const shouldNotifyStoreRef = useRef(shouldNotifyStore)
  const shouldNotifyRouteRef = useRef(shouldNotifyRoute)

  shouldNotifyStoreRef.current = shouldNotifyStore
  shouldNotifyRouteRef.current = shouldNotifyRoute

  useEffect(() => {
    const unsubscribeStore = store
      ? subscribeState((mutation, currentState) => {
          const shouldNotify = shouldNotifyStoreRef.current
          if (shouldNotify && !shouldNotify(mutation, currentState)) {
            return
          }
          setVersion((current) => current + 1)
        })
      : () => undefined

    const unsubscribeRouter = router
      ? subscribeRouteChanges((route, from) => {
          const shouldNotify = shouldNotifyRouteRef.current
          if (shouldNotify && !shouldNotify(route, from)) {
            return
          }
          setVersion((current) => current + 1)
        })
      : () => undefined

    return () => {
      unsubscribeStore()
      unsubscribeRouter()
    }
  }, [router, store])

  return version
}
