# Ouroboros SDK 用户手册

Ouroboros SDK 是为微前端应用提供的平台能力集成工具包，支持与主应用的无缝交互。

业务模型动态调用使用 `businessActions.invoke({modelFullName, actionName}, {params?, data?})`；可用性查询使用 `businessActions.checkAvailability`，返回 EXECUTABLE / BLOCKED / NEEDS_INPUT。生成客户端共用该入口和主壳当前注入的 request，携带契约指纹，在 Schema 变化时要求重新生成。示例与类型导出见[业务行为开发指南](../../../docs/guides/business-model-behaviors.md)。

## 目录

- [快速开始](#快速开始)
- [微前端初始化](#微前端初始化)
- [平台能力](#平台能力)
  - [UI 交互](#ui-交互)
  - [标签页管理](#标签页管理)
  - [消息提示](#消息提示)
  - [网络请求](#网络请求)
  - [事件总线](#事件总线)
  - [WebSocket (Stomp)](#websocket-stomp)
  - [国际化 (i18n)](#国际化-i18n)
  - [主题管理](#主题管理)
  - [用户认证](#用户认证)
  - [菜单扩展](#菜单扩展)
- [Amis 集成](#amis-集成)
- [类型定义](#类型定义)

---

## 快速开始

### 安装

```bash
npm install ouroboros-sdk
```

### 基础使用

```javascript
import { initMicroApp, toast, request } from 'ouroboros-sdk'

initMicroApp({
  render: async (props) => {
    // 渲染应用
  },
  beforeMount: async (props) => {
    // 挂载前逻辑
  },
})

// 使用平台能力
toast.success('操作成功')
request.get('/api/data')
```

---

## 微前端初始化

### initMicroApp

标准微前端应用初始化。

```javascript
import { initMicroApp } from 'ouroboros-sdk'

initMicroApp({
  render: async (props) => {
    // 渲染应用逻辑
    return app
  },
  beforeMount: async (props) => {
    // 挂载前钩子
  },
  afterMount: async (props) => {
    // 挂载后钩子
  },
  afterUnmount: async (props, app) => {
    // 卸载后钩子
  },
  afterUpdate: async (props) => {
    // 更新后钩子
  },
  onBootstrap: async () => {
    // 启动钩子
  },
})
```

### initLayoutComponent

业务组件式微前端初始化，用于布局组件。

```javascript
import { initLayoutComponent } from 'ouroboros-sdk'

initLayoutComponent({
  render: async (props) => {
    const { container, appName, logo, menu, theme, userInfo } = props
    // 渲染布局组件
  },
  beforeMount: async (props) => {},
  afterUnmount: async (props, app) => {},
  afterUpdate: async (props) => {},
  onBootstrap: async () => {},
})
```

### initAmisComponentLib

Amis 组件库微前端初始化。

```javascript
import { initAmisComponentLib, FormItem, Renderer } from 'ouroboros-sdk'

initAmisComponentLib({
  beforeMount: async (props) => {
    // 注册 Amis 组件
    FormItem({ type: 'my-input' })(MyInputComponent)
    Renderer({ type: 'my-renderer' })(MyRendererComponent)
  },
})
```

---

## 平台能力

### UI 交互

#### openDialog

打开对话框，返回 Promise。

**参数：**

- `schema` (Object) - 对话框配置
  - `title` (string) - 标题
  - `body` (Object) - Amis Schema，通常是 form；配置 `url` 或 `schemaId` 时可省略
  - `url` / `schemaId` - 引用已有页面或 UI Schema 作为弹窗内容
  - `size` (string) - 尺寸：'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'full'
  - `sizeSwitchable` / `sizeOptions` - 是否显示预设尺寸切换，以及可切换尺寸列表
  - `resizable` (boolean) - 是否允许拖拽改变对话框尺寸
  - `actions` (Array) - 自定义按钮
  - 其他 Dialog Schema 属性
- `ctx` (Object) - 上下文数据（可选）
  - `onConfirm` (Function) - 确认回调
  - `onCancel` (Function) - 取消回调

**返回值：**

- 确认：表单数据数组 `values[]`
- 取消：`false`

```javascript
import { openDialog } from 'ouroboros-sdk'

// 使用 await 获取结果
const result = await openDialog({
  title: '对话框标题',
  size: 'md',
  body: {
    type: 'form',
    body: [
      { type: 'input-text', name: 'name', label: '姓名' }
    ]
  }
})

if (result !== false) {
  console.log('用户提交的数据', result) // [{ name: 'John' }]
} else {
  console.log('用户取消了')
}

// 使用回调方式（可选）
openDialog(
  {
    title: '对话框标题',
    body: { type: 'form', body: [...] }
  },
  {
    onConfirm: (data) => console.log('确认', data),
    onCancel: () => console.log('取消')
  }
)
```

#### openDrawer

打开抽屉，返回 Promise。

**参数：**

- `schema` (Object) - 抽屉配置
  - `title` (string) - 标题
  - `body` (Object) - Amis Schema
  - `size` (string) - 尺寸：'xs' | 'sm' | 'md' | 'lg' | 'xl'
  - `position` (string) - 位置：'left' | 'right' | 'top' | 'bottom'
  - `overlay` (boolean) - 是否显示遮罩
  - `resizable` (boolean) - 是否可调整大小
  - `width` (number | string) - 宽度
  - `height` (number | string) - 高度
- `ctx` (Object) - 上下文数据（可选）
  - `onConfirm` (Function) - 确认回调
  - `onCancel` (Function) - 取消回调

**返回值：**

- 确认：表单数据数组 `values[]`
- 取消：`false`

```javascript
import { openDrawer } from 'ouroboros-sdk'

// 使用 await 获取结果
const result = await openDrawer({
  title: '抽屉标题',
  body: { type: 'page', body: '内容' },
  size: 'lg',
  position: 'right',
  resizable: true,
})

if (result !== false) {
  console.log('用户提交的数据', result)
} else {
  console.log('用户关闭了抽屉')
}
```

#### confirm / alert / prompt

确认框、提示框、输入框。

**confirm 参数：**

- `content` (string | ReactNode) - 提示内容
- `title` (string) - 标题（可选）
- `optionsOrConfirmText` (string | Object) - 确认按钮文本或选项对象（可选）
  - `confirmText` (string) - 确认按钮文本
  - `cancelText` (string) - 取消按钮文本
  - `confirmBtnLevel` (string) - 确认按钮样式
  - `cancelBtnLevel` (string) - 取消按钮样式
  - `size` (string) - 尺寸
  - `closeOnEsc` (boolean) - 按 ESC 关闭
- `cancelText` (string) - 取消按钮文本（可选）
- **返回值：** `true` 确认 | `false` 取消

**alert 参数：**

- `content` (string) - 提示内容
- `title` (string) - 标题（可选）
- `className` (string) - 样式类名（可选）
- **返回值：** `Promise<void>`

**prompt 参数：**

- `controls` (Object | Array | string) - 输入框配置
  - 对象：单个输入框
  - 数组：多个输入框
  - 字符串：兼容浏览器标准用法
- `defaultValue` (Object | string) - 默认值（可选）
- `title` (string) - 标题（可选）
- `confirmText` (string) - 确认按钮文本（可选）
- **返回值：** 表单值对象 `{ name: value, ... }` | `false` 取消

```javascript
import { confirm, alert, prompt } from 'ouroboros-sdk'

// 确认框 - 返回 true/false，不会 reject
const result = await confirm('确定删除吗？', '删除确认')
if (result) {
  console.log('用户点击了确认')
  // 执行删除操作
} else {
  console.log('用户点击了取消')
}

// 带选项的确认框
const result = await confirm('确定删除吗？', '删除确认', {
  confirmText: '确定',
  cancelText: '取消',
  confirmBtnLevel: 'danger',
  size: 'md',
})

// 提示框
await alert('操作成功', '提示')
await alert('警告信息', '警告', 'modal-warning')

// 输入框 - 单个输入
const result = await prompt(
  { type: 'input-text', name: 'username', label: '用户名' },
  { username: 'admin' }, // 默认值
  '请输入用户名',
  '确定' // 确认按钮文本
)
if (result !== false) {
  console.log('用户输入:', result.username)
} else {
  console.log('用户取消了')
}

// 输入框 - 多个输入
const result = await prompt(
  [
    { type: 'input-text', name: 'username', label: '用户名', required: true },
    { type: 'input-email', name: 'email', label: '邮箱' },
    { type: 'input-password', name: 'password', label: '密码' },
  ],
  { username: 'admin' }, // 默认值
  '请输入用户信息'
)
if (result !== false) {
  console.log('用户输入:', result)
  // { username: 'john', email: 'john@example.com', password: '123456' }
}

// 兼容浏览器标准用法
const result = await prompt('请输入姓名', 'John')
// 等价于单个 text 输入框，返回 { text: '输入的值' }
```

### 标签页管理

#### openTab

打开新标签页。

**参数：**

- `fullPath` (string) - 页面路径（必需）
- `tabOption` (Object) - 标签页选项（可选）
  - `title` (string) - 标签页标题
  - `icon` (string) - 图标类名
  - `breadcrumbs` (Array) - 面包屑导航
  - `callback` (Function) - 标签页关闭时的回调函数

**返回值：** `tabId` (string) - 标签页 ID

#### closeTab

关闭标签页。

**参数：**

- `id` (string) - 标签页 ID，不传则关闭当前标签页（可选）
- `result` (any) - 返回给父标签页的数据（可选）

#### openOrSwitchTab

打开或切换到已存在的标签页。

**参数：**

- `fullPath` (string) - 页面路径（必需）
- `tabOption` (Object) - 标签页选项（可选）
  - `title` (string) - 标签页标题
  - `callback` (Function) - 回调函数

**返回值：** `tabId` (string) - 标签页 ID

#### updateTabTitle

更新标签页标题。

**参数：**

- `id` (string) - 标签页 ID，不传则更新当前标签页（可选）
- `title` (string) - 新标题（必需）

#### sendToOpenerTab

向打开当前标签页的父标签页发送消息。

**参数：**

- `id` (string) - 当前标签页 ID，不传则使用当前标签页（可选）
- `data` (any) - 要发送的数据（必需）

```javascript
import {
  openTab,
  closeTab,
  openOrSwitchTab,
  updateTabTitle,
  sendToOpenerTab,
} from 'ouroboros-sdk'

// 打开新标签页
const tabId = openTab('/path/to/page', {
  title: '标签页标题',
  icon: 'fa fa-home',
  breadcrumbs: [{ label: '首页', path: '/' }],
  callback: (result) => {
    console.log('标签页返回的数据', result)
  },
})

// 关闭标签页
closeTab('tab-id', { result: 'data' })

// 打开或切换到已存在的标签页
openOrSwitchTab('/path/to/page', {
  title: '标题',
  callback: (result) => console.log(result),
})

// 更新标签页标题
updateTabTitle('tab-id', '新标题')
```

#### 标签页间通信

```javascript
import { sendToOpenerTab, closeTab } from 'ouroboros-sdk'

// 父标签页打开子标签页
openTab('/child-page', {
  title: '子页面',
  callback: (result) => {
    console.log('子页面返回的数据', result)
  },
})

// 子页面中发送消息给父标签页
// 方式1：关闭时返回数据
closeTab(null, { success: true, data: 'result' })

// 方式2：不关闭，只发送消息
sendToOpenerTab(null, { message: 'hello from parent' })
```

### 消息提示

#### toast

显示消息提示。

**方法：**

- `toast.success(content, conf)` - 成功提示
- `toast.error(content, conf)` - 错误提示
- `toast.info(content, conf)` - 信息提示
- `toast.warning(content, conf)` - 警告提示

**参数：**

- `content` (string) - 提示内容（必需）
- `conf` (Object) - 配置选项（可选）
  - `timeout` (number) - 显示时长（毫秒）
  - 其他 toast 配置

```javascript
import { toast } from 'ouroboros-sdk'

toast.success('操作成功')
toast.error('操作失败')
toast.info('提示信息')
toast.warning('警告信息')

// 带配置
toast.success('成功', { timeout: 3000 })
```

### 网络请求

基于 axios 的请求封装，自动携带认证信息。

**方法：**

- `request(config)` - 通用请求
- `request.get(url, config)` - GET 请求
- `request.post(url, data, config)` - POST 请求
- `request.put(url, data, config)` - PUT 请求
- `request.delete(url, config)` - DELETE 请求
- `request.patch(url, data, config)` - PATCH 请求

**参数：**

- `url` (string) - 请求地址
- `data` (any) - 请求数据
- `config` (Object) - axios 配置选项

**返回值：** Promise - 响应数据

```javascript
import { request } from 'ouroboros-sdk'

// GET 请求
const data = await request.get('/api/users')
const data = await request.get('/api/users', { params: { page: 1 } })

// POST 请求
await request.post('/api/users', { name: 'John' })

// PUT 请求
await request.put('/api/users/1', { name: 'Jane' })

// DELETE 请求
await request.delete('/api/users/1')

// PATCH 请求
await request.patch('/api/users/1', { status: 'active' })

// 自定义配置
await request({
  url: '/api/data',
  method: 'GET',
  headers: { 'X-Custom': 'value' },
})
```

### 事件总线

跨应用事件通信。

#### EventBus.subscribe

订阅事件。

**参数：**

- `event` (string) - 事件名（必需）
- `handler` (Function) - 事件处理函数（必需，第二个参数）
- `filter` (Function) - 过滤器函数（可选，第三个参数）

**返回值：** `void`。取消订阅时调用 `EventBus.unsubscribe(event, handler)`，传入原处理函数引用。

#### EventBus.subscribeOnce

一次性订阅事件。

**参数：** 同 `subscribe`

#### EventBus.publish

发布事件。

**参数：**

- `event` (string) - 事件名（必需）
- `data` (any) - 事件数据（必需）
- `options` (Object) - 选项（可选）
  - `replayScope` (string) - 重放范围
  - `replayStage` (string) - 重放阶段

#### EventBus.unsubscribe

取消订阅。

**参数：**

- `event` (string) - 事件名（必需）
- `handler` (Function) - 事件处理函数（必需）

```javascript
import { EventBus } from 'ouroboros-sdk'

// 订阅事件
const handler = (data) => console.log('收到事件', data)
EventBus.subscribe('event-name', handler)

// 带过滤器的订阅
EventBus.subscribe(
  'event-name',
  (data) => console.log('匹配的事件', data),
  (data) => data.type === 'specific' // 第三个参数为过滤器
)

// 一次性订阅
EventBus.subscribeOnce('event-name', (data) => {
  console.log('只触发一次', data)
})

// 发布事件
EventBus.publish('event-name', { key: 'value' })

// 带选项的发布
EventBus.publish('event-name', data, {
  replayScope: 'SESSION',
  replayStage: 'stage-1',
})

// 取消订阅
EventBus.unsubscribe('event-name', handler)
```

### WebSocket (Stomp)

基于 Stomp 协议的 WebSocket 通信。

#### 连接管理

- `Stomp.connect()` - 连接服务器
- `Stomp.disconnect()` - 断开连接
- `Stomp.reconnect()` - 重新连接

#### 状态检查

- `Stomp.isConnected()` - 检查是否已连接
- `Stomp.isActive()` - 检查是否已激活（包括正在连接和已连接状态）
- `Stomp.isStompAuthenticated()` - 检查是否已认证

**返回值：** `boolean`

```javascript
import { Stomp } from 'ouroboros-sdk'

if (Stomp.isConnected()) {
  console.log('已连接到服务器')
}

if (Stomp.isStompAuthenticated()) {
  console.log('已通过认证')
}
```

#### 连接事件订阅

订阅 Stomp 连接状态变化事件。

**onStompConnected 参数：**

- `handler` (Function) - 事件处理函数（必需）
  - 参数：`data` (Object)
    - `isReconnect` (boolean) - 是否为重连
    - `timestamp` (number) - 时间戳
    - `message` (any) - 连接消息

**返回值：** `void`。取消订阅时调用 `EventBus.unsubscribe(event, handler)`，传入原处理函数引用。

**onStompDisconnected 参数：**

- `handler` (Function) - 事件处理函数（必需）
  - 参数：`data` (Object)
    - `timestamp` (number) - 时间戳

**返回值：** `void`。取消订阅时调用 `EventBus.unsubscribe(event, handler)`，传入原处理函数引用。

```javascript
import { Stomp } from 'ouroboros-sdk'

// 订阅连接成功事件
const unsubscribeConnected = Stomp.onStompConnected((data) => {
  if (data.isReconnect) {
    console.log('重连成功', data.timestamp)
  } else {
    console.log('首次连接成功', data.timestamp)
  }
})

// 订阅断开连接事件
const unsubscribeDisconnected = Stomp.onStompDisconnected((data) => {
  console.log('连接已断开', data.timestamp)
})

// 取消订阅
unsubscribeConnected()
unsubscribeDisconnected()
```

#### 订阅方法

**参数：**

- `destination` (string) - 目标地址（必需）
- `callback` (Function) - 消息回调函数（必需）
  - 参数：`message` (Object) - 消息对象
    - `body` - 消息体
    - `headers` - 消息头

**返回值：** `void`。取消订阅时调用 `EventBus.unsubscribe(event, handler)`，传入原处理函数引用。

- `Stomp.subscribeTopic(destination, callback)` - 订阅主题
- `Stomp.subscribeQueue(destination, callback)` - 订阅队列
- `Stomp.subscribeUserTopic(destination, callback)` - 订阅用户主题
- `Stomp.subscribe(destination, callback)` - 通用订阅

第三个参数继续兼容 `boolean`，也可以传平铺的 `initial*` 选项。

#### `Stomp.subscribe(destination, listener, keepSingleListenerOrOptions?)`

当一个流需要“先补 init 数据，再继续接实时增量”时，优先把 flat `initial*` 选项放到现有 `subscribe*` API 的第三个参数里。文档中的规范术语统一使用 `init`，当前 API 选项名仍保持 `initial*`。

当前对外文档以 **app-logs pilot** 为准，不声明 helper logs、所有历史 replay flow、exactly-once、持久化 replay，也不宣称 Redis、RabbitMQ 等多 broker 场景已经完成硬化。

**参数：**

- `keepSingleListenerOrOptions?: boolean | { keepSingleListener?: boolean, initialDestination?: string, createInitialRequest?: () => any, initialBody?: any, initialTimeoutMs?: number, splitInitialHandlers?: boolean, onInitialData?: (...), onInitialLive?: (...), onInitialComplete?: (...), onInitialError?: (...) }`，第三参也兼容旧布尔值

`initial` 根命名已收敛为 `initial*`：

- `initialDestination?`
- `createInitialRequest?`
- `initialBody?`
- `initialTimeoutMs?`
- `splitInitialHandlers?`
- `onInitialData?`
- `onInitialLive?`
- `onInitialComplete?`
- `onInitialError?`

**返回值：**

- `() => void`，取消订阅函数

**三 lane 语义：**

- live lane 使用完整 live destination，例如 `/user/queue/app/{appName}/logs` 或 `/topic/...`
- init request lane 默认派生为 `/app${liveDestination}/init`，也可以用 `initialDestination` 显式 override
- init reply lane 默认派生为 `/queue/init${liveDestination}/{token}`，当前连接、当前周期的 init 返回流

**reject 语义：**

- `bootstrapDone` 在以下情况 reject：
  - 超时
  - 收到 `init-error`
  - 重连后旧周期失效，变成 stale cycle
  - initial 完成前调用 `unsubscribe()`

**重连语义：**

- 重连会开始一个新周期
- 新周期会使用新的 token 和新的 init reply queue
- 旧周期迟到的 init 帧会被忽略，不会污染当前周期

**app-logs pilot 示例：**

```javascript
import { Stomp } from 'ouroboros-sdk'

const unsubscribe = Stomp.subscribe(
  `/user/queue/app/${appName}/logs`,
  (message) => console.log(message),
  {
    initialBody: {},
    splitInitialHandlers: true,
    onInitialLive: (message) => console.log('live', message),
    onInitialData: (message) => console.log('init', message),
  }
)

unsubscribe()
```

这个 pilot 里：

- live lane 使用 `/user/queue/app/{appName}/logs`
- backend init request entry 由 runtime-owned registrar 接管；默认请求目的地是 `/app/user/queue/app/{appName}/logs/init`
- frontend caller 默认只需要提供 live lane `/user/queue/app/{appName}/logs`
- init reply lane 由运行时自动派生为 `/queue/init/user/queue/app/{appName}/logs/{token}`
- `subscriptionToken` 通过 STOMP native headers 发送，request body 保持业务字段本身
- 这轮只覆盖 app-logs，不声明 helper logs 或其他 legacy replay 入口已经切到新 lane

前端这里的 `init` 约定不是单边协议。当前已落地的 backend support layer 由 `InitRequest`、`InitRequestContext`、`InitRouteDefinition`、`InitReplyFrame`、`InitReplySender`、`InitRequestHandler`、`StompInitSupport` 组成，默认实现是 `DefaultInitReplySender`、`DefaultInitRequestValidator`、`DefaultInitRequestContext`、`DefaultStompInitSupport`，并由 `OuroborosWebSocketAutoConfiguration` 装配。app-logs flow 通过这些 contracts 接入，业务代码不再重复实现 route 派生和 control frame 发送样板代码。canonical contract 以 cross-cutting STOMP compensation 设计文档为准，当前 API 选项名仍可能保持 `initial*` 兼容命名。

#### 取消订阅

**参数：**

- `destination` (string) - 目标地址（必需）

- `Stomp.unsubscribeTopic(destination)` - 取消订阅主题
- `Stomp.unsubscribeQueue(destination)` - 取消订阅队列
- `Stomp.unsubscribeUserTopic(destination)` - 取消订阅用户主题
- `Stomp.unsubscribe(destination)` - 通用取消订阅
- `Stomp.unsubscribeAll()` - 取消所有订阅
- `Stomp.unsubscribeAllTopics()` - 取消所有主题订阅
- `Stomp.unsubscribeAllQueues()` - 取消所有队列订阅
- `Stomp.unsubscribeAllUserTopics()` - 取消所有用户主题订阅

#### 发送消息

**参数：**

- `destination` (string) - 目标地址（必需）
- `body` (any) - 消息体（必需）
- `headers` (Object) - 消息头（可选）

- `Stomp.sendJson(destination, body, headers)` - 发送 JSON
- `Stomp.sendText(destination, body, headers)` - 发送文本
- `Stomp.sendBinary(destination, body, headers)` - 发送二进制
- `Stomp.send(destination, body, headers)` - 通用发送

```javascript
import { Stomp } from 'ouroboros-sdk'

// 连接
Stomp.connect()

// 订阅主题
const unsubscribe = Stomp.subscribeTopic('/topic/messages', (message) => {
  console.log('收到消息', message.body)
})

// 订阅队列
Stomp.subscribeQueue('/queue/tasks', (message) => {
  console.log('收到任务', message.body)
})

// 订阅用户主题
Stomp.subscribeUserTopic('/user/notifications', (message) => {
  console.log('收到通知', message.body)
})

// 发送消息
Stomp.sendJson('/app/message', { content: 'Hello' })
Stomp.sendText('/app/message', 'Hello')
Stomp.sendBinary('/app/upload', binaryData)

// 取消订阅
unsubscribe()
Stomp.unsubscribeAll()

// 断开连接
Stomp.disconnect()

// 重连
Stomp.reconnect()
```

#### 先订阅后注入

Stomp 支持在平台注入前进行订阅。订阅请求会被缓存，待平台注入真实 Stomp 对象后自动执行。

```javascript
import { Stomp } from 'ouroboros-sdk'

// 在平台注入前订阅（订阅请求会被缓存）
const unsubscribe = Stomp.subscribeTopic('/topic/messages', (message) => {
  console.log('收到消息', message)
})

// 平台注入后，缓存的订阅会自动执行
// 取消订阅函数在注入前后都能正常工作
unsubscribe()
```

`subscribeWithInitial` 仍保留为兼容 helper；新的推荐写法是直接使用 `subscribe(..., thirdArgWithInitialOptions)`。规范术语统一使用 `init request lane`、`init reply lane`、`init-data`、`init-complete`、`init-error`，当前 API 字段名仍保持 `initial*`。

```javascript
import { Stomp } from 'ouroboros-sdk'

const unsubscribe = Stomp.subscribe(
  `/user/queue/app/${appName}/logs`,
  (message) => console.log(message),
  {
    initialBody: {},
  }
)

const splitUnsubscribe = Stomp.subscribe(
  `/user/queue/app/${appName}/logs`,
  (message) => console.log(message),
  {
    initialBody: {},
    splitInitialHandlers: true,
    onInitialLive: (message) => console.log('live', message),
    onInitialData: (message) => console.log('init', message),
  }
)

// 注入前后都可以取消
unsubscribe()
splitUnsubscribe()
```

### 国际化 (i18n)

多语言支持。

#### i18n.getLocale

获取当前语言。

**返回值：** `string` - 语言代码，如 'zh-CN' | 'en-US'

#### i18n.getLanguages

获取可用语言列表。

**返回值：** `Array<LanguageOption>` - 语言列表

- `value` (string) - 语言代码
- `label` (string) - 语言名称
- `version` (string) - 版本号
- `isDefault` (boolean) - 是否默认

#### i18n.switchLanguage

切换语言。

**参数：**

- `locale` (string) - 语言代码（必需）

**返回值：** `Promise<void>`

#### i18n.t

通用翻译。

**参数：**

- `key` (string) - 翻译键（必需）
- `defaultText` (string) - 默认文本（可选）
- `params` (Object) - 参数对象（可选）

**返回值：** `string` - 翻译后的文本

#### i18n.tn

命名空间翻译。

**参数：**

- `namespace` (string) - 命名空间（必需）
- `key` (string) - 翻译键（必需）
- `defaultText` (string) - 默认文本（可选）
- `params` (Object) - 参数对象（可选）

**返回值：** `string` - 翻译后的文本

#### i18n.tMenu

菜单翻译。

**参数：**

- `key` (string) - 翻译键（必需）
- `defaultText` (string) - 默认文本（可选）

**返回值：** `string` - 翻译后的文本

#### i18n.tCommon

通用文本翻译。

**参数：**

- `key` (string) - 翻译键（必需）
- `defaultText` (string) - 默认文本（可选）
- `params` (Object) - 参数对象（可选）

**返回值：** `string` - 翻译后的文本

#### i18n.useNamespace

使用命名空间。

**参数：**

- `namespace` (string) - 命名空间（必需）

**返回值：** `Function` - 翻译函数 `(key, defaultText, params) => string`

#### i18n.getLocaleData

获取语言数据。

**返回值：** `Object` - 当前语言的所有翻译数据

#### i18n.onLocaleChange

监听语言变化。

**参数：**

- `callback` (Function) - 回调函数（必需）
  - 参数：`locale` (string) - 新的语言代码

**返回值：** `Function` - 取消监听函数

```javascript
import { i18n } from 'ouroboros-sdk'

// 获取当前语言
const locale = i18n.getLocale() // 'zh-CN' | 'en-US'

// 获取可用语言列表
const languages = i18n.getLanguages()
// [{ value: 'zh-CN', label: '简体中文', version: '1.0.0' }, { value: 'en-US', label: 'English', version: '1.0.0' }]

// 切换语言
await i18n.switchLanguage('en-US')

// 翻译文本
const text = i18n.t('common.save', '保存')

// 带参数的翻译
const text = i18n.t('common.welcome', '欢迎 {name}', { name: 'John' })

// 命名空间翻译
const text = i18n.tn('myapp', 'title', '我的应用')

// 菜单翻译
const menuText = i18n.tMenu('menu.home', '首页')

// 通用文本翻译
const commonText = i18n.tCommon('save', '保存')

// 使用命名空间
const t = i18n.useNamespace('myapp')
const text = t('title', '我的应用')

// 获取语言数据
const localeData = i18n.getLocaleData()

// 监听语言变化
const unsubscribe = i18n.onLocaleChange((locale) => {
  console.log('语言已切换为', locale)
})
// 取消监听
unsubscribe()
```

### 主题管理

```javascript
import { getTheme, setTheme } from 'ouroboros-sdk'

// 获取当前主题
const theme = getTheme() // 'light' | 'dark'

// 设置主题
setTheme('dark')
```

### 用户认证

### 主题管理

#### getTheme

获取当前主题。

**返回值：** `string` - 主题名称，如 'light' | 'dark'

#### setTheme

设置主题。

**参数：**

- `theme` (string) - 主题名称（必需）

```javascript
import { getTheme, setTheme } from 'ouroboros-sdk'

// 获取当前主题
const theme = getTheme() // 'light' | 'dark'

// 设置主题
setTheme('dark')
```

### 用户认证

#### login

用户登录。

**参数：**

- `params` (Object) - 登录参数（必需）
  - `username` (string) - 用户名
  - `password` (string) - 密码
  - 其他登录参数

**返回值：** `Promise<any>` - 登录结果

#### logout

用户登出。

**返回值：** `Promise<void>`

#### getUserInfo

获取用户信息。

**返回值：** `Promise<Object>` - 用户信息对象

#### getToken

获取当前最新 token。

**返回值：** `Promise<Object | null>` - 最新 token 对象

> 注意：在自定义登录页微前端中，`props.token` 仍然会继续传递，用于兼容历史实现；但它是挂载时的快照。如果平台已经刷新过 token，请改用 `getToken()` 获取最新值。

#### listExternalProviders

获取当前应用可用的外部登录提供方列表。

**返回值：** `Promise<Array>` - 认证提供方列表

#### isLocalPasswordLoginEnabled

判断当前应用是否启用了本地账号密码登录。

**返回值：** `boolean`

#### startRedirectLogin

发起跳转式登录流程，适用于 `CAS`、`OAuth2`、`OIDC` 等需要跳转到外部认证中心的登录方式。

**参数：**

- `provider` (Object) - 外部登录提供方对象
- `returnUrl` (string) - 登录完成后的返回地址（可选）

**返回值：** `string | null` - 实际跳转地址

#### loginWithLdap

发起 LDAP 目录账号密码登录。

**参数：**

- `params` (Object) - LDAP 登录参数，通常包含 `provider`、`username`、`password`

**返回值：** `Promise<any>`

#### exchangeLoginCode

将登录回调携带的 `loginCode` 换取平台登录结果。

**返回值：** `Promise<any>`

#### bindExternalAccount

绑定外部账号。

**返回值：** `Promise<any>`

#### resolveReturnUrl

标准化并清洗登录回跳地址。

**返回值：** `string`

#### mapAuthError

将认证错误码转换为前端可展示的统一错误标识。

**返回值：** `string`

#### hasAuth

权限检查。

**参数：**

- `authKey` (string) - 权限键（必需）

**返回值：** `boolean` - 是否有权限

```javascript
import {
  login,
  logout,
  getUserInfo,
  getToken,
  listExternalProviders,
  isLocalPasswordLoginEnabled,
  loginWithLdap,
  startRedirectLogin,
  resolveReturnUrl,
  mapAuthError,
  hasAuth,
} from 'ouroboros-sdk'

// 登录
await login({ username: 'user', password: 'pass' })

// 登出
await logout()

// 获取用户信息
const userInfo = await getUserInfo()

// 获取平台最新 token（而不是使用 props.token 快照）
const token = await getToken()

// 加载登录方式
const providers = await listExternalProviders()
const localEnabled = isLocalPasswordLoginEnabled()

// LDAP 目录登录
await loginWithLdap({
  provider: 'ldap-default',
  username: 'directory-user',
  password: 'directory-password',
})

// CAS / OAuth2（含 OIDC）跳转登录
const returnUrl = resolveReturnUrl('/workspace')
const redirectProvider = providers.find((item) => item.type === 'oauth2')
if (redirectProvider) {
  startRedirectLogin(redirectProvider, returnUrl)
}

// 统一映射登录错误
const errorKey = mapAuthError('INVALID_CREDENTIALS')

// 权限检查
if (hasAuth('user:create')) {
  // 有权限
}
```

---

### 菜单扩展

#### menu.setMenuBadge

设置 / 修改 / 清除菜单徽标（主菜单与辅助菜单通用）。徽标为会话内存级状态，刷新后由业务重新上报。

**参数：**

- `fullName` (string) - 菜单全名（`fullName`），兼容 path/url 等引用
- `badge` (Object | null) - 徽标配置；传 `null` 清除徽标

**徽标类型：**

- `{ type: 'number', value, max?, showZero?, tone?, color? }` - 数字徽标，`max` 缺省 99，溢出显示 `99+`
- `{ type: 'dot', tone?, color? }` - 红点（可自定义颜色）
- `{ type: 'text', text, tone?, color? }` - 短文本（如 `NEW`）
- `{ type: 'ribbon', text, position?, tone?, color? }` - 缎带角标（默认右上角）

```javascript
import { menu } from 'ouroboros-sdk'

// 数字徽标：待办数
menu.setMenuBadge('workbench.todo', { type: 'number', value: 3 })

// 红点提醒
menu.setMenuBadge('workbench.messages', { type: 'dot' })

// 自定义颜色
menu.setMenuBadge('workbench.messages', { type: 'dot', color: '#00b3ff' })

// 缎带角标
menu.setMenuBadge('new-feature', { type: 'ribbon', text: 'NEW' })

// 清除徽标
menu.setMenuBadge('workbench.todo', null)
```

#### menu 菜单树查询 / 遍历 / 增删

```javascript
import { menu } from 'ouroboros-sdk'

// 查询单个菜单（含徽标状态）
const item = menu.getMenu('workbench.todo') // { fullName, title, badge, children, ... }

// 遍历菜单树（含徽标状态）
const tree = menu.getMenus({ scope: 'all' }) // { main: [...], secondary: [...] }
const flat = menu.getMenus({ scope: 'all', flat: true }) // 深度优先拍平，每项带 level

// 访问器遍历，visitor 返回 false 跳过子树
menu.traverseMenus((item, parents) => {
  if (item.fullName === 'system') return false
})

// 运行时添加菜单（仅前端运行时，刷新后回退后端菜单树；冲突时返回 false）
const ok = menu.addMenuItem({
  scope: 'main',
  parentFullName: 'system.user',
  item: { fullName: 'system.user.extra', title: '扩展页', path: '/system/user/extra' },
})

// 运行时移除菜单（含子树，并级联清理其徽标）
menu.removeMenuItem('system.user.extra')
```

> 注意：`addMenuItem` 的 `item.fullName` 必填且全局唯一。运行时增删不持久化，且会被 `devWorkspaceMenuSync` 等全量菜单同步覆盖。

#### userMenu 用户菜单注册

用户菜单（头像下拉）采用注册制：内置"修改密码 / 切换主题 / 退出"为注册项，业务方可注册自定义项。微应用卸载时 SDK 自动清理本实例注册的用户菜单项。

```javascript
import { userMenu } from 'ouroboros-sdk'

// 注册用户菜单项，返回 id
const id = userMenu.register({
  title: '我的待办',
  key: 'my-todo',            // 可选：稳定业务键，同 key 重复注册视为覆盖
  order: 50,                 // 可选：升序渲染，缺省 100
  badge: { type: 'number', value: 3 }, // 可选：用户菜单项徽标
  onClick: (ctx) => {
    // ctx: { userInfo, theme, themeList, isLockTheme, lockTheme, dispatch, openDialog }
    ctx.dispatch('tabs/openTab', { fullPath: '/my/todo' })
  },
})

// 移除
userMenu.unregister(id)

// 查询 / 遍历当前注册项（按 order 升序，含内置项）
const items = userMenu.getItems()
```

---

## Amis 集成

### 注册组件

#### FormItem

注册表单项。

```javascript
import { FormItem } from 'ouroboros-sdk'

@FormItem({
  type: 'my-input',
  label: '自定义输入框',
})
class MyInput extends React.Component {
  render() {
    const { value, onChange } = this.props
    return <input value={value} onChange={(e) => onChange(e.target.value)} />
  }
}
```

#### Renderer

注册渲染器。

```javascript
import { Renderer } from 'ouroboros-sdk'

@Renderer({
  type: 'my-component',
  name: 'my-component',
})
class MyComponent extends React.Component {
  render() {
    return <div>{this.props.body}</div>
  }
}
```

#### OptionsControl

注册选项控件。

```javascript
import { OptionsControl } from 'ouroboros-sdk'

@OptionsControl({
  type: 'my-select',
})
class MySelect extends React.Component {
  render() {
    const { options, value, onChange } = this.props
    return (
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    )
  }
}
```

### 注册功能

#### registerAction

注册自定义动作。

**参数：**

- `actionType` (string) - 动作名称（必需）
- `action` (Function) - 动作处理函数（必需）
  - 参数：`(action, renderer, event) => void | Promise<void>`

```javascript
import { registerAction } from 'ouroboros-sdk'

registerAction('my-action', async (action, renderer, event) => {
  console.log('执行自定义动作', action)
  // 执行逻辑
})
```

#### registerFormula

注册公式。

**参数：**

- `name` (string) - 公式名称（必需）
- `fn` (Function) - 公式函数（必需）

```javascript
import { registerFormula } from 'ouroboros-sdk'

registerFormula('DOUBLE', (value) => value * 2)

// 在 schema 中使用: "${DOUBLE(amount)}"
```

#### registerValidator

注册验证器。

**参数：**

- `name` (string) - 验证器名称（必需）
- `fn` (Function) - 验证函数（必需）
  - 参数：`(values, value) => true | string`
  - 返回：`true` 验证通过 | `string` 错误消息

```javascript
import { registerValidator } from 'ouroboros-sdk'

registerValidator('phone', (values, value) => {
  if (!/^1[3-9]\d{9}$/.test(value)) {
    return '请输入正确的手机号'
  }
  return true
})
```

#### addRule

添加验证规则。

**参数：**

- `ruleName` (string) - 规则名称（必需）
- `validatorFn` (Function) - 验证函数（必需）
  - 参数：`(value) => boolean`
- `errorMessage` (string) - 错误消息（必需）

```javascript
import { addRule } from 'ouroboros-sdk'

addRule('idcard', (value) => /^\d{17}[\dXx]$/.test(value), '请输入正确的身份证号')
```

#### registerIcon

注册图标。

**参数：**

- `key` (string) - 图标键名（必需）
- `component` (Function | Component) - 图标组件（必需）

```javascript
import { registerIcon } from 'ouroboros-sdk'

registerIcon('my-icon', () => <svg>...</svg>)
```

### 编辑器扩展

#### registerEditorPlugin

注册编辑器插件。

**参数：**

- `plugin` (Object) - 插件对象（必需）

#### registerActionPanel

注册动作面板。

**参数：**

- `panel` (Object) - 面板对象（必需）

```javascript
import { registerEditorPlugin, registerActionPanel } from 'ouroboros-sdk'

// 注册编辑器插件
registerEditorPlugin(MyEditorPlugin)

// 注册动作面板
registerActionPanel(MyActionPanel)
```

### 渲染 Amis Schema

#### renderAmisSchema

渲染 Amis Schema 到指定容器。

**参数：**

- `containerEl` (HTMLElement) - 容器元素（必需）
- `schema` (Object) - Amis Schema（必需）
- `props` (Object) - 属性对象（可选）
  - `data` (Object) - 初始数据
  - 其他 Amis 属性
- `env` (Object) - 环境配置（可选）
  - `theme` (string) - 主题
  - 其他环境配置

```javascript
import { renderAmisSchema } from 'ouroboros-sdk'

const schema = {
  type: 'page',
  body: {
    type: 'form',
    body: [{ type: 'input-text', name: 'name', label: '姓名' }],
  },
}

renderAmisSchema(
  document.getElementById('container'),
  schema,
  { data: { name: 'John' } },
  { theme: 'cxd' }
)
```

### Amis 工具函数

```javascript
import { amisUtils } from 'ouroboros-sdk'

// 使用 amis-core 提供的工具函数
amisUtils.guid()
amisUtils.isObject(value)
amisUtils.createObject(parent, props)
// ... 更多工具函数
```

---

## 类型定义

SDK 提供完整的 TypeScript 类型定义。

```typescript
import type {
  TabOption,
  MenuInfo,
  ConfirmOptions,
  LoginParams,
  StompHeaders,
  IMessage,
  InitMicroAppOptions,
  InitLayoutComponentOptions,
  InitAmisComponentLibOptions,
  MicroAppLifecycle,
  OuroborosDialogSchema,
  OuroborosDrawerSchema,
  OuroborosModalContext,
  MenuBadge,
  MenuItemInfo,
  GetMenusOptions,
  AddMenuItemOptions,
  UserMenuItem,
  UserMenuContext,
  MenuApi,
  UserMenuApi,
} from 'ouroboros-sdk'
```

### 主要类型

```typescript
// 微前端初始化选项
interface InitMicroAppOptions {
  render?: (props: any) => Promise<any>
  beforeMount?: (props: any) => Promise<void>
  afterMount?: (props: any) => Promise<void>
  afterUnmount?: (props: any, app: any) => Promise<void>
  afterUpdate?: (props: any) => Promise<void>
  onBootstrap?: () => Promise<void>
}

// 标签页选项
interface TabOption {
  title?: string
  breadcrumbs?: Object[]
  callback?: Function
  icon?: string
}

// 对话框 Schema
interface OuroborosDialogSchema {
  title: string
  url?: string
  schemaId?: string
  body?: any
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'full'
  sizeSwitchable?: boolean
  sizeOptions?: Array<'' | 'sm' | 'md' | 'lg' | 'xl' | 'full'>
  resizable?: boolean
  actions?: any[]
}

// 抽屉 Schema
interface OuroborosDrawerSchema {
  title: string
  body: any
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  position?: 'left' | 'right' | 'top' | 'bottom'
}
```

---

## 注意事项

1. **ES6 活绑定机制**：SDK 使用 ES6 模块的活绑定特性，平台能力在微前端挂载时动态注入。

2. **独立运行**：微前端应用可以独立运行，此时 SDK 方法会输出警告信息。

3. **类型安全**：建议使用 TypeScript 开发，SDK 提供完整的类型定义。

4. **组件注册时机**：Amis 组件应在 `beforeMount` 或 `initAmisComponentLib` 中注册。

5. **事件清理**：组件卸载时记得取消事件订阅和 WebSocket 连接。

---

## 示例项目

参考 monorepo 中的示例项目：

- `ouroboros-logicflow-editor` - 逻辑流设计器
- `ouroboros-debug-console-topbar` - 调试工具栏

---

## 版本历史

遵循[语义化版本 2.0.0](https://semver.org/lang/zh-CN/)规范。
