import systemApi from '@/common/api/system'
import { isExternal } from '@/utils/url'
import { getItemFromLocal } from '@/utils/localStorage'
import { walkTree } from 'tree-like-object-utils'
import { Client } from '@/utils/http'
import { setTheme } from '@/utils/theme'
import { addCustomStyle } from '@/utils/style'
import { getUrlMatchScore, normalizeTabPath } from '@/common/tabs/tabNavigation'

function asArray(value) {
  return Array.isArray(value) ? value : []
}

function asObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {}
  }
  return value
}

function normalizeSidebarMatchUrl(url) {
  if (typeof url !== 'string') {
    return ''
  }

  const trimmedUrl = url.trim()
  if (!trimmedUrl) {
    return ''
  }

  return normalizeTabPath(trimmedUrl)
}

const initialState = {
  appInfo: {},
  appName: '潮汐栈',
  logo: '',
  routes: [],
  whiteList: [
    '/login',
    '/login/callback',
    '/login/oidc',
    '/login/bind',
    '/debug/script-editor-intelligence',
    '/debug/dataset-sql-editor',
  ],
  microWhiteRoutesMap: {},
  theme: getItemFromLocal('theme') ? getItemFromLocal('theme') : '',
  locale: 'zh-CN', // 当前语言
  microRoutesMap: {},
  microEntryArray: [],
  initialized: false, // 系统初始化状态
  homePage: '', // 默认首页地址
  headerEntry: '', // 头部导航微应用入口地址
  sidebarEntry: '', // 边栏导航微应用入口地址
  loginEntry: '', // 登录微应用入口地址
  amisLibrary: null, // amis 微应用组件
  amisComponentsRegistered: false, // amis组件微应用加载完标识
  themeList: ['dark', 'default'],
  isLockTheme: false, // 锁定主题
  quickEntry: '', // quick微应用入口地址
  isSSOAnyWhere: true, // 任意页面sso检查开关
  ssoServices: [],
  config: {}, // 系统配置
  layoutType: '', // 菜单布局方式类型
  storagePrefix: 'Ouroboros', // 本地存储、会话存储前缀
  customStyleUnloader: null,
}

function getCurrentSidebarTree(arr, currUrl) {
  const currentUrl = normalizeSidebarMatchUrl(currUrl)
  if (!currentUrl) {
    return []
  }

  let bestPath = null
  let bestScore = Number.MIN_VALUE
  walkTree(arr, (node, nodePath) => {
    const candidateUrl = normalizeSidebarMatchUrl(node.value.url || node.value.path)
    if (!candidateUrl) {
      return
    }

    const score = getUrlMatchScore(currentUrl, candidateUrl)
    if (score <= Number.MIN_VALUE || score <= bestScore) {
      return
    }

    bestScore = score
    bestPath = [...nodePath, node].map((n) => n.value)
  })

  return bestPath ? [bestPath] : []
}

const getters = {
  whiteList: (state) => asArray(state.whiteList),
  routes: (state) => asArray(state.routes),
  currentSidebarGetter: (state) => (arr, url) => getCurrentSidebarTree(arr, url),
  config: (state) => state.config,
  microRoutesMap: (state) => state.microRoutesMap,
  microEntryArray: (state) => state.microEntryArray,
  microWhiteRoutesMap: (state) => asObject(state.microWhiteRoutesMap),
  initialized: (state) => Boolean(state.initialized),
  logo: (state) => state.logo,
  homePage: (state) => state.homePage,
  quickEntry: (state) => state.quickEntry,
  headerEntry: (state) => state.headerEntry,
  sidebarEntry: (state) => state.sidebarEntry,
  loginEntry: (state) => state.loginEntry,
  amisLibrary: (state) => state.amisLibrary,
  amisComponentsRegistered: (state) => state.amisComponentsRegistered,
  themeList: (state) => state.themeList,
  isLockTheme: (state) => state.isLockTheme,
  isSSOAnyWhere: (state) => state.isSSOAnyWhere,
  ssoServices: (state) => state.ssoServices,
  appInfo: (state) => state.appInfo,
  layoutType: (state) => state.layoutType,
}

const mutations = {
  SET_APP_INFO: (state, info) => {
    state.appInfo = info
  },

  SET_APP_NAME: (state, data) => {
    state.appName = data
  },

  SET_LOGO_URL: (state, logo) => {
    state.logo = logo
  },

  SET_LOCALE: (state, locale) => {
    state.locale = locale
  },

  SET_HOME_PAGE: (state, homePage) => {
    state.homePage = homePage
  },

  SET_ROUTES: (state, routes) => {
    // 先统一处理一下path，返回合法path
    const finalRoutes = asArray(routes)
      .map((item) => {
        const route = {
          ...item,
          config: {
            ...(item?.config || {}),
          },
        }
        if (typeof route.path === 'string' && !isExternal(route.path)) {
          const path = route.path.trim()
          route.path = path.startsWith('/') ? path : '/' + path
        }
        route.title = route.title || route.name
        route.type = route.type || route.routeType
        if (route.type === 'quick') {
          route.config.entry = state.quickEntry || process.env.VUE_APP_QUICK_ENTRY
        }
        const regex = /\{([_A-Za-z]+\w*)\}/g
        if (typeof route.path === 'string') {
          route.path = route.path.replaceAll(regex, ':$1')
        }
        return route
      })

    state.routes = finalRoutes
  },

  PUSH_ROUTE: (state, route) => {
    state.routes.push(route)
  },

  SET_WHITE_LIST: (state, routes) => {
    const whiteListArr = asArray(routes)
      .filter((item) => item.isPublic === true)
      .map((item) => item.path)
    state.whiteList = [...new Set([...state.whiteList, ...whiteListArr])]
  },

  SET_THEME(state, themeName) {
    state.theme = themeName
    setTheme(themeName)
  },

  SAVE_MICRO_ROUTES_MAP: (state, microRoutesMap) => {
    state.microRoutesMap = microRoutesMap
  },

  UPDATE_MICRO_ROUTES_MAP: (state, route) => {
    state.microRoutesMap[route.fromChild] = [
      ...(state.microRoutesMap[route.fromChild]
        ? state.microRoutesMap[route.fromChild]
        : []),
      ...[route.path],
    ]
  },

  SAVE_MICRO_ENTRY_MAP: (state, microEntryArray) => {
    state.microEntryArray = microEntryArray
  },

  PUSH_MICRO_WHITE_ROUTES: (state, whiteRoutesMap) => {
    state.microWhiteRoutesMap = whiteRoutesMap
  },

  UPDATE_INITIALIZED: (state) => {
    state.initialized = true
  },

  SET_TOPBAR_ENTRY: (state, headerEntry) => {
    state.headerEntry = headerEntry
  },

  SET_SIDEBAR_ENTRY: (state, sidebarEntry) => {
    state.sidebarEntry = sidebarEntry
  },

  SET_LOGIN_ENTRY: (state, loginEntry) => {
    state.loginEntry = loginEntry
  },

  SET_AMIS_LIBRARY: (state, amisLibrary) => {
    state.amisLibrary = amisLibrary
  },

  SET_AMIS_COMPONENES_REGISTERED: (state, amisComponentsRegistered) => {
    state.amisComponentsRegistered = amisComponentsRegistered
  },

  SET_IS_LOCK_THEME: (state, isLockTheme) => {
    state.isLockTheme = isLockTheme
  },

  SET_QUICK_ENTRY: (state, quickEntry) => {
    state.quickEntry = quickEntry
  },

  SET_IS_SSO_ANY_WHERE: (state, isSSOAnyWhere) => {
    state.isSSOAnyWhere = isSSOAnyWhere
  },

  SET_SSO_SERVICES: (state, ssoServices) => {
    state.ssoServices = ssoServices
  },

  SET_CONFIG: (state, config) => {
    const configTree = {}
    for (const key in config) {
      // 先复制扁平结构
      configTree[key] = config[key]

      // 再创建树形结构
      const keyPath = key.split('.')
      if (keyPath.length > 1) {
        // 循环创建父级
        let parent = configTree
        for (let i = 0; i < keyPath.length - 1; i++) {
          const key = keyPath[i]
          if (!parent[key]) {
            parent[key] = {}
          }
          parent = parent[key]
        }
        // 为末端节点设置值
        parent[keyPath[keyPath.length - 1]] = config[key]
      }
    }
    state.config = Object.freeze(configTree)
  },

  SET_LAYOUT_TYPE: (state, layoutType) => {
    if (!layoutType) return
    state.layoutType = layoutType
  },

  SET_CUSTOM_STYLES: (state, customStyles) => {
    state.customStyleUnloader?.()
    state.customStyleUnloader = addCustomStyle({
      styles: customStyles,
      id: 'ouroboros-custom-styles',
    })
  },
}

const actions = {
  setAppName({ commit }, value) {
    commit('SET_APP_NAME', value)
  },

  setAppLogo({ commit }, value) {
    commit('SET_LOGO_URL', value)
  },

  changeTheme({ commit }, themeName) {
    commit('SET_THEME', themeName)
  },

  async init({ commit, dispatch, state }, appInfo) {
    const info = appInfo ?? (await systemApi.getAppInfo())
    if (!info) {
      return false
    }
    const {
      routes = [],
      defaultTheme = '',
      currentTheme = '',
      appName = 'Ouroboros 开发平台',
      quickEntry = '',
      logo = '',
      icon = '',
      homePage = '',
      headerEntry = '',
      sidebarEntry = '',
      loginEntry = '',
      amisLibrary = null,
      isLockTheme = false, // 锁定主题开关
      isSSOAnyWhere = true, // 任意页面sso检查开关
      ssoServices = [],
      config = {},
      layoutType = 'sidebar-split', // 菜单布局方式类型
    } = info
    const customStyles = info.customStyles ?? (info.customStyle ? [info.customStyle] : [])

    commit('UPDATE_INITIALIZED')
    commit('SET_APP_INFO', info)
    commit('SET_IS_LOCK_THEME', isLockTheme)
    // @REMOVE: currentTheme后续版本中需要移除
    commit('SET_THEME', state.theme || defaultTheme || currentTheme || 'dark')
    commit('SET_APP_NAME', appName)
    // @REMOVE: icon后续版本中需要移除
    commit('SET_LOGO_URL', logo || icon)
    commit('SET_HOME_PAGE', homePage)
    commit('SET_TOPBAR_ENTRY', headerEntry)
    commit('SET_QUICK_ENTRY', quickEntry)
    commit('SET_SIDEBAR_ENTRY', sidebarEntry)
    commit('SET_LOGIN_ENTRY', loginEntry)
    commit('SET_AMIS_LIBRARY', amisLibrary)
    commit('SET_ROUTES', routes)
    commit('SET_CONFIG', config)
    commit('SET_WHITE_LIST', routes)
    commit('SET_IS_SSO_ANY_WHERE', isSSOAnyWhere)
    commit('SET_SSO_SERVICES', ssoServices)
    commit('SET_LAYOUT_TYPE', layoutType)
    commit('SET_CUSTOM_STYLES', customStyles)

    // 初始化其他模块的 storage
    await dispatch('user/initStorage', null, { root: true })
    await dispatch('tabs/initStorage', null, { root: true })

    return info
  },

  saveMicroRoutesMap({ commit }, payload) {
    const routesMap = payload?.microRoutesMap || {}
    const microEntryArray = payload?.microEntryArray || []
    commit('SAVE_MICRO_ROUTES_MAP', routesMap)
    commit('SAVE_MICRO_ENTRY_MAP', microEntryArray)
  },

  pushMicroWhiteRoutes({ commit }, whiteRoutesMap) {
    commit('PUSH_MICRO_WHITE_ROUTES', whiteRoutesMap)
    Object.keys(whiteRoutesMap).forEach((key) => {
      if (!whiteRoutesMap[key] || !whiteRoutesMap[key].length) return
      whiteRoutesMap[key].forEach((item) => {
        const route = {
          ...item,
          title: item.name || '未知页面',
          type: 'micro',
          config: {
            entry: key,
          },
        }
        commit('PUSH_ROUTE', route)
      })
    })
  },

  setAmisComponentsRegistered({ commit }, amisComponentsRegistered) {
    commit('SET_AMIS_COMPONENES_REGISTERED', amisComponentsRegistered)
  },

  async checkSSO({ commit, state }) {
    // Deprecated: external auth is now driven by /login, /login/callback and /login/bind.
    if (!state.isSSOAnyWhere) return
    if (!state.ssoServices || !state.ssoServices.length) return
    const allCodeParamKey = state.ssoServices.map((item) => item.codeParamName || 'code')
    const uniqueAllCodeParamKey = [...new Set(allCodeParamKey)]
    // state 为空时且只有一种登录认证方式
    // 获取当前地址栏的URL
    const currentUrl = window.location.search
    // 创建URLSearchParams对象
    const urlParams = new URLSearchParams(currentUrl)
    if (state.ssoServices.length === 1 && !urlParams.has('state')) {
      if (
        state.ssoServices[0].codeParamName &&
        urlParams.has(state.ssoServices[0].codeParamName)
      ) {
        const { api, codeParamName } = state.ssoServices[0]
        const codeValue = urlParams.get(codeParamName)
        const queryParams = { [codeParamName]: codeValue }
        const res = await Client.request(api.method, api.url, queryParams)
        if (!res?.data?.code === 0) {
          return
        }
        await commit('user/SET_TOKEN', res.data, { root: true })
      }
    }
    // TODO state 不为空
  },
}

export default {
  namespaced: true,
  state: initialState,
  getters,
  mutations,
  actions,
}
