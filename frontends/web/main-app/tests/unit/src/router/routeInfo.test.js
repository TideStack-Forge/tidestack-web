import { describe, expect, test } from 'vitest'

import { buildRouteInfo } from '../../../../src/router/routeInfo.ts'

function createResolvedRoute(overrides = {}) {
  const { href = '/dev/app-list', ...resolvedOverrides } = overrides

  return {
    href,
    resolved: {
      matched: [],
      query: {},
      params: {},
      fullPath: '/dev/app-list',
      path: '/dev/app-list',
      hash: '',
      ...resolvedOverrides,
    },
  }
}

describe('buildRouteInfo', () => {
  test('returns the internal notFound fallback for unmatched routes', () => {
    expect(buildRouteInfo('/missing', createResolvedRoute({ matched: [] }))).toEqual({
      href: '/dev/app-list',
      type: 'internal',
      name: 'notFound',
      path: '/missing',
      fullPath: '/missing',
      params: {},
      query: {},
      hash: '',
      matched: [],
      meta: {},
    })
  })

  test('exposes path, fullPath, query, params, hash, lastMatched, and meta for matched routes', () => {
    const lastMatched = {
      path: '/dev/app-list',
      meta: {
        title: '应用列表',
        type: 'micro',
        entry: 'main-app',
      },
    }

    expect(
      buildRouteInfo(
        '/dev/app-list?tab=todo#filters',
        createResolvedRoute({
          href: '/dev/app-list?tab=todo#filters',
          matched: [{ path: '/' }, lastMatched],
          query: { tab: 'todo' },
          params: { appId: '123' },
          fullPath: '/dev/app-list?tab=todo#filters',
          path: '/dev/app-list',
          hash: '#filters',
        })
      )
    ).toEqual({
      href: '/dev/app-list?tab=todo#filters',
      type: 'micro',
      query: { tab: 'todo' },
      params: { appId: '123' },
      path: '/dev/app-list',
      fullPath: '/dev/app-list?tab=todo#filters',
      hash: '#filters',
      matched: [{ path: '/' }, lastMatched],
      lastMatched,
      meta: {
        title: '应用列表',
        type: 'micro',
        entry: 'main-app',
      },
      title: '应用列表',
      entry: 'main-app',
    })
  })

  test('defaults route type to internal when matched meta omits it', () => {
    const lastMatched = {
      path: '/dev/internal-page',
      meta: {
        title: '内部页面',
      },
    }

    expect(
      buildRouteInfo(
        '/dev/internal-page',
        createResolvedRoute({
          href: '/dev/internal-page',
          matched: [lastMatched],
          path: '/dev/internal-page',
          fullPath: '/dev/internal-page',
        })
      )
    ).toEqual(
      expect.objectContaining({
        type: 'internal',
        meta: {
          title: '内部页面',
        },
        title: '内部页面',
      })
    )
  })
})
