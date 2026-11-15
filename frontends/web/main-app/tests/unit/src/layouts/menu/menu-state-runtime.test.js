const assert = require('node:assert/strict')
const path = require('node:path')

const {
  clearMirroredSrcModuleCache,
  registerTypescriptRequire,
  requireMirroredSrcModule,
} = require(path.join(process.cwd(), 'tests/unit/helpers/mainAppTestKit'))

registerTypescriptRequire()

function loadMenuStateModule() {
  clearMirroredSrcModuleCache(__filename, '.')
  return requireMirroredSrcModule(__filename, './menuState.ts')
}

test('builds breadcrumb keys and sync keys from the active tab identity chain', () => {
  const { buildMenuSyncKey, getActiveLeafKey, getMenuBreadcrumbKeys, isMenuItemInTrail } =
    loadMenuStateModule()

  const breadcrumbKeys = getMenuBreadcrumbKeys([
    { key: 'system-setting' },
    { key: 'user-management' },
  ])

  assert.deepEqual(breadcrumbKeys, ['system-setting', 'user-management'])
  assert.equal(buildMenuSyncKey('tab-user', breadcrumbKeys), 'tab-user|system-setting|user-management')
  assert.equal(getActiveLeafKey(breadcrumbKeys), 'user-management')
  assert.equal(isMenuItemInTrail({ key: 'system-setting' }, breadcrumbKeys), true)
  assert.equal(isMenuItemInTrail({ key: 'role-management' }, breadcrumbKeys), false)
})

test('detects real tab switches from the sync key prefix only', () => {
  const { isMenuTabChanged } = loadMenuStateModule()

  assert.equal(isMenuTabChanged('tab-a|system|user', 'tab-a|system|role'), false)
  assert.equal(isMenuTabChanged('tab-b|system|user', 'tab-a|system|role'), true)
  assert.equal(isMenuTabChanged('tab-a|system|user', ''), false)
})

test('expands the active menu path without overriding manual close until a tab switch forces reopen', () => {
  const { expandActiveMenuPath } = loadMenuStateModule()

  const menuArr = [
    {
      key: 'system-setting',
      title: '系统管理',
      children: [
        {
          key: 'user-management',
          title: '用户管理',
          children: [{ key: 'user-detail', title: '用户详情' }],
        },
      ],
    },
  ]

  const breadcrumbKeys = ['system-setting', 'user-management', 'user-detail']

  assert.equal(expandActiveMenuPath(menuArr, breadcrumbKeys), true)
  assert.equal(menuArr[0].opened, true)
  assert.equal(menuArr[0].children[0].opened, true)

  menuArr[0].opened = false
  menuArr[0].children[0].opened = false

  assert.equal(expandActiveMenuPath(menuArr, breadcrumbKeys), false)
  assert.equal(menuArr[0].opened, false)
  assert.equal(menuArr[0].children[0].opened, false)

  assert.equal(expandActiveMenuPath(menuArr, breadcrumbKeys, { force: true }), true)
  assert.equal(menuArr[0].opened, true)
  assert.equal(menuArr[0].children[0].opened, true)
})
