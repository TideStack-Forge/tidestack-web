import { describe, test, expect, vi } from 'vitest'
import * as SDK from '../../../src/main'
import { toast, EventBus, Stomp, initMicroApp } from '../../../src/main'

// Mock window 对象
global.window = global.window || ({} as any)

describe('ES6 活绑定：命名空间导入 vs 命名导入', () => {
  test('两种导入方式应该获得相同的活绑定效果', async () => {
    // 准备 mock
    const mockToast = { 
      success: vi.fn().mockReturnValue('injected'),
      error: vi.fn(),
      info: vi.fn(),
      warning: vi.fn(),
    }
    const mockEventBus = { 
      publish: vi.fn().mockReturnValue('injected'),
      subscribe: vi.fn(),
      unsubscribe: vi.fn(),
    }
    const mockStomp = { 
      connect: vi.fn().mockReturnValue('injected'),
      subscribeTopic: vi.fn(),
    }
    
    const mockProps = {
      __utils__: {
        toast: mockToast,
        eventBus: mockEventBus,
        stomp: mockStomp,
        request: vi.fn(),
        amisUtils: {},
        openDialog: vi.fn(),
        openDrawer: vi.fn(),
        openTab: vi.fn(),
        closeTab: vi.fn(),
        openMenu: vi.fn(),
        openOrSwitchTab: vi.fn(),
        sendToOpenerTab: vi.fn(),
        updateTabTitle: vi.fn(),
        hasAuth: vi.fn(),
        getUserInfo: vi.fn(),
        loginHandler: vi.fn(),
        logoutHandler: vi.fn(),
        confirm: vi.fn(),
        alert: vi.fn(),
        prompt: vi.fn(),
        FormItem: vi.fn(),
        Renderer: vi.fn(),
        OptionsControl: vi.fn(),
        registerAction: vi.fn(),
        registerFormula: vi.fn(),
        registerValidator: vi.fn(),
        registerEditorPlugin: vi.fn(),
        registerActionPanel: vi.fn(),
        registerIcon: vi.fn(),
        renderAmisSchema: vi.fn(),
        addRule: vi.fn(),
        getTheme: vi.fn(),
        setTheme: vi.fn(),
      },
    }
    
    // 初始化并挂载
    const lifecycle = initMicroApp({
      render: async () => ({ app: 'test' }),
    })
    await lifecycle.mount(mockProps)
    
    // 验证：命名空间导入（SDK.xxx）
    SDK.toast.success('test1')
    expect(mockToast.success).toHaveBeenCalledWith('test1')
    
    SDK.EventBus.publish('event1', { data: 1 })
    expect(mockEventBus.publish).toHaveBeenCalledWith('event1', { data: 1 })
    
    SDK.Stomp.connect()
    expect(mockStomp.connect).toHaveBeenCalled()
    
    // 验证：命名导入（直接使用）
    toast.success('test2')
    expect(mockToast.success).toHaveBeenCalledWith('test2')
    
    EventBus.publish('event2', { data: 2 })
    expect(mockEventBus.publish).toHaveBeenCalledWith('event2', { data: 2 })
    
    Stomp.connect()
    expect(mockStomp.connect).toHaveBeenCalledTimes(2) // 被调用了 2 次
    
    // 结论：两种方式获得相同的活绑定效果
    expect(SDK.toast).toBe(toast) // 指向同一个对象
    expect(SDK.EventBus).toBe(EventBus)
    expect(SDK.Stomp).toBe(Stomp)
  })
})
