const CHART_EDITOR_PATH_PATTERN = /^\/dev\/[^/]+\/chart\/[^/]+\/?$/
const LEAVE_MESSAGE = '当前图表编辑器存在未保存改动，离开后未保存内容将会丢失。'

const dirtyChartEditorPaths = new Set()
let beforeUnloadInstalled = false
let eventBusInstalled = false

function normalizePath(path) {
  if (typeof path !== 'string') {
    return ''
  }
  const normalized = path.split('?')[0].split('#')[0]
  return normalized.length > 1 && normalized.endsWith('/')
    ? normalized.slice(0, -1)
    : normalized
}

function isStatisticsChartEditorPath(path) {
  return CHART_EDITOR_PATH_PATTERN.test(normalizePath(path))
}

function markStatisticsChartEditorDirty(path) {
  const normalizedPath = normalizePath(path)
  if (isStatisticsChartEditorPath(normalizedPath)) {
    dirtyChartEditorPaths.add(normalizedPath)
  }
}

function clearStatisticsChartEditorDirty(path) {
  const normalizedPath = normalizePath(path)
  if (!normalizedPath) {
    dirtyChartEditorPaths.clear()
    return
  }
  dirtyChartEditorPaths.delete(normalizedPath)
}

function hasStatisticsChartEditorDirtyChanges(path) {
  const normalizedPath = normalizePath(path)
  return normalizedPath
    ? dirtyChartEditorPaths.has(normalizedPath)
    : dirtyChartEditorPaths.size > 0
}

function getStatisticsChartEditorLeaveMessage() {
  return LEAVE_MESSAGE
}

function shouldConfirmStatisticsChartEditorRouteLeave(from, to) {
  const fromPath = normalizePath(from?.fullPath || from?.path)
  const toPath = normalizePath(to?.fullPath || to?.path)
  return (
    isStatisticsChartEditorPath(fromPath) &&
    hasStatisticsChartEditorDirtyChanges(fromPath) &&
    Boolean(toPath) &&
    fromPath !== toPath
  )
}

function handleBeforeUnload(event) {
  if (typeof window === 'undefined') {
    return undefined
  }
  const currentPath = normalizePath(window.location?.pathname)
  if (
    !isStatisticsChartEditorPath(currentPath) ||
    !hasStatisticsChartEditorDirtyChanges(currentPath)
  ) {
    return undefined
  }
  const message = getStatisticsChartEditorLeaveMessage()
  event?.preventDefault()
  if (event) {
    event.returnValue = message
  }
  return message
}

function installStatisticsChartEditorBeforeUnloadGuard(
  targetWindow = typeof window !== 'undefined' ? window : null
) {
  if (
    beforeUnloadInstalled ||
    !targetWindow ||
    typeof targetWindow.addEventListener !== 'function'
  ) {
    return
  }
  targetWindow.addEventListener('beforeunload', handleBeforeUnload)
  beforeUnloadInstalled = true
}

function installStatisticsChartEditorEventBridge(eventBus, getCurrentPath) {
  if (eventBusInstalled || !eventBus) {
    return
  }
  const resolvePath = () => {
    const currentPath =
      getCurrentPath?.() ||
      (typeof window !== 'undefined' ? window.location?.pathname : '')
    return normalizePath(currentPath)
  }
  eventBus.subscribe('statisticsReporting.chartEditor.changed', () => {
    markStatisticsChartEditorDirty(resolvePath())
  })
  eventBus.subscribe('statisticsReporting.chartEditor.saved', () => {
    clearStatisticsChartEditorDirty(resolvePath())
  })
  eventBusInstalled = true
}

module.exports = {
  clearStatisticsChartEditorDirty,
  getStatisticsChartEditorLeaveMessage,
  hasStatisticsChartEditorDirtyChanges,
  installStatisticsChartEditorBeforeUnloadGuard,
  installStatisticsChartEditorEventBridge,
  isStatisticsChartEditorPath,
  markStatisticsChartEditorDirty,
  shouldConfirmStatisticsChartEditorRouteLeave,
}
