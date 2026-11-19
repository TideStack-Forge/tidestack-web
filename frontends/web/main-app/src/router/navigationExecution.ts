import type { NavigationDecision } from './navigationDecision'

export interface NavigationExecutionContext {
  to: any
  next: any
  onCommit?: (action: (isCurrent: () => boolean) => Promise<any>) => void
}

export interface NavigationExecutionHandlers {
  openNotFoundPage: (to: any) => any
  openOrSwitchTab: (fullPath: string, options: { title?: string, syncLocation?: boolean, isCurrent?: () => boolean }) => any
  openRootMenu: () => any
  switchTab: (activeTabId: string, options?: { syncLocation?: boolean, isCurrent?: () => boolean }) => any
  updateTab: (activeTabId: string, fullPath: string, options?: { syncLocation?: boolean, isCurrent?: () => boolean }) => any
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
    { to, next, onCommit }: NavigationExecutionContext
  ) {
    async function project(action: (isCurrent: () => boolean) => Promise<any>) {
      if (onCommit) { onCommit(action); return next() }
      const result = await action(() => true)
      return result === false ? next(false) : next()
    }
    if (decision.type === 'open-root-menu') {
      await handlers.openRootMenu()
      return next(false)
    }

    if (decision.type === 'allow') {
      return next()
    }

    if (decision.type === 'open-not-found') {
      return project((isCurrent) => handlers.openNotFoundPage(to))
    }

    if (decision.type === 'redirect') {
      return next(decision.location)
    }

    if (decision.type === 'switch-tab') {
      return project((isCurrent) => handlers.switchTab(decision.activeTabId, { syncLocation: false, isCurrent }))
    }

    if (decision.type === 'update-tab') {
      return project((isCurrent) => handlers.updateTab(decision.activeTabId, decision.fullPath, { syncLocation: false, isCurrent }))
    }

    return project((isCurrent) => handlers.openOrSwitchTab(decision.fullPath, {
      title: decision.title,
      syncLocation: false,
      isCurrent,
    }))
  }
}
