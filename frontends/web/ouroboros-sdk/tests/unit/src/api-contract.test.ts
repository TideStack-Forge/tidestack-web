import { describe, test, expect } from 'vitest'
import * as SDK from '../../../src/main'

describe('API Contract Tests - 导出函数验证', () => {
  test('UI 相关函数存在', () => {
    expect(typeof SDK.openDialog).toBe('function')
    expect(typeof SDK.openDrawer).toBe('function')
    expect(typeof SDK.openTab).toBe('function')
    expect(typeof SDK.closeTab).toBe('function')
    expect(typeof SDK.openMenu).toBe('function')
    expect(typeof SDK.openOrSwitchTab).toBe('function')
    expect(typeof SDK.sendToOpenerTab).toBe('function')
    expect(typeof SDK.updateTabTitle).toBe('function')
  })

  test('Amis 相关函数存在', () => {
    expect(typeof SDK.FormItem).toBe('function')
    expect(typeof SDK.Renderer).toBe('function')
    expect(typeof SDK.registerAction).toBe('function')
    expect(typeof SDK.registerIcon).toBe('function')
    expect(typeof SDK.renderAmisSchema).toBe('function')
    expect(typeof SDK.addRule).toBe('function')
  })

  test('对话框相关函数存在', () => {
    expect(typeof SDK.confirm).toBe('function')
    expect(typeof SDK.alert).toBe('function')
    expect(typeof SDK.prompt).toBe('function')
  })

  test('权限和用户相关函数存在', () => {
    expect(typeof SDK.hasAuth).toBe('function')
    expect(typeof SDK.getUserInfo).toBe('function')
    expect(typeof SDK.login).toBe('function')
    expect(typeof SDK.logout).toBe('function')
  })

  test('外部登录和实时 token 相关函数存在', () => {
    expect(typeof SDK.getToken).toBe('function')
    expect(typeof SDK.listExternalProviders).toBe('function')
    expect(typeof SDK.isLocalPasswordLoginEnabled).toBe('function')
    expect(typeof SDK.startRedirectLogin).toBe('function')
    expect(typeof SDK.loginWithLdap).toBe('function')
    expect(typeof SDK.exchangeLoginCode).toBe('function')
    expect(typeof SDK.bindExternalAccount).toBe('function')
    expect(typeof SDK.resolveReturnUrl).toBe('function')
    expect(typeof SDK.mapAuthError).toBe('function')
  })

  test('生命周期相关函数存在', () => {
    // 生命周期函数初始为 null，通过 initMicroApp 等初始化后更新
    expect(SDK.mount).toBe(null)
    expect(SDK.unmount).toBe(null)
    expect(SDK.update).toBe(null)
    expect(SDK.bootstrap).toBe(null)
  })

  test('微前端初始化函数存在', () => {
    expect(typeof SDK.initMicroApp).toBe('function')
    expect(typeof SDK.initSingleComponent).toBe('function')
    expect(typeof SDK.initLayoutComponent).toBe('function')
    expect(typeof SDK.initAmisComponentLib).toBe('function')
  })

  test('回调函数存在', () => {
    expect(typeof SDK.onConfirm).toBe('function')
    expect(typeof SDK.onCancel).toBe('function')
  })
})

describe('API Contract Tests - 导出对象验证', () => {
  test('toast 对象存在且有正确的方法', () => {
    expect(SDK.toast).toBeDefined()
    expect(typeof SDK.toast.success).toBe('function')
    expect(typeof SDK.toast.error).toBe('function')
    expect(typeof SDK.toast.info).toBe('function')
    expect(typeof SDK.toast.warning).toBe('function')
  })

  test('EventBus 对象存在且有正确的方法', () => {
    expect(SDK.EventBus).toBeDefined()
    expect(typeof SDK.EventBus.subscribe).toBe('function')
    expect(typeof SDK.EventBus.subscribeOnce).toBe('function')
    expect(typeof SDK.EventBus.unsubscribe).toBe('function')
    expect(typeof SDK.EventBus.publish).toBe('function')
  })

  test('Stomp 对象存在且有正确的方法', () => {
    expect(SDK.Stomp).toBeDefined()
    
    // 订阅方法
    expect(typeof SDK.Stomp.subscribe).toBe('function')
    expect(typeof SDK.Stomp.subscribeTopic).toBe('function')
    expect(typeof SDK.Stomp.subscribeQueue).toBe('function')
    expect(typeof SDK.Stomp.subscribeUserTopic).toBe('function')
    expect(typeof SDK.Stomp.subscribeWithInitial).toBe('function')
    
    // 取消订阅方法
    expect(typeof SDK.Stomp.unsubscribe).toBe('function')
    expect(typeof SDK.Stomp.unsubscribeTopic).toBe('function')
    expect(typeof SDK.Stomp.unsubscribeQueue).toBe('function')
    expect(typeof SDK.Stomp.unsubscribeUserTopic).toBe('function')
    expect(typeof SDK.Stomp.unsubscribeAll).toBe('function')
    expect(typeof SDK.Stomp.unsubscribeAllTopics).toBe('function')
    expect(typeof SDK.Stomp.unsubscribeAllQueues).toBe('function')
    expect(typeof SDK.Stomp.unsubscribeAllUserTopics).toBe('function')
    
    // 发送方法
    expect(typeof SDK.Stomp.send).toBe('function')
    expect(typeof SDK.Stomp.sendText).toBe('function')
    expect(typeof SDK.Stomp.sendJson).toBe('function')
    expect(typeof SDK.Stomp.sendBinary).toBe('function')
    
    // 连接方法
    expect(typeof SDK.Stomp.connect).toBe('function')
    expect(typeof SDK.Stomp.disconnect).toBe('function')
    expect(typeof SDK.Stomp.reconnect).toBe('function')
  })

  test('request 对象存在', () => {
    expect(SDK.request).toBeDefined()
  })

  test('amisUtils 对象存在', () => {
    expect(SDK.amisUtils).toBeDefined()
  })

  test('i18n 对象存在且有正确的方法', () => {
    expect(SDK.i18n).toBeDefined()
    expect(typeof SDK.i18n.getLocale).toBe('function')
    expect(typeof SDK.i18n.getLanguages).toBe('function')
    expect(typeof SDK.i18n.switchLanguage).toBe('function')
    expect(typeof SDK.i18n.t).toBe('function')
    expect(typeof SDK.i18n.tn).toBe('function')
    expect(typeof SDK.i18n.tMenu).toBe('function')
    expect(typeof SDK.i18n.tCommon).toBe('function')
    expect(typeof SDK.i18n.useNamespace).toBe('function')
    expect(typeof SDK.i18n.getLocaleData).toBe('function')
    expect(typeof SDK.i18n.onLocaleChange).toBe('function')
  })

  test('主题管理函数存在', () => {
    expect(typeof SDK.getTheme).toBe('function')
    expect(typeof SDK.setTheme).toBe('function')
  })
})

describe('API Contract Tests - TypeScript 类型定义验证', () => {
  test('类型定义可以正常使用（编译时检查）', () => {
    // 这些代码主要用于 TypeScript 编译时检查
    // 如果类型定义缺失或改变，编译会失败
    
    const _tabOption: SDK.TabOption = {
      title: 'test',
      breadcrumbs: [],
      callback: () => {}
    }
    
    const _menuInfo: SDK.MenuInfo = {
      path: '/test',
      title: 'test',
      showMode: 'tab'
    }
    
    const _confirmOptions: SDK.ConfirmOptions = {
      className: 'test',
      closeOnEsc: true,
      size: 'md'
    }
    
    const _loginParams: SDK.LoginParams = {
      username: 'test',
      password: 'test',
      success: '/home',
      error: () => {}
    }

    const _microAppCommonProps: SDK.MicroAppCommonProps = {
      token: {
        accessToken: 'legacy-access-token',
        refreshToken: 'legacy-refresh-token',
      },
      apiHost: 'https://example.com',
      mainWindow: {} as Window,
      appInfo: {
        authProviders: [],
      },
      config: {
        security: {
          auth: {
            login: {
              localPassword: {
                enabled: true,
              },
            },
          },
        },
      },
      __utils__: {
        openDialog: async () => true,
        openDrawer: async () => true,
        openTab: async () => 'tab-1',
        closeTab: async () => undefined,
        openMenu: async () => undefined,
        openOrSwitchTab: async () => 'tab-2',
        sendToOpenerTab: async () => undefined,
        updateTabTitle: async () => undefined,
        renderAmisSchema: async () => undefined,
        hasAuth: () => true,
        loginHandler: async () => true,
        logoutHandler: async () => undefined,
        getToken: async () => ({ accessToken: 'fresh-access-token' }),
        getUserInfo: async () => ({ name: 'tester' }),
        listExternalProviders: async () => [],
        isLocalPasswordLoginEnabled: () => true,
        startRedirectLogin: () => null,
        loginWithLdap: async () => true,
        exchangeLoginCode: async () => ({ code: 0 }),
        bindExternalAccount: async () => ({ code: 0 }),
        resolveReturnUrl: () => '/',
        mapAuthError: () => 'AUTH_ERROR',
      },
      i18n: {
        getLocale: () => 'zh-CN',
        getLanguages: () => [],
        switchLanguage: async () => undefined,
        t: (key) => key,
        tn: (_namespace, key) => key,
        tMenu: (key) => key,
        tCommon: (key) => key,
        useNamespace: () => (key) => key,
        getLocaleData: () => ({}),
        onLocaleChange: () => () => {},
      },
    }

    const _subscribeInitialOptions: SDK.SubscribeInitialOptions = {
      createInitialRequest: () => ({ token: 'abc' }),
      splitInitialHandlers: true,
      onInitialLive: () => {},
      onInitialData: () => {},
      onInitialComplete: () => {},
      onInitialError: () => {},
      initialTimeoutMs: 1000,
    }

    const _subscribeOptions: SDK.SubscribeOptions = {
      keepSingleListener: true,
      ..._subscribeInitialOptions,
    }

    const _subscribeWithInitialOptions: SDK.SubscribeWithInitialOptions = {
      createInitialRequest: () => ({ token: 'abc' }),
      splitInitialHandlers: true,
      onInitialLive: () => {},
      onInitialData: () => {},
      onInitialComplete: () => {},
      onInitialError: () => {},
      initialTimeoutMs: 1000,
      keepSingleListener: true,
    }

    const _subscribeWithInitialHandle: SDK.SubscribeWithInitialHandle = {
      bootstrapDone: Promise.resolve(),
      unsubscribe: () => {},
    }

    // 验证类型存在
    expect(_tabOption).toBeDefined()
    expect(_menuInfo).toBeDefined()
    expect(_confirmOptions).toBeDefined()
    expect(_loginParams).toBeDefined()
    expect(_microAppCommonProps).toBeDefined()
    expect(_subscribeInitialOptions).toBeDefined()
    expect(_subscribeOptions).toBeDefined()
    expect(_subscribeWithInitialOptions).toBeDefined()
    expect(_subscribeWithInitialHandle).toBeDefined()
  })
})
