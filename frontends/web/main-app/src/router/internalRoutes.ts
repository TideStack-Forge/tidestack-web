import { createElement } from 'react'

import UserProfilePage, { AdminUserProfilePage } from '@/features/account/UserProfilePage'
import LoginRoute from '@/features/auth/routes/LoginRoute'
import OidcConsentPage from '@/features/auth/pages/OidcConsentPage'
import OidcLoginRoute from '@/features/auth/routes/OidcLoginRoute'
import LoginCallbackRoute from '@/features/auth/routes/LoginCallbackRoute'
import LoginBindRoute from '@/features/auth/routes/LoginBindRoute'
import { ErrorAfterLoginPage } from '@/features/system/pages/ErrorAfterLoginPage'
import { NotFoundPage } from '@/features/system/pages/NotFoundPage'
import { WelcomePage } from '@/features/system/pages/WelcomePage'
import { ScriptEditorIntelligencePage } from '@/pages/debug/ScriptEditorIntelligencePage'
import { DatasetSqlEditorPage } from '@/pages/debug/DatasetSqlEditorPage'
import { StatisticsRuntimeChartPage } from '@/pages/runtime/statistics-reporting/StatisticsRuntimeChartPage'

function RootRedirectPlaceholderPage() {
  return createElement('div', null, '正在跳转...')
}

export const standaloneInternalRoutes = [
  { path: '/login/oidc/consent', name: 'oidcConsent', meta: { title: '授权确认', authIds: [], type: 'internal', cache: false }, pageComponent: OidcConsentPage },
  {
    path: '/login/oidc',
    name: 'oidcLogin',
    meta: { title: '授权登录', authIds: [], type: 'internal', cache: false },
    pageComponent: OidcLoginRoute,
  },
  {
    path: '/login',
    name: 'login',
    meta: {
      title: '登录',
      authIds: [],
      type: 'internal',
    },
    pageComponent: LoginRoute,
  },
  {
    path: '/login/callback',
    name: 'loginCallback',
    meta: {
      title: '登录回调',
      authIds: [],
      type: 'internal',
    },
    pageComponent: LoginCallbackRoute,
  },
  {
    path: '/login/bind',
    name: 'loginBind',
    meta: {
      title: '绑定账号',
      authIds: [],
      type: 'internal',
    },
    pageComponent: LoginBindRoute,
  },
  {
    path: '/debug/script-editor-intelligence',
    name: 'scriptEditorIntelligenceDebug',
    meta: {
      title: 'Script Editor Intelligence Playground',
      authIds: [],
      type: 'internal',
    },
    pageComponent: ScriptEditorIntelligencePage,
  },
  {
    path: '/debug/dataset-sql-editor',
    name: 'datasetSqlEditorDebug',
    meta: {
      title: '数据集 SQL 编辑器调试页',
      authIds: [],
      type: 'internal',
    },
    pageComponent: DatasetSqlEditorPage,
  },
  {
    path: '/runtime/statistics-reporting/charts/:chartName',
    name: 'statistics-reporting-chart',
    meta: {
      title: '图表',
      authIds: [],
      type: 'internal',
    },
    pageComponent: StatisticsRuntimeChartPage,
  },
]

export const appLayoutChildren = [
  { path: '/system-setting/user-management/profile', name: 'adminUserProfile', meta: { title: '用户资料', type: 'internal', authIds: ['systemSetting.userManagement.profile'], cache: false }, pageComponent: AdminUserProfilePage },
  { path: "/personal-settings/profile", name: "userProfile", meta: { title: "个人资料", type: "internal" }, pageComponent: UserProfilePage },
  {
    path: '/',
    pageComponent: RootRedirectPlaceholderPage,
  },
  {
    path: '/welcome',
    name: 'welcome',
    pageComponent: WelcomePage,
    meta: {
      title: '欢迎页',
      type: 'internal',
    },
  },
  {
    path: '/errorAfterLogin',
    name: 'errorAfterLogin',
    pageComponent: ErrorAfterLoginPage,
    meta: {
      title: '错误页',
      type: 'internal',
    },
  },
  {
    path: '*',
    name: 'notFound',
    pageComponent: NotFoundPage,
    meta: {
      title: '页面未找到',
      type: 'internal',
    },
  },
]

export default {
  standaloneInternalRoutes,
  appLayoutChildren,
}
