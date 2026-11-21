const DATASET_EDITOR_PATH_PATTERN = /^\/dev\/[^/]+\/dataset\/[^/]+\/?$/
const LEAVE_MESSAGE = '当前数据集编辑器存在未保存改动，离开后未保存内容将会丢失。'

const dirtyDatasetEditorPaths = new Set()
let hasAnonymousDirtyChange = false
let beforeUnloadInstalled = false

function normalizePath(path) {
  if (typeof path !== 'string') {
    return ''
  }
  const normalized = path.split('?')[0].split('#')[0]
  if (normalized.length > 1 && normalized.endsWith('/')) {
    return normalized.slice(0, -1)
  }
  return normalized
}

function resolveRoutePath(route) {
  if (!route || typeof route !== 'object') {
    return ''
  }
  return normalizePath(route.fullPath || route.path || '')
}

function isStatisticsDatasetEditorPath(path) {
  return DATASET_EDITOR_PATH_PATTERN.test(normalizePath(path))
}

function markStatisticsDatasetEditorDirty(path) {
  const normalizedPath = normalizePath(path)
  if (normalizedPath && isStatisticsDatasetEditorPath(normalizedPath)) {
    dirtyDatasetEditorPaths.add(normalizedPath)
    return
  }
  hasAnonymousDirtyChange = true
}

function clearStatisticsDatasetEditorDirty(path) {
  const normalizedPath = normalizePath(path)
  if (!normalizedPath) {
    dirtyDatasetEditorPaths.clear()
    hasAnonymousDirtyChange = false
    return
  }
  if (!isStatisticsDatasetEditorPath(normalizedPath)) {
    hasAnonymousDirtyChange = false
    return
  }
  dirtyDatasetEditorPaths.delete(normalizedPath)
}

function hasStatisticsDatasetEditorDirtyChanges(path) {
  const normalizedPath = normalizePath(path)
  if (normalizedPath) {
    return dirtyDatasetEditorPaths.has(normalizedPath) || hasAnonymousDirtyChange
  }
  return dirtyDatasetEditorPaths.size > 0 || hasAnonymousDirtyChange
}

function getStatisticsDatasetEditorLeaveMessage() {
  return LEAVE_MESSAGE
}

function shouldConfirmStatisticsDatasetEditorRouteLeave(from, to) {
  const fromPath = resolveRoutePath(from)
  const toPath = resolveRoutePath(to)
  if (!isStatisticsDatasetEditorPath(fromPath)) {
    return false
  }
  if (!hasStatisticsDatasetEditorDirtyChanges(fromPath)) {
    return false
  }
  if (!toPath || fromPath === toPath) {
    return false
  }
  return true
}

function handleStatisticsDatasetEditorBeforeUnload(event) {
  if (typeof window === 'undefined' || !window.location) {
    return undefined
  }
  const currentPath = normalizePath(window.location.pathname)
  if (!isStatisticsDatasetEditorPath(currentPath)) {
    return undefined
  }
  if (!hasStatisticsDatasetEditorDirtyChanges(currentPath)) {
    return undefined
  }
  const message = getStatisticsDatasetEditorLeaveMessage()
  if (event) {
    event.preventDefault()
    event.returnValue = message
  }
  return message
}

function installStatisticsDatasetEditorBeforeUnloadGuard(
  targetWindow = typeof window !== 'undefined' ? window : null
) {
  if (
    beforeUnloadInstalled ||
    !targetWindow ||
    typeof targetWindow.addEventListener !== 'function'
  ) {
    return
  }
  targetWindow.addEventListener('beforeunload', handleStatisticsDatasetEditorBeforeUnload)
  beforeUnloadInstalled = true
}

module.exports = {
  clearStatisticsDatasetEditorDirty,
  getStatisticsDatasetEditorLeaveMessage,
  hasStatisticsDatasetEditorDirtyChanges,
  installStatisticsDatasetEditorBeforeUnloadGuard,
  isStatisticsDatasetEditorPath,
  markStatisticsDatasetEditorDirty,
  shouldConfirmStatisticsDatasetEditorRouteLeave,
}
