import userApi from '@/common/api/user'
import authApi from '@/common/api/auth'
import { doJump } from '@/common/menus'
import Storage from '@/utils/Storage'
import { EventBus } from '@/common/eventBus'
import toast from '@/utils/toast'
import { cloneDeep, debounce } from 'lodash'
import { startMicroApp } from '@/common/micro'
import { configAxios } from '@/utils/http'
import { i18nManager } from '@/common/i18n'
import { hasConfiguredMenus } from '@/common/menus/post-login'
import { findMenuItem as getMenuItem } from '@/common/menus/utils'
import { buildInitializationRecoveryLocation, resolveReturnUrl } from '@/common/auth/flow'

// TODO: 挪到 @/common/menus/utils 中
/**
 * 构建菜单翻译 key
 * @param {Object} menuItem - 菜单项
 * @returns {string} 翻译 key
 */
function buildMenuKey(menuItem) {
  // 优先使用 fullName
  if (menuItem.fullName) {
    return menuItem.fullName + '.title'
  }
  // 其次使用 router_id
  if (menuItem.router_id) {
    return menuItem.router_id.replace(/\//g, '.').replace(/^\./, '') + '.title'
  }
  // 再使用 path
  if (menuItem.path) {
    return menuItem.path.replace(/\//g, '.').replace(/^\./, '') + '.title'
  }
  // 最后使用 title 作为 fallback
  return menuItem.title
}

function normalizeMenu(menuArr, parentKey) {
  return menuArr.map((item, index) => {
    item.path = item.path ? item.path : item.url || ''
    item.key = item.title + item.path + index
    item.parent = parentKey || null

    // 翻译菜单标题
    const menuKey = buildMenuKey(item)
    const translatedTitle = i18nManager.tMenu(menuKey, item.title)

    // 直接修改 title，这样所有菜单组件都能使用翻译后的标题
    item.title = translatedTitle
    item.displayTitle = translatedTitle

    item.children = item.children || []
    if (item.children && item.children.length > 0) {
      normalizeMenu(item.children, item.key)
    }

    return item
  })
}

// TODO: 在 api 层理清除函数
function removeFunctions(obj) {
  const newObj = {}
  for (const key in obj) {
    if (
      typeof obj[key] !== 'function' &&
      key !== 'success' &&
      key !== 'error' &&
      key !== 'loginFn'
    ) {
      newObj[key] = obj[key]
    }
  }
  return newObj
}

function buildFailureResult(msg, extra = {}) {
  return {
    success: false,
    msg,
    data: null,
    ...extra,
  }
}

function buildSuccessResult(data, extra = {}) {
  return {
    success: true,
    data,
    msg: null,
    ...extra,
  }
}

function clearIdleMonitoring(state) {
  state.idleMonitoringCleanup?.()
  state.idleMonitoringCleanup = null
  state.idleMonitoringSignature = null
}

const initialState = {
  token: null,
  userInfo: {},
  menu: {
    globalMenu: [], // 全局菜单
    globalSubNav: [], // 全局副导航
  },
  authorities: {},
  authorityNames: [],
  tokenStorage: null,

  // 空闲检查
  idleLogout: false,
  idleTimeout: 30 * 60, // 单位为秒，在用的时候需要 * 1000
  idleMonitoringMethod: 'Interaction',
  idleMonitoringSignature: null,
  idleMonitoringCleanup: null,
  debouncedIdleProcessor: null,
  isLogin: false,
  initializationError: null,
}

const getters = {
  menu: (state) => state.menu,
  menuGetter: (state) => (path) =>
    getMenuItem(state.menu.globalMenu, path) ||
    getMenuItem(state.menu.globalSubNav, path),
  token: (state) => cloneDeep(state.token),
  tokenPromise: (state) => state.tokenPromise,
  userInfo: (state) => cloneDeep(state.userInfo),
  authorities: (state) => cloneDeep(state.authorities),
  hasAuth: (state) => (key) =>
    key && state.authorityNames.includes(`${key}`.toLowerCase()),
  hasRole: (state) => {
    const lowdownRoles = []
    state.userInfo.roles?.forEach((role) => {
      role.id && lowdownRoles.push(role.id.toLowerCase())
      role.name && lowdownRoles.push(role.name.toLowerCase())
    })
    return (key) => {
      if (!key) return true
      if (typeof key !== 'string') return false
      const checkRoles = key.split(',').map((role) => role.trim().toLowerCase())
      return checkRoles.some((role) => lowdownRoles.includes(role))
    }
  },
  hasConfiguredMenu: (state) => hasConfiguredMenus(state.menu),
  isLogin: (state) => state.isLogin,
  initializationError: (state) => state.initializationError,
}

const mutations = {
  INIT_TOKEN_STORAGE: (state, storage) => {
    state.tokenStorage = storage
    state.token = storage.getItem('token')
  },

  SET_TOKEN: (state, token) => {
    state.token = token
    state.tokenStorage.setItem('token', token)
  },

  SET_USERINFO: (state, userInfo) => {
    state.userInfo = userInfo
  },

  SET_AUTHORITIES: (state, authorities) => {
    if (!authorities) return
    state.authorities = authorities
    state.authorityNames = Object.keys(authorities).map((key) => key.toLowerCase())
  },

  RESET_INITIALIZATION: (state) => {
    clearIdleMonitoring(state)
    state.debouncedIdleProcessor?.cancel?.()
    state.debouncedIdleProcessor = null
    state.isLogin = false
    state.initializationError = null
    state.userInfo = {}
    state.menu = { globalMenu: [], globalSubNav: [] }
    state.authorities = {}
    state.authorityNames = []
  },

  SET_INITIALIZATION_ERROR: (state, error) => {
    state.initializationError = error
  },

  LOGOUT: (state) => {
    clearIdleMonitoring(state)
    state.debouncedIdleProcessor?.cancel?.()
    state.debouncedIdleProcessor = null
    state.userInfo = {}
    state.token = null
    state.isLogin = false
    state.initializationError = null
    state.menu = { globalMenu: [], globalSubNav: [] }
    state.authorities = {}
    state.authorityNames = []
    state.tokenStorage.removeItem('token')
  },

  GLOBAL_MENU: (state, menus) => {
    state.menu.globalMenu = menus || []
  },

  GLOBAL_SUB_MENU: (state, subMenus) => {
    state.menu.globalSubNav = subMenus || []
  },

  // 是否开启空闲检查
  SET_IDLE_LOGOUT: (state, flag) => {
    state.idleLogout = flag
  },

  // 初始化空闲检查处理器
  INIT_IDLE_PROCESSOR: (state, processor) => {
    if (state.debouncedIdleProcessor) {
      state.debouncedIdleProcessor.cancel?.()
    }
    state.debouncedIdleProcessor = debounce(processor, state.idleTimeout * 1000)
  },

  // 取消空闲处理器
  CANCEL_IDLE_PROCESSOR: (state) => {
    if (state.debouncedIdleProcessor) {
      state.debouncedIdleProcessor.cancel?.()
      state.debouncedIdleProcessor = null
    }
  },

  // 设置空闲监控方法
  SET_IDLE_MONITORING_METHOD: (state, method) => {
    state.idleMonitoringMethod = method
  },

  // 设置空闲超时时间
  SET_IDLE_TIMEOUT: (state, timeout) => {
    state.idleTimeout = timeout
  },

  SET_IDLE_MONITORING_RUNTIME: (state, { signature, cleanup }) => {
    state.idleMonitoringSignature = signature
    state.idleMonitoringCleanup = cleanup
  },

  CLEAR_IDLE_MONITORING: (state) => {
    clearIdleMonitoring(state)
  },

  // 是否已登录
  SET_IS_LOGIN: (state, isLogin) => {
    state.isLogin = isLogin
  },
}

const actions = {
  // 任何操作之前，先初始化 tokenStorage
  initStorage({ commit, rootState, rootGetters }) {
    const prefix = rootState.app.storagePrefix
    const config = rootGetters['app/config'] ?? {}
    const storageType = config['security.auth.token.storageType'] ?? 'localStorage'
    const tokenStorage = new Storage({ prefix, type: storageType })
    commit('INIT_TOKEN_STORAGE', tokenStorage)
  },

  // 用户登录: 返回 promise，api的返回结果
  async login({ dispatch, state }, data) {
    const successFn = data.success || data.loginFn
    const errorFn = data.error
    const defaultJump = data.defaultJump
    const loginData = data?.loginForm || data
    const filteredData = removeFunctions(loginData)
    const loginResult = await userApi.login(filteredData)

    if (loginResult?.code !== 0) {
      const errorMsg = loginResult.msg || '登录失败'
      if (errorFn) {
        errorFn(errorMsg)
        return buildFailureResult(errorMsg, { code: loginResult?.code })
      }
      toast.error(errorMsg)
      return buildFailureResult(errorMsg, { code: loginResult?.code })
    }

    const bootstrapResult = await dispatch('bootstrapWithToken', loginResult.data)
    if (!bootstrapResult.success) {
      if (state.token && state.initializationError) {
        const { replaceLocation } = await import('@/router/routerFacade')
        const url = new URL(window.location.href)
        await replaceLocation(
          buildInitializationRecoveryLocation(
            resolveReturnUrl(url.searchParams.get('redirect'))
          )
        )
      }
      return bootstrapResult
    }

    if (successFn) {
      if (typeof successFn === 'string') {
        window.history.replaceState({}, '', successFn)
      }
      if (typeof successFn === 'function') {
        await successFn({
          userInfo: state.userInfo,
          token: state.token,
          mainMenu: state.menu.globalMenu,
          secondaryMenu: state.menu.globalSubNav,
        })
      }
      return buildSuccessResult(loginResult.data)
    }
    // 微前端登录页自动跳转逻辑
    if (defaultJump) {
      doJump()
      return buildSuccessResult(loginResult.data)
    }
    return buildSuccessResult(loginResult.data)
  },

  async loginWithLdap({ dispatch, state }, data) {
    const successFn = data.success || data.loginFn
    const errorFn = data.error
    const defaultJump = data.defaultJump
    const provider = data.provider
    const loginData = data?.loginForm || data
    const filteredData = removeFunctions(loginData)
    delete filteredData.provider

    const loginResult = await authApi.loginWithLdap(provider, filteredData)

    if (loginResult?.code === 40901) {
      return buildFailureResult(loginResult.msg || 'Binding required', {
        code: loginResult.code,
        bindingRequired: true,
        bindingToken: loginResult?.data?.bindingToken || null,
      })
    }

    if (loginResult?.code !== 0) {
      const errorMsg = loginResult.msg || '登录失败'
      if (errorFn) {
        errorFn(errorMsg)
        return buildFailureResult(errorMsg, { code: loginResult?.code })
      }
      toast.error(errorMsg)
      return buildFailureResult(errorMsg, { code: loginResult?.code })
    }

    const bootstrapResult = await dispatch('bootstrapWithToken', loginResult.data)
    if (!bootstrapResult.success) {
      if (state.token && state.initializationError) {
        const { replaceLocation } = await import('@/router/routerFacade')
        const url = new URL(window.location.href)
        await replaceLocation(
          buildInitializationRecoveryLocation(
            resolveReturnUrl(url.searchParams.get('redirect'))
          )
        )
      }
      return bootstrapResult
    }

    if (successFn) {
      if (typeof successFn === 'string') {
        window.history.replaceState({}, '', successFn)
      }
      if (typeof successFn === 'function') {
        await successFn({
          userInfo: state.userInfo,
          token: state.token,
          mainMenu: state.menu.globalMenu,
          secondaryMenu: state.menu.globalSubNav,
        })
      }
      return buildSuccessResult(loginResult.data)
    }

    if (defaultJump) {
      doJump()
      return buildSuccessResult(loginResult.data)
    }

    return buildSuccessResult(loginResult.data)
  },

  async bootstrapWithToken({ commit, dispatch, state }, tokenPayload) {
    commit('SET_TOKEN', tokenPayload)
    const initResult = await dispatch('init')
    if (initResult?.success === false) {
      return initResult
    }
    return buildSuccessResult(tokenPayload, {
      hasConfiguredMenu: hasConfiguredMenus(state.menu),
    })
  },

  // 获取用户权限
  async fetchAuthorities() {
    return userApi.getAuthorities()
  },

  // 退出登录
  async logout({ state, commit, dispatch }, { revoke = true } = {}) {
    if (state.token && revoke) {
      await userApi.revokeToken()
    }
    EventBus.publish('SYS_LOGOUT')
    await commit('LOGOUT')
    await dispatch('tabs/clearAll', null, { root: true })
    await dispatch('cancelIdleProcessor')
    window.location.assign('/login')
  },

  // 获取用户信息
  async fetchUserInfo() {
    return userApi.getUserInfo()
  },

  // 更新菜单
  updateMenu({ commit }, menuData) {
    commit('GLOBAL_MENU', normalizeMenu(menuData.main || []))
    commit('GLOBAL_SUB_MENU', normalizeMenu(menuData.secondary || []))
  },

  // 获取用户菜单
  async fetchMenu({ dispatch }, { commitResult = true } = {}) {
    const result = await userApi.getUserMenus()
    if (result?.code === 0 && commitResult) {
      await dispatch('updateMenu', result.data || {})
    }
    return result
  },

  // 初始化用户信息和菜单
  async init({ commit, dispatch, state, rootGetters }) {
    if (!state.token) {
      const anonymousRoutes = rootGetters['app/whiteList'] || ['/login']
      if (anonymousRoutes.includes(window.location.pathname)) {
        return
      }
      const params = {}
      if (window.location.pathname && window.location.pathname !== '/') {
        const url = new URL(window.location.href)
        const redirect = url.searchParams.get('redirect')

        if (redirect) {
          params.redirect = encodeURIComponent(redirect)
        } else {
          params.redirect = encodeURIComponent(
            window.location.pathname + window.location.search
          )
        }
      }
      const paramsStr = Object.keys(params)
        .map((key) => `${key}=${params[key]}`)
        .join('&')
      window.history.replaceState({}, '', '/login' + (paramsStr ? `?${paramsStr}` : ''))
      return
    }

    commit('RESET_INITIALIZATION')
    const results = []
    for (const action of ['fetchUserInfo', 'fetchMenu', 'fetchAuthorities']) {
      const result = await dispatch(action, { commitResult: false })
      if (result?.code !== 0) {
        const failure = buildFailureResult(result?.msg || '加载失败，请稍后重试', {
          code: result?.code,
          httpStatus: result?.httpStatus,
        })
        commit('SET_INITIALIZATION_ERROR', failure)
        return failure
      }
      results.push(result)
    }
    const [userInfoResult, menuResult, authoritiesResult] = results
    commit('SET_USERINFO', userInfoResult.data)
    await dispatch('updateMenu', menuResult.data || {})
    commit('SET_AUTHORITIES', authoritiesResult.data)
    commit('SET_IS_LOGIN', true)
    await dispatch('loadUserSetting')
    // TODO: 暂时先在这里加上空闲检查，后续再抽离
    dispatch('initIdleLogout')

    // 注册微应用并启用
    await startMicroApp()

    EventBus.publish('SYS_INIT_USER')
    return buildSuccessResult(userInfoResult.data)
  },

  // 初始化空闲登出检查
  initIdleLogout({ state, dispatch, commit, rootGetters }) {
    const config = rootGetters['app/config'] ?? {}
    const idleLogout = config['security.session.idleLogout'] ?? false
    const idleTimeout = config['security.session.idleTimeout'] ?? 30 * 60 // 30分钟
    const idleMonitoringMethod =
      config['security.session.idleMonitoringMethod'] ?? 'Interaction'
    commit('SET_IDLE_LOGOUT', idleLogout)
    commit('SET_IDLE_TIMEOUT', idleTimeout)
    commit('SET_IDLE_MONITORING_METHOD', idleMonitoringMethod)
    const signature = `${idleLogout}:${idleTimeout}:${idleMonitoringMethod}`
    if (state.idleMonitoringSignature === signature) return

    commit('CLEAR_IDLE_MONITORING')
    if (!state.idleLogout) {
      commit('SET_IDLE_MONITORING_RUNTIME', { signature, cleanup: null })
      return
    }

    const method = state.idleMonitoringMethod
    let cleanup
    switch (method) {
      case 'Visibility': {
        const handleVisibilityChange = () => {
          document.hidden
            ? dispatch('initIdleProcessor')
            : dispatch('cancelIdleProcessor')
        }
        document.addEventListener('visibilitychange', handleVisibilityChange)
        cleanup = () =>
          document.removeEventListener('visibilitychange', handleVisibilityChange)
        break
      }
      case 'RequestActivity': {
        dispatch('initIdleProcessor')
        configAxios((axios) => {
          const interceptorId = axios.interceptors.request.use((config) => {
            dispatch('resetIdleCD')
            return config
          })
          cleanup = () => axios.interceptors.request.eject(interceptorId)
        })
        break
      }
      case 'Interaction':
      default: {
        dispatch('initIdleProcessor')
        const resetIdleCountdown = () => dispatch('resetIdleCD')
        const interactionEvents = ['mousemove', 'touchmove', 'keydown', 'click']
        interactionEvents.forEach((eventName) => {
          window.addEventListener(eventName, resetIdleCountdown)
        })
        cleanup = () => {
          interactionEvents.forEach((eventName) => {
            window.removeEventListener(eventName, resetIdleCountdown)
          })
        }
        break
      }
    }

    commit('SET_IDLE_MONITORING_RUNTIME', { signature, cleanup })
  },

  // 初始化空闲处理器
  initIdleProcessor({ commit, dispatch }) {
    commit('INIT_IDLE_PROCESSOR', () => {
      dispatch('logout')
    })
  },

  // 取消空闲处理器
  cancelIdleProcessor({ commit }) {
    commit('CANCEL_IDLE_PROCESSOR')
  },

  // 重置空闲计时器
  resetIdleCD({ state, dispatch }) {
    state.debouncedIdleProcessor
      ? state.debouncedIdleProcessor()
      : dispatch('initIdleProcessor')
  },

  async loadUserSetting() {
    const result = (await userApi.getUserSetting()).data
    if (!result) return
    if (typeof result === 'object' && !Array.isArray(result)) {
      Object.keys(result).forEach((key) => {
        const value = result[key]
        sessionStorage.setItem(
          key,
          typeof value === 'object' ? JSON.stringify(value) : value
        )
      })
    }
  },
}

export default {
  namespaced: true,
  state: initialState,
  getters,
  mutations,
  actions,
}
