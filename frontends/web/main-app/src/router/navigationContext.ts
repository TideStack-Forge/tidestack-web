import { isExternal } from '@/utils/url'
import type { NavigationDecisionInput } from './navigationDecision'

export type NavigationContext = Pick<
  NavigationDecisionInput,
  | 'hasInitializationError'
  | 'isLogin'
  | 'toPath'
  | 'toFullPath'
  | 'toQueryRedirect'
  | 'postLoginFallbackPath'
  | 'whiteList'
  | 'preventTabOperation'
  | 'routeName'
  | 'activeTabId'
  | 'tabsList'
  | 'routeTitle'
>

export type NavigationContextRuntimeState = Pick<
  NavigationContext,
  | 'hasInitializationError'
  | 'isLogin'
  | 'postLoginFallbackPath'
  | 'whiteList'
  | 'preventTabOperation'
  | 'activeTabId'
  | 'tabsList'
>

export function createNavigationContext(
  to: any,
  {
    isLogin,
    hasInitializationError,
    postLoginFallbackPath,
    whiteList,
    preventTabOperation,
    activeTabId,
    tabsList,
  }: NavigationContextRuntimeState
): NavigationContext {
  return {
    isLogin,
    hasInitializationError,
    toPath: to.path,
    toFullPath: to.fullPath,
    toQueryRedirect:
      to.query?.redirect && !isExternal(to.query.redirect)
        ? to.query.redirect
        : undefined,
    postLoginFallbackPath,
    whiteList,
    preventTabOperation,
    routeName: to.name || '',
    activeTabId,
    tabsList,
    routeTitle: to.meta?.title,
  }
}
