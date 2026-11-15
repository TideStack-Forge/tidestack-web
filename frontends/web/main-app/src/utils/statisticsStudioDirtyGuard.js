const STUDIO_PATH_PATTERN = /^\/dev\/[^/]+\/analytics\/datasets\/[^/]+\/studio\/?$/
const LEAVE_MESSAGE = '当前 Dataset Studio 存在未保存改动，离开后未保存内容将会丢失。'

const dirtyStudioPaths = new Set()
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

function isStatisticsDatasetStudioPath(path) {
  return STUDIO_PATH_PATTERN.test(normalizePath(path))
}

function markStatisticsStudioDirty(path) {
  const normalizedPath = normalizePath(path)
  if (normalizedPath && isStatisticsDatasetStudioPath(normalizedPath)) {
    dirtyStudioPaths.add(normalizedPath)
    return
  }
  hasAnonymousDirtyChange = true
}

function clearStatisticsStudioDirty(path) {
  const normalizedPath = normalizePath(path)
  if (!normalizedPath) {
    dirtyStudioPaths.clear()
    hasAnonymousDirtyChange = false
    return
  }
  if (!isStatisticsDatasetStudioPath(normalizedPath)) {
    hasAnonymousDirtyChange = false
    return
  }
  dirtyStudioPaths.delete(normalizedPath)
}

function hasStatisticsStudioDirtyChanges(path) {
  const normalizedPath = normalizePath(path)
  if (normalizedPath) {
    return dirtyStudioPaths.has(normalizedPath) || hasAnonymousDirtyChange
  }
  return dirtyStudioPaths.size > 0 || hasAnonymousDirtyChange
}

function getStatisticsStudioLeaveMessage() {
  return LEAVE_MESSAGE
}

function shouldConfirmStatisticsStudioRouteLeave(from, to) {
  const fromPath = resolveRoutePath(from)
  const toPath = resolveRoutePath(to)
  if (!isStatisticsDatasetStudioPath(fromPath)) {
    return false
  }
  if (!hasStatisticsStudioDirtyChanges(fromPath)) {
    return false
  }
  if (!toPath || fromPath === toPath) {
    return false
  }
  return true
}

function handleStatisticsStudioBeforeUnload(event) {
  if (typeof window === 'undefined' || !window.location) {
    return undefined
  }
  const currentPath = normalizePath(window.location.pathname)
  if (!isStatisticsDatasetStudioPath(currentPath)) {
    return undefined
  }
  if (!hasStatisticsStudioDirtyChanges(currentPath)) {
    return undefined
  }
  const message = getStatisticsStudioLeaveMessage()
  if (event) {
    event.preventDefault()
    event.returnValue = message
  }
  return message
}

function installStatisticsStudioBeforeUnloadGuard(targetWindow = typeof window !== 'undefined' ? window : null) {
  if (
    beforeUnloadInstalled ||
    !targetWindow ||
    typeof targetWindow.addEventListener !== 'function'
  ) {
    return
  }
  targetWindow.addEventListener('beforeunload', handleStatisticsStudioBeforeUnload)
  beforeUnloadInstalled = true
}

module.exports = {
  clearStatisticsStudioDirty,
  getStatisticsStudioLeaveMessage,
  hasStatisticsStudioDirtyChanges,
  installStatisticsStudioBeforeUnloadGuard,
  isStatisticsDatasetStudioPath,
  markStatisticsStudioDirty,
  shouldConfirmStatisticsStudioRouteLeave,
}
