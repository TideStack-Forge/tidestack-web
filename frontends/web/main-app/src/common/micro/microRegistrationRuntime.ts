import { addGlobalUncaughtErrorHandler, registerMicroApps, start } from 'qiankun'
import { addErrorHandler, getAppStatus, unloadApplication } from 'single-spa'
import { store } from '@/store/storeFacade'
import { isExternal } from '@/utils/url'
import { getCommonProps } from './commonProps'
import {
  canRetryMicroApp,
  recordMicroAppLoadFailureByName,
  recordMicroAppMountSuccessByName,
  registerMicroAppLoadTarget,
} from './loadRetry'
import { normalizeMicroEntry } from './utils'
import { createMicroEntryFetch } from './entryGuard'
import {
  buildActiveRuleMatcher,
  buildEntryRoutesMap,
  buildExcludeAssetFilter,
  buildMicroAppConfigs,
  buildMicroEntryArray,
} from './microRegistration'

let singleSpaErrorHandlerBound = false

function warnMicroAppRegistrationFailure(name: string, error: unknown) {
  console.warn('注册微前端失败，已跳过该微前端', name, error)
}

addGlobalUncaughtErrorHandler(
  (
    event: Event | string,
    source?: string,
    lineno?: number,
    colno?: number,
    error?: Error
  ) => {
    console.warn('加载微前端失败', event, source, lineno, colno, error)
  }
)

function bindSingleSpaErrorHandler() {
  if (singleSpaErrorHandlerBound) return

  addErrorHandler((error) => {
    const appName = error.appOrParcelName
    const state = recordMicroAppLoadFailureByName(appName)

    if (state.failures > 0) {
      console.warn('微前端加载失败', appName, error)
    }

    if (state.exhausted) {
      console.warn('微前端加载达到重试上限，停止继续加载', appName)

      if (getAppStatus(appName) !== null) {
        unloadApplication(appName, { waitForUnmount: false }).catch((unloadError) => {
          console.warn('停止微前端重试失败', appName, unloadError)
        })
      }
    }
  })

  singleSpaErrorHandlerBound = true
}

function getWindowOrigin() {
  return window.location.protocol + '//' + window.location.host
}

export function registerMicroApp() {
  const routes = store.getters['app/routes'] || []
  const microRoutesMap = buildEntryRoutesMap(routes, { isExternal })
  const microEntryArray = buildMicroEntryArray(microRoutesMap, {
    isExternal,
    origin: getWindowOrigin(),
  })

  store.dispatch('app/saveMicroRoutesMap', {
    microRoutesMap,
    microEntryArray,
  })

  const microAppConfigs = buildMicroAppConfigs(microRoutesMap, {
    commonProps: getCommonProps(),
    normalizeEntry: normalizeMicroEntry,
    registerLoadTarget: registerMicroAppLoadTarget,
    createActiveRule: ({ routes, retryKey }) => {
      const matches = buildActiveRuleMatcher(routes)
      return (loc) => {
        if (!canRetryMicroApp(retryKey)) return false
        return matches(loc.pathname)
      }
    },
  })

  const lifeCycles = {
    afterMount: [
      (app) => {
        recordMicroAppMountSuccessByName(app.name)
      },
    ],
  }

  microAppConfigs.forEach((microAppConfig) => {
    try {
      registerMicroApps([microAppConfig], lifeCycles)
    } catch (error) {
      warnMicroAppRegistrationFailure(microAppConfig.name, error)
    }
  })
}

export async function startMicroApp() {
  registerMicroApp()
  bindSingleSpaErrorHandler()
  start({
    excludeAssetFilter: buildExcludeAssetFilter(
      store.getters['app/microEntryArray'] || []
    ),
    fetch: createMicroEntryFetch(),
  })
}
