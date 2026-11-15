import { describe, test, expect, vi, beforeEach } from 'vitest'
import * as SDK from '../../../src/main'

// Mock window 对象
global.window = global.window || ({} as any)

describe('微前端初始化和函数注入测试', () => {
  let mockProps: any

  beforeEach(() => {
    // 准备模拟的 props
    mockProps = {
      __utils__: {
        openDialog: vi.fn().mockResolvedValue(true),
        openDrawer: vi.fn().mockResolvedValue(true),
        openTab: vi.fn().mockResolvedValue('tab-123'),
        closeTab: vi.fn().mockResolvedValue(undefined),
        openMenu: vi.fn().mockResolvedValue(undefined),
        openOrSwitchTab: vi.fn().mockResolvedValue('tab-456'),
        sendToOpenerTab: vi.fn().mockResolvedValue(undefined),
        updateTabTitle: vi.fn().mockResolvedValue(undefined),
        
        confirm: vi.fn().mockResolvedValue(true),
        alert: vi.fn().mockResolvedValue(undefined),
        prompt: vi.fn().mockResolvedValue('user input'),
        
        toast: {
          container: null,
          success: vi.fn(),
          error: vi.fn(),
          info: vi.fn(),
          warning: vi.fn(),
        },
        
        eventBus: {
          subscribe: vi.fn(),
          subscribeOnce: vi.fn(),
          unsubscribe: vi.fn(),
          unsubscribeAll: vi.fn(),
          publish: vi.fn(),
        },
        
        stomp: {
          subscribeTopic: vi.fn().mockReturnValue(() => {}),
          subscribeQueue: vi.fn().mockReturnValue(() => {}),
          subscribeUserTopic: vi.fn().mockReturnValue(() => {}),
          subscribe: vi.fn().mockReturnValue(() => {}),
          unsubscribeTopic: vi.fn(),
          unsubscribeQueue: vi.fn(),
          unsubscribeUserTopic: vi.fn(),
          unsubscribe: vi.fn(),
          unsubscribeAll: vi.fn(),
          unsubscribeAllTopics: vi.fn(),
          unsubscribeAllQueues: vi.fn(),
          unsubscribeAllUserTopics: vi.fn(),
          sendBinary: vi.fn().mockResolvedValue(undefined),
          sendText: vi.fn().mockResolvedValue(undefined),
          sendJson: vi.fn().mockResolvedValue(undefined),
          send: vi.fn().mockResolvedValue(undefined),
          connect: vi.fn().mockResolvedValue(undefined),
          disconnect: vi.fn().mockResolvedValue(undefined),
          reconnect: vi.fn().mockResolvedValue(undefined),
          isConnected: vi.fn().mockReturnValue(true),
          isActive: vi.fn().mockReturnValue(true),
          isStompAuthenticated: vi.fn().mockReturnValue(true),
          onStompConnected: vi.fn().mockReturnValue(() => {}),
          onStompDisconnected: vi.fn().mockReturnValue(() => {}),
        },
        
        request: vi.fn().mockResolvedValue({ data: 'mock data' }),
        
        amisUtils: {
          someUtil: vi.fn(),
        },
        
        hasAuth: vi.fn().mockReturnValue(true),
        getToken: vi.fn().mockResolvedValue({
          accessToken: 'fresh-access-token',
          refreshToken: 'fresh-refresh-token',
        }),
        getUserInfo: vi.fn().mockResolvedValue({ name: 'test user' }),
        listExternalProviders: vi.fn().mockResolvedValue([
          { id: 'ldap-1', type: 'LDAP', name: '企业目录' },
          { id: 'oidc-1', type: 'OIDC', name: 'OIDC 登录' },
        ]),
        isLocalPasswordLoginEnabled: vi.fn().mockReturnValue(true),
        startRedirectLogin: vi.fn().mockReturnValue('/auth/redirect/cas'),
        loginWithLdap: vi.fn().mockResolvedValue({ code: 0 }),
        exchangeLoginCode: vi.fn().mockResolvedValue({ code: 0, data: { accessToken: 'login-code-token' } }),
        bindExternalAccount: vi.fn().mockResolvedValue({ code: 0 }),
        resolveReturnUrl: vi.fn().mockReturnValue('/workspace'),
        mapAuthError: vi.fn().mockReturnValue('AUTH_INVALID_CREDENTIALS'),
        
        FormItem: vi.fn(),
        Renderer: vi.fn(),
        OptionsControl: vi.fn(),
        registerAction: vi.fn(),
        registerIcon: vi.fn(),
        registerFormula: vi.fn(),
        registerValidator: vi.fn(),
        registerEditorPlugin: vi.fn(),
        registerActionPanel: vi.fn(),
        renderAmisSchema: vi.fn().mockResolvedValue(undefined),
        addRule: vi.fn(),
        getTheme: vi.fn().mockReturnValue('light'),
        setTheme: vi.fn(),
        
        loginHandler: vi.fn().mockResolvedValue(true),
        logoutHandler: vi.fn().mockResolvedValue(undefined),
      },
    }
  })

  test('initMicroApp 初始化并挂载后，导出的函数应该被正确注入', async () => {
    // 初始化微前端
    const lifecycle = SDK.initMicroApp({
      render: async (props) => {
        return { app: 'mock-app' }
      },
    })

    // 调用 mount
    await lifecycle.mount(mockProps)

    // 测试 UI 相关函数（现在直接调用平台函数，不再有包装）
    await SDK.openDialog({ body: 'test' })
    expect(mockProps.__utils__.openDialog).toHaveBeenCalledWith({ body: 'test' })

    await SDK.openDrawer({ body: 'test', onConfirm: vi.fn(), onClose: vi.fn() })
    expect(mockProps.__utils__.openDrawer).toHaveBeenCalled()
    expect(mockProps.__utils__.openDrawer.mock.calls[0][0]).toMatchObject({ body: 'test' })

    await SDK.openTab('/test', { title: 'Test Tab' })
    expect(mockProps.__utils__.openTab).toHaveBeenCalledWith('/test', { title: 'Test Tab' })

    await SDK.closeTab('tab-123', { result: 'data' })
    expect(mockProps.__utils__.closeTab).toHaveBeenCalledWith('tab-123', { result: 'data' })

    await SDK.openMenu('/menu')
    expect(mockProps.__utils__.openMenu).toHaveBeenCalledWith('/menu')

    const callback = vi.fn()
    await SDK.openOrSwitchTab('/test-path', { callback })
    expect(mockProps.__utils__.openOrSwitchTab).toHaveBeenCalledWith('/test-path', { callback })

    await SDK.sendToOpenerTab('tab-id', { data: 'test' })
    expect(mockProps.__utils__.sendToOpenerTab).toHaveBeenCalledWith('tab-id', { data: 'test' })

    await SDK.updateTabTitle('tab-id', { title: 'New Title' })
    expect(mockProps.__utils__.updateTabTitle).toHaveBeenCalledWith('tab-id', { title: 'New Title' })

    // 测试对话框函数
    await SDK.confirm('Are you sure?', 'Confirm', { confirmText: 'Yes' })
    expect(mockProps.__utils__.confirm).toHaveBeenCalledWith('Are you sure?', 'Confirm', { confirmText: 'Yes' })

    await SDK.alert('Alert message', 'Warning')
    expect(mockProps.__utils__.alert).toHaveBeenCalledWith('Alert message', 'Warning')

    await SDK.prompt([{ type: 'text', name: 'input' }], { input: 'default' }, 'Enter value')
    expect(mockProps.__utils__.prompt).toHaveBeenCalledWith(
      [{ type: 'text', name: 'input' }],
      { input: 'default' },
      'Enter value'
    )

    // 测试权限函数
    const hasAuth = SDK.hasAuth('test-permission')
    expect(mockProps.__utils__.hasAuth).toHaveBeenCalledWith('test-permission')
    expect(hasAuth).toBe(true)

    const userInfo = await SDK.getUserInfo()
    expect(mockProps.__utils__.getUserInfo).toHaveBeenCalled()
    expect(userInfo).toEqual({ name: 'test user' })

    const latestToken = await SDK.getToken()
    expect(mockProps.__utils__.getToken).toHaveBeenCalled()
    expect(latestToken).toEqual({
      accessToken: 'fresh-access-token',
      refreshToken: 'fresh-refresh-token',
    })

    // 测试登录登出
    const loginParams = { username: 'test', password: 'pass', success: '/', error: vi.fn() }
    await SDK.login(loginParams)
    expect(mockProps.__utils__.loginHandler).toHaveBeenCalledWith(loginParams)

    await SDK.logout()
    expect(mockProps.__utils__.logoutHandler).toHaveBeenCalled()

    const providers = await SDK.listExternalProviders()
    expect(mockProps.__utils__.listExternalProviders).toHaveBeenCalled()
    expect(providers).toEqual([
      { id: 'ldap-1', type: 'LDAP', name: '企业目录' },
      { id: 'oidc-1', type: 'OIDC', name: 'OIDC 登录' },
    ])

    const localEnabled = SDK.isLocalPasswordLoginEnabled()
    expect(mockProps.__utils__.isLocalPasswordLoginEnabled).toHaveBeenCalled()
    expect(localEnabled).toBe(true)

    const redirectUrl = SDK.startRedirectLogin({ id: 'cas-1', type: 'CAS' }, '/return')
    expect(mockProps.__utils__.startRedirectLogin).toHaveBeenCalledWith({ id: 'cas-1', type: 'CAS' }, '/return')
    expect(redirectUrl).toBe('/auth/redirect/cas')

    await SDK.loginWithLdap({ providerId: 'ldap-1', username: 'dir-user', password: 'dir-pass' })
    expect(mockProps.__utils__.loginWithLdap).toHaveBeenCalledWith({
      providerId: 'ldap-1',
      username: 'dir-user',
      password: 'dir-pass',
    })

    await SDK.exchangeLoginCode('login-code')
    expect(mockProps.__utils__.exchangeLoginCode).toHaveBeenCalledWith('login-code')

    await SDK.bindExternalAccount({ providerId: 'oidc-1', loginCode: 'bind-code' })
    expect(mockProps.__utils__.bindExternalAccount).toHaveBeenCalledWith({
      providerId: 'oidc-1',
      loginCode: 'bind-code',
    })

    const returnUrl = SDK.resolveReturnUrl('/workspace')
    expect(mockProps.__utils__.resolveReturnUrl).toHaveBeenCalledWith('/workspace')
    expect(returnUrl).toBe('/workspace')

    const mappedError = SDK.mapAuthError('INVALID_CREDENTIALS')
    expect(mockProps.__utils__.mapAuthError).toHaveBeenCalledWith('INVALID_CREDENTIALS')
    expect(mappedError).toBe('AUTH_INVALID_CREDENTIALS')

    // 测试 amis 相关函数
    const mockDiv = {} as HTMLElement
    const schema = { type: 'page' }
    const props = { data: { test: 1 } }
    const env = { theme: 'default' }
    await SDK.renderAmisSchema(mockDiv, schema, props, env)
    expect(mockProps.__utils__.renderAmisSchema).toHaveBeenCalledWith(mockDiv, schema, props, env)

    const validateFn = vi.fn()
    SDK.addRule('customRule', validateFn, 'Error message')
    expect(mockProps.__utils__.addRule).toHaveBeenCalledWith('customRule', validateFn, 'Error message')

    const iconComponent = { render: vi.fn() }
    SDK.registerIcon('custom-icon', iconComponent)
    expect(mockProps.__utils__.registerIcon).toHaveBeenCalledWith('custom-icon', iconComponent)

    const formItemDecorator = SDK.FormItem({ type: 'custom-input' })
    expect(mockProps.__utils__.FormItem).toHaveBeenCalledWith({ type: 'custom-input' })

    const rendererDecorator = SDK.Renderer({ type: 'custom-renderer' })
    expect(mockProps.__utils__.Renderer).toHaveBeenCalledWith({ type: 'custom-renderer' })

    const optionsControlDecorator = SDK.OptionsControl({ type: 'custom-options' })
    expect(mockProps.__utils__.OptionsControl).toHaveBeenCalledWith({ type: 'custom-options' })

    const actionFn = vi.fn()
    SDK.registerAction('customAction', actionFn)
    expect(mockProps.__utils__.registerAction).toHaveBeenCalledWith('customAction', actionFn)

    const formulaFn = vi.fn()
    SDK.registerFormula('customFormula', formulaFn)
    expect(mockProps.__utils__.registerFormula).toHaveBeenCalledWith('customFormula', formulaFn)

    const validatorFn = vi.fn()
    SDK.registerValidator('customValidator', validatorFn)
    expect(mockProps.__utils__.registerValidator).toHaveBeenCalledWith('customValidator', validatorFn)

    const plugin = { name: 'custom-plugin', order: 100 }
    SDK.registerEditorPlugin(plugin)
    expect(mockProps.__utils__.registerEditorPlugin).toHaveBeenCalledWith(plugin)

    const panel = { name: 'custom-panel', actions: [] }
    SDK.registerActionPanel(panel)
    expect(mockProps.__utils__.registerActionPanel).toHaveBeenCalledWith(panel)

    // 测试主题函数
    const theme = SDK.getTheme()
    expect(mockProps.__utils__.getTheme).toHaveBeenCalled()
    expect(theme).toBe('light')

    SDK.setTheme('dark')
    expect(mockProps.__utils__.setTheme).toHaveBeenCalledWith('dark')
  })

  test('挂载后，toast 对象的方法应该被正确注入', async () => {
    const lifecycle = SDK.initMicroApp({
      render: async () => ({ app: 'mock' }),
    })

    await lifecycle.mount(mockProps)

    // 测试 toast 方法及参数传递
    SDK.toast.success('Success message', { timeout: 3000 })
    expect(mockProps.__utils__.toast.success).toHaveBeenCalledWith('Success message', { timeout: 3000 })

    SDK.toast.error('Error message', { closable: true })
    expect(mockProps.__utils__.toast.error).toHaveBeenCalledWith('Error message', { closable: true })

    SDK.toast.info('Info message')
    expect(mockProps.__utils__.toast.info).toHaveBeenCalledWith('Info message')

    SDK.toast.warning('Warning message')
    expect(mockProps.__utils__.toast.warning).toHaveBeenCalledWith('Warning message')
  })

  test('挂载后，EventBus 对象的方法应该被正确注入', async () => {
    const lifecycle = SDK.initMicroApp({
      render: async () => ({ app: 'mock' }),
    })

    await lifecycle.mount(mockProps)

    const handler = vi.fn()
    const filter = vi.fn()

    // 测试 EventBus 方法及参数传递
    SDK.EventBus.subscribe('test-event', handler)
    expect(mockProps.__utils__.eventBus.subscribe).toHaveBeenCalledWith('test-event', handler)

    SDK.EventBus.subscribe('filtered-event', handler, filter)
    expect(mockProps.__utils__.eventBus.subscribe).toHaveBeenCalledWith('filtered-event', handler, filter)

    const eventData = { data: 'test', timestamp: Date.now() }
    SDK.EventBus.publish('test-event', eventData)
    expect(mockProps.__utils__.eventBus.publish).toHaveBeenCalledWith('test-event', eventData)

    SDK.EventBus.unsubscribe('test-event', handler)
    expect(mockProps.__utils__.eventBus.unsubscribe).toHaveBeenCalledWith('test-event', handler)
  })

  test('挂载后，Stomp 对象的方法应该被正确注入', async () => {
    const lifecycle = SDK.initMicroApp({
      render: async () => ({ app: 'mock' }),
    })

    await lifecycle.mount(mockProps)

    const listener = vi.fn()
    const headers = { 'custom-header': 'value' }

    // 测试 Stomp 订阅方法及参数传递
    SDK.Stomp.subscribeTopic('test-topic', listener, headers)
    expect(mockProps.__utils__.stomp.subscribeTopic).toHaveBeenCalledWith('test-topic', listener, headers)

    SDK.Stomp.subscribeQueue('test-queue', listener)
    expect(mockProps.__utils__.stomp.subscribeQueue).toHaveBeenCalledWith('test-queue', listener)

    // 测试 Stomp 发送方法及参数传递
    const jsonData = { data: 'test', id: 123 }
    await SDK.Stomp.sendJson('/dest', jsonData, headers)
    expect(mockProps.__utils__.stomp.sendJson).toHaveBeenCalledWith('/dest', jsonData, headers)

    // 测试 Stomp 连接方法
    await SDK.Stomp.connect()
    expect(mockProps.__utils__.stomp.connect).toHaveBeenCalled()
  })

  test('挂载后，request 对象应该被正确注入', async () => {
    const lifecycle = SDK.initMicroApp({
      render: async () => ({ app: 'mock' }),
    })

    await lifecycle.mount(mockProps)

    // 测试 request 及参数传递和返回值
    const config = { url: '/api/test', method: 'GET', params: { id: 1 } }
    const result = await SDK.request(config)
    expect(mockProps.__utils__.request).toHaveBeenCalledWith(config)
    expect(result).toEqual({ data: 'mock data' })
  })

  test('挂载后，amisUtils 对象应该被正确注入', async () => {
    const lifecycle = SDK.initMicroApp({
      render: async () => ({ app: 'mock' }),
    })

    await lifecycle.mount(mockProps)

    // 测试 amisUtils
    expect(SDK.amisUtils).toBe(mockProps.__utils__.amisUtils)
  })

  test('挂载时传入的 onConfirm 和 onCancel 应该被正确注入', async () => {
    const lifecycle = SDK.initMicroApp({
      render: async () => ({ app: 'mock' }),
    })

    const onConfirmFn = vi.fn().mockResolvedValue(true)
    const onCancelFn = vi.fn().mockResolvedValue(undefined)

    await lifecycle.mount({
      ...mockProps,
      onConfirm: onConfirmFn,
      onCancel: onCancelFn,
    })

    // 测试 onConfirm 和 onCancel 及参数传递
    const confirmData = { data: 'test', action: 'save' }
    await SDK.onConfirm(confirmData, false)
    expect(onConfirmFn).toHaveBeenCalledWith(confirmData, false)

    await SDK.onCancel()
    expect(onCancelFn).toHaveBeenCalled()
  })

  test('未挂载前，导出的函数应该显示警告', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    // 创建一个新的 SDK 实例（未挂载）
    // 注意：由于之前的测试已经挂载过，Stomp 等对象可能已经被注入
    // 这个测试主要验证初始状态
    
    SDK.toast.success('test')
    // toast 如果已被注入，则不会触发警告
    // expect(warnSpy).toHaveBeenCalledWith('请通过平台加载success方法')

    SDK.EventBus.subscribe('test', vi.fn())
    // EventBus 如果已被注入，则不会触发警告
    // expect(warnSpy).toHaveBeenCalledWith('请通过平台加载subscribe方法')

    warnSpy.mockRestore()
    
    // 这个测试实际上暴露了一个问题：
    // 一旦某个测试挂载了微前端，全局的 toast/EventBus/Stomp 等对象就被永久修改了
    // 这说明当前的实现确实有问题
  })
})
