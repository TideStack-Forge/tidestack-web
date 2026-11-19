export interface NavigationDecisionInput {
  isLegacyIframeMode: boolean
  shouldConfirmLeave: boolean
  isErrorRoute: boolean
  isLogin: boolean
  hasInitializationError?: boolean
  toPath: string
  toFullPath: string
  toQueryRedirect?: string
  postLoginFallbackPath: string
  whiteList: string[]
  tabIntent?: boolean
  routeName: string
  activeTabId?: string
  tabsList?: Array<{ id?: string; path?: string; fullPath?: string }>
  routeTitle?: string
}

export type NavigationDecision =
  | { type: 'allow' }
  | { type: 'redirect'; location: Record<string, any> }
  | { type: 'open-root-menu' }
  | { type: 'open-not-found' }
  | { type: 'switch-tab'; activeTabId: string }
  | { type: 'update-tab'; activeTabId: string; fullPath: string }
  | { type: 'open-or-switch-tab'; fullPath: string; title?: string }

export function resolveNavigationDecision(
  input: NavigationDecisionInput
): NavigationDecision {
  const activeTab = (input.tabsList || []).find((item) => item.id === input.activeTabId)

  if (input.hasInitializationError) {
    return input.toPath === '/errorAfterLogin'
      ? { type: 'allow' }
      : {
          type: 'redirect',
          location: {
            path: '/errorAfterLogin',
            query: {
              fullscreen: 'true',
              redirect: input.toQueryRedirect || input.toFullPath,
            },
            replace: true,
          },
        }
  }

  if (input.isLegacyIframeMode) {
    return { type: 'allow' }
  }

  if (input.isErrorRoute) {
    return { type: 'allow' }
  }

  if (input.isLogin && input.toPath === '/login') {
    return {
      type: 'redirect',
      location: {
        path: input.toQueryRedirect || '/',
      },
    }
  }

  if (
    input.isLogin &&
    input.toPath === '/welcome' &&
    input.postLoginFallbackPath === '/errorAfterLogin'
  ) {
    return {
      type: 'redirect',
      location: { path: '/errorAfterLogin', replace: true },
    }
  }

  if (
    input.isLogin &&
    input.toPath === '/errorAfterLogin' &&
    input.postLoginFallbackPath === '/welcome'
  ) {
    return {
      type: 'redirect',
      location: { path: '/', replace: true },
    }
  }

  if (input.toPath === '/' && input.isLogin) {
    return { type: 'open-root-menu' }
  }

  if (input.whiteList.includes(input.toPath)) {
    return { type: 'allow' }
  }

  if (input.routeName.toLowerCase() === 'notfound') {
    return { type: 'open-not-found' }
  }

  if (!input.isLogin) {
    return {
      type: 'redirect',
      location: {
        path: '/login',
        query:
          input.toFullPath === '/' || input.toFullPath === ''
            ? {}
            : { redirect: input.toFullPath },
      },
    }
  }

  if (input.tabIntent) {
    return { type: 'allow' }
  }

  if (activeTab && input.activeTabId && activeTab.fullPath === input.toFullPath) {
    return {
      type: 'switch-tab',
      activeTabId: input.activeTabId,
    }
  }

  if (activeTab && input.activeTabId && activeTab.path === input.toPath) {
    return {
      type: 'update-tab',
      activeTabId: input.activeTabId,
      fullPath: input.toFullPath,
    }
  }

  return {
    type: 'open-or-switch-tab',
    fullPath: input.toFullPath,
    title: input.routeTitle,
  }
}
