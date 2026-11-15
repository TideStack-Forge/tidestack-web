import { describe, expect, test, vi } from 'vitest'

vi.mock('@/common/i18n', () => ({
  i18nService: {
    getManager: () => ({
      tCommon: (_key, fallback) => fallback,
    }),
  },
}))

const getters = (await import('../../../../src/store/getters.js')).default

describe('store/getters compatibility route-tab seam', () => {
  test('exposes the configured application logo to the shell without requiring config.logo', () => {
    const state = {
      app: {
        logo: '/api/app-metadata/logo.png',
        config: { isLockTheme: true },
      },
    }

    expect(getters.logo(state)).toBe('/api/app-metadata/logo.png')
  })

  test('exposes normalized root tab compatibility getters', () => {
    const state = {
      tabs: {
        tabsList: undefined,
        activeTabId: undefined,
        preventTabOperation: undefined,
        scrollBarScrollTopMap: undefined,
      },
      app: {},
    }

    expect(getters.tabsList(state)).toEqual([])
    expect(getters.activeTabId(state)).toBe('')
    expect(getters.preventTabOperation(state)).toBe(false)
    expect(getters.scrollBarScrollTopMap(state)).toEqual({})
  })

  test('exposes normalized root route-state compatibility getters', () => {
    const state = {
      app: {
        routes: undefined,
        whiteList: undefined,
        microWhiteRoutesMap: undefined,
        initialized: undefined,
      },
      tabs: {},
    }

    expect(getters.routes(state)).toEqual([])
    expect(getters.whiteList(state)).toEqual([])
    expect(getters.microWhiteRoutesMap(state)).toEqual({})
    expect(getters.initialized(state)).toBe(false)
  })
})
