import { describe, expect, test } from 'vitest'

import * as layoutProjectionModule from '../../../../src/layouts/layout-projection.js'

const projectionResolvers = Object.values(layoutProjectionModule).filter(
  (value) => typeof value === 'function'
)

if (projectionResolvers.length !== 1) {
  throw new Error('layout-projection module shape changed unexpectedly')
}

const [resolveLayoutProjection] = projectionResolvers

function createBaseInput(overrides = {}) {
  const {
    storeGetters: storeGetterOverrides = {},
    ...inputOverrides
  } = overrides
  const currentSidebarGetter = overrides.currentSidebarGetter || ((globalMenu, fullPath) => [[
    {
      title: `Resolved ${fullPath}`,
      path: fullPath,
      key: 'resolved-path',
    },
  ]])

  return {
    routeQuery: {},
    fullPath: '/dashboard',
    appName: 'Ouroboros',
    logo: 'logo.svg',
    menu: {
      globalMenu: [
        {
          title: 'Dashboard',
          path: '/dashboard',
          key: 'dashboard',
        },
      ],
    },
    theme: 'dark',
    userInfo: {
      id: 'u-1',
      name: 'Layout User',
    },
    tabsList: [],
    activeTabId: '',
    storeGetters: {
      'app/layoutType': 'header-sidebar',
      'app/headerEntry': '',
      'app/sidebarEntry': '',
      'app/themeList': ['dark', 'light'],
      'app/isLockTheme': false,
      'app/lockTheme': '',
      'app/config': {
        mode: 'default',
      },
      'app/currentSidebarGetter': currentSidebarGetter,
      ...storeGetterOverrides,
    },
    ...inputOverrides,
  }
}

describe('layout projection', () => {
  test('fullscreen query override still wins over the store layout type', () => {
    const projection = resolveLayoutProjection(
      createBaseInput({
        routeQuery: {
          fullscreen: '1',
        },
        storeGetters: {
          'app/layoutType': 'header-only',
        },
      })
    )

    expect(projection.layoutType).toBe('fullscreen')
    expect(projection.layoutConfig).toEqual({
      header: {
        enabled: false,
      },
      sidebar: {
        enabled: false,
      },
      tabs: {
        enabled: false,
      },
    })
    expect(projection.layoutProps.layoutClass).toBe('fullscreen')
    expect(projection.layoutProps.config).toBe(projection.layoutConfig)
  })

  test('current route menu replaces stale tab breadcrumbs after opening an app', () => {
    const projection = resolveLayoutProjection(
      createBaseInput({
        activeTabId: 'tab-1',
        tabsList: [
          {
            id: 'tab-1',
            breadcrumbs: [
              {
                title: 'Tab breadcrumb',
                path: '/from-tab',
                key: 'tab-breadcrumb',
              },
            ],
          },
        ],
        currentSidebarGetter: () => [[
          {
            title: 'Sidebar breadcrumb',
            path: '/from-sidebar',
            key: 'sidebar-breadcrumb',
          },
        ]],
      })
    )

    expect(projection.breadcrumb).toEqual([
      {
        title: 'Sidebar breadcrumb',
        path: '/from-sidebar',
        key: 'sidebar-breadcrumb',
      },
    ])
    expect(projection.layoutProps.breadcrumb).toEqual(projection.breadcrumb)
  })

  test('fallback breadcrumb calculation still mirrors the current sidebar tree', () => {
    const projection = resolveLayoutProjection(
      createBaseInput({
        fullPath: '/reports/weekly',
        currentSidebarGetter: () => [[
          {
            title: 'Reports',
            path: '/reports',
            key: 'reports',
          },
          {
            title: 'Weekly',
            path: '/reports/weekly',
            key: 'reports-weekly',
          },
        ]],
      })
    )

    expect(projection.breadcrumb).toEqual([
      {
        title: 'Reports',
        path: '/reports',
        key: 'reports',
      },
      {
        title: 'Weekly',
        path: '/reports/weekly',
        key: 'reports-weekly',
      },
    ])
    expect(projection.layoutProps.breadcrumb).toEqual(projection.breadcrumb)
  })
})
