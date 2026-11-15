import AppLayoutOutlet from '../../layouts/AppLayoutOutlet'
import { i18nManager } from '../../common/i18n'
import { readNavigationContext } from '../navigationContextRuntime'
import { executeNavigationDecision } from '../navigationExecutionRuntime'
import { installNavigationOrchestration } from '../navigationOrchestration'
import { readRouterTopology } from '../routerTopologyRuntime'
import { readGetters } from '../../store/storeFacade'

type RouteChangeListener = (route: any, from?: any) => void
type NavigationGuard = (to: any, from: any, next: (value?: any) => void) => any
type AfterEachGuard = (to: any, from: any) => void

interface RouteCandidate {
  path: string
  matcher: RegExp
  paramNames: string[]
  matched: any[]
  score: number
}

interface RouteMatcher {
  routes: any[]
  candidates: RouteCandidate[]
}

interface NormalizedLocationInput {
  fullPath: string
  path: string
  query: Record<string, any>
  hash: string
  location: any
  normalizedTo: any
  replace: boolean
}

const routeChangeListeners = new Set<RouteChangeListener>()
const beforeEachHooks: NavigationGuard[] = []
const afterEachHooks: AfterEachGuard[] = []

let routeMatcher: RouteMatcher | null = null
let currentRoute: any = null
let popStateBound = false
let initialNavigationBootstrapped = false

function createInitialRoute(): any {
  return resolveRouteMatch(readLocationInput(readBrowserLocation(), '/'))
}

function ensureRouteMatcher() {
  if (!routeMatcher) {
    routeMatcher = buildMatcher(readRouterTopology(AppLayoutOutlet))
  }

  return routeMatcher
}

function ensureCurrentRoute() {
  if (!currentRoute) {
    currentRoute = createInitialRoute()
  }

  return currentRoute
}

function readBrowserLocation(): string {
  if (typeof window === 'undefined') {
    return '/'
  }

  return `${window.location.pathname}${window.location.search}${window.location.hash}`
}

function parseQuery(searchParams: URLSearchParams): Record<string, any> {
  const query: Record<string, any> = {}

  searchParams.forEach((value, key) => {
    if (Object.prototype.hasOwnProperty.call(query, key)) {
      const currentValue = query[key]
      query[key] = Array.isArray(currentValue) ? [...currentValue, value] : [currentValue, value]
      return
    }

    query[key] = value
  })

  return query
}

function stringifyQuery(query: Record<string, any> = {}): string {
  const searchParams = new URLSearchParams()

  Object.keys(query).forEach((key) => {
    const value = query[key]
    if (value == null) {
      return
    }

    if (Array.isArray(value)) {
      value.forEach((entry) => {
        searchParams.append(key, `${entry}`)
      })
      return
    }

    searchParams.set(key, `${value}`)
  })

  const serialized = searchParams.toString()
  return serialized ? `?${serialized}` : ''
}

function readLocationInput(location: any, fallbackPath = '/'): NormalizedLocationInput {
  if (typeof location === 'string') {
    const parsed = new URL(location, 'https://layout.local')
    const fullPath = `${parsed.pathname}${parsed.search}${parsed.hash}`
    return {
      fullPath,
      path: parsed.pathname,
      query: parseQuery(parsed.searchParams),
      hash: parsed.hash || '',
      location: fullPath,
      normalizedTo: fullPath,
      replace: false,
    }
  }

  const path = location?.path || fallbackPath || '/'
  const hash = location?.hash || ''
  const query = location?.query || {}
  const fullPath = `${path}${stringifyQuery(query)}${hash}`

  return {
    fullPath,
    path,
    query,
    hash,
    location,
    normalizedTo: {
      ...location,
      path,
      query,
      hash,
    },
    replace: Boolean(location?.replace),
  }
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function compileRoutePattern(path: string) {
  if (path === '*') {
    return {
      matcher: /^.*$/,
      paramNames: [],
      score: -100,
    }
  }

  if (path === '/') {
    return {
      matcher: /^\/?$/,
      paramNames: [],
      score: 10,
    }
  }

  const segments = path.split('/').filter(Boolean)
  const paramNames: string[] = []

  const pattern = segments
    .map((segment) => {
      if (segment === '*') {
        return '/.*'
      }

      if (segment.startsWith(':')) {
        paramNames.push(segment.slice(1))
        return '/([^/]+)'
      }

      return `/${escapeRegExp(segment)}`
    })
    .join('')

  const staticSegments = segments.filter((segment) => !segment.startsWith(':') && segment !== '*').length
  const dynamicSegments = paramNames.length

  return {
    matcher: new RegExp(`^${pattern}/?$`),
    paramNames,
    score: staticSegments * 10 - dynamicSegments,
  }
}

function normalizeRoutePath(parentPath: string, routePath: string) {
  if (!routePath) {
    return parentPath || '/'
  }

  if (routePath === '*') {
    return '*'
  }

  if (routePath.startsWith('/')) {
    return routePath
  }

  if (parentPath === '/' || !parentPath) {
    return `/${routePath}`
  }

  return `${parentPath.replace(/\/$/, '')}/${routePath}`
}

function flattenRouteCandidates(routes: any[], parentMatched: any[] = [], parentPath = '/') {
  return routes.flatMap((routeRecord: any) => {
    const routePath = normalizeRoutePath(parentPath, routeRecord.path || parentPath)
    const matched = [...parentMatched, routeRecord]
    const children = Array.isArray(routeRecord.children) ? routeRecord.children : []
    const childCandidates = children.length > 0
      ? flattenRouteCandidates(children, matched, routePath)
      : []

    if (children.length > 0 && routeRecord.path !== '/' && routeRecord.path !== '*') {
      return childCandidates
    }

    const compiledPattern = compileRoutePattern(routePath)
    return [
      ...childCandidates,
      {
        path: routePath,
        matcher: compiledPattern.matcher,
        paramNames: compiledPattern.paramNames,
        matched,
        score: compiledPattern.score + matched.length,
      },
    ]
  })
}

function buildMatcher(routes: any[]): RouteMatcher {
  return {
    routes,
    candidates: flattenRouteCandidates(routes).sort((left: RouteCandidate, right: RouteCandidate) => right.score - left.score),
  }
}

function buildResolvedRoute(locationInput: NormalizedLocationInput, matchedRoute?: RouteCandidate, params: Record<string, string> = {}) {
  const lastMatched = matchedRoute?.matched?.[matchedRoute.matched.length - 1]
  return {
    path: locationInput.path,
    fullPath: locationInput.fullPath,
    hash: locationInput.hash,
    query: locationInput.query,
    params,
    matched: matchedRoute?.matched || [],
    meta: lastMatched?.meta || {},
    name: lastMatched?.name,
  }
}

function buildResolveResult(locationInput: NormalizedLocationInput, matchedRoute?: RouteCandidate, params?: Record<string, string>) {
  const resolvedRoute = buildResolvedRoute(locationInput, matchedRoute, params)
  return {
    location: locationInput.location,
    route: resolvedRoute,
    href: locationInput.fullPath,
    normalizedTo: locationInput.normalizedTo,
    resolved: resolvedRoute,
  }
}

function resolveRouteMatch(locationInput: NormalizedLocationInput): any {
  const matchedRoute = ensureRouteMatcher().candidates.find((candidate) => candidate.matcher.test(locationInput.path))

  if (!matchedRoute) {
    return buildResolvedRoute(locationInput)
  }

  const routeMatch = locationInput.path.match(matchedRoute.matcher)
  const params = matchedRoute.paramNames.reduce((allParams, paramName, index) => {
    const value = routeMatch?.[index + 1]
    if (value != null) {
      allParams[paramName] = decodeURIComponent(value)
    }
    return allParams
  }, {} as Record<string, string>)

  return buildResolveResult(locationInput, matchedRoute, params).resolved
}

function resolveLocation(location: any) {
  const locationInput = readLocationInput(location, currentRoute?.path || '/')
  const matchedRoute = ensureRouteMatcher().candidates.find((candidate) => candidate.matcher.test(locationInput.path))

  if (!matchedRoute) {
    return buildResolveResult(locationInput)
  }

  const routeMatch = locationInput.path.match(matchedRoute.matcher)
  const params = matchedRoute.paramNames.reduce((allParams, paramName, index) => {
    const value = routeMatch?.[index + 1]
    if (value != null) {
      allParams[paramName] = decodeURIComponent(value)
    }
    return allParams
  }, {} as Record<string, string>)

  return buildResolveResult(locationInput, matchedRoute, params)
}

function notifyRouteChangeListeners(route: any, from?: any) {
  routeChangeListeners.forEach((listener) => {
    listener(route, from)
  })
}

function runGuard(guard: NavigationGuard, to: any, from: any) {
  return new Promise<any>((resolve, reject) => {
    let settled = false

    function next(value?: any) {
      settled = true
      resolve(value)
    }

    Promise.resolve(guard(to, from, next))
      .then((result) => {
        if (!settled) {
          resolve(result)
        }
      })
      .catch(reject)
  })
}

async function runBeforeEachHooks(to: any, from: any) {
  for (const guard of beforeEachHooks) {
    const result = await runGuard(guard, to, from)
    if (result === false || result) {
      return result
    }
  }

  return undefined
}

function commitCurrentRoute(nextRoute: any, options: { replace?: boolean; skipHistory?: boolean } = {}) {
  const previousRoute = currentRoute
  currentRoute = nextRoute

  if (!options.skipHistory && typeof window !== 'undefined') {
    const historyMethod = options.replace ? 'replaceState' : 'pushState'
    window.history[historyMethod]({}, '', nextRoute.fullPath)
  }

  afterEachHooks.forEach((listener) => {
    listener(nextRoute, previousRoute)
  })
  notifyRouteChangeListeners(nextRoute, previousRoute)
  return nextRoute
}

async function performNavigation(location: any, options: { replace?: boolean; skipHistory?: boolean } = {}) {
  const previousRoute = ensureCurrentRoute()
  const targetRoute = resolveLocation(location).resolved
  const guardResult = await runBeforeEachHooks(targetRoute, previousRoute)

  if (guardResult === false) {
    return previousRoute
  }

  if (guardResult && guardResult !== true) {
    const redirectOptions = typeof guardResult === 'object' ? guardResult : { path: guardResult }
    return performNavigation(redirectOptions, {
      replace: Boolean(redirectOptions.replace),
    })
  }

  return commitCurrentRoute(targetRoute, options)
}

function updateDocumentTitle(route: any) {
  if (typeof document === 'undefined') {
    return
  }

  const getters = readGetters()
  const appName = getters.getAppName?.() || '潮汐栈'
  const routeDefinitionPath =
    route.matched && route.matched.length > 0
      ? route.matched[route.matched.length - 1].path
      : route.path

  let pageTitle = null
  const routeTitle = i18nManager.tn(routeDefinitionPath, 'title')
  if (routeTitle && !routeTitle.includes('.title')) {
    pageTitle = routeTitle
  }

  if (!pageTitle && route.name) {
    const routeNameLower = route.name.toLowerCase()
    const commonResult = i18nManager.tCommon(`page.${routeNameLower}`)
    if (commonResult && !commonResult.startsWith('common.')) {
      pageTitle = commonResult
    }
  }

  if (!pageTitle && route.meta?.title) {
    pageTitle = i18nManager.tCommon(route.meta.title, route.meta.title)
  }

  document.title = pageTitle ? `${pageTitle} - ${appName}` : appName
}

function ensurePopStateBinding() {
  if (popStateBound || typeof window === 'undefined') {
    return
  }

  window.addEventListener('popstate', () => {
    void performNavigation(readBrowserLocation(), { replace: true, skipHistory: true })
  })
  popStateBound = true
}

function bootstrapInitialNavigation() {
  if (initialNavigationBootstrapped || typeof window === 'undefined') {
    return
  }

  initialNavigationBootstrapped = true
  void performNavigation(readBrowserLocation(), { replace: true, skipHistory: true })
}

function initializeRouter() {
  if (beforeEachHooks.length === 0) {
    installNavigationOrchestration(
      routerRuntime,
      updateDocumentTitle,
      readNavigationContext,
      executeNavigationDecision
    )
  }

  if (afterEachHooks.length === 0) {
    i18nManager.onLocaleChange(() => {
      Promise.resolve().then(() => {
        if (currentRoute) {
          updateDocumentTitle(currentRoute)
        }
      })
    })
  }

  ensurePopStateBinding()
  ensureCurrentRoute()
  bootstrapInitialNavigation()
}

const routerRuntime = {
  get currentRoute() {
    return ensureCurrentRoute()
  },
  get matcher() {
    return ensureRouteMatcher()
  },
  beforeEach(listener: NavigationGuard) {
    beforeEachHooks.push(listener)
    return () => {
      const index = beforeEachHooks.indexOf(listener)
      if (index >= 0) beforeEachHooks.splice(index, 1)
    }
  },
  afterEach(listener: AfterEachGuard) {
    afterEachHooks.push(listener)
  },
  resolve(location: any) {
    initializeRouter()
    return resolveLocation(location)
  },
  push(location: any) {
    try {
      initializeRouter()
      return performNavigation(location, { replace: false })
    } catch (error) {
      return Promise.reject(error)
    }
  },
  replace(location: any) {
    try {
      initializeRouter()
      return performNavigation(location, { replace: true })
    } catch (error) {
      return Promise.reject(error)
    }
  },
}

export function getRouter() {
  initializeRouter()
  return routerRuntime
}

export function refreshRouter() {
  initialNavigationBootstrapped = true
  initializeRouter()
  routeMatcher = buildMatcher(readRouterTopology(AppLayoutOutlet))

  if (typeof window === 'undefined') {
    currentRoute = resolveRouteMatch(readLocationInput(readBrowserLocation()))
    notifyRouteChangeListeners(currentRoute)
    return
  }

  void performNavigation(readBrowserLocation(), { replace: true, skipHistory: true })
}

export function subscribeRouteChanges(listener: RouteChangeListener) {
  routeChangeListeners.add(listener)
  return () => {
    routeChangeListeners.delete(listener)
  }
}

export function readCurrentRoute() {
  getRouter()
  return ensureCurrentRoute()
}

export function pushLocation(location: any) {
  return getRouter().push(location)
}

export function replaceLocation(location: any) {
  return getRouter().replace(location)
}

export { resolveLocation }
