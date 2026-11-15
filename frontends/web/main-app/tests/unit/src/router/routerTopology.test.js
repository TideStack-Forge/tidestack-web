import { describe, expect, test } from 'vitest'

import {
  buildErrorRoutes,
  buildRouterTopology,
  buildAppLayoutRoute,
} from '../../../../src/router/routerTopology.ts'

function routersUnique(routes) {
  const map = new Map()
  for (const item of routes) {
    map.set(item.path.split('?')[0], item)
  }
  return [...map.values()]
}

function mergeRoutes(baseRoutes, anotherRoutes) {
  const topLayRoutes = ['/', '/login', '*']
  const routes = anotherRoutes
    .map((item) => {
      const [url] = item.path.split('?')
      const path = url ? encodeURI(url) : ''

      if (item.type === 'internal') {
        return null
      }

      return {
        path,
        meta: {
          title: item.title,
          type: item.type,
          ...item.config,
        },
      }
    })
    .filter((item) => item !== null)

  const newTopLayerRoutes = routes.filter(
    (item) => topLayRoutes.includes(item?.path || '') && item?.path !== '/'
  )
  const newNormalRoutes = routes.filter((item) => !topLayRoutes.includes(item?.path || ''))
  const baseTopLayerRoutes = baseRoutes
    .filter((item) => item.path !== '/')
    .filter((item) => !newTopLayerRoutes.find((newItem) => newItem?.path === item.path))
  const baseLayoutRoute = baseRoutes.find((item) => item.path === '/')
  const baseNormalRoutes = (baseLayoutRoute.children || []).filter(
    (item) => !newNormalRoutes.find((newItem) => newItem?.path === item.path)
  )

  return [
    ...baseTopLayerRoutes,
    ...newTopLayerRoutes,
    {
      ...baseLayoutRoute,
      children: [...newNormalRoutes, ...baseNormalRoutes],
    },
  ]
}

function createTopologyInput(overrides = {}) {
  const layoutComponent = { name: 'LayoutStub' }

  return {
    initialized: true,
    routes: [],
    microWhiteRoutesMap: {},
    baseRoutes: [
      { path: '/login', name: 'login', meta: { type: 'internal' } },
      { path: '/debug', name: 'debug', meta: { type: 'internal' } },
      buildAppLayoutRoute(layoutComponent, [
        { path: '/', name: 'root' },
        { path: '/welcome', name: 'welcome' },
        { path: '*', name: 'notFound' },
      ]),
    ],
    errorRoutes: buildErrorRoutes({ name: 'ErrorRouteComponent' }),
    mergeRoutes,
    routersUnique,
    ...overrides,
  }
}

describe('buildRouterTopology', () => {
  test('returns the error-route topology when initialization is false', () => {
    expect(
      buildRouterTopology(
        createTopologyInput({
          initialized: false,
          routes: [{ path: '/dev/app-list', title: '应用列表', type: 'micro', config: {} }],
        })
      )
    ).toEqual([
      expect.objectContaining({
        path: '*',
        name: 'error',
        meta: {
          title: '错误页面',
          authIds: [],
          type: 'internal',
        },
      }),
    ])
  })

  test('merges app routes and micro white routes while preserving the app layout base route', () => {
    const topology = buildRouterTopology(
      createTopologyInput({
        routes: [
          {
            path: '/dev/app-list',
            title: '应用列表',
            type: 'micro',
            config: { entry: 'app-layout' },
          },
        ],
        microWhiteRoutesMap: {
          microApp: [{ path: '/micro/white', name: 'microWhite' }],
        },
      })
    )

    const layoutRoute = topology.find((item) => item.path === '/')

    expect(layoutRoute).toEqual(
      expect.objectContaining({
        path: '/',
        pageComponent: { name: 'LayoutStub' },
        children: expect.arrayContaining([
          expect.objectContaining({ path: '/' }),
          expect.objectContaining({ path: '/welcome' }),
          expect.objectContaining({ path: '/dev/app-list' }),
          expect.objectContaining({
            path: '/micro/white',
            meta: expect.objectContaining({ type: 'micro', entry: 'microApp' }),
          }),
        ]),
      })
    )
  })

  test('dedupes app routes by normalized path before merging', () => {
    const topology = buildRouterTopology(
      createTopologyInput({
        routes: [
          {
            path: '/dev/app-list?tab=todo',
            title: '旧应用列表',
            type: 'micro',
            config: { entry: 'old-app' },
          },
          {
            path: '/dev/app-list?tab=done',
            title: '新应用列表',
            type: 'micro',
            config: { entry: 'new-app' },
          },
        ],
      })
    )

    const layoutRoute = topology.find((item) => item.path === '/')
    const appListRoutes = (layoutRoute?.children || []).filter((item) => item.path === '/dev/app-list')

    expect(appListRoutes).toHaveLength(1)
    expect(appListRoutes[0]).toEqual(
      expect.objectContaining({
        path: '/dev/app-list',
        meta: expect.objectContaining({ title: '新应用列表', entry: 'new-app' }),
      })
    )
  })
})
