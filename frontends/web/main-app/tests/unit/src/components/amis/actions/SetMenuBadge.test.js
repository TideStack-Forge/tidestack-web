import { beforeEach, describe, expect, test, vi } from 'vitest'

const { mockRegisterAction, mockSetMenuBadge } = vi.hoisted(() => ({
  mockRegisterAction: vi.fn(),
  mockSetMenuBadge: vi.fn(),
}))

vi.mock('amis-core', () => ({
  registerAction: mockRegisterAction,
}))

vi.mock('@/common/menus/registry', () => ({
  menu: { setMenuBadge: mockSetMenuBadge },
}))

const { SetMenuBadge } = await import('@/components/amis/actions/SetMenuBadge.js')

describe('setMenuBadge amis action', () => {
  beforeEach(() => {
    // registerAction 的注册发生在模块加载时，不能被清除
    mockSetMenuBadge.mockClear()
  })

  test('以 actionType=setMenuBadge 注册', () => {
    expect(mockRegisterAction).toHaveBeenCalledTimes(1)
    expect(mockRegisterAction).toHaveBeenCalledWith('setMenuBadge', expect.any(SetMenuBadge))
  })

  test('对象 args：按 fullName 设置徽标', async () => {
    await new SetMenuBadge().run({ args: { fullName: 'dev.apps', badge: { type: 'number', value: 3 } } }, {})
    expect(mockSetMenuBadge).toHaveBeenCalledWith('dev.apps', { type: 'number', value: 3 })
  })

  test('对象 args 兼容 menu/menuName 字段，badge 为 null 时清除', async () => {
    await new SetMenuBadge().run({ args: { menu: 'dev.apps', badge: null } }, {})
    expect(mockSetMenuBadge).toHaveBeenCalledWith('dev.apps', null)

    await new SetMenuBadge().run({ args: { menuName: 'dev.apps' } }, {})
    expect(mockSetMenuBadge).toHaveBeenCalledWith('dev.apps', null)
  })

  test('字符串 args 视为 fullName，语义为清除徽标', async () => {
    await new SetMenuBadge().run({ args: 'dev.apps' }, {})
    expect(mockSetMenuBadge).toHaveBeenCalledWith('dev.apps', null)
  })

  test('缺 fullName 时不调用', async () => {
    await new SetMenuBadge().run({ args: {} }, {})
    expect(mockSetMenuBadge).not.toHaveBeenCalled()
  })
})
