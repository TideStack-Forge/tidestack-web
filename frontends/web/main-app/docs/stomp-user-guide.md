# Stomp WebSocket 用户手册

> 完整的 Stomp WebSocket 使用指南，包括 API 文档、事件机制、最佳实践和故障排查。

## 目录

- [快速开始](#快速开始)
- [核心概念](#核心概念)
- [API 文档](#api-文档)
- [事件系统](#事件系统)
- [订阅机制](#订阅机制)
- [连接管理](#连接管理)
- [最佳实践](#最佳实践)
- [故障排查](#故障排查)
- [常见问题](#常见问题)

---

## 快速开始

### 基本使用

```typescript
import { subscribeTopic, sendJson } from '@/utils/Stomp'

// 1. 订阅主题
const unsubscribe = subscribeTopic('/notifications', (message) => {
  console.log('收到通知:', message)
})

// 2. 发送消息
await sendJson('/app/message', { text: 'Hello' })

// 3. 取消订阅（组件销毁时）
unsubscribe()
```

### React 组件示例

```tsx
import { useEffect } from 'react'
import { subscribeTopic } from '@/utils/Stomp'

export function Notifications() {
  useEffect(() => subscribeTopic('/notifications', (message) => {
    console.log('收到消息:', message)
  }), [])
  return null
}
```

---

## 核心概念

### Stomp 协议

STOMP (Simple Text Oriented Messaging Protocol) 是一个简单的文本消息协议，运行在 WebSocket 之上。

### 消息类型

| 类型           | 前缀           | 说明                           | 需要认证 |
| -------------- | -------------- | ------------------------------ | -------- |
| **Topic**      | `/topic/`      | 广播主题，所有订阅者都能收到   | ❌       |
| **Queue**      | `/queue/`      | 原服务端会追加 sessionId 的会话队列 | 按目的地与服务端处理器契约 |
| **User Topic** | `/user/topic/` | 用户专属主题，只有当前用户收到 | ✅       |

### 连接状态

```
未连接 → 正在连接 → 已连接 → 已认证
   ↑                      ↓
   └──────── 断开 ←────────┘
              ↓
         自动重连（5秒）
```

---

## API 文档

### 订阅 API

#### `subscribeTopic(topic, listener, keepSingleListenerOrOptions?)`

订阅广播主题。

**参数:**

- `topic: string` - 主题名称（自动添加 `/topic/` 前缀）
- `listener: (message: any, rawMessage: IMessage) => void` - 消息处理函数
- `keepSingleListenerOrOptions?: boolean | { keepSingleListener?: boolean, initialDestination?: string, initialBody?: any, initialTimeoutMs?: number, splitInitialHandlers?: boolean, onInitialData?: (...), onInitialLive?: (...), onInitialComplete?: (...), onInitialError?: (...) }`

**返回:**

- `() => void` - 取消订阅函数

**示例:**

```typescript
// 订阅通知主题
const unsubscribe = subscribeTopic('/notifications', (msg) => {
  console.log('收到通知:', msg)
})

// 取消订阅
unsubscribe()
```

#### `subscribeQueue(queue, listener, keepSingleListenerOrOptions?)`

订阅点对点队列。

**参数:**

- `queue: string` - 队列名称（自动添加 `/queue/` 前缀）
- `listener: (message: any, rawMessage: IMessage) => void` - 消息处理函数
- `keepSingleListenerOrOptions?: boolean | { keepSingleListener?: boolean, initialDestination?: string, initialBody?: any, initialTimeoutMs?: number, splitInitialHandlers?: boolean, onInitialData?: (...), onInitialLive?: (...), onInitialComplete?: (...), onInitialError?: (...) }`

**返回:**

- `() => void` - 取消订阅函数

**示例:**

```typescript
const unsubscribe = subscribeQueue('/tasks', (task) => {
  console.log('收到任务:', task)
})
```

#### `subscribeUserTopic(topic, listener, keepSingleListenerOrOptions?)`

订阅用户专属主题（需要认证）。

**参数:**

- `topic: string` - 主题名称（自动添加 `/user/topic/` 前缀）
- `listener: (message: any, rawMessage: IMessage) => void` - 消息处理函数
- `keepSingleListenerOrOptions?: boolean | { keepSingleListener?: boolean, initialDestination?: string, initialBody?: any, initialTimeoutMs?: number, splitInitialHandlers?: boolean, onInitialData?: (...), onInitialLive?: (...), onInitialComplete?: (...), onInitialError?: (...) }`

**返回:**

- `() => void` - 取消订阅函数

**示例:**

```typescript
// 订阅当前用户的私人通知
const unsubscribe = subscribeUserTopic('/private-notifications', (msg) => {
  console.log('私人通知:', msg)
})
```

#### `subscribe(destination, listener, keepSingleListenerOrOptions?)`

通用订阅方法，可订阅任意目的地。

**参数:**

- `destination: string` - 完整的目的地路径
- `listener: (message: any, rawMessage: IMessage) => void` - 消息处理函数
- `keepSingleListenerOrOptions?: boolean | { keepSingleListener?: boolean, initialDestination?: string, initialBody?: any, initialTimeoutMs?: number, splitInitialHandlers?: boolean, onInitialData?: (...), onInitialLive?: (...), onInitialComplete?: (...), onInitialError?: (...) }`

`initial` 根命名已收敛为 `initial*` 前缀：

- `initialDestination?`
- `createInitialRequest?`
- `initialBody?`
- `initialTimeoutMs?`
- `splitInitialHandlers?`
- `onInitialData?`
- `onInitialLive?`
- `onInitialComplete?`
- `onInitialError?`

**示例:**

```typescript
const unsubscribe = subscribe('/topic/custom', (msg) => {
  console.log('收到消息:', msg)
})
```

#### `subscribeWithInitial(destination, listener, options?)`

为“先拿一段初始化数据，再继续消费实时增量”的场景提供兼容 helper。文档中的规范术语统一使用 `init`，当前 API 选项名仍保持 `initial*`。新的推荐写法是把这些 `initial*` 选项放到现有 `subscribe*` API 的第三个参数里。

当前文档覆盖的是 **app-logs 与 helper logs** 已接入的用法。不要把它理解为所有历史 replay flow、Redis、RabbitMQ、多 broker 一致性、exactly-once 或持久化重放已经完成迁移或保证。

**适用场景:**

- 订阅建立后，先补一段初始化数据
- 初始化完成后，继续消费共享 live 流
- 重连后，需要重新发起一轮新的 init 周期

**参数:**

- `destination: string` - 必填，live 订阅目的地，通常是 `/topic/...`
- `listener: (message: any, rawMessage: IMessage) => void` - 默认消息监听器。默认情况下，live 和 `init-data` 都会进入同一个 listener
  - `options?: SubscribeWithInitialOptions` - 扩展选项
  - `initialDestination?: string` - 可选 override；省略时运行时会直接用完整 live destination 推导 `init request lane`，即 `/app${liveDestination}/init`
  - `createInitialRequest?: () => any` - 可选，请求体工厂。需要为每个周期生成最新参数时优先使用
  - `initialBody?: any` - 可选，固定请求体。若同时提供 `createInitialRequest` 和 `initialBody`，实际发送以 `createInitialRequest()` 为准
  - `initialTimeoutMs?: number` - 可选，单次 initial 周期超时时间，默认 `30000`
  - `keepSingleListener?: boolean` - 可选，沿用现有订阅 API 的监听器复用语义，默认 `true`
  - `splitInitialHandlers?: boolean` - 可选，显式开启 live/init-data 分流
  - `onInitialLive?: (message: any, rawMessage: IMessage) => void` - 可选，仅在 `splitInitialHandlers = true` 时用于处理 live 消息
  - `onInitialData?: (message: any, rawMessage: IMessage) => void` - 可选，仅在 `splitInitialHandlers = true` 时用于处理 `init-data`
  - `onInitialComplete?: (message: any, rawMessage: IMessage) => void` - 可选，处理 `init-complete`
  - `onInitialError?: (message: any, rawMessage: IMessage) => void` - 可选，处理 `init-error`

**返回:**

- `{ bootstrapDone, unsubscribe }`
  - `bootstrapDone: Promise<void>` - 当前 init 周期的完成 Promise。仅在收到当前周期的 `init-complete` 时 resolve
  - `unsubscribe: () => void` - 取消这个逻辑订阅，并阻止后续重连时继续恢复该 helper

**三 lane 语义:**

- live lane: 完整 live destination，例如 `/user/queue/app/{appName}/logs` 或 `/topic/...`
- init request lane: `/app${liveDestination}/init`，或显式 `initialDestination` override
- init reply lane: `/queue/init${liveDestination}/{token}`，只承载当前连接、当前周期的 init 帧

运行时固定按这个顺序启动单次周期：

1. 先订阅完整 live destination
2. 再订阅按 live destination 派生的 init reply `/queue/init${liveDestination}/{token}`
3. 最后发送 init 请求到 `/app${liveDestination}/init`（或显式 override）

这样做是为了先接住实时流，再补初始化数据，减少 live 事件空窗。

**失败与 reject 语义:**

- `bootstrapDone` 在以下情况会 reject：
  - init 超时
  - 收到显式 `init-error`
  - 因重连启动了新周期，旧周期变成 stale cycle
  - 调用 `unsubscribe()` 时当前周期尚未完成
- `bootstrapDone` 不会因为收到了部分 `init-data` 就 resolve
- `bootstrapDone` 也不会因为重连而沿用旧 Promise 完成旧周期

**重连语义:**

- 重连会启动一个**全新周期**，不是续用旧周期
- 新周期会重新生成新的 `subscriptionToken` 和新的 init reply queue
- 旧周期迟到的 `init-data`、`init-complete`、`init-error` 会被视为 stale frame 并忽略

**app-logs pilot 示例:**

```typescript
import { subscribe } from '@/utils/Stomp'

const unsubscribe = subscribe(
  `/user/queue/app/${appName}/logs`,
  (message) => console.log(message),
  {
    initialBody: {},
    onInitialError: () => {
      console.warn('日志初始化失败')
    },
  }
)

unsubscribe()
```

这个 pilot 里：

- live lane 使用 `/user/queue/app/{appName}/logs`
- backend init request entry 由 runtime-owned registrar 接管，请求目的地是 `/app/user/queue/app/{appName}/logs/init`
- frontend caller 默认只传 live lane `/user/queue/app/{appName}/logs`；如需特殊路由，可显式 override `initialDestination`
- init request lane 默认由运行时自动派生为 `/app/user/queue/app/{appName}/logs/init`
- init reply lane 由运行时按当前周期自动派生为 `/queue/init/user/queue/app/{appName}/logs/{token}`，不需要调用方手工传 queue 路径
- `subscriptionToken` 通过 STOMP native headers 发送，request body 保持业务字段本身
- live 与 init data 都保持 app-log 的原始字符串语义，不引入新的日志 DTO
- 当前已接入 app-logs 与 helper logs；其他 legacy replay 入口仍需逐项确认

前端这里的 `init` 用法依赖匹配的后端 contract，不是单边约定。当前已落地的 backend support layer 由 `InitRequest`、`InitRequestContext`、`InitRouteDefinition`、`InitReplyFrame`、`InitReplySender`、`InitRequestHandler`、`StompInitSupport` 组成，默认实现是 `DefaultInitReplySender`、`DefaultInitRequestValidator`、`DefaultInitRequestContext`、`DefaultStompInitSupport`，由 `OuroborosWebSocketAutoConfiguration` 装配。app-logs flow 现在只负责接入这些 contracts，不再在业务代码里重复写 route 派生和 control frame 发送样板代码。规范以 cross-cutting 设计文档为准，当前 API 字段名仍可能保留 `initial*` 兼容命名。

### 取消订阅 API

#### `unsubscribeTopic(topic, listener?)`

取消订阅主题。

**参数:**

- `topic: string` - 主题名称
- `listener?: Function` - 可选，指定要取消的监听器，留空则取消所有

#### `unsubscribeQueue(queue, listener?)`

取消订阅队列。

#### `unsubscribeUserTopic(topic, listener?)`

取消订阅用户主题。

#### `unsubscribe(destination, listener?)`

通用取消订阅方法。

#### `unsubscribeAll()`

取消所有订阅。

#### `unsubscribeAllTopics()`

取消所有主题订阅。

#### `unsubscribeAllQueues()`

取消所有队列订阅。

#### `unsubscribeAllUserTopics()`

取消所有用户主题订阅。

### 发送消息 API

#### `sendJson(destination, body, headers?)`

发送 JSON 消息。

**参数:**

- `destination: string` - 目的地路径
- `body: any` - 消息体（会自动转为 JSON）
- `headers?: object` - 可选的消息头

**返回:**

- `Promise<void>`

**示例:**

```typescript
await sendJson('/app/chat', {
  text: 'Hello',
  userId: 123,
})
```

#### `sendText(destination, body, headers?)`

发送文本消息。

**参数:**

- `destination: string` - 目的地路径
- `body: string` - 文本消息体
- `headers?: object` - 可选的消息头

**返回:**

- `Promise<void>`

#### `sendBinary(destination, body, headers?)`

发送二进制消息。

**参数:**

- `destination: string` - 目的地路径
- `body: Uint8Array` - 二进制消息体
- `headers?: object` - 可选的消息头

**返回:**

- `Promise<void>`

#### `send(destination, body, headers?)`

通用发送方法，自动判断消息类型。

### 连接管理 API

#### `connect()`

手动连接到服务器。

**返回:**

- `Promise<void>` - 连接成功后 resolve

**示例:**

```typescript
await connect()
console.log('连接成功')
```

#### `disconnect(force?)`

断开连接。

**参数:**

- `force?: boolean` - 是否强制断开，默认 `false`（有订阅时不会断开）

**返回:**

- `Promise<void>`

**示例:**

```typescript
// 普通断开（有订阅时不会断开）
await disconnect()

// 强制断开
await disconnect(true)
```

#### `reconnect()`

重新连接（先断开再连接）。

**返回:**

- `Promise<void>`

**示例:**

```typescript
await reconnect()
console.log('重连成功')
```

### 状态检查 API

#### `isConnected()`

检查是否已连接。

**返回:**

- `boolean` - 是否已连接

**示例:**

```typescript
if (isConnected()) {
  await sendJson('/app/message', data)
} else {
  console.log('未连接，等待连接...')
}
```

#### `isActive()`

检查是否已激活（包括正在连接和已连接状态）。

**返回:**

- `boolean` - 是否已激活

**示例:**

```typescript
if (isActive()) {
  console.log('连接活跃中')
}
```

#### `isStompAuthenticated()`

检查当前 STOMP 连接是否已获得服务端身份确认；本地有 Token 不等于已经完成连接认证。

**返回:**

- `boolean` - 是否已认证

**示例:**

```typescript
if (isStompAuthenticated()) {
  // 可以订阅用户专属主题
  subscribeUserTopic('/notifications', handler)
} else {
  console.log('未认证，无法订阅用户主题')
}
```

### 事件订阅 API

#### `onStompConnected(handler)`

订阅连接成功事件（包括首次连接和重连）。

**参数:**

- `handler: (data) => void` - 事件处理函数
  - `data.isReconnect: boolean` - 是否是重连
  - `data.timestamp: number` - 连接成功的时间戳
  - `data.message: any` - STOMP 连接消息对象

**返回:**

- `() => void` - 取消订阅函数

**示例:**

```typescript
const unsubscribe = onStompConnected((data) => {
  if (data.isReconnect) {
    console.log('重连成功，刷新数据')
    refreshData()
  } else {
    console.log('首次连接成功')
  }
})
```

#### `onStompDisconnected(handler)`

订阅断开连接事件。

**参数:**

- `handler: (data) => void` - 事件处理函数
  - `data.timestamp: number` - 断开连接的时间戳

**返回:**

- `() => void` - 取消订阅函数

**示例:**

```typescript
const unsubscribe = onStompDisconnected((data) => {
  console.log('连接断开，等待重连...')
  showNotification('实时通信已断开，正在重连...')
})
```

---

## 事件系统

### 事件列表

| 事件名               | 触发时机               | 数据                                  |
| -------------------- | ---------------------- | ------------------------------------- |
| `stomp:connected`    | 连接成功（首次或重连） | `{ isReconnect, timestamp, message }` |
| `stomp:disconnected` | 连接断开               | `{ timestamp }`                       |

### 使用方式

#### 方式一：使用 Stomp API（推荐）

```typescript
import { onStompConnected, onStompDisconnected } from '@/utils/Stomp'

// 订阅连接事件
const unsubscribe1 = onStompConnected((data) => {
  console.log('连接成功', data.isReconnect ? '(重连)' : '(首次)')
})

// 订阅断开事件
const unsubscribe2 = onStompDisconnected((data) => {
  console.log('连接断开')
})

// 取消订阅
unsubscribe1()
unsubscribe2()
```

#### 方式二：直接使用 EventBus

```typescript
import { EventBus } from '@/common/eventBus'

EventBus.subscribe('stomp:connected', (data) => {
  console.log('连接成功', data)
})

EventBus.subscribe('stomp:disconnected', (data) => {
  console.log('连接断开', data)
})
```

### 实际应用场景

#### 场景 1：显示连接状态

```tsx
import { useEffect, useState } from 'react'
import { onStompConnected, onStompDisconnected } from '@/utils/Stomp'

export function ConnectionStatus() {
  const [status, setStatus] = useState('连接中...')
  useEffect(() => {
    const offConnected = onStompConnected(() => setStatus('已连接'))
    const offDisconnected = onStompDisconnected(() => setStatus('连接断开，重连中...'))
    return () => { offConnected(); offDisconnected() }
  }, [])
  return <div>{status}</div>
}
```

#### 场景 2：重连后刷新数据

```typescript
import { onStompConnected } from '@/utils/Stomp'

onStompConnected((data) => {
  if (data.isReconnect) {
    // 重连成功后，可能需要刷新数据
    console.log('检测到重连，刷新数据...')
    fetchLatestData()
  }
})
```

---

## 订阅机制

### 订阅复用

#### 正常订阅（复用机制）

当应用正常运行时，多次订阅同一个 topic：

```typescript
// 组件 A 订阅
subscribeTopic('/notifications', handlerA, false)

// 组件 B 订阅同一个 topic
subscribeTopic('/notifications', handlerB, false)
```

**行为:**

- ✅ 只向服务器发送一次订阅请求
- ✅ 两个 handler 都会收到消息
- ✅ 减少网络开销和服务器负担

#### 重连订阅（强制重建）

当连接断开后自动重连成功时：

**场景:**

- 服务器重启：服务器丢失了所有客户端订阅信息
- 网络波动：连接短暂中断，服务器可能保留或丢失订阅信息

**行为:**

- ✅ 先取消旧订阅，再创建新订阅
- ✅ 确保服务器端有正确的订阅状态
- ✅ 所有之前的 listener 都会被恢复

### keepSingleListener 参数

控制同一个目的地的监听器管理方式。

#### `keepSingleListener = true`（默认）

每次订阅会替换之前的监听器。

```typescript
// 第一次订阅
subscribeTopic('/notifications', handler1) // handler1 生效

// 第二次订阅（替换）
subscribeTopic('/notifications', handler2) // 只有 handler2 生效
```

**适用场景:**

- 单个组件订阅
- 不需要多个监听器

#### `keepSingleListener = false`

允许多个监听器共存。

```typescript
// 第一次订阅
subscribeTopic('/notifications', handler1, false) // handler1 生效

// 第二次订阅（添加）
subscribeTopic('/notifications', handler2, false) // handler1 和 handler2 都生效
```

**适用场景:**

- 多个组件订阅同一个主题
- 需要多个监听器处理同一消息

### 订阅流程

```
用户调用 subscribe()
    ↓
检查是否已有订阅
    ↓
├─ 已有订阅
│   ├─ keepSingleListener = true → 替换 listener
│   └─ keepSingleListener = false → 添加 listener
│   └─ 复用服务端订阅（不重复订阅）
│
└─ 没有订阅
    └─ 创建新的服务端订阅
    └─ 添加 listener
    ↓
返回取消订阅函数
```

### `subscribe(destination, listener, options)` 周期流程

```text
调用 subscribe(destination, listener, { initialBody: ... })
    ↓
订阅 live /topic
    ↓
订阅当前周期的 init reply /queue/init/.../{token}
    ↓
发送 init 请求到 /app/.../init
    ↓
接收 init-data...
    ↓
收到 init-complete → bootstrapDone resolve
    ↓
继续只消费 live /topic
```

如果在过程中超时、收到 `init-error`、发生 stale-cycle 失效，或调用方先取消订阅，则当前 `bootstrapDone` 会 reject。

---

## 连接管理

### 自动连接

Stomp 会在以下情况自动连接：

1. **首次订阅时**

   ```typescript
   // 自动触发连接
   subscribeTopic('/notifications', handler)
   ```

2. **发送消息时**
   ```typescript
   // 如果未连接，会先连接再发送
   await sendJson('/app/message', data)
   ```

### 自动重连

连接断开后，会自动重连：

- **重连延迟**: 5 秒
- **心跳间隔**: 4 秒（接收和发送）
- **订阅恢复**: 重连成功后自动恢复所有订阅

```
连接断开
    ↓
等待 5 秒
    ↓
自动重连
    ↓
连接成功
    ↓
自动恢复所有订阅
    ↓
继续接收消息
```

### 认证机制

当前服务端 CONNECT 入口由原 TokenService 校验平台 Token 并通过 UserCenter 关联身份；本节不宣称接纳 OIDC/委托 Token。用户专属路由还受服务端发送和目的地契约约束，前端订阅条件不能替代服务端鉴权。实现见[通道拦截器](../../../../ability/ouroboros-websocket/ouroboros-websocket-runtime/src/main/java/com/ouroboros/websocket/StompWebSocketChannelInterceptor.java)。

连接时会自动携带 accessToken：

```typescript
// beforeConnect 钩子
stompClient.beforeConnect = () => {
  const accessToken = getAccessToken()
  if (accessToken) {
    stompClient.connectHeaders = {
      token: accessToken,
    }
  }
}
```

**认证后可以:**

- 订阅 `/user/` 开头的主题
- 接收用户专属消息

### 连接状态检查

```typescript
import { isConnected, isActive, isStompAuthenticated } from '@/utils/Stomp'

// 检查连接状态
console.log('已连接:', isConnected())
console.log('已激活:', isActive())
console.log('已认证:', isStompAuthenticated())
```

---

## 最佳实践

### ✅ 推荐做法

#### 1. 组件中正确订阅和取消订阅

```tsx
import { useEffect } from 'react'
import { subscribeTopic } from '@/utils/Stomp'

export function Notifications() {
  useEffect(() => subscribeTopic('/notifications', (msg) => {
    console.log('收到通知:', msg)
  }), [])
  return null
}
```

#### 2. 多组件订阅同一主题

```typescript
// 组件 A
subscribeTopic('/notifications', handlerA, false) // keepSingleListener = false

// 组件 B
subscribeTopic('/notifications', handlerB, false) // keepSingleListener = false

// 结果：只有一次服务端订阅，两个组件都能收到消息
```

#### 3. 监听重连事件并刷新数据

```typescript
import { onStompConnected } from '@/utils/Stomp'

onStompConnected((data) => {
  if (data.isReconnect) {
    // 重连后可能需要刷新数据
    console.log('检测到重连，刷新数据')
    fetchLatestData()
  }
})
```

#### 4. 需要 init + live 时使用 `subscribe(destination, listener, options)`

```typescript
const unsubscribe = subscribe(
  `/user/queue/app/${appName}/logs`,
  (message) => console.log(message),
  {
    initialBody: {},
    splitInitialHandlers: true,
    onInitialLive: (message) => console.log('live', message),
    onInitialData: (message) => console.log('init', message),
  }
)

onBeforeUnmount(() => {
  unsubscribe()
})
```

适合用在“先补初始化数据，再接实时增量”的流。这里的规范命名是 `init request lane`、`init reply lane`、`init-data`、`init-complete`、`init-error`。普通只读 live topic 的场景，继续使用低层 `subscribe` / `subscribeTopic` 就够了。

#### 5. 发送消息前检查连接状态

```typescript
import { isConnected, sendJson } from '@/utils/Stomp'

async function sendMessage(data) {
  if (!isConnected()) {
    console.warn('未连接，消息将被缓存')
  }
  await sendJson('/app/message', data)
}
```

#### 6. 使用 TypeScript 类型

```typescript
interface Notification {
  id: number
  title: string
  content: string
}

subscribeTopic('/notifications', (msg: Notification) => {
  console.log(`通知 ${msg.id}: ${msg.title}`)
})
```

### ❌ 避免的做法

#### 1. 忘记取消订阅

```typescript
// ❌ 错误：组件销毁时没有取消订阅
useEffect(() => {
  subscribeTopic('/notifications', handler)
  // 忘记保存 unsubscribe 函数
}, [handler])

// ✅ 正确
useEffect(() => {
  const unsubscribe = subscribeTopic('/notifications', handler)
  return () => unsubscribe()
}, [handler])
```

#### 2. 重连后手动重新订阅

```typescript
// ❌ 错误：不需要手动重新订阅
onStompConnected((data) => {
  if (data.isReconnect) {
    subscribeTopic('/notifications', handler) // 系统会自动处理！
  }
})

// ✅ 正确：只需要刷新数据
onStompConnected((data) => {
  if (data.isReconnect) {
    refreshData() // 只刷新数据即可
  }
})
```

#### 3. 频繁订阅和取消订阅

```typescript
// ❌ 错误：浪费资源
setInterval(() => {
  const unsub = subscribeTopic('/notifications', handler)
  unsub() // 立即取消
}, 1000)

// ✅ 正确：订阅一次，长期使用
const unsubscribe = subscribeTopic('/notifications', handler)
// 只在组件销毁时取消
```

#### 4. 在循环中订阅

```typescript
// ❌ 错误：创建多个重复订阅
for (let i = 0; i < 10; i++) {
  subscribeTopic('/notifications', handler)
}

// ✅ 正确：只订阅一次
subscribeTopic('/notifications', handler)
```

---

## 故障排查

### 问题 1：收不到消息

**可能原因:**

1. **未连接**

   ```typescript
   import { isConnected } from '@/utils/Stomp'
   console.log('连接状态:', isConnected())
   ```

2. **订阅路径错误**

   ```typescript
   // ❌ 错误
   subscribeTopic('notifications', handler) // 缺少 /

   // ✅ 正确
   subscribeTopic('/notifications', handler)
   ```

3. **需要认证但未认证**

   ```typescript
   import { isStompAuthenticated } from '@/utils/Stomp'

   if (!isStompAuthenticated()) {
     console.error('未认证，无法订阅用户主题')
   }
   ```

4. **监听器被替换**

   ```typescript
   // 第一次订阅
   subscribeTopic('/notifications', handler1)

   // 第二次订阅（默认会替换 handler1）
   subscribeTopic('/notifications', handler2)

   // 解决：使用 keepSingleListener = false
   subscribeTopic('/notifications', handler1, false)
   subscribeTopic('/notifications', handler2, false)
   ```

### 问题 2：连接频繁断开

**可能原因:**

1. **网络不稳定**

   - 检查网络连接
   - 查看浏览器控制台的 WebSocket 错误

2. **服务器问题**

   - 检查服务器日志
   - 确认服务器 WebSocket 配置

3. **心跳超时**
   - 当前心跳间隔：4 秒
   - 如果网络延迟高，可能需要调整

### 问题 3：重连后收不到消息

**检查步骤:**

1. **确认订阅是否恢复**

   ```typescript
   onStompConnected((data) => {
     if (data.isReconnect) {
       console.log('重连成功，订阅应该已恢复')
     }
   })
   ```

2. **检查认证状态**

   ```typescript
   import { isStompAuthenticated } from '@/utils/Stomp'
   console.log('认证状态:', isStompAuthenticated())
   ```

3. **查看浏览器控制台**
   - 查找 `[Stomp]` 开头的日志
   - 确认是否有错误信息

### 问题 4：消息发送失败

**可能原因:**

1. **未连接**

   ```typescript
   import { isConnected, sendJson } from '@/utils/Stomp'

   if (!isConnected()) {
     console.warn('未连接，消息将被缓存')
   }
   await sendJson('/app/message', data)
   ```

2. **目的地路径错误**

   ```typescript
   // ❌ 错误：客户端不能直接发送到 /topic/
   await sendJson('/topic/notifications', data)

   // ✅ 正确：发送到 /app/ 路径
   await sendJson('/app/notifications', data)
   ```

### 调试技巧

#### 1. 启用详细日志

打开浏览器控制台，查找 `[Stomp]` 开头的日志：

```
[Stomp] 连接成功
[Stomp] 重连成功
[Stomp] WebSocket 连接已关闭，将自动重连
[Stomp] STOMP 错误: ...
```

#### 2. 检查订阅状态

```typescript
// 在浏览器控制台执行
import { isConnected, isActive, isStompAuthenticated } from '@/utils/Stomp'

console.log({
  connected: isConnected(),
  active: isActive(),
  authenticated: isStompAuthenticated(),
})
```

#### 3. 监听所有事件

```typescript
import { onStompConnected, onStompDisconnected } from '@/utils/Stomp'

onStompConnected((data) => {
  console.log('连接事件:', data)
})

onStompDisconnected((data) => {
  console.log('断开事件:', data)
})
```

---

## 常见问题

### Q1: 如何知道当前是否已连接？

```typescript
import { isConnected } from '@/utils/Stomp'

if (isConnected()) {
  console.log('已连接')
} else {
  console.log('未连接')
}
```

### Q2: 重连后需要手动重新订阅吗？

**不需要。** 系统会自动恢复所有订阅。

```typescript
// ❌ 不需要这样做
onStompConnected((data) => {
  if (data.isReconnect) {
    subscribeTopic('/notifications', handler) // 不需要！
  }
})

// ✅ 只需要刷新数据
onStompConnected((data) => {
  if (data.isReconnect) {
    refreshData() // 只刷新数据
  }
})
```

### Q3: 多个组件订阅同一个主题会重复订阅吗？

**不会。** 使用 `keepSingleListener = false` 可以复用同一个服务端订阅。

```typescript
// 组件 A
subscribeTopic('/notifications', handlerA, false)

// 组件 B
subscribeTopic('/notifications', handlerB, false)

// 结果：只有一次服务端订阅，两个组件都能收到消息
```

### Q4: 如何订阅用户专属消息？

使用 `subscribeUserTopic`，需要先认证：

```typescript
import { subscribeUserTopic, isStompAuthenticated } from '@/utils/Stomp'

if (isStompAuthenticated()) {
  subscribeUserTopic('/private-notifications', (msg) => {
    console.log('私人通知:', msg)
  })
} else {
  console.error('未认证，无法订阅用户主题')
}
```

### Q5: 发送消息时如何知道是否成功？

`send` 系列方法返回 Promise，表示本地发送调用/连接尝试的结果；它没有等待 broker receipt，也不能证明服务端业务已处理。需要端到端确认时应使用业务响应合同。

```typescript
try {
  await sendJson('/app/message', data)
  console.log('本地发送调用已返回')
} catch (error) {
  console.error('发送失败:', error)
}
```

### Q6: 如何处理二进制消息？

```typescript
// 发送二进制消息
const binaryData = new Uint8Array([1, 2, 3, 4])
await sendBinary('/app/binary', binaryData)

// 接收二进制消息
subscribeTopic('/binary-topic', (msg) => {
  if (msg instanceof Uint8Array) {
    console.log('收到二进制数据:', msg)
  }
})
```

### Q7: 如何取消所有订阅？

```typescript
import { unsubscribeAll } from '@/utils/Stomp'

// 取消所有订阅
unsubscribeAll()

// 或者只取消特定类型
unsubscribeAllTopics() // 取消所有主题
unsubscribeAllQueues() // 取消所有队列
unsubscribeAllUserTopics() // 取消所有用户主题
```

### Q8: 连接断开后发送的消息会丢失吗？

**仅在当前页面进程仍存活且连接随后成功时，缓存消息会尝试发送。** 这是本地发送调用的缓存，不是 broker receipt、业务处理成功或持久化保证：

```typescript
// 即使未连接，消息也会被缓存
await sendJson('/app/message', data)

// 连接成功后，缓存的消息会自动发送
```

### Q9: 如何自定义连接配置？

当前配置在 `src/utils/Stomp.ts` 中：

```typescript
const stompClient = new Client({
  webSocketFactory: () => new SockJS('/websocket/stomp'),
  reconnectDelay: 5000, // 重连延迟（毫秒）
  heartbeatIncoming: 4000, // 接收心跳间隔（毫秒）
  heartbeatOutgoing: 4000, // 发送心跳间隔（毫秒）
})
```

如需修改，请编辑该文件。

### Q10: 如何在 React 组件中使用？

```tsx
import { useEffect } from 'react'
import { subscribeTopic } from '@/utils/Stomp'

export function Notifications() {
  useEffect(() => subscribeTopic('/notifications', (msg) => {
    console.log('收到通知:', msg)
  }), [])
  return null
}
```

---

## 完整示例

### 示例 1：聊天应用

主应用使用 React。下面示例只展示订阅、发送和卸载清理；历史消息和 UI 状态由业务组件自行管理。

```tsx
import { useEffect } from 'react'
import { sendJson, subscribeTopic } from '@/utils/Stomp'

export function Chat() {
  useEffect(() => subscribeTopic('/chat/messages', (message) => {
    console.log('收到消息', message)
  }), [])

  async function sendMessage(text: string) {
    await sendJson('/app/chat/send', { text, timestamp: Date.now() })
  }

  return null
}
```
### 示例 2：实时通知系统

```typescript
// notification-service.ts
import { subscribeUserTopic, onStompConnected, isStompAuthenticated } from '@/utils/Stomp'
import { ElNotification } from 'element-plus'

class NotificationService {
  private unsubscribe: (() => void) | null = null

  init() {
    // 等待认证后订阅
    const checkAndSubscribe = () => {
      if (isStompAuthenticated()) {
        this.subscribe()
      }
    }

    // 监听连接事件
    onStompConnected((data) => {
      if (!data.isReconnect) {
        checkAndSubscribe()
      }
    })

    // 立即检查
    checkAndSubscribe()
  }

  private subscribe() {
    this.unsubscribe = subscribeUserTopic('/notifications', (notification) => {
      this.showNotification(notification)
    })
  }

  private showNotification(notification: any) {
    ElNotification({
      title: notification.title,
      message: notification.content,
      type: notification.type || 'info',
      duration: 5000,
    })
  }

  destroy() {
    this.unsubscribe?.()
  }
}

export const notificationService = new NotificationService()
```

```typescript
// main.ts
import { notificationService } from './services/notification-service'

// 应用启动时初始化
notificationService.init()
```

### 示例 3：多组件共享订阅

```typescript
// shared-subscription.ts
import { subscribeTopic } from '@/utils/Stomp'

// 创建共享订阅
const listeners = new Set<(data: any) => void>()
let unsubscribe: (() => void) | null = null

export function subscribeSharedTopic(listener: (data: any) => void) {
  listeners.add(listener)

  // 第一个订阅者创建服务端订阅
  if (listeners.size === 1) {
    unsubscribe = subscribeTopic('/shared-topic', (data) => {
      // 分发给所有监听器
      listeners.forEach((fn) => fn(data))
    })
  }

  // 返回取消订阅函数
  return () => {
    listeners.delete(listener)

    // 最后一个订阅者取消服务端订阅
    if (listeners.size === 0) {
      unsubscribe?.()
      unsubscribe = null
    }
  }
}
```

```tsx
import { useEffect } from 'react'
import { subscribeSharedTopic } from './shared-subscription'

export function ComponentA() {
  useEffect(() => subscribeSharedTopic((data) => {
    console.log('组件 A 收到:', data)
  }), [])
  return null
}

export function ComponentB() {
  useEffect(() => subscribeSharedTopic((data) => {
    console.log('组件 B 收到:', data)
  }), [])
  return null
}
```

---

## 技术细节

### 底层实现

- **协议**: STOMP over WebSocket
- **传输层**: SockJS (提供 WebSocket 降级支持)
- **客户端库**: `@stomp/stompjs`
- **连接地址**: `/websocket/stomp`

### 配置参数

| 参数                | 值     | 说明           |
| ------------------- | ------ | -------------- |
| `reconnectDelay`    | 5000ms | 断开后重连延迟 |
| `heartbeatIncoming` | 4000ms | 接收心跳间隔   |
| `heartbeatOutgoing` | 4000ms | 发送心跳间隔   |

### 消息格式

#### JSON 消息

```json
{
  "headers": {
    "content-type": "application/json"
  },
  "body": "{\"key\":\"value\"}"
}
```

#### 二进制消息

```json
{
  "headers": {
    "content-type": "application/octet-stream"
  },
  "binaryBody": "Uint8Array"
}
```

### 认证流程

```
1. beforeConnect 钩子
   ↓
2. 从 store 获取 accessToken
   ↓
3. 设置连接 headers: { token: accessToken }
   ↓
4. 建立连接
   ↓
5. 服务器验证 token
   ↓
6. 返回 user-name header（认证成功）
   ↓
7. 触发 afterAuthenticated()
```

---

## 相关文档

- [Stomp.ts](../src/utils/Stomp.ts) - 源代码

---

## 更新日志

### v1.0.0 (2026-02-09)

- ✅ 自动重连机制
- ✅ 订阅自动恢复
- ✅ 连接状态事件
- ✅ 状态检查 API
- ✅ 订阅复用机制
- ✅ 消息缓存机制

---

## 支持

如有问题或建议，请联系开发团队或提交 Issue。

---

**文档版本**: 1.0.0
**最后更新**: 2026-02-09
**维护者**: 开发团队
