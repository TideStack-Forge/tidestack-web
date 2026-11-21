import { getBootstrapMode } from '@/utils'
import { EventBus } from '@/common/eventBus'
import {
  clearStatisticsDatasetEditorDirty,
  getStatisticsDatasetEditorLeaveMessage,
  installStatisticsDatasetEditorBeforeUnloadGuard,
  shouldConfirmStatisticsDatasetEditorRouteLeave,
} from '@/utils/statisticsDatasetEditorDirtyGuard'
import {
  clearStatisticsChartEditorDirty,
  getStatisticsChartEditorLeaveMessage,
  installStatisticsChartEditorBeforeUnloadGuard,
  installStatisticsChartEditorEventBridge,
  shouldConfirmStatisticsChartEditorRouteLeave,
} from '@/utils/statisticsChartEditorDirtyGuard'
import type { NavigationContext } from './navigationContext'
import {
  resolveNavigationDecision,
  type NavigationDecisionInput,
} from './navigationDecision'
import type { NavigationDecisionExecutor } from './navigationExecution'

export function createNavigationGuard(
  updateDocumentTitle: (route: any) => void,
  readDecisionContext: (to: any) => NavigationContext,
  executeNavigationDecision: NavigationDecisionExecutor
) {
  return async (to: any, from: any, next: any) => {
    const isLegacyIframeMode = getBootstrapMode(window.location.href) === 'legacyIframe'
    const shouldConfirmLeave = shouldConfirmStatisticsDatasetEditorRouteLeave(from, to)
    const shouldConfirmChartLeave = shouldConfirmStatisticsChartEditorRouteLeave(from, to)

    if (shouldConfirmLeave || shouldConfirmChartLeave) {
      const confirmed = window.confirm(
        shouldConfirmChartLeave
          ? getStatisticsChartEditorLeaveMessage()
          : getStatisticsDatasetEditorLeaveMessage()
      )
      if (!confirmed) {
        return next(false)
      }
      if (shouldConfirmChartLeave) {
        clearStatisticsChartEditorDirty(from.fullPath || from.path)
      } else {
        clearStatisticsDatasetEditorDirty(from.fullPath || from.path)
      }
    }

    const isErrorRoute = (to.name || '').toLowerCase() === 'error'
    const navigationContext = readDecisionContext(to)
    const decisionInput: NavigationDecisionInput = {
      isLegacyIframeMode,
      shouldConfirmLeave: shouldConfirmLeave || shouldConfirmChartLeave,
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
  installStatisticsDatasetEditorBeforeUnloadGuard()
  installStatisticsChartEditorBeforeUnloadGuard()
  installStatisticsChartEditorEventBridge(EventBus, () => router.currentRoute?.fullPath)
  router.afterEach(updateDocumentTitle)
  router.beforeEach(
    createNavigationGuard(
      updateDocumentTitle,
      readDecisionContext,
      executeNavigationDecision
    )
  )
}
