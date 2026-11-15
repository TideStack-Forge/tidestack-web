# 菜单扩展机制使用指南（徽标 + 用户菜单注册）

> 面向 main-app 内部前端扩展编写者的编程接口指南。
> 设计文档：[menu-extension-design.md](menu-extension-design.md)（本模块内，权威设计）
> 微前端（SDK）用法见 [ouroboros-sdk/README.md](../../ouroboros-sdk/README.md) 的"菜单扩展"章节。

## 概述

菜单扩展机制提供三类能力，全部收敛到唯一实现 `@/common/menus/registry`：

1. **菜单徽标**：主菜单（`globalMenu`）与辅助菜单（`globalSubNav`）支持数字 / 红点 / 文本 / ribbon 四种形态；
2. **菜单树运行时操作**：查询、遍历、添加、删除（仅前端运行时，刷新回退后端菜单树）；
3. **用户菜单注册制**：头像下拉的菜单项全部来自注册表，内置"修改密码 / 切换主题 / 退出"也是注册项。

徽标与注册项均为**会话内存级**状态：刷新即失，登出（`user/LOGOUT`）时清空徽标与非内置注册项。

## 徽标（Badge）

### 编程接口

```ts
import { menu } from '@/common/menus/registry'

// 数字徽标（max 缺省 99，溢出显示 99+）
menu.setMenuBadge('workbench.todo', { type: 'number', value: 3 })

// 红点（默认 danger 红，可自定义颜色）
menu.setMenuBadge('workbench.messages', { type: 'dot' })
menu.setMenuBadge('workbench.messages', { type: 'dot', color: '#00b3ff' })

// 短文本 / 缎带角标
menu.setMenuBadge('new-feature', { type: 'text', text: 'NEW' })
menu.setMenuBadge('featured', { type: 'ribbon', text: 'HOT', position: 'top-right' })

// 查询 / 清除
const badge = menu.getMenuBadge('workbench.todo')
menu.setMenuBadge('workbench.todo', null)
```

徽标写入与清除使用调用方提供的同一引用键（去首尾空格），建议统一使用 `fullName`。查询先查原键，再由菜单树定位该项的首个有效引用键；渲染会依次检查 `fullName / url / path / fullPath / router_id / name`。这不保证任意别名之间都可互查或互相清除：例如用 path 写入后，应仍用该 path 清除。

### amis action

```json
{
  "actionType": "setMenuBadge",
  "args": { "fullName": "dev.apps", "badge": { "type": "number", "value": 3 } }
}
```

- `badge` 为 `null` 即清除；
- `args` 直接传字符串（fullName）时语义为清除该菜单徽标。

## 菜单树查询 / 遍历 / 增删

```ts
import { menu } from '@/common/menus/registry'

// 查询单个菜单（含徽标），返回副本
const item = menu.getMenu('system.user') // { fullName, title, badge, children, ... }

// 遍历（含徽标）；flat 时深度优先拍平并带 level
const tree = menu.getMenus({ scope: 'all' })          // { main, secondary }
const flat = menu.getMenus({ scope: 'all', flat: true })

// 访问器遍历，visitor 返回 false 跳过子树
menu.traverseMenus((item, parents) => {
  if (item.fullName === 'system') return false
}, { scope: 'main' })

// 添加（需要有效菜单引用（建议 fullName），引用冲突时拒绝；冲突 / 父节点缺失返回 false）
const ok = menu.addMenuItem({
  scope: 'main',
  parentFullName: 'system.user',
  index: 0,
  item: { fullName: 'system.user.extra', title: '扩展页', path: '/system/user/extra' },
})

// 移除（含子树，级联清理子树徽标）
menu.removeMenuItem('system.user.extra')
```

## 用户菜单注册

### 编程接口

```ts
import { userMenu } from '@/common/menus/registry'
import type { UserMenuItem } from '@/common/menus/registry'

const id = userMenu.register({
  title: '我的待办',
  key: 'my-todo',               // 稳定业务键：同 key 重复注册视为覆盖（幂等）
  order: 50,                    // 升序渲染，缺省 100
  badge: { type: 'number', value: 3 },  // 可选：用户菜单项徽标
  divider: false,
  visible: (ctx) => true,       // 可选：渲染时求值
  disabled: (ctx) => false,     // 可选
  closeOnClick: true,           // 可选：点击后收起下拉，缺省 true
  onClick: (ctx) => {
    // ctx: { userInfo, theme, themeList, isLockTheme, lockTheme, dispatch, openDialog }
    ctx.openDialog({ width: '500px', url: '/some/dialog' })
  },
})

userMenu.unregister(id)
const items = userMenu.getItems() // 按 order 升序，含内置项
userMenu.unregisterAll('my-app')  // 按 owner 批量移除（SDK 自动按微应用名传入 owner）
```

### 内置项

内置"修改密码（order 10）/ 切换主题（order 20，`isLockTheme` 时隐藏）/ 退出（order 1000）"由 `@/common/menus/userMenuBuiltins` 在模块加载时幂等注册，`UserMenu.tsx` 已作为副作用引入，无需手动注册。登出清理时内置项保留。

### i18n

注册项支持 `titleKey`（common 命名空间翻译键）：提供时渲染 `t(titleKey, title)`，切换语言自动生效。

## 生命周期语义

| 时机 | 行为 |
|------|------|
| 菜单树重建（updateMenu / 重新登录 / locale 切换） | 徽标独立保留，按引用重新命中 |
| 运行时移除菜单 | 级联清理被删子树的徽标 |
| 用户登出（`user/LOGOUT` mutation） | 清空徽标与非内置注册项 |
| 微应用卸载（SDK） | 清理本次 SDK 初始化实例登记的用户菜单 id；初始化前的登记需显式清理；徽标保留 |

## 渲染接入点

徽标已接入：`MenuDualMode`（双栏主菜单）、`MenuTree / MenuTreeItems`（树形主菜单与辅助菜单）、`MenuFloatMenu / MenuFloatItem / MenuFloatSubmenu`（悬浮菜单）、`SearchBar`（搜索结果）、`UserMenu`（用户菜单项）。新增菜单渲染面时，在菜单项上渲染 `<MenuBadge item={item} />` 即可，组件位于 `src/layouts/menu/MenuBadge.tsx`。
