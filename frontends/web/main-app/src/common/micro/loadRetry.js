const MAX_MICRO_APP_LOAD_RETRIES = 3
const MICRO_APP_RETRY_STORAGE_KEY = 'Ouroboros_micro_app_load_retries'

const microAppLoadTargets = new Map()
let memoryMicroAppLoadFailures = {}

function readMicroAppLoadFailures() {
  if (typeof window === 'undefined') {
    return { ...memoryMicroAppLoadFailures }
  }

  try {
    const raw = window.sessionStorage.getItem(MICRO_APP_RETRY_STORAGE_KEY)
    if (!raw) {
      return {}
    }

    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {}
    }

    return parsed
  } catch (error) {
    return {}
  }
}

function writeMicroAppLoadFailures(failures) {
  memoryMicroAppLoadFailures = { ...failures }

  if (typeof window === 'undefined') {
    return
  }

  try {
    if (Object.keys(failures).length === 0) {
      window.sessionStorage.removeItem(MICRO_APP_RETRY_STORAGE_KEY)
      return
    }

    window.sessionStorage.setItem(MICRO_APP_RETRY_STORAGE_KEY, JSON.stringify(failures))
  } catch (error) {
    console.warn('Failed to persist micro app retry state', error)
  }
}

function getRetryKey(appName) {
  return microAppLoadTargets.get(appName)
}

function createState(failures) {
  return {
    exhausted: failures >= MAX_MICRO_APP_LOAD_RETRIES,
    failures,
  }
}

function getMicroAppLoadState(retryKey) {
  const failures = readMicroAppLoadFailures()
  return createState(failures[retryKey] || 0)
}

function registerMicroAppLoadTarget(appName, retryKey) {
  if (!appName || !retryKey) return
  microAppLoadTargets.set(appName, retryKey)
}

function canRetryMicroApp(retryKey) {
  return !getMicroAppLoadState(retryKey).exhausted
}

function recordMicroAppLoadFailure(retryKey) {
  if (!retryKey) {
    return createState(0)
  }

  const failures = readMicroAppLoadFailures()
  const nextFailureCount = (failures[retryKey] || 0) + 1
  failures[retryKey] = nextFailureCount
  writeMicroAppLoadFailures(failures)
  return createState(nextFailureCount)
}

function recordMicroAppLoadFailureByName(appName) {
  return recordMicroAppLoadFailure(getRetryKey(appName))
}

function recordMicroAppMountSuccess(retryKey) {
  if (!retryKey) {
    return createState(0)
  }

  const failures = readMicroAppLoadFailures()
  delete failures[retryKey]
  writeMicroAppLoadFailures(failures)
  return createState(0)
}

function recordMicroAppMountSuccessByName(appName) {
  return recordMicroAppMountSuccess(getRetryKey(appName))
}

function resetMicroAppLoadRetryState() {
  microAppLoadTargets.clear()
  writeMicroAppLoadFailures({})
}

module.exports = {
  MAX_MICRO_APP_LOAD_RETRIES,
  canRetryMicroApp,
  getMicroAppLoadState,
  recordMicroAppLoadFailure,
  recordMicroAppLoadFailureByName,
  recordMicroAppMountSuccess,
  recordMicroAppMountSuccessByName,
  registerMicroAppLoadTarget,
  resetMicroAppLoadRetryState,
}
