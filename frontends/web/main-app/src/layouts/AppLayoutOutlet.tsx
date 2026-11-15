import { useMemo, useRef } from 'react'

import { readCurrentRoute } from '../router/routerFacade'
import { useHostSnapshot } from './useHostSnapshot'

interface AppLayoutOutletProps {
  className?: string
}

interface CachedRoutePage {
  cacheKey: string
  pageComponent: any
}

export default function AppLayoutOutlet({ className }: AppLayoutOutletProps) {
  useHostSnapshot({ store: false })
  const route = readCurrentRoute()
  const lastMatched = route?.matched?.[route.matched.length - 1]
  const RoutePage = lastMatched?.pageComponent
  const cacheRoute = route?.meta?.cache !== false
  const cachedPagesRef = useRef<CachedRoutePage[]>([])
  const pageCacheKeyMapRef = useRef(new Map<any, string>())
  const nextCacheKeyRef = useRef(0)

  const activeCacheKey = useMemo(() => {
    if (!RoutePage || !cacheRoute) {
      return ''
    }

    const existingCacheKey = pageCacheKeyMapRef.current.get(RoutePage)
    if (existingCacheKey) {
      return existingCacheKey
    }

    const cacheKey = `route-page-${nextCacheKeyRef.current++}`
    pageCacheKeyMapRef.current.set(RoutePage, cacheKey)
    cachedPagesRef.current = [
      ...cachedPagesRef.current,
      {
        cacheKey,
        pageComponent: RoutePage,
      },
    ]

    return cacheKey
  }, [RoutePage, cacheRoute])

  if (!RoutePage) {
    return <div className={className} />
  }

  return (
    <div className={className}>
      {!cacheRoute && <RoutePage key={route.fullPath} />}
      {cachedPagesRef.current.map(({ cacheKey, pageComponent: CachedRoutePageComponent }) => (
        <div
          className="route-cache-slot"
          data-cache-scope="route"
          data-cache-key={cacheKey}
          key={cacheKey}
          style={{
            display: cacheKey === activeCacheKey ? 'block' : 'none',
            height: '100%',
          }}>
          <CachedRoutePageComponent />
        </div>
      ))}
    </div>
  )
}
