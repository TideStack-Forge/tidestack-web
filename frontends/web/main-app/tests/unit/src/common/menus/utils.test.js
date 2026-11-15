const assert = require('node:assert/strict')
const path = require('node:path')
const { requireMirroredSrcModule } = require(
  path.join(process.cwd(), 'tests/unit/helpers/mainAppTestKit')
)

const { resolveMenuRef, findMenuItem, findMenuItemInTrees, cloneMenuItems } =
  requireMirroredSrcModule(__filename, './utils.ts')

const mainTree = [
  {
    fullName: 'dashboard',
    title: '仪表盘',
    path: '/dashboard',
    children: [{ fullName: 'dashboard.overview', title: '概览', path: '/dashboard/overview' }],
  },
  {
    url: '/system',
    router_id: 'system',
    title: '系统',
    children: [
      {
        fullName: 'system.user',
        name: 'user-management',
        title: '用户',
        children: [{ fullName: 'system.user.list', title: '用户列表', path: '/system/user/list' }],
      },
    ],
  },
]

const secondaryTree = [{ fullName: 'help', title: '帮助', path: '/help' }]

test('resolveMenuRef 按 fullName → url → path → fullPath → router_id → name 优先级取键', () => {
  assert.equal(resolveMenuRef({ fullName: 'a.b', path: '/a' }), 'a.b')
  assert.equal(resolveMenuRef({ url: '/a', path: '/b' }), '/a')
  assert.equal(resolveMenuRef({ path: '/a', fullPath: '/a/x' }), '/a')
  assert.equal(resolveMenuRef({ router_id: 'sys', name: 'n' }), 'sys')
  assert.equal(resolveMenuRef({ name: 'only-name' }), 'only-name')
})

test('resolveMenuRef 对空值与非对象返回 undefined', () => {
  assert.equal(resolveMenuRef(undefined), undefined)
  assert.equal(resolveMenuRef(null), undefined)
  assert.equal(resolveMenuRef({}), undefined)
  assert.equal(resolveMenuRef({ fullName: '' }), undefined)
  assert.equal(resolveMenuRef('not-an-object'), undefined)
})

test('findMenuItem 支持任一枚举键匹配并递归子树', () => {
  assert.equal(findMenuItem(mainTree, 'dashboard').title, '仪表盘')
  assert.equal(findMenuItem(mainTree, '/dashboard').title, '仪表盘')
  assert.equal(findMenuItem(mainTree, 'dashboard.overview').title, '概览')
  assert.equal(findMenuItem(mainTree, '/system/user/list').title, '用户列表')
  assert.equal(findMenuItem(mainTree, 'user-management').title, '用户')
  assert.equal(findMenuItem(mainTree, 'not-exists'), undefined)
  assert.equal(findMenuItem(undefined, 'x'), undefined)
  assert.equal(findMenuItem(mainTree, ''), undefined)
})

test('findMenuItemInTrees 依次查找主菜单与辅助菜单', () => {
  assert.equal(findMenuItemInTrees({ globalMenu: mainTree, globalSubNav: secondaryTree }, 'help').title, '帮助')
  assert.equal(findMenuItemInTrees({ globalMenu: mainTree, globalSubNav: secondaryTree }, 'dashboard').title, '仪表盘')
  assert.equal(findMenuItemInTrees({ globalMenu: mainTree, globalSubNav: secondaryTree }, 'missing'), undefined)
})

test('cloneMenuItems 深拷贝树且不共享子节点引用', () => {
  const cloned = cloneMenuItems(mainTree)
  assert.notEqual(cloned, mainTree)
  assert.notEqual(cloned[0].children, mainTree[0].children)
  assert.notEqual(cloned[0].children[0], mainTree[0].children[0])
  assert.deepEqual(cloned, mainTree)
  assert.equal(cloneMenuItems(undefined).length, 0)
})
