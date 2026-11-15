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
import { StatisticsSqlEditorPage } from '@/pages/debug/StatisticsSqlEditorPage'
import { StatisticsRuntimeQueryViewPage } from '@/pages/runtime/statistics-reporting/StatisticsRuntimeQueryViewPage'
import { StatisticsRuntimeReportViewPage } from '@/pages/runtime/statistics-reporting/StatisticsRuntimeReportViewPage'
import { StatisticsRuntimeDashboardPage } from '@/pages/runtime/statistics-reporting/StatisticsRuntimeDashboardPage'

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
    path: '/debug/statistics-sql-editor',
    name: 'statisticsSqlEditorDebug',
    meta: {
      title: 'Statistics SQL Editor Playground',
      authIds: [],
      type: 'internal',
    },
    pageComponent: StatisticsSqlEditorPage,
  },
  {
    path: '/runtime/statistics-reporting/query-views/:viewName',
    name: 'statistics-reporting-query-view',
    meta: {
      title: '查询视图',
      authIds: [],
      type: 'internal',
    },
    pageComponent: StatisticsRuntimeQueryViewPage,
  },
  {
    path: '/runtime/statistics-reporting/report-views/:viewName',
    name: 'statistics-reporting-report-view',
    meta: {
      title: '报表视图',
      authIds: [],
      type: 'internal',
    },
    pageComponent: StatisticsRuntimeReportViewPage,
  },
  {
    path: '/runtime/statistics-reporting/dashboards/:dashboardName',
    name: 'statistics-reporting-dashboard',
    meta: {
      title: '仪表盘',
      authIds: [],
      type: 'internal',
    },
    pageComponent: StatisticsRuntimeDashboardPage,
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
