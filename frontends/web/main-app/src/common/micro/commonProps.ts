import { openDialog, openDrawer, alert, prompt, confirm } from '@/common/modal'
import tabs from '@/common/tabs'
import { openMenuItem } from '@/common/menus'
import { menu, userMenu } from '@/common/menus/registry'
import { EventBus } from '@/common/eventBus'
import { renderAmisSchema } from '@/components/amis/AmisComponent'
import { registerIcon, registerFormula } from 'amis'
import { FormItem, OptionsControl, Renderer, addRule, registerAction, utils } from 'amis-core'
import { request } from '@/utils/http'
import { toast } from '@/utils/toast'
import * as stomp from '@/utils/Stomp'
import { getTheme, setTheme } from '@/utils/theme'
import {
  registerActionPanel,
  registerValidator,
  registerEditorPlugin,
} from 'ouroboros-amis-runtime/editor/lazyRegister'
import type { LanguageOption } from '@/common/i18n/types'
import type { AuthProviderInfo } from '@/common/auth/types'
import { readCommonPropsRuntimeValues } from './commonPropsRuntime'

export interface MicroWebUtils {
  registerIcon: typeof registerIcon
  FormItem: typeof FormItem
  OptionsControl: typeof OptionsControl
  Renderer: typeof Renderer
  addRule: typeof addRule
  registerFormula: typeof registerFormula
  registerAction: typeof registerAction
  registerValidator: typeof registerValidator
  registerEditorPlugin: typeof registerEditorPlugin
  registerActionPanel: typeof registerActionPanel
  confirm: typeof confirm
  alert: typeof alert
  prompt: typeof prompt
  toast: typeof toast
  amisUtils: typeof utils
  request: typeof request
  stomp: typeof stomp
  openTab: typeof tabs.openTab
  closeTab: typeof tabs.closeTab
  openOrSwitchTab: typeof tabs.openOrSwitchTab
  sendToOpenerTab: typeof tabs.sendToOpenerTab
  updateTabTitle: typeof tabs.updateTabTitle
  openMenu: typeof openMenuItem
  openDialog: typeof openDialog
  openDrawer: typeof openDrawer
  renderAmisSchema: typeof renderAmisSchema
  eventBus: typeof EventBus
  hasAuth: any
  getTheme: typeof getTheme
  setTheme: typeof setTheme
  menu: typeof menu
  userMenu: typeof userMenu
  loginHandler: (params: any) => Promise<any>
  getToken: () => Promise<any>
  listExternalProviders: () => Promise<AuthProviderInfo[]>
  isLocalPasswordLoginEnabled: () => boolean
  startRedirectLogin: (provider: AuthProviderInfo, returnUrl?: string) => string | null
  loginWithLdap: (params: any) => Promise<any>
  exchangeLoginCode: (loginCode: string) => Promise<any>
  bindExternalAccount: (params: any) => Promise<any>
  resolveReturnUrl: (input?: any) => string
  mapAuthError: (code?: string | number) => string
  logoutHandler: () => Promise<any>
  getUserInfo: () => Promise<any>
}

export interface MicroWebCommonProps {
  token: { accessToken: any; refreshToken: any }
  apiHost: string
  mainWindow: Window
  appInfo: Record<string, any>
  config: Record<string, any>
  __utils__: MicroWebUtils
  i18n: {
    getLocale: () => string
    getLanguages: () => LanguageOption[]
    switchLanguage: (locale: string) => Promise<void>
    t: (key: string, defaultText?: string, params?: Record<string, any>) => string
    tn: (
      namespace: string,
      key: string,
      defaultText?: string,
      params?: Record<string, any>
    ) => string
    tMenu: (key: string, defaultText?: string) => string
    tCommon: (key: string, defaultText?: string, params?: Record<string, any>) => string
    useNamespace: (
      namespace: string
    ) => (key: string, defaultText?: string, params?: Record<string, any>) => string
    getLocaleData: () => any
    onLocaleChange: (callback: (locale: string) => void) => () => void
  }
}

export interface CommonPropsRuntimeValues {
  token: { accessToken: any; refreshToken: any }
  apiHost: string
  mainWindow: Window
  appInfo: Record<string, any>
  config: Record<string, any>
  hasAuth: any
  loginHandler: (params: any) => Promise<any>
  getToken: () => Promise<any>
  listExternalProviders: () => Promise<AuthProviderInfo[]>
  isLocalPasswordLoginEnabled: () => boolean
  startRedirectLogin: (provider: AuthProviderInfo, returnUrl?: string) => string | null
  loginWithLdap: (params: any) => Promise<any>
  exchangeLoginCode: (loginCode: string) => Promise<any>
  bindExternalAccount: (params: any) => Promise<any>
  resolveReturnUrl: (input?: any) => string
  mapAuthError: (code?: string | number) => string
  logoutHandler: () => Promise<any>
  getUserInfo: () => Promise<any>
  i18nManager: {
    getLocale: () => string
    t: (key: string, defaultText?: string, params?: Record<string, any>) => string
    tn: (
      namespace: string,
      key: string,
      defaultText?: string,
      params?: Record<string, any>
    ) => string
    tMenu: (key: string, defaultText?: string) => string
    tCommon: (key: string, defaultText?: string, params?: Record<string, any>) => string
    useNamespace: (
      namespace: string
    ) => (key: string, defaultText?: string, params?: Record<string, any>) => string
    getLocaleData: () => any
    onLocaleChange: (callback: (locale: string) => void) => () => void
  }
  getLanguages: () => LanguageOption[]
  switchLanguage: (locale: string) => Promise<void>
}

export interface CommonPropsCapabilityValues {
  Renderer: typeof Renderer
  FormItem: typeof FormItem
  OptionsControl: typeof OptionsControl
  registerAction: typeof registerAction
  registerIcon: typeof registerIcon
  addRule: typeof addRule
  registerFormula: typeof registerFormula
  registerValidator: typeof registerValidator
  registerEditorPlugin: typeof registerEditorPlugin
  registerActionPanel: typeof registerActionPanel
  confirm: typeof confirm
  alert: typeof alert
  prompt: typeof prompt
  toast: typeof toast
  request: typeof request
  amisUtils: typeof utils
  openTab: typeof tabs.openTab
  closeTab: typeof tabs.closeTab
  openOrSwitchTab: typeof tabs.openOrSwitchTab
  sendToOpenerTab: typeof tabs.sendToOpenerTab
  updateTabTitle: typeof tabs.updateTabTitle
  openDialog: typeof openDialog
  openDrawer: typeof openDrawer
  renderAmisSchema: typeof renderAmisSchema
  eventBus: typeof EventBus
  openMenu: typeof openMenuItem
  getTheme: typeof getTheme
  setTheme: typeof setTheme
  stomp: typeof stomp
  menu: typeof menu
  userMenu: typeof userMenu
}

function readDefaultCapabilityValues(): CommonPropsCapabilityValues {
  return {
  Renderer,
  FormItem,
  OptionsControl,
  registerAction,
  registerIcon,
  addRule,
  registerFormula,
  registerValidator,
  registerEditorPlugin,
  registerActionPanel,
  confirm,
  alert,
  prompt,
  toast,
  request,
  amisUtils: utils,
  openTab: (fullPath: string, tabOption?: unknown) => tabs.openTab(fullPath, tabOption),
  closeTab: (id?: string, result?: unknown, option?: unknown) => tabs.closeTab(id, result, option),
  openOrSwitchTab: (fullPath: string, tabOption?: unknown) =>
    tabs.openOrSwitchTab(fullPath, tabOption),
  sendToOpenerTab: (id: string | undefined, data: unknown) =>
    tabs.sendToOpenerTab(id, data),
  updateTabTitle: (id: string | undefined, title: string) => tabs.updateTabTitle(id, title),
  openDialog,
  openDrawer,
  renderAmisSchema,
  eventBus: EventBus,
  openMenu: openMenuItem,
  getTheme,
  setTheme,
  stomp,
  menu,
  userMenu,
  }
}

export function createCommonProps(
  runtime: CommonPropsRuntimeValues,
  capabilityValues: Partial<CommonPropsCapabilityValues> = {}
): MicroWebCommonProps {
  const capabilities = {
    ...readDefaultCapabilityValues(),
    ...capabilityValues,
  }

  return {
    token: runtime.token,
    apiHost: runtime.apiHost,
    mainWindow: runtime.mainWindow,
    appInfo: runtime.appInfo,
    config: runtime.config,
    __utils__: {
      Renderer: capabilities.Renderer,
      FormItem: capabilities.FormItem,
      OptionsControl: capabilities.OptionsControl,
      registerAction: capabilities.registerAction,
      registerIcon: capabilities.registerIcon,
      addRule: capabilities.addRule,
      registerFormula: capabilities.registerFormula,
      registerValidator: capabilities.registerValidator,
      registerEditorPlugin: capabilities.registerEditorPlugin,
      registerActionPanel: capabilities.registerActionPanel,
      confirm: capabilities.confirm,
      alert: capabilities.alert,
      prompt: capabilities.prompt,
      toast: capabilities.toast,
      request: capabilities.request,
      amisUtils: capabilities.amisUtils,
      openTab: capabilities.openTab,
      closeTab: capabilities.closeTab,
      openOrSwitchTab: capabilities.openOrSwitchTab,
      sendToOpenerTab: capabilities.sendToOpenerTab,
      updateTabTitle: capabilities.updateTabTitle,
      openDialog: capabilities.openDialog,
      openDrawer: capabilities.openDrawer,
      renderAmisSchema: capabilities.renderAmisSchema,
      eventBus: capabilities.eventBus,
      openMenu: capabilities.openMenu,
      hasAuth: runtime.hasAuth,
      getTheme: capabilities.getTheme,
      setTheme: capabilities.setTheme,
      menu: capabilities.menu,
      userMenu: capabilities.userMenu,
      loginHandler: runtime.loginHandler,
      getToken: runtime.getToken,
      listExternalProviders: runtime.listExternalProviders,
      isLocalPasswordLoginEnabled: runtime.isLocalPasswordLoginEnabled,
      startRedirectLogin: runtime.startRedirectLogin,
      loginWithLdap: runtime.loginWithLdap,
      exchangeLoginCode: runtime.exchangeLoginCode,
      bindExternalAccount: runtime.bindExternalAccount,
      resolveReturnUrl: runtime.resolveReturnUrl,
      mapAuthError: runtime.mapAuthError,
      logoutHandler: runtime.logoutHandler,
      stomp: capabilities.stomp,
      getUserInfo: runtime.getUserInfo,
    },
    i18n: {
      getLocale: () => runtime.i18nManager.getLocale(),
      getLanguages: () => runtime.getLanguages(),
      switchLanguage: (locale: string) => runtime.switchLanguage(locale),
      t: (key: string, defaultText?: string, params?: Record<string, any>) =>
        runtime.i18nManager.t(key, defaultText, params),
      tn: (
        namespace: string,
        key: string,
        defaultText?: string,
        params?: Record<string, any>
      ) => runtime.i18nManager.tn(namespace, key, defaultText, params),
      tMenu: (key: string, defaultText?: string) => runtime.i18nManager.tMenu(key, defaultText),
      tCommon: (key: string, defaultText?: string, params?: Record<string, any>) =>
        runtime.i18nManager.tCommon(key, defaultText, params),
      useNamespace: (namespace: string) => runtime.i18nManager.useNamespace(namespace),
      getLocaleData: () => runtime.i18nManager.getLocaleData(),
      onLocaleChange: (callback: (locale: string) => void) =>
        runtime.i18nManager.onLocaleChange(callback),
    },
  }
}

export function getCommonProps(): MicroWebCommonProps {
  return createCommonProps(readCommonPropsRuntimeValues())
}
