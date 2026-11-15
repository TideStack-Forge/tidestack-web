import type { NavigationDecision } from './navigationDecision'

export interface NavigationExecutionContext {
  to: any
  next: any
}

export interface NavigationExecutionHandlers {
  clearPreventTabOperation: () => any
  openNotFoundPage: (to: any) => any
  openOrSwitchTab: (fullPath: string, options: { title?: string, syncLocation?: boolean }) => any
  openRootMenu: () => any
  switchTab: (activeTabId: string, options?: { syncLocation?: boolean }) => any
  updateTab: (activeTabId: string, fullPath: string, options?: { syncLocation?: boolean }) => any
}

export type NavigationDecisionExecutor = (
  decision: NavigationDecision,
  context: NavigationExecutionContext
) => Promise<any>

export function createNavigationExecutor(
  handlers: NavigationExecutionHandlers
): NavigationDecisionExecutor {
  return async function executeNavigationDecision(
    decision: NavigationDecision,
    { to, next }: NavigationExecutionContext
  ) {
    if (decision.type === 'open-root-menu') {
      await handlers.openRootMenu()
      return next(false)
    }

    if (decision.type === 'allow') {
      return next()
    }

    if (decision.type === 'clear-prevent-tab-operation') {
      handlers.clearPreventTabOperation()
      return next()
    }

    if (decision.type === 'open-not-found') {
      await handlers.openNotFoundPage(to)
      return next()
    }

    if (decision.type === 'redirect') {
      return next(decision.location)
    }

    if (decision.type === 'switch-tab') {
      await handlers.switchTab(decision.activeTabId, { syncLocation: false })
      return next()
    }

    if (decision.type === 'update-tab') {
      await handlers.updateTab(decision.activeTabId, decision.fullPath, { syncLocation: false })
      return next()
    }

    await handlers.openOrSwitchTab(decision.fullPath, {
      title: decision.title,
      syncLocation: false,
    })
    return next()
  }
}
