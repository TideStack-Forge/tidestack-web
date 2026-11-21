const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { mainAppRoot, readRootFile } = require(path.join(
  process.cwd(),
  'tests/unit/helpers/mainAppTestKit'
))

function readSrc(relativePath) {
  return readRootFile(path.join('src', relativePath))
}

test('wave j slice keeps the app layout on a react-owned boot lane', () => {
  const hostBootstrapSource = readSrc('bootstrap/bootstrapHostApp.ts')
  const appLayoutSource = readSrc('layouts/AppLayout.tsx')
  const internalRoutesSource = readSrc('router/internalRoutes.ts')
  const routerTopologyRuntimeSource = readSrc('router/routerTopologyRuntime.ts')

  assert.match(hostBootstrapSource, /mountReactApp\(/)
  assert.match(hostBootstrapSource, /AppLayout/)
  assert.doesNotMatch(hostBootstrapSource, /initMain\(/)
  assert.doesNotMatch(hostBootstrapSource, /createRoot\(document\.createElement\('div'\)\)/)
  assert.doesNotMatch(hostBootstrapSource, /mountLegacyVue\w*\(/)
  assert.match(hostBootstrapSource, /createRoot\(container\)/)
  assert.match(appLayoutSource, /from '@\/layouts\/layout-projection'/)
  assert.match(appLayoutSource, /const layoutProjection = ownedRoute\s*\?/)
  assert.match(appLayoutSource, /layoutProjection\?\.layoutProps/)
  assert.doesNotMatch(appLayoutSource, /VueComponentIsland/)

  assert.equal(fs.existsSync(path.join(mainAppRoot, 'src', 'initMain.js')), false)
  assert.equal(fs.existsSync(path.join(mainAppRoot, 'src', 'pages', 'systems', 'error.vue')), false)
  assert.equal(
    fs.existsSync(path.join(mainAppRoot, 'src', 'pages', 'systems', 'errorAfterLogin.vue')),
    false
  )
  assert.equal(fs.existsSync(path.join(mainAppRoot, 'src', 'pages', 'systems', 'welcome.vue')), false)
  assert.equal(fs.existsSync(path.join(mainAppRoot, 'src', 'pages', 'systems', '404.vue')), false)
  assert.equal(
    fs.existsSync(path.join(mainAppRoot, 'src', 'pages', 'debug', 'ScriptEditorIntelligenceRoute.ts')),
    false
  )
  assert.equal(
    fs.existsSync(path.join(mainAppRoot, 'src', 'pages', 'debug', 'DatasetSqlEditorRoute.ts')),
    false
  )
  assert.equal(
    fs.existsSync(path.join(mainAppRoot, 'src', 'features', 'system', 'createReactPageAdapter.ts')),
    false
  )

  assert.match(internalRoutesSource, /WelcomePage/)
  assert.match(internalRoutesSource, /ErrorAfterLoginPage/)
  assert.match(internalRoutesSource, /NotFoundPage/)
  assert.match(routerTopologyRuntimeSource, /ErrorPage/)
  assert.doesNotMatch(internalRoutesSource, /createReactPageAdapter/)
  assert.doesNotMatch(internalRoutesSource, /\.vue/)

  assert.ok(
    fs.existsSync(path.join(mainAppRoot, 'src', 'features', 'system', 'pages', 'ErrorPage.tsx')),
    'expected ErrorPage.tsx to exist'
  )
  assert.ok(
    fs.existsSync(path.join(mainAppRoot, 'src', 'features', 'system', 'pages', 'ErrorAfterLoginPage.tsx')),
    'expected ErrorAfterLoginPage.tsx to exist'
  )
  assert.ok(
    fs.existsSync(path.join(mainAppRoot, 'src', 'features', 'system', 'pages', 'WelcomePage.tsx')),
    'expected WelcomePage.tsx to exist'
  )
  assert.ok(
    fs.existsSync(path.join(mainAppRoot, 'src', 'features', 'system', 'pages', 'NotFoundPage.tsx')),
    'expected NotFoundPage.tsx to exist'
  )
  assert.ok(
    fs.existsSync(path.join(mainAppRoot, 'src', 'pages', 'debug', 'ScriptEditorIntelligencePage.tsx')),
    'expected ScriptEditorIntelligencePage.tsx to exist'
  )
  assert.ok(
    fs.existsSync(path.join(mainAppRoot, 'src', 'pages', 'debug', 'DatasetSqlEditorPage.tsx')),
    'expected DatasetSqlEditorPage.tsx to exist'
  )
})
