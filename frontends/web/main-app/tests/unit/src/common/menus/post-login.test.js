const assert = require('node:assert/strict')
const path = require('node:path')
const {
  clearMirroredSrcModuleCache,
  registerTypescriptRequire,
  requireMirroredSrcModule,
} = require(path.join(process.cwd(), 'tests/unit/helpers/mainAppTestKit'))

registerTypescriptRequire()
clearMirroredSrcModuleCache(__filename, '.')

const {
  hasConfiguredMenus,
  resolvePostLoginDecision,
  resolvePostLoginFallbackPath,
} = requireMirroredSrcModule(__filename, './post-login.ts')

test('routes users without menu resources to the post-login error page', () => {
  assert.equal(hasConfiguredMenus({ globalMenu: [] }), false)
  assert.equal(resolvePostLoginFallbackPath({ globalMenu: [] }), '/errorAfterLogin')
})

test('keeps welcome fallback for users with at least one configured menu', () => {
  const menu = {
    globalMenu: [
      {
        title: '应用开发看板',
        path: '/dev/app-list',
      },
    ],
  }

  assert.equal(hasConfiguredMenus(menu), true)
  assert.equal(resolvePostLoginFallbackPath(menu), '/welcome')
})

test('prefers menu-opening policy when redirect hits a configured menu', () => {
  assert.deepEqual(
    resolvePostLoginDecision({
      preferredPath: '/dev/app-list',
      preferredMenuPath: '/dev/app-list',
      preferredRoutePath: '/dev/app-list',
      menu: {
        globalMenu: [{ title: '应用开发看板', path: '/dev/app-list' }],
      },
    }),
    {
      type: 'menu',
      targetPath: '/dev/app-list',
    }
  )
})

test('falls back to route-opening policy when redirect has no menu but resolves to a valid route', () => {
  assert.deepEqual(
    resolvePostLoginDecision({
      preferredPath: '/welcome?tab=todo',
      preferredMenuPath: null,
      preferredRoutePath: '/welcome',
      menu: {
        globalMenu: [{ title: '应用开发看板', path: '/dev/app-list' }],
      },
    }),
    {
      type: 'route',
      targetPath: '/welcome',
    }
  )
})

test('falls back to post-login error route when no menu resources exist', () => {
  assert.deepEqual(
    resolvePostLoginDecision({
      preferredPath: '/dev/missing',
      preferredMenuPath: null,
      preferredRoutePath: null,
      menu: { globalMenu: [] },
    }),
    {
      type: 'fallback',
      targetPath: '/errorAfterLogin',
    }
  )
})

test('falls back to welcome route when menu resources exist but redirect cannot be matched', () => {
  assert.deepEqual(
    resolvePostLoginDecision({
      preferredPath: '/dev/missing',
      preferredMenuPath: null,
      preferredRoutePath: null,
      menu: {
        globalMenu: [{ title: '应用开发看板', path: '/dev/app-list' }],
      },
    }),
    {
      type: 'fallback',
      targetPath: '/welcome',
    }
  )
})
