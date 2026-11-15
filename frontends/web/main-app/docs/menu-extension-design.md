# 前端基座菜单扩展机制设计（菜单徽标 + 用户菜单注册）

> 状态：Accepted（已实施）
> **契约以实现为准**：下面接口签名已按 2026-09-12 的 `registry.ts` / `types.ts` 核对修正（`getMenus` 的返回联合类型、`removeMenuItem` 的 boolean、`unregisterAll` 的必填 owner）；若再次分叉，以代码为准并回来更新本页。
> 实施证据：设计随 `b9087f3552`（2026-08-20）提交，实现于同一日至 2026-08-24 落地
> （`2e3e2e2606` registry、`4d571215c0` 各菜单面渲染、`049e7d5b33` SDK 能力、
> `30e55a6028` amis action + 平台注入、`679313a4c9` 使用指南）。
> 使用指南：[frontends/web/main-app/docs/menu-extension.md](menu-extension.md)
> 主题：主应用运行时菜单装饰（badge）、菜单树运行时操作与用户菜单注册制
> 涉及模块：`frontends/web/main-app`、`frontends/web/ouroboros-sdk`

## 实施前背景

实施前，前端基座的菜单体系由后端驱动：`/api/authored-menu-tree` 返回 `{ main, secondary }`，经 `user/updateMenu` → `normalizeMenu` 存入 store 的 `user` 模块（`store/modules/user.js`：`state.menu = { globalMenu, globalSubNav }`；基座已弃用 Vuex，底层为自研 storeEngine，模块契约沿用 Vuex 风格写法），由 `Sidebar` 中 `MenuDualMode / MenuTree / MenuTreeItems` 等组件渲染。运行时只有一条菜单更新通道——`devWorkspaceMenuSync`，且是全量覆盖语义。

由此产生三类能力缺口：

1. **缺少运行时装饰能力**：业务微应用无法在主菜单、辅助菜单上表达"待办数、红点提醒、缎带角标"等状态提示。菜单树是后端下发对象，前端运行时状态没有合法落点。
2. **缺少菜单树的运行时编程接口**：`ouroboros-sdk` 只有 `openMenu`（打开菜单），没有查询、遍历、添加、删除菜单的能力；前端扩展编写者无法以编程方式读写菜单树，也无法在读取结果中获得徽标状态。
3. **用户菜单不可扩展**：`UserMenu.tsx` 硬编码"修改密码 / 切换主题 / 退出"三项，业务方无法注册自定义用户菜单项，基座也无法演进出注册制。

调用方诉求共三种通道：主应用内前端编程接口、amis action、`ouroboros-sdk`（微前端扩展编写者）。

## 目标

1. 为主菜单（`globalMenu`）、辅助菜单（`globalSubNav`）提供徽标能力，支持数字、红点（可自定义颜色）、文本、ribbon 四种形态；通过菜单全名（`fullName`）即可设置、修改、清除徽标。
2. 提供三种等价调用通道：主应用内编程接口、amis action（`setMenuBadge`）、`ouroboros-sdk`。
3. SDK 提供菜单查询、遍历、添加、删除能力；查询与遍历结果必须携带徽标状态。
4. 用户菜单改为注册制：现有"退出、切换主题、修改密码"以注册方式进入用户菜单；开放主应用编程接口与 SDK，支持查询、遍历、注册、移除用户菜单项。
5. 完全兼容现有数据流：store 菜单树、`updateMenu` EventBus 通道、`devWorkspaceMenuSync`、i18n 菜单翻译、面包屑、搜索、Tab 联动不受影响。

## 非目标

- 不做后端持久化：徽标与运行时菜单增删均为**会话内存级**，刷新后回退到后端菜单树；不扩展后端菜单模型与 `/api/authored-menu-tree` 协议。
- 不做 window 全局挂载：编程接口仅限主应用内 import，不暴露 `window.ouroboros.menu` 等全局对象。
- 不做跨 Tab 同步（BroadcastChannel 等）。
- 不做 amis 动作面板（`registerActionPanel`）配置界面，`setMenuBadge` 与既有 `openMenu` 同等地位。
- 不重构菜单渲染组件本身；徽标以装饰组件形式接入，不改变现有 DOM 结构与类名。

## 关键决策（已确认）

| # | 决策点 | 结论 |
|---|--------|------|
| D1 | 徽标生命周期 | 会话内存级，刷新即失，由业务侧重新上报 |
| D2 | 运行时菜单增删持久性 | 仅前端运行时，刷新回退后端菜单树 |
| D3 | 微应用卸载清理策略 | 用户菜单项强制清理；徽标保留（业务数字由各应用自行维护） |
| D4 | 编程接口形态 | 仅限主应用内 import，不挂 window |
| D5 | 用户菜单项徽标 | 纳入，复用同一徽标机制 |

## 方案设计

### 整体架构

运行时扩展层与菜单树分离，三条调用通道收敛到唯一实现：

```
                ┌─────────────────────────────── 调用通道 ───────────────────────────────┐
                │                                                                         │
   主应用内编程接口(import)          amis action                    ouroboros-sdk(微前端)   │
   common/menus/menuApi.ts        components/amis/actions/           sdk main.ts          │
        │                         SetMenuBadge.js  ──┐                  │ (活绑定桩+pending) │
        │                              (registerAction)                 │                    │
        └───────────────┬──────────────┴──────────────────┬────────────┘                    │
                        ▼                                  ▼                                 │
              ┌────────────────────────────┐   __utils__ 注入 (common/micro/commonProps.ts) ─┘
              │  MenuRegistry（单例注册中心） │
              │  common/menus/registry.ts   │
              │  ├─ badges: Map<key, Badge> │         菜单树操作
              │  ├─ userMenuItems: Item[]   │ ───────────────────────────────┐
              │  └─ subscribe/notify        │                                ▼
              └──────────────┬─────────────┘                  storeFacade.dispatch('user/updateMenu')
                             │  useSyncExternalStore                              │
                             ▼                                                   ▼
              菜单渲染组件(useMenuBadge / useUserMenuItems)        store user.state.menu（globalMenu/globalSubNav）
              MenuDualMode / MenuTree / MenuTreeItems /           ── normalizeMenu 重建树 ──► 既有渲染链/搜索/面包屑/Tab 不受影响
              MenuFloatMenu / UserMenu / SearchBar
```

要点：

- **徽标与注册表是独立的运行时装饰层**，不写入后端菜单树对象。菜单树会被 `updateMenu / fetchMenu` 重建（`normalizeMenu` 生成全新对象），写入即被冲掉；装饰层在树重建后按 `fullName` 重新命中。
- **菜单树增删操作经 registry 落回 store**（`user/updateMenu`），复用 normalize、翻译、面包屑、搜索等全部既有数据流，不另立平行树。
- **徽标寻址统一以 `fullName` 为主键**，兼容现有 `getMenuItem` 的多键 fallback（`path / url / fullPath / router_id / name`）。
- 状态变更通过 registry 的 `subscribe/notify` 通知，React 组件经 `useSyncExternalStore` 自订阅，不依赖 `AppLayout` 投影链路逐层传 props。

### 核心组件

| 组件 | 落点 | 职责 |
|------|------|------|
| `MenuRegistry` | `src/common/menus/registry.ts`（新建，单例） | 徽标子表 + 用户菜单子表 + 订阅通知；对外导出 `menu`（徽标/树操作）与 `userMenu`（注册表）两组 API |
| 菜单寻址工具 | `src/common/menus/utils.ts`（新建） | `resolveMenuRef(item)`：按 `fullName → path → url → fullPath → router_id → name` 归一菜单键；`resolveMenuNode(menu, ref)`：按引用在树中定位节点。承接 `user.js` 中 `getMenuItem` 的职责迁移 |
| 内置用户菜单项 | `src/common/menus/userMenuBuiltins.ts`（新建） | 注册"修改密码 / 切换主题 / 退出"三个内置项（幂等） |
| `useMenuBadge` / `useUserMenuItems` | `src/layouts/menu/useMenuExtensions.ts`（新建） | `useSyncExternalStore` 订阅 registry，返回当前徽标/用户菜单项快照 |
| `MenuBadge` | `src/layouts/menu/MenuBadge.tsx`（新建） | 按 `MenuBadge.type` 渲染四种形态的装饰组件 |
| `SetMenuBadge` amis action | `src/components/amis/actions/SetMenuBadge.js`（新建） | `registerAction('setMenuBadge', ...)`，调用 menu API，与 `OpenMenu.js` 同模式 |
| SDK 扩展 | `frontends/web/ouroboros-sdk/src/main.ts`、`types.ts` | 新增 `menu`、`userMenu` 两个活绑定桩对象 + pending 队列 + 卸载清理 |
| 平台注入 | `src/common/micro/commonProps.ts` | `defaultCapabilityValues` 增加 `menu`、`userMenu`，随 `__utils__` 下发 |

### 数据模型

```ts
// ── 徽标 ──────────────────────────────────────────────
type MenuBadgeTone = 'danger' | 'warning' | 'success' | 'info' | 'neutral'

interface MenuBadgeBase {
  tone?: MenuBadgeTone  // 语义色，缺省 danger；color 优先于 tone
  color?: string
}

type MenuBadge =
  | ({ type: 'number'; value: number; max?: number; showZero?: boolean } & MenuBadgeBase)
  //   max 缺省 99，溢出渲染 "99+"；value<=0 且 !showZero 时不渲染
  | ({ type: 'dot' } & MenuBadgeBase)                                    // 红点（默认 danger 红，可换色）
  | ({ type: 'text'; text: string } & MenuBadgeBase)                     // 短文本（如 "NEW"）
  | ({ type: 'ribbon'; text: string; position?: 'top-left' | 'top-right' } & MenuBadgeBase)
  //   缎带角标，适合一级菜单，默认 top-right

// 同一引用键只存一个徽标实例；别名写入可能形成不同记录，应统一用 fullName。

// ── 菜单项（树操作与遍历输出形态）──────────────────────
interface MenuItemInfo {
  fullName?: string    // 菜单全名（建议采用的稳定引用；运行时也接受其他有效引用）
  key?: string         // normalizeMenu 计算的运行时键
  title?: string
  displayTitle?: string
  path?: string
  url?: string
  fullPath?: string
  icon?: any
  showMode?: string
  opened?: boolean
  active?: boolean
  parent?: string
  children?: MenuItemInfo[]
  badge?: MenuBadge    // 查询/遍历输出时由 registry 合并注入
}

// ── 用户菜单项 ─────────────────────────────────────────
interface UserMenuContext {
  userInfo: any
  theme: string
  themeList: string[]
  isLockTheme: boolean
  lockTheme: string
  dispatch: (action: string, payload?: any) => Promise<unknown> | unknown
  openDialog: (schema: any, ctx?: any) => Promise<any>
}

interface UserMenuItem {
  id?: string                    // registry 分配，register() 返回
  title: string
  icon?: string
  order?: number                 // 升序渲染，缺省 100
  badge?: MenuBadge              // 用户菜单项徽标（复用同一机制，D5）
  divider?: boolean              // 分组线
  visible?: (ctx: UserMenuContext) => boolean     // 渲染时求值
  disabled?: (ctx: UserMenuContext) => boolean
  closeOnClick?: boolean         // 点击后收起下拉，缺省 true
  onClick: (ctx: UserMenuContext) => void | Promise<void>
}
```

### 接口设计

#### 1. 主应用编程接口（`import { menu, userMenu } from '@/common/menus/registry'`）

```ts
// 徽标
menu.setMenuBadge(fullName: string, badge: MenuBadge | null): void   // badge 为 null 即清除
menu.getMenuBadge(fullName: string): MenuBadge | undefined

// 菜单树查询 / 遍历（输出均合并 badge）
menu.getMenu(ref: string): MenuItemInfo | undefined
menu.getMenus(options?: { scope?: 'main' | 'secondary' | 'all'; flat?: boolean }): MenuItemInfo[] | MenuTreeResult
// flat 为 true 时返回带 level 的扁平数组，否则返回 { main?, secondary? }，仅包含所请求的 scope
menu.traverseMenus(visitor: (item: MenuItemInfo, parents: MenuItemInfo[]) => boolean | void,
                   options?: { scope?: 'main' | 'secondary' | 'all' }): void
// visitor 返回 false 时跳过该子树

// 菜单树增删（运行时，落 store；D2 语义）
menu.addMenuItem(options: {
  scope: 'main' | 'secondary'
  item: MenuItemInfo                  // 取首个有效引用并检查冲突；缺引用或冲突时返回 false
  parentFullName?: string             // 缺省追加到对应 scope 根
  index?: number                      // 在父节点 children 中的插入位置
}): boolean
menu.removeMenuItem(ref: string): boolean  // 删除节点及子树，级联清理该子树全部徽标；未命中返回 false

// 用户菜单
userMenu.register(item: UserMenuItem, owner?: string): string    // 返回 id；未提供 onClick 时返回空串
userMenu.unregister(id: string): void
userMenu.getItems(): UserMenuItem[]              // 按 order 升序，含内置项
userMenu.unregisterAll(owner: string): void      // 按 owner 批量移除（owner 必填；空值 no-op）
```

#### 2. amis action

```json
{ "actionType": "setMenuBadge", "args": { "fullName": "dev.apps", "badge": { "type": "number", "value": 3 } } }
```

- `args` 为对象：`{ fullName, badge }`；`badge: null` 清除徽标。
- `args` 为字符串：视为 `fullName`，语义为清除徽标（与 `OpenMenu` 的字符串 args 风格一致）。

#### 3. ouroboros-sdk

```ts
import { menu, userMenu } from 'ouroboros-sdk'

menu.setMenuBadge('dev.apps', { type: 'dot', tone: 'danger' })
const tree = menu.getMenus({ scope: 'all' })   // 每项含 badge
userMenu.register({ title: '我的待办', order: 50, onClick: (ctx) => { /* ... */ } })
```

- SDK 导出 `menu`、`userMenu` 两个活绑定桩对象，与现有 `openMenu / EventBus / Stomp` 同机制。
- **命令式调用（set/register/add/remove）在平台注入前进入 pending 队列，注入后按序 flush**（复用 `registeredComponents` / `pendingStompSubscriptions` 模式），防止微应用挂载早于能力注入时丢失调用。
- **查询类（get/getMenus/traverse）在注入前返回空结果**，文档注明"挂载后可用"。
- **卸载清理（D3）**：SDK 实例记录自身产生的注册项 id，页面、布局和组件库三类初始化入口的 `unmount` 时自动 `userMenu.unregister`；初始化前的兜底集合没有卸载钩子；徽标保留。

#### 4. 平台注入契约

`common/micro/commonProps.ts` 的 `defaultCapabilityValues` 与 `__utils__` 输出增加：

```ts
menu: typeof menu        // 指向主应用 registry 的 menu API
userMenu: typeof userMenu
```

SDK `commonPropsFn` 同步活绑定赋值。

### 渲染接入

新增共享组件 `MenuBadge` + `useMenuBadge(item)`（按 `resolveMenuRef(item)` 订阅）：

| 组件 | 接入方式 |
|------|----------|
| `MenuDualMode`（双栏主菜单） | 图标右上角 dot/number/text；`dual-mode-menu__item` 右上角 ribbon |
| `MenuTree` / `MenuTreeItems`（树形主菜单与辅助菜单共用） | `tree-menu__content` 标题后 dot/number/text；`tree-menu__item` 右上角 ribbon |
| `MenuFloatMenu` / `MenuFloatItem` / `MenuFloatSubmenu`（悬浮菜单） | 条目文本后 dot/number |
| `SearchBar` | 搜索结果项 dot/number（随 Phase 1 一并接入，成本低） |
| `UserMenu` | 用户菜单项 dot/number（D5） |

样式落点：`src/style/layout/menu.scss`、`float-menu.scss` 新增 `.menu-badge` 系列；tone 语义色走既有 `contract/semantic.scss` 变量，自定义 `color` 以 CSS 变量内联。

### 内置用户菜单项迁移

`userMenuBuiltins.ts` 模块加载时幂等注册（`UserMenu.tsx` 中的对应逻辑整体迁出）：

| 内置项 | order | 实现要点 |
|--------|-------|----------|
| 修改密码 | 10 | `openDialog({ width: '500px', url: '/system-setting/user-management/change-password' })` |
| 切换主题 | 20 | `visible: (ctx) => !ctx.isLockTheme`；`onClick` 按 `ctx.themeList` 循环 `dispatch('app/changeTheme', next)` |
| 退出 | 1000 | `dispatch('user/logout')`，固定垫底 |

注册时无需依赖组件 props：`visible / onClick` 均为渲染时求值，`ctx` 由 `UserMenu` 组件渲染时注入。改造后 `UserMenu.tsx` 退化为纯渲染器：订阅 registry → 过滤 `visible` → 按 order 排序 → 渲染，**DOM 结构与现有类名（`app-user-menu__item` 等）保持不变**。

### 生命周期与清理

| 时机 | 行为 |
|------|------|
| 菜单树重建（`updateMenu / fetchMenu / locale-changed` 重载） | 徽标独立保留，树重建后按 `fullName` 重新命中 |
| `removeMenuItem` | 级联清理被删子树的全部徽标 |
| 徽标目标菜单尚不存在 | 挂起记录（内存 Map 保留），菜单加载后自然生效；菜单从未出现则该记录仅占内存，无副作用 |
| 用户 LOGOUT | registry 重置：清空全部徽标与全部非内置用户菜单项；内置项注册幂等，无需重建 |
| 微应用卸载（D3） | SDK 清理该实例注册的用户菜单项；徽标保留 |
| `devWorkspaceMenuSync` 全量覆盖 | 运行时 `addMenuItem` 的增删会被覆盖——与既有行为一致，属预期；文档明确"运行时增删不持久化" |

## 替代方案

### 方案 A：徽标写回 store 菜单树对象

- **描述**：在 `user.state.menu` 的菜单项对象上直接挂 `badge` 字段。
- **优点**：改动最小，渲染组件天然可读。
- **缺点**：`normalizeMenu` 每次重建菜单项对象，徽标随树重建丢失；后端数据与运行时装饰混在一个对象，`updateMenu` 全量覆盖时无法区分。
- **为何未选择**：无法满足"树重建后徽标保留"的基本时序要求。

### 方案 B：徽标与运行时菜单写入后端菜单模型

- **描述**：扩展后端菜单模型与接口，徽标与增删持久化。
- **优点**：跨会话、跨设备一致。
- **缺点**：涉及后端模型、权限、多端同步，超出本次范围（D1、D2 已明确仅运行时）。
- **为何未选择**：与已确认的会话内存级语义冲突，范围过大。

### 方案 C：徽标与用户菜单项存入新 store module

- **描述**：新建 `menuExtension` store module（沿用 storeEngine 的 Vuex 风格模块契约）存 badges 与用户菜单项。
- **优点**：复用现有 store 订阅链路（`storeFacade.subscribeState`）。
- **缺点**：用户菜单项含函数型 `onClick / visible`，入 store state 与模块状态克隆约定冲突（storeEngine 的 `buildInitialState` 克隆与 getters 的 `cloneDeep` 模式均不预期函数型值）；且菜单组件当前经 props 渲染，深层节点订阅 store 需改造投影链路。
- **为何未选择**：独立 registry + `useSyncExternalStore` 更轻、无函数序列化风险、组件自订阅不依赖投影链路。

### 方案 D：用户菜单项经 EventBus 动态注入

- **描述**：微应用 `publish('registerUserMenuItem', ...)`，`UserMenu` 订阅渲染。
- **优点**：复用现有 EventBus 通道。
- **缺点**：事件总线无注册表语义，无法查询/遍历/移除已注册项，无法约束 order 与幂等，卸载清理需额外协议。
- **为何未选择**：用户明确要求查询、遍历、注册、移除，注册表是正解。

## 影响分析

### 性能影响

- 徽标存储为 `Map`，读写 O(1)；组件按需订阅，无全树 diff。
- `getMenus / traverseMenus` 为 O(n) 全量遍历，仅由调用方显式触发，不在渲染热路径。
- 用户菜单项数量级极小（个位数~十位数），排序开销可忽略。

### 安全影响

- 无新增网络面与后端接口，纯前端运行时装饰与导航行为。
- 注册项 `onClick` 的执行信任边界等同于现有 `__utils__` 注入能力（微应用代码本身即受信宿主内的执行者）；`ctx` 不暴露 token 与权限信息以外的既有字段。
- 徽标不接受 HTML，仅纯文本渲染（`text` 字段按文本节点输出），无注入面。

### 兼容性影响

- 菜单渲染组件 props 不变，仅内部增加装饰渲染；DOM 结构与类名保持，既有 e2e 与样式不受影响。
- `UserMenu` 对外 props 不变，视觉结构不变；"切换主题受 `isLockTheme` 抑制"等既有行为经 `visible` 保留。
- SDK 仅新增导出，向后兼容；`commonPropsFn` 注入新增字段，旧微应用无感知。
- `openMenu`、`devWorkspaceMenuSync`、i18n 翻译链路不受影响。

## 测试策略

遵守 [frontends/web/TESTING.md](../../TESTING.md) 的测试分类与放置规则：

- **registry 单测（vitest）**：badge set/clear/覆盖、fullName 寻址与 fallback、挂起记录、`removeMenuItem` 级联清理；用户菜单注册/移除/排序/`visible` 过滤/owner 批量清理/幂等。
- **菜单树操作单测**：增删与 store `user/updateMenu` 联动（mock `storeFacade`）、遍历输出含 badge、`addMenuItem` 冲突拒绝。
- **SDK 单测**：桩对象行为、pending 队列 flush 顺序（set → clear 顺序保真）、注入后直达、`unmount` 清理用户菜单项且保留徽标。
- **组件测试**：`MenuBadge` 四形态（数字、`99+` 溢出、红点、ribbon）、`UserMenu` 渲染注册项与内置项、`closeOnClick` 与 `disabled`。
- **e2e（可选关键旅程）**：amis `setMenuBadge` action 全链路。

## 风险和缓解

| 风险 | 影响 | 概率 | 缓解措施 |
|------|------|------|----------|
| 徽标设置早于菜单树加载（异步时序） | 徽标丢失 | 中 | 挂起记录机制：Map 保留未命中记录，树加载后自然生效 |
| 微应用重复挂载导致用户菜单项重复注册 | 下拉重复项 | 中 | 注册幂等（按 `key` 或 `id` 去重，当前已实现）+ `unmount` 强制清理（D3） |
| SDK pending flush 顺序错乱 | 徽标终态错误 | 低 | pending 队列按调用顺序 FIFO flush，单测固化顺序语义 |
| 用户菜单 handler 持有过期闭包（props 值） | 主题切换等行为失效 | 中 | handler 只经渲染时注入的 `ctx` 取状态，注册表不持有快照 |
| `addMenuItem` 与 `devWorkspaceMenuSync` 全量覆盖冲突 | 运行时节点被清 | 中 | 已确认 D2 语义即预期；文档明确说明，预留 merge 策略扩展点 |
| `UserMenu` 注册制改造破坏既有 UI 细节 | 视觉/无障碍回归 | 低 | DOM 结构与类名不变，保留 `aria-label`；组件测试覆盖 |

## 参考资料

- 后端菜单模型：[core/ouroboros-menu-model.md](../../../../docs/design/modules/core/ouroboros-menu-model.md)
- 模块摘要：[main-app.md](../../../../docs/design/modules/frontends/main-app.md)、[ouroboros-sdk.md](../../../../docs/design/modules/frontends/ouroboros-sdk.md)
- 前端规范：[frontends/web/AGENTS.md](../../AGENTS.md)、[frontends/web/TESTING.md](../../TESTING.md)
- 扩展机制惯例：[cross-cutting/extension-mechanisms.md](../../../../docs/design/cross-cutting/extension-mechanisms.md)
- 关键源码：
  - `frontends/web/main-app/src/store/engines/storeEngine.ts`（自研 store 引擎，模块契约沿用 Vuex 风格）
  - `frontends/web/main-app/src/store/modules/user.js`（菜单树、normalizeMenu、getMenuItem）
  - `frontends/web/main-app/src/common/menus/index.js`（openMenuItem、面包屑）
  - `frontends/web/main-app/src/layouts/UserMenu.tsx`（消费 user-menu registry 的用户菜单入口）
  - `frontends/web/main-app/src/layouts/menu/*`（菜单渲染组件）
  - `frontends/web/main-app/src/layouts/devWorkspaceMenuSync.ts`（运行时菜单更新先例）
  - `frontends/web/main-app/src/common/micro/commonProps.ts`（`__utils__` 能力注入）
  - `frontends/web/main-app/src/components/amis/actions/OpenMenu.js`（amis action 先例）
  - `frontends/web/ouroboros-sdk/src/main.ts`、`types.ts`（活绑定桩与 pending 模式）
