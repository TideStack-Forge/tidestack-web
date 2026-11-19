import { getBootstrapMode } from '@/utils'
import {
  clearStatisticsStudioDirty,
  getStatisticsStudioLeaveMessage,
  installStatisticsStudioBeforeUnloadGuard,
  shouldConfirmStatisticsStudioRouteLeave,
} from '@/utils/statisticsStudioDirtyGuard'
import type { NavigationContext } from './navigationContext'
import { resolveNavigationDecision, type NavigationDecisionInput } from './navigationDecision'
import type { NavigationDecisionExecutor } from './navigationExecution'

export function createNavigationGuard(
  updateDocumentTitle: (route: any) => void,
  readDecisionContext: (to: any) => NavigationContext,
  executeNavigationDecision: NavigationDecisionExecutor
) {
  return async (to: any, from: any, next: any) => {
    const isLegacyIframeMode = getBootstrapMode(window.location.href) === 'legacyIframe'
    const shouldConfirmLeave = shouldConfirmStatisticsStudioRouteLeave(from, to)

    if (shouldConfirmLeave) {
      const confirmed = window.confirm(getStatisticsStudioLeaveMessage())
      if (!confirmed) {
        return next(false)
      }
      clearStatisticsStudioDirty(from.fullPath || from.path)
    }

    const isErrorRoute = (to.name || '').toLowerCase() === 'error'
    const navigationContext = readDecisionContext(to)
    const decisionInput: NavigationDecisionInput = {
      isLegacyIframeMode,
      shouldConfirmLeave,
      isErrorRoute,
      ...navigationContext,
      tabIntent: Boolean(next.tabIntent),
    }

    const decision = resolveNavigationDecision(decisionInput)

    if (!next.onCommit) updateDocumentTitle(to)

    return executeNavigationDecision(decision, { to, next, onCommit: next.onCommit })
  }
}

export function installNavigationOrchestration(
  router: any,
  updateDocumentTitle: (route: any) => void,
  readDecisionContext: (to: any) => NavigationContext,
  executeNavigationDecision: NavigationDecisionExecutor
) {
  installStatisticsStudioBeforeUnloadGuard()
  router.afterEach(updateDocumentTitle)
  router.beforeEach(
    createNavigationGuard(updateDocumentTitle, readDecisionContext, executeNavigationDecision)
  )
}
