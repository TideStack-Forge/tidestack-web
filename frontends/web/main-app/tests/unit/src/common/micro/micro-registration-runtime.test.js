import { beforeEach, expect, test, vi } from 'vitest'

const {
  store,
  registerMicroApps,
  start,
  addGlobalUncaughtErrorHandler,
  addErrorHandler,
  getAppStatus,
  unloadApplication,
  recordMicroAppLoadFailureByName,
  recordMicroAppMountSuccessByName,
  registerMicroAppLoadTarget,
  canRetryMicroApp,
  isExternal,
  normalizeMicroEntry,
  getCommonProps,
  buildEntryRoutesMap,
  buildMicroEntryArray,
  buildActiveRuleMatcher,
  buildMicroAppConfigs,
  buildExcludeAssetFilter,
  createMicroEntryFetch,
} = vi.hoisted(() => ({
  store: {
    getters: {
      'app/routes': [],
      'app/microEntryArray': [],
      'app/microRoutesMap': {},
    },
    dispatch: vi.fn(),
  },
  registerMicroApps: vi.fn(),
  start: vi.fn(),
  addGlobalUncaughtErrorHandler: vi.fn(),
  addErrorHandler: vi.fn(),
  getAppStatus: vi.fn(),
  unloadApplication: vi.fn(() => Promise.resolve()),
  recordMicroAppLoadFailureByName: vi.fn(() => ({ failures: 0, exhausted: false })),
  recordMicroAppMountSuccessByName: vi.fn(),
  registerMicroAppLoadTarget: vi.fn(),
  canRetryMicroApp: vi.fn(() => true),
  isExternal: vi.fn((value) => /^https?:/.test(value)),
  normalizeMicroEntry: vi.fn((value) => `normalized:${value}`),
  getCommonProps: vi.fn(() => ({ token: 'abc' })),
  buildEntryRoutesMap: vi.fn(),
  buildMicroEntryArray: vi.fn(),
  buildActiveRuleMatcher: vi.fn(),
  buildMicroAppConfigs: vi.fn(),
  buildExcludeAssetFilter: vi.fn(),
  createMicroEntryFetch: vi.fn(() => vi.fn()),
}))

vi.mock('@/store/storeFacade', () => ({
  store,
}))

vi.mock('qiankun', () => ({
  registerMicroApps,
  start,
  addGlobalUncaughtErrorHandler,
}))

vi.mock('single-spa', () => ({
  addErrorHandler,
  getAppStatus,
  unloadApplication,
}))

vi.mock('@/utils/url', () => ({
  isExternal,
}))

vi.mock('../../../../../src/common/micro/loadRetry.js', () => ({
  canRetryMicroApp,
  recordMicroAppLoadFailureByName,
  recordMicroAppMountSuccessByName,
  registerMicroAppLoadTarget,
}))

vi.mock('../../../../../src/common/micro/utils.js', () => ({
  normalizeMicroEntry,
}))

vi.mock('../../../../../src/common/micro/commonProps.ts', () => ({
  getCommonProps,
}))

vi.mock('../../../../../src/common/micro/entryGuard.js', () => ({
  createMicroEntryFetch,
}))

vi.mock('../../../../../src/common/micro/microRegistration.ts', () => ({
  buildEntryRoutesMap,
  buildMicroEntryArray,
  buildActiveRuleMatcher,
  buildMicroAppConfigs,
  buildExcludeAssetFilter,
}))

const registerMicroAppModule =
  await import('../../../../../src/common/micro/registerMicroApp.js')
const microIndexModule = await import('../../../../../src/common/micro/index.ts')

beforeEach(() => {
  Object.defineProperty(globalThis, 'window', {
    value: {
      location: {
        protocol: 'https:',
        host: 'host.test',
      },
    },
    configurable: true,
    writable: true,
  })
  store.getters['app/routes'] = []
  store.getters['app/microEntryArray'] = []
  store.getters['app/microRoutesMap'] = {}
  store.dispatch.mockReset()
  registerMicroApps.mockReset()
  start.mockReset()
  addGlobalUncaughtErrorHandler.mockReset()
  addErrorHandler.mockReset()
  getAppStatus.mockReset()
  unloadApplication.mockReset()
  recordMicroAppLoadFailureByName.mockReset()
  recordMicroAppMountSuccessByName.mockReset()
  registerMicroAppLoadTarget.mockReset()
  canRetryMicroApp.mockReset()
  isExternal.mockReset()
  normalizeMicroEntry.mockReset()
  getCommonProps.mockReset()
  buildEntryRoutesMap.mockReset()
  buildMicroEntryArray.mockReset()
  buildActiveRuleMatcher.mockReset()
  buildMicroAppConfigs.mockReset()
  buildExcludeAssetFilter.mockReset()
  createMicroEntryFetch.mockReset()
  canRetryMicroApp.mockReturnValue(true)
  isExternal.mockImplementation((value) => /^https?:/.test(value))
  normalizeMicroEntry.mockImplementation((value) => `normalized:${value}`)
  getCommonProps.mockReturnValue({ token: 'abc' })
  recordMicroAppLoadFailureByName.mockReturnValue({ failures: 0, exhausted: false })
  buildMicroAppConfigs.mockImplementation((entryRoutesMap, options) => {
    return Object.entries(entryRoutesMap).map(([entry, routes]) => {
      const retryKey = `route:${entry}`
      const name = entry.startsWith('-')
        ? 'micro' + entry
        : `micro${entry.replace(/[\\/?=:]/g, '-')}`
      options.registerLoadTarget(name, retryKey)
      return {
        entry: options.normalizeEntry(entry),
        activeRule: options.createActiveRule({ entry, routes, retryKey }),
        container: '#micro-app',
        name,
        props: options.commonProps,
      }
    })
  })
  buildExcludeAssetFilter.mockImplementation((microEntryArray) => {
    return (assetUrl) => !microEntryArray.some((item) => assetUrl.startsWith(item))
  })
  createMicroEntryFetch.mockReturnValue(vi.fn())
})

test('registerMicroApp reads app routes, persists maps, and builds retry-gated activeRule configs', () => {
  store.getters['app/routes'] = [
    { path: '/dev/apps/:id', type: 'micro', entry: '/micro-app-a' },
  ]
  buildEntryRoutesMap.mockReturnValue({ '/micro-app-a': ['/dev/apps/:id'] })
  buildMicroEntryArray.mockReturnValue(['https://host.test/micro-app-a'])
  buildActiveRuleMatcher.mockReturnValue((pathname) => pathname === '/dev/apps/123')

  registerMicroAppModule.registerMicroApp()

  expect(buildEntryRoutesMap).toHaveBeenCalledWith(store.getters['app/routes'], {
    isExternal,
  })
  expect(store.dispatch).toHaveBeenCalledWith('app/saveMicroRoutesMap', {
    microRoutesMap: { '/micro-app-a': ['/dev/apps/:id'] },
    microEntryArray: ['https://host.test/micro-app-a'],
  })
  expect(registerMicroAppLoadTarget).toHaveBeenCalledWith(
    'micro-micro-app-a',
    'route:/micro-app-a'
  )
  expect(registerMicroApps).toHaveBeenCalledTimes(1)
  expect(buildMicroAppConfigs).toHaveBeenCalledTimes(1)

  const configs = registerMicroApps.mock.calls[0][0]
  expect(configs[0].entry).toBe('normalized:/micro-app-a')
  expect(configs[0].activeRule({ pathname: '/dev/apps/123' })).toBe(true)
  expect(buildActiveRuleMatcher).toHaveBeenCalledWith(['/dev/apps/:id'])
})

test('startMicroApp uses runtime-provided microEntryArray in excludeAssetFilter', async () => {
  store.getters['app/microEntryArray'] = [
    'https://host.test/micro-a',
    'https://micro.example.com',
  ]
  buildEntryRoutesMap.mockReturnValue({})
  buildMicroEntryArray.mockReturnValue([])

  await microIndexModule.startMicroApp()

  expect(start).toHaveBeenCalledTimes(1)
  expect(createMicroEntryFetch).toHaveBeenCalledTimes(1)
  expect(buildExcludeAssetFilter).toHaveBeenCalledWith(
    store.getters['app/microEntryArray']
  )
  const options = start.mock.calls[0][0]
  expect(options.fetch).toBe(createMicroEntryFetch.mock.results[0].value)
  expect(options.excludeAssetFilter('https://host.test/micro-a/main.js')).toBe(false)
  expect(options.excludeAssetFilter('https://other.test/app.js')).toBe(true)
})

test('startMicroApp skips failed registration configs and still starts qiankun', async () => {
  buildEntryRoutesMap.mockReturnValue({})
  buildMicroEntryArray.mockReturnValue([])
  const failedError = new Error('register failed')
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  buildMicroAppConfigs.mockReturnValue([
    {
      name: 'micro-a',
      entry: 'normalized:/micro-a',
      activeRule: () => true,
      container: '#micro-app',
      props: {},
    },
    {
      name: 'micro-b',
      entry: 'normalized:/micro-b',
      activeRule: () => true,
      container: '#micro-app',
      props: {},
    },
    {
      name: 'micro-c',
      entry: 'normalized:/micro-c',
      activeRule: () => true,
      container: '#micro-app',
      props: {},
    },
  ])
  registerMicroApps.mockImplementation((configs) => {
    if (configs[0].name === 'micro-b') {
      throw failedError
    }
  })

  try {
    await microIndexModule.startMicroApp()

    expect(registerMicroApps).toHaveBeenCalledTimes(3)
    expect(registerMicroApps.mock.calls.map(([configs]) => configs[0].name)).toEqual([
      'micro-a',
      'micro-b',
      'micro-c',
    ])
    expect(warn).toHaveBeenCalledWith(
      '注册微前端失败，已跳过该微前端',
      'micro-b',
      failedError
    )
    expect(start).toHaveBeenCalledTimes(1)
  } finally {
    warn.mockRestore()
  }
})
