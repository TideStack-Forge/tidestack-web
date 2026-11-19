import { describe, expect, test } from 'vitest'

import { resolveNavigationDecision } from '../../../../src/router/navigationDecision.ts'

function createDecisionInput(overrides = {}) {
  return {
    isLegacyIframeMode: false,
    shouldConfirmLeave: false,
    isErrorRoute: false,
    isLogin: false,
    toPath: '/dev/app-list',
    toFullPath: '/dev/app-list?tab=todo',
    toQueryRedirect: undefined,
    postLoginFallbackPath: '/welcome',
    whiteList: ['/login'],
    routeName: 'app-list',
    activeTabId: '',
    tabsList: [],
    routeTitle: '应用列表',
    ...overrides,
  }
}

describe('resolveNavigationDecision', () => {
  test('allows legacy iframe routes immediately', () => {
    expect(
      resolveNavigationDecision(createDecisionInput({ isLegacyIframeMode: true }))
    ).toEqual({
      type: 'allow',
    })
  })

  test('allows error routes immediately', () => {
    expect(
      resolveNavigationDecision(createDecisionInput({ isErrorRoute: true }))
    ).toEqual({
      type: 'allow',
    })
  })

  test('redirects logged-in login visits to the sanitized redirect target', () => {
    expect(
      resolveNavigationDecision(
        createDecisionInput({
          isLogin: true,
          toPath: '/login',
          toFullPath: '/login?redirect=/dev/app-list?tab=todo',
          routeName: 'login',
          toQueryRedirect: '/dev/app-list?tab=todo',
        })
      )
    ).toEqual({
      type: 'redirect',
      location: {
        path: '/dev/app-list?tab=todo',
      },
    })
  })

  test('flips welcome to errorAfterLogin when the fallback points there', () => {
    expect(
      resolveNavigationDecision(
        createDecisionInput({
          isLogin: true,
          toPath: '/welcome',
          toFullPath: '/welcome',
          routeName: 'welcome',
          postLoginFallbackPath: '/errorAfterLogin',
        })
      )
    ).toEqual({
      type: 'redirect',
      location: { path: '/errorAfterLogin', replace: true },
    })
  })

  test('flips errorAfterLogin back to the root route when welcome is the fallback', () => {
    expect(
      resolveNavigationDecision(
        createDecisionInput({
          isLogin: true,
          toPath: '/errorAfterLogin',
          toFullPath: '/errorAfterLogin',
          routeName: 'errorAfterLogin',
          postLoginFallbackPath: '/welcome',
        })
      )
    ).toEqual({
      type: 'redirect',
      location: { path: '/', replace: true },
    })
  })

  test('opens the root menu for logged-in root navigation', () => {
    expect(
      resolveNavigationDecision(
        createDecisionInput({
          isLogin: true,
          toPath: '/',
          toFullPath: '/',
          routeName: 'root',
        })
      )
    ).toEqual({
      type: 'open-root-menu',
    })
  })

  test('allows whitelist routes before auth redirects', () => {
    expect(
      resolveNavigationDecision(
        createDecisionInput({
          toPath: '/login',
          toFullPath: '/login',
          routeName: 'login',
        })
      )
    ).toEqual({
      type: 'allow',
    })
  })

  test('accepts a tab command without scheduling a second tab projection', () => {
    expect(
      resolveNavigationDecision(
        createDecisionInput({
          isLogin: true,
          tabIntent: true,
        })
      )
    ).toEqual({
      type: 'allow',
    })
  })

  test('requires login before accepting a tab command', () => {
    expect(resolveNavigationDecision(createDecisionInput({
      isLogin: false,
      tabIntent: true,
      toPath: '/dev/app-list',
      toFullPath: '/dev/app-list',
    }))).toEqual({
      type: 'redirect',
      location: { path: '/login', query: { redirect: '/dev/app-list' } },
    })
  })

  test('opens the dedicated notFound path', () => {
    expect(
      resolveNavigationDecision(
        createDecisionInput({
          isLogin: true,
          routeName: 'notFound',
          toPath: '/missing',
          toFullPath: '/missing',
        })
      )
    ).toEqual({
      type: 'open-not-found',
    })
  })

  test('preserves unauthenticated redirects for non-root destinations', () => {
    expect(resolveNavigationDecision(createDecisionInput())).toEqual({
      type: 'redirect',
      location: {
        path: '/login',
        query: { redirect: '/dev/app-list?tab=todo' },
      },
    })
  })

  test('switches the current tab on an exact fullPath match', () => {
    expect(
      resolveNavigationDecision(
        createDecisionInput({
          isLogin: true,
          activeTabId: 'tab-1',
          tabsList: [
            {
              id: 'tab-1',
              path: '/dev/app-list',
              fullPath: '/dev/app-list?tab=todo',
            },
          ],
        })
      )
    ).toEqual({
      type: 'switch-tab',
      activeTabId: 'tab-1',
    })
  })

  test('updates the current tab when the path matches but the fullPath changed', () => {
    expect(
      resolveNavigationDecision(
        createDecisionInput({
          isLogin: true,
          toFullPath: '/dev/app-list?tab=done',
          activeTabId: 'tab-1',
          tabsList: [
            {
              id: 'tab-1',
              path: '/dev/app-list',
              fullPath: '/dev/app-list?tab=todo',
            },
          ],
        })
      )
    ).toEqual({
      type: 'update-tab',
      activeTabId: 'tab-1',
      fullPath: '/dev/app-list?tab=done',
    })
  })

  test('opens or switches a tab when there is no active-tab match', () => {
    expect(
      resolveNavigationDecision(
        createDecisionInput({
          isLogin: true,
          activeTabId: 'tab-1',
          tabsList: [
            {
              id: 'tab-1',
              path: '/dev/other',
              fullPath: '/dev/other',
            },
          ],
        })
      )
    ).toEqual({
      type: 'open-or-switch-tab',
      fullPath: '/dev/app-list?tab=todo',
      title: '应用列表',
    })
  })
})

test('initialization failure blocks protected routes and only admits the recovery page', () => {
  const input = createDecisionInput({ hasInitializationError: true, isLogin: false })
  expect(resolveNavigationDecision(input)).toMatchObject({
    type: 'redirect',
    location: { path: '/errorAfterLogin' },
  })
  expect(resolveNavigationDecision({ ...input, isLegacyIframeMode: true })).toMatchObject(
    { type: 'redirect', location: { path: '/errorAfterLogin' } }
  )
  expect(resolveNavigationDecision({ ...input, toPath: '/errorAfterLogin' })).toEqual({
    type: 'allow',
  })
  expect(
    resolveNavigationDecision({ ...input, hasInitializationError: false })
  ).toMatchObject({ type: 'redirect', location: { path: '/login' } })
})
