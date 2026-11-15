import { describe, expect, test, vi } from 'vitest'

vi.mock('@/utils/Storage', () => ({
  default: class Storage {},
}))

const tabsModule = (await import('../../../../../src/store/modules/tabs.js')).default

function createStorage(values = {}) {
  return {
    getItem(key) {
      return values[key]
    },
    setItem() {
      return undefined
    },
    removeItem() {
      return undefined
    },
  }
}

describe('store/modules/tabs ownership', () => {
  test('exports normalized getters for tab route-state ownership', () => {
    expect(typeof tabsModule.getters.tabsList).toBe('function')
    expect(typeof tabsModule.getters.activeTabId).toBe('function')
    expect(typeof tabsModule.getters.preventTabOperation).toBe('function')
    expect(typeof tabsModule.getters.scrollBarScrollTopMap).toBe('function')

    expect(
      tabsModule.getters.tabsList({
        tabsList: undefined,
      })
    ).toEqual([])
    expect(
      tabsModule.getters.activeTabId({
        activeTabId: undefined,
      })
    ).toBe('')
    expect(
      tabsModule.getters.preventTabOperation({
        preventTabOperation: undefined,
      })
    ).toBe(false)
    expect(
      tabsModule.getters.scrollBarScrollTopMap({
        scrollBarScrollTopMap: undefined,
      })
    ).toEqual({})
  })

  test('INIT_TAB_STORAGE normalizes persisted tab ownership state', () => {
    const state = {
      tabsList: [{ id: 'legacy' }],
      activeTabId: 'legacy',
      tabStorage: null,
    }

    tabsModule.mutations.INIT_TAB_STORAGE(
      state,
      createStorage({
        tabsList: { unexpected: true },
        activeTabId: 123,
      })
    )

    expect(state.tabsList).toEqual([])
    expect(state.activeTabId).toBe('')
  })

  test('moveTab reorders tabs and persists the new order', () => {
    const setItem = vi.fn()
    const state = {
      tabsList: [
        { id: 'tab-1', title: '个人门户' },
        { id: 'tab-2', title: '打开应用' },
        { id: 'tab-3', title: '平台数据源' },
      ],
      activeTabId: 'tab-2',
      tabStorage: { setItem },
    }
    const commit = vi.fn((type, payload) => {
      tabsModule.mutations[type](state, payload)
    })

    const result = tabsModule.actions.moveTab(
      { commit, state },
      { sourceTabId: 'tab-1', targetTabId: 'tab-3', position: 'after' }
    )

    expect(result).toBe(true)
    expect(state.tabsList.map((tab) => tab.id)).toEqual(['tab-2', 'tab-3', 'tab-1'])
    expect(setItem).toHaveBeenCalledWith('tabsList', state.tabsList)
  })

  test('moveTab is a no-op when source and target are identical', () => {
    const state = {
      tabsList: [{ id: 'tab-1', title: '个人门户' }],
      activeTabId: 'tab-1',
      tabStorage: { setItem: vi.fn() },
    }
    const commit = vi.fn()

    const result = tabsModule.actions.moveTab(
      { commit, state },
      { sourceTabId: 'tab-1', targetTabId: 'tab-1', position: 'before' }
    )

    expect(result).toBe(false)
    expect(commit).not.toHaveBeenCalled()
  })

  test('CLOSE_OTHERS_TABS preserves fixed tabs by default', () => {
    const state = {
      tabsList: [
        { id: 'tab-fixed', title: '固定页', isFixed: true },
        { id: 'tab-keep', title: '保留页' },
        { id: 'tab-close', title: '关闭页' },
      ],
      activeTabId: 'tab-close',
      tabStorage: { setItem: vi.fn() },
    }

    tabsModule.mutations.CLOSE_OTHERS_TABS(state, { saveId: 'tab-keep', includeFixedTabs: false })

    expect(state.tabsList.map((tab) => tab.id)).toEqual(['tab-fixed', 'tab-keep'])
    expect(state.activeTabId).toBe('tab-keep')
  })

  test('CLOSE_OTHERS_TABS can drop fixed tabs when explicitly requested', () => {
    const state = {
      tabsList: [
        { id: 'tab-fixed', title: '固定页', isFixed: true },
        { id: 'tab-keep', title: '保留页' },
        { id: 'tab-close', title: '关闭页' },
      ],
      activeTabId: 'tab-close',
      tabStorage: { setItem: vi.fn() },
    }

    tabsModule.mutations.CLOSE_OTHERS_TABS(state, { saveId: 'tab-keep', includeFixedTabs: true })

    expect(state.tabsList.map((tab) => tab.id)).toEqual(['tab-keep'])
    expect(state.activeTabId).toBe('tab-keep')
  })

  test('CLOSE_RIGHT_TABS keeps the selected tab and preserves fixed tabs on the right by default', () => {
    const state = {
      tabsList: [
        { id: 'tab-left', title: '左侧页' },
        { id: 'tab-keep', title: '当前页' },
        { id: 'tab-close', title: '右侧页' },
        { id: 'tab-fixed', title: '右侧固定页', isFixed: true },
      ],
      activeTabId: 'tab-close',
      tabStorage: { setItem: vi.fn() },
    }

    tabsModule.mutations.CLOSE_RIGHT_TABS(state, { saveId: 'tab-keep', includeFixedTabs: false })

    expect(state.tabsList.map((tab) => tab.id)).toEqual(['tab-left', 'tab-keep', 'tab-fixed'])
    expect(state.activeTabId).toBe('tab-keep')
  })

  test('toggleFixedTab flips the requested tab fixed state and persists the change', () => {
    const setItem = vi.fn()
    const state = {
      tabsList: [
        { id: 'tab-1', title: '个人门户', isFixed: false },
      ],
      activeTabId: 'tab-1',
      tabStorage: { setItem },
    }
    const commit = vi.fn((type, payload) => {
      tabsModule.mutations[type](state, payload)
    })

    const result = tabsModule.actions.toggleFixedTab(
      { commit, state },
      { tabId: 'tab-1' }
    )

    expect(result).toBe(true)
    expect(state.tabsList[0].isFixed).toBe(true)
    expect(setItem).toHaveBeenCalledWith('tabsList', state.tabsList)
  })
})
