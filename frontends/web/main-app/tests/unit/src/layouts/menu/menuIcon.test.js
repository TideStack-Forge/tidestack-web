const assert = require('node:assert/strict')
const path = require('node:path')
const {
  clearMirroredSrcModuleCache,
  registerTypescriptRequire,
  requireMirroredSrcModule,
} = require(path.join(process.cwd(), 'tests/unit/helpers/mainAppTestKit'))

registerTypescriptRequire()

function loadMenuIconModule() {
  clearMirroredSrcModuleCache(__filename, '.')
  return requireMirroredSrcModule(__filename, './menuIcon.ts')
}

test('menu icon resolver falls back to list icon only when menu item icon is missing', () => {
  const { DEFAULT_MENU_ICON, resolveMenuItemIcon } = loadMenuIconModule()

  assert.equal(DEFAULT_MENU_ICON, 'fas fa-list-ul')
  assert.equal(resolveMenuItemIcon({ icon: 'icon-custom' }), 'icon-custom')
  assert.equal(resolveMenuItemIcon({}), DEFAULT_MENU_ICON)
  assert.equal(resolveMenuItemIcon(), DEFAULT_MENU_ICON)
})
