const assert = require('node:assert/strict')
const path = require('node:path')
const {
  clearMirroredSrcModuleCache,
  registerTypescriptRequire,
  requireMirroredSrcModule,
} = require(path.join(process.cwd(), 'tests/unit/helpers/mainAppTestKit'))

registerTypescriptRequire()
clearMirroredSrcModuleCache(__filename, '.')

const { performPostLoginNavigation } = requireMirroredSrcModule(__filename, './post-login-navigation.ts')

test('preferred configured menu target routes through the menu opener path', async () => {
  const calls = []

  const result = await performPostLoginNavigation({
    preferredPath: '/dev/app-list',
    preferredMenuPath: '/dev/app-list',
    preferredRoutePath: '/dev/app-list',
    menu: { globalMenu: [{ title: '应用开发看板', path: '/dev/app-list' }] },
    onMenuTarget: async (targetPath) => {
      calls.push(['menu', targetPath])
      return true
    },
    onRouteTarget: async (targetPath) => {
      calls.push(['route', targetPath])
    },
    onFallbackTarget: async (targetPath) => {
      calls.push(['fallback', targetPath])
    },
  })

  assert.deepEqual(calls, [['menu', '/dev/app-list']])
  assert.deepEqual(result, {
    decision: { type: 'menu', targetPath: '/dev/app-list' },
    handled: true,
  })
})

test('preferred valid route target routes through the tab opener path', async () => {
  const calls = []

  const result = await performPostLoginNavigation({
    preferredPath: '/welcome?tab=todo',
    preferredMenuPath: null,
    preferredRoutePath: '/welcome',
    menu: { globalMenu: [{ title: '应用开发看板', path: '/dev/app-list' }] },
    onMenuTarget: async (targetPath) => {
      calls.push(['menu', targetPath])
      return true
    },
    onRouteTarget: async (targetPath) => {
      calls.push(['route', targetPath])
    },
    onFallbackTarget: async (targetPath) => {
      calls.push(['fallback', targetPath])
    },
  })

  assert.deepEqual(calls, [['route', '/welcome']])
  assert.deepEqual(result, {
    decision: { type: 'route', targetPath: '/welcome' },
    handled: true,
  })
})

test('unmatched target without menus routes through the layout landing fallback path', async () => {
  const calls = []

  const result = await performPostLoginNavigation({
    preferredPath: '/dev/missing',
    preferredMenuPath: null,
    preferredRoutePath: null,
    menu: { globalMenu: [] },
    onMenuTarget: async (targetPath) => {
      calls.push(['menu', targetPath])
      return true
    },
    onRouteTarget: async (targetPath) => {
      calls.push(['route', targetPath])
    },
    onFallbackTarget: async (targetPath) => {
      calls.push(['fallback', targetPath])
    },
  })

  assert.deepEqual(calls, [['fallback', '/errorAfterLogin']])
  assert.deepEqual(result, {
    decision: { type: 'fallback', targetPath: '/errorAfterLogin' },
    handled: true,
  })
})

test('failed menu action falls back to a valid route target before layout fallback', async () => {
  const calls = []

  const result = await performPostLoginNavigation({
    preferredPath: '/dev/app-list',
    preferredMenuPath: '/dev/app-list',
    preferredRoutePath: '/welcome',
    menu: { globalMenu: [{ title: '应用开发看板', path: '/dev/app-list' }] },
    onMenuTarget: async (targetPath) => {
      calls.push(['menu', targetPath])
      return false
    },
    onRouteTarget: async (targetPath) => {
      calls.push(['route', targetPath])
    },
    onFallbackTarget: async (targetPath) => {
      calls.push(['fallback', targetPath])
    },
  })

  assert.deepEqual(calls, [
    ['menu', '/dev/app-list'],
    ['route', '/welcome'],
  ])
  assert.deepEqual(result, {
    decision: { type: 'route', targetPath: '/welcome' },
    handled: true,
  })
})
