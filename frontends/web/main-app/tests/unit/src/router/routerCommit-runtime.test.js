import { beforeEach, expect, test, vi } from 'vitest'

vi.mock('../../../../src/common/i18n/index.ts', () => ({ i18nManager: { onLocaleChange: vi.fn() } }))
vi.mock('../../../../src/store/storeFacade.ts', () => ({ readGetters: () => ({}) }))

let engine
let router
let popstate
beforeEach(async () => {
  vi.resetModules()
  popstate = undefined
  globalThis.window = {
    location: { pathname: '/first', search: '', hash: '' },
    history: { pushState: vi.fn(), replaceState: vi.fn() },
    addEventListener: vi.fn((event, listener) => { if (event === 'popstate') popstate = listener }),
  }
  engine = await import('../../../../src/router/engines/routerEngine.ts')
  engine.configureRouter({
    readTopology: () => [{ path: '/:page', name: 'page', meta: {} }],
    install: router => router.beforeEach((_to, _from, next) => next()),
  })
  router = engine.getRouter()
  await new Promise(resolve => setTimeout(resolve, 0))
})

test('a later guard rejection prevents deferred tab projection and URL commit', async () => {
  const project = vi.fn()
  router.beforeEach((_to, _from, next) => { next.onCommit(project); next() })
  router.beforeEach((_to, _from, next) => next(false))
  expect(await engine.commitTabNavigation('/second')).toBe(false)
  expect(project).not.toHaveBeenCalled()
  expect(router.currentRoute.fullPath).toBe('/first')
  expect(window.history.replaceState).not.toHaveBeenCalled()
})

test('rejection at the same URL still reports rejection to the tab command', async () => {
  router.beforeEach((_to, _from, next) => next(false))
  expect(await engine.commitTabNavigation('/first')).toBe(false)
})

test('rapid navigation commits the latest intent when an earlier guard finishes late', async () => {
  let release
  const held = new Promise(resolve => { release = resolve })
  router.beforeEach(async (to, _from, next) => { if (to.path === '/slow') await held; next() })
  const earlier = engine.commitTabNavigation('/slow')
  expect(await engine.commitTabNavigation('/fast')).toBe(true)
  release()
  expect(await earlier).toBe(false)
  expect(router.currentRoute.fullPath).toBe('/fast')
  expect(window.history.replaceState).toHaveBeenCalledTimes(1)
})

test('a deferred projection can reject its late result after a newer navigation', async () => {
  let release
  let entered
  const held = new Promise(resolve => { release = resolve })
  const started = new Promise(resolve => { entered = resolve })
  const project = vi.fn()
  router.beforeEach((to, _from, next) => {
    if (to.path === '/slow') next.onCommit(async isCurrent => {
      entered(); await held
      if (!isCurrent()) return false
      project()
    })
    next()
  })
  const earlier = engine.commitTabNavigation('/slow')
  await started
  await engine.commitTabNavigation('/fast')
  release()
  expect(await earlier).toBe(false)
  expect(project).not.toHaveBeenCalled()
  expect(router.currentRoute.fullPath).toBe('/fast')
})

test('cancelled back or forward restores the committed URL without notifying consumers', async () => {
  const listener = vi.fn()
  engine.subscribeRouteChanges(listener)
  router.beforeEach((_to, _from, next) => next(false))
  window.location.pathname = '/previous'
  popstate()
  await new Promise(resolve => setTimeout(resolve, 0))
  expect(window.history.replaceState).toHaveBeenCalledWith({}, '', '/first')
  expect(listener).not.toHaveBeenCalled()
})

test('a tab leave rejection during browser history navigation restores the committed URL', async () => {
  const listener = vi.fn()
  engine.subscribeRouteChanges(listener)
  router.beforeEach((_to, _from, next) => { next.onCommit(async () => false); next() })
  window.location.pathname = '/previous'
  popstate()
  await new Promise(resolve => setTimeout(resolve, 0))
  expect(window.history.replaceState).toHaveBeenCalledWith({}, '', '/first')
  expect(router.currentRoute.fullPath).toBe('/first')
  expect(listener).not.toHaveBeenCalled()
})

test('redirects commit the destination but reject the original tab intent', async () => {
  router.beforeEach((to, _from, next) => next(to.path === '/private' ? { path: '/login', replace: true } : undefined))
  expect(await engine.commitTabNavigation('/private')).toBe(false)
  expect(router.currentRoute.fullPath).toBe('/login')
  expect(window.history.replaceState).toHaveBeenCalledTimes(1)
})

test('tab command projection finishes before the URL and route consumers are notified', async () => {
  const state = { activeTab: 'first' }
  const observed = []
  engine.subscribeRouteChanges(route => observed.push([route.fullPath, state.activeTab]))
  expect(await engine.commitTabNavigation('/second', async () => { state.activeTab = 'second' })).toBe(true)
  expect(observed).toEqual([['/second', 'second']])
  expect(window.history.replaceState).toHaveBeenCalledTimes(1)
})

test('a cancelled tab projection preserves URL and suppresses route notification', async () => {
  const listener = vi.fn()
  engine.subscribeRouteChanges(listener)
  expect(await engine.commitTabNavigation('/second', async () => false)).toBe(false)
  expect(router.currentRoute.fullPath).toBe('/first')
  expect(window.history.replaceState).not.toHaveBeenCalled()
  expect(listener).not.toHaveBeenCalled()
})

test('accepted browser back and forward use the browser entry and notify the matching route', async () => {
  const listener = vi.fn()
  engine.subscribeRouteChanges(listener)
  for (const path of ['/back', '/forward']) {
    window.location.pathname = path
    popstate()
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(router.currentRoute.fullPath).toBe(path)
  }
  expect(listener).toHaveBeenCalledTimes(2)
  expect(window.history.pushState).not.toHaveBeenCalled()
  expect(window.history.replaceState).not.toHaveBeenCalled()
})
