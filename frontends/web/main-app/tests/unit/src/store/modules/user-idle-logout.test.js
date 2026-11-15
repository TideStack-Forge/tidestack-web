import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

const { configAxios } = vi.hoisted(() => ({
  configAxios: vi.fn(),
}))

vi.mock('@/common/api/user', () => ({ default: {} }))
vi.mock('@/common/api/auth', () => ({ default: {} }))
vi.mock('@/common/menus', () => ({ doJump: vi.fn() }))
vi.mock('@/utils/Storage', () => ({ default: class Storage {} }))
vi.mock('@/common/eventBus', () => ({ EventBus: { publish: vi.fn() } }))
vi.mock('@/utils/toast', () => ({ default: {} }))
vi.mock('@/common/micro', () => ({ startMicroApp: vi.fn() }))
vi.mock('@/utils/http', () => ({ configAxios }))
vi.mock('@/common/i18n', () => ({ i18nManager: { tMenu: vi.fn() } }))
vi.mock('@/common/menus/post-login', () => ({ hasConfiguredMenus: vi.fn() }))

const userModule = (await import('../../../../../src/store/modules/user.js')).default

function createState() {
  return {
    token: { accessToken: 'token' },
    userInfo: {},
    menu: { globalMenu: [], globalSubNav: [] },
    authorities: {},
    authorityNames: [],
    tokenStorage: { removeItem: vi.fn() },
    idleLogout: false,
    idleTimeout: 30 * 60,
    idleMonitoringMethod: 'Interaction',
    idleMonitoringSignature: null,
    idleMonitoringCleanup: null,
    debouncedIdleProcessor: null,
    isLogin: true,
  }
}

function createActionContext(state, configRef) {
  const commit = vi.fn((type, payload) => userModule.mutations[type](state, payload))
  const dispatch = vi.fn()

  return {
    state,
    commit,
    dispatch,
    rootGetters: {
      get 'app/config'() {
        return configRef.current
      },
    },
  }
}

function createEventTarget() {
  return {
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }
}

describe('store/modules/user idle logout runtime', () => {
  beforeEach(() => {
    configAxios.mockReset()
    vi.stubGlobal('window', createEventTarget())
    vi.stubGlobal('document', { ...createEventTarget(), hidden: false })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  test('does not install duplicate interaction listeners for the same configuration', () => {
    const state = createState()
    const configRef = {
      current: {
        'security.session.idleLogout': true,
        'security.session.idleTimeout': 120,
        'security.session.idleMonitoringMethod': 'Interaction',
      },
    }
    const context = createActionContext(state, configRef)

    userModule.actions.initIdleLogout(context)
    userModule.actions.initIdleLogout(context)

    expect(window.addEventListener).toHaveBeenCalledTimes(4)
    expect(context.dispatch).toHaveBeenCalledTimes(1)
    expect(state.idleMonitoringSignature).toBe('true:120:Interaction')
  })

  test('ejects the request interceptor when the monitoring configuration changes', () => {
    const state = createState()
    const configRef = {
      current: {
        'security.session.idleLogout': true,
        'security.session.idleMonitoringMethod': 'RequestActivity',
      },
    }
    const context = createActionContext(state, configRef)
    const eject = vi.fn()
    const use = vi.fn(() => 7)
    configAxios.mockImplementation((configure) => {
      configure({ interceptors: { request: { use, eject } } })
    })

    userModule.actions.initIdleLogout(context)
    configRef.current = {
      'security.session.idleLogout': true,
      'security.session.idleMonitoringMethod': 'Visibility',
    }
    userModule.actions.initIdleLogout(context)

    expect(use).toHaveBeenCalledTimes(1)
    expect(eject).toHaveBeenCalledWith(7)
    expect(document.addEventListener).toHaveBeenCalledWith(
      'visibilitychange',
      expect.any(Function)
    )
  })

  test('logout releases idle monitoring and the pending idle processor', () => {
    const state = createState()
    const cleanup = vi.fn()
    const cancel = vi.fn()
    state.idleMonitoringSignature = 'true:1800:Interaction'
    state.idleMonitoringCleanup = cleanup
    state.debouncedIdleProcessor = { cancel }

    userModule.mutations.LOGOUT(state)

    expect(cleanup).toHaveBeenCalledTimes(1)
    expect(cancel).toHaveBeenCalledTimes(1)
    expect(state.idleMonitoringSignature).toBeNull()
    expect(state.idleMonitoringCleanup).toBeNull()
    expect(state.debouncedIdleProcessor).toBeNull()
    expect(state.tokenStorage.removeItem).toHaveBeenCalledWith('token')
  })
})
