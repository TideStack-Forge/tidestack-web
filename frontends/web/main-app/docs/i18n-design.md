# Web 主应用 I18n 集成设计

本页描述 React 主应用的语言初始化、切换、缓存和渲染机制。语言列表、语言包和词条的共同约定见 [前后端对接规范](../../../../core/ouroboros-i18n/docs/frontend-integration.md)，本页不再维护接口字段副本。

## 1. 组件职责与正式入口

主应用使用 React、AMIS 和 qiankun。I18n 的管理器与服务层以 TypeScript 实现，通过既有 EventBus、HTTP Client 和 store facade 与宿主集成。

| 入口 | 职责 |
| --- | --- |
| [common/i18n/index.ts](../src/common/i18n/index.ts) | 创建并导出唯一 `i18nManager`、`i18nService` 与 IndexedDB 缓存工具 |
| [I18nManager.ts](../src/common/i18n/I18nManager.ts) | 保存当前语言包、查词、插值、发布语言变更事件 |
| [I18nService.ts](../src/common/i18n/I18nService.ts) | 初始化、加载/切换语言、更新 AMIS 注册、文档属性、store 和页签标题 |
| [api.ts](../src/common/i18n/api.ts) | 复用 HTTP Client 获取语言列表和完整语言包 |
| [indexedDBCache.ts](../src/common/i18n/indexedDBCache.ts) | 按语言缓存完整字典、版本和写入时间，保存语言偏好 |
| [amis.ts](../src/common/i18n/amis.ts) | 按 schemaId 和词条路径处理可翻译的 Schema 属性 |

[bootstrapHostApp](../src/bootstrap/bootstrapHostApp.ts) 在宿主启动中等待 `i18nService.init()`。业务组件从单例入口取服务；不在组件挂载时另建管理器或并行缓存。

## 2. 初始化与语言切换

初始化的主链路如下：

1. `loadLanguages()` 获取可用语言及版本、默认标记。
2. 初始语言按本地偏好、语言列表中 `isDefault` 的值、浏览器语言、`zh-CN` 的顺序选择。当前代码没有把不支持的浏览器语言自动映射为受支持语言。
3. `loadLocale(locale)` 校验缓存版本，读取有效缓存，未命中则请求语言包并缓存。
4. 管理器保存语言数据并发布 `locale-changed`，随后服务注册 `messages.base` 中的 AMIS 文案，设置 HTML `dir/lang` 并保存偏好。
5. 初始化提交 `app/SET_LOCALE`，以应用名称设置初始页面标题。

`switchLanguage(locale)` 等待同一个 `loadLocale()`，再提交 store 状态并尝试更新已打开页签的标题。业务调用方应等待返回的 Promise，并处理失败。

```typescript
import { i18nManager, i18nService } from '@/common/i18n'

await i18nService.switchLanguage('en-US')
const saveLabel = i18nManager.tCommon('save', '保存')
const fieldLabel = i18nManager.tn('/sys/user-management', 'page.crud.columns.userName.label', '用户名')
```

语言切换依次更新多个消费者，没有事务、取消旧请求或并发请求排序保证。管理器事件在 AMIS 注册和文档属性更新前发布；订阅者不能据事件推断所有副作用已结束。

## 3. 缓存与失败处理

完整语言包存于 IndexedDB 数据库 `i18n-cache` 的 `locales` store，条目含语言包、版本和写入时间，有效期为 7 天。`loadLocale()` 在语言列表提供最新版本时等待 `isValid()`，版本不相等则删除该语言缓存，再读缓存或请求后端。未取得最新版本时不能保证立即发现服务端字典变化。

localStorage 保存的是 `i18n-preferred-locale` 偏好，不承担当前主链路的完整语言包缓存。[cache.ts](../src/common/i18n/cache.ts) 是存量实现，当前 `I18nService` 使用 `I18nIndexedDBCache`。

| 失败位置 | 当前处理与边界 |
| --- | --- |
| 获取语言列表 | 记录警告并返回空列表，后续仍会尝试加载选定语言 |
| 初始化异常 | 管理器设为空词条的 `zh-CN` 包；这是显示降级，不代表已成功加载默认语言包 |
| 切换时加载语言包 | 错误可向调用方传播；没有自动再加载另一语言包的完整回退链 |
| IndexedDB 不可用或条目过期 | 缓存读取会尝试返回空值，主链可转向 API；各存储失败的具体行为以缓存实现为准 |
| 更新页签标题 | 服务捕获并记录异常；语言包加载成功不能证明所有标题均更新 |

## 4. 查词与 React 订阅

`tn(namespace, key, defaultText?, params?)` 优先读指定 namespace，其次读 `common` 中同 key 的文本；仍缺失时尝试用默认文本查 `common`，再返回默认文本；未给默认文本则返回 `namespace.key`。`tCommon()`、`tMenu()` 分别绑定公共和菜单 namespace。

`t(key, ...)` 先遍历 namespace 查找完整 key，再尝试按第一个点拆分 namespace，最后按默认文本降级。可能同名的业务词条优先用 `tn()`，避免依赖全局遍历顺序。`useNamespace()` 返回绑定 namespace 的查词函数，名称中的 `use` 不表示它是 React Hook。

查词与插值规则见共同规范；开发模式下无法降级的 key 进入管理器的 `missingKeys` 集合。管理器不自动向后端上报缺词或统计翻译覆盖率。

React 消费方通过 `onLocaleChange()` 更新本地渲染状态，并在卸载时取消订阅。例如：

```tsx
const [locale, setLocale] = useState(() => i18nManager.getLocale())
useEffect(() => i18nManager.onLocaleChange(setLocale), [])
```

返回值即清理函数。示例只展示订阅方式，组件仍需在渲染时读取当前词条。[LanguageSelector.tsx](../src/features/auth/components/LanguageSelector.tsx) 是现有语言选择器入口；本设计只说明其语言服务消费关系。

## 5. AMIS、菜单和标题

`processAmisSchema(schemaId, schema)` 只在 schemaId 非空、且当前字典包含该 namespace 词条时执行转换，否则返回原 Schema。转换会复制所处理的节点，并以源文本作为默认文案。

Schema 处理器识别 label、title、placeholder 等文本属性、规定的文本后缀、definitions/messages/validationErrors 映射和部分 onEvent 消息；跳过 data、value、样式、条件表达式等黑名单属性，并设有递归深度限制。它不翻译任意字符串或执行任意表达式。

路径由根类型、节点标识和结构构成；数组节点优先使用 `localePath`、稳定 id、name，再按 type 或下标定位。文本可由 `localeKeys` 指定属性 key，或由 `localeKey` 指定 key，最终交给 `tn(schemaId, key, 原文)`。节点和 key 调整必须与后端提取器共同核对。

| 消费方 | 实际入口与刷新边界 |
| --- | --- |
| AMIS 基础组件文案 | `I18nService` 将非空的 `messages.base` 交给 `registerLocale` |
| 页面 Schema | [AmisPage.tsx](../src/components/amis/AmisPage.tsx) 订阅 `locale-changed`，递增语言版本并重新计算已加载 Schema；不重新请求页面 Schema |
| AMIS 渲染 | [AmisComponent.tsx](../src/components/amis/AmisComponent.tsx) 读取当前 locale 交给渲染器 |
| 菜单 | [Sidebar.tsx](../src/layouts/Sidebar.tsx) 等消费者读取管理器词条并响应语言状态 |
| 页签 | 服务按页签 path 查 `title`，有有效翻译才 dispatch 标题更新 |

`finalSchema` 的 memo 依赖包含语言版本；即使语言代码相同，只要管理器更新语言包并发布事件，也会重新翻译。组件卸载时取消订阅，重挂时读取当前语言包。[组件行为测试](../tests/unit/src/components/amis/amis-page-locale.test.js) 覆盖已加载页面重复切换、同语言词条更新及卸载重挂；该测试使用真实管理器、事件总线和 Schema 翻译器，AMIS 渲染器由展示标题的组件替代。实际浏览器中的 AMIS 控件、菜单、页签与微前端联动仍按下文验收，不能由这组组件测试推定全部通过。

## 6. 微前端共用入口

[commonPropsRuntime.ts](../src/common/micro/commonPropsRuntime.ts) 提供 `i18nManager`、`getLanguages()`、`switchLanguage(locale)`。微前端通过宿主公共属性复用这些能力，订阅语言变化时遵守自身卸载生命周期；不把调试窗口对象当正式运行时接口。

调试顶栏、逻辑流编辑器和审批流编辑器分别使用 `debug-console`、`logicflow-editor`、`workflow-editor` 命名空间，语料随对应的后端开发模块提供，放在该模块的 `src/main/resources/META-INF/ouroboros/i18n/messages/` 下。登录、外部账号绑定及回调、404 和通用网络错误语料仍放在 i18n runtime 的 `common.json` 中。

微前端通过 SDK 调用 `i18n.tn(namespace, key, defaultText, params)` 翻译原生界面；内嵌 AMIS Schema 使用 `renderAmisSchema(container, schema, { localeNamespace: namespace })`，更新渲染句柄时也保留该属性。运行时调用 `openDialog` 或 `openDrawer` 时，在 Schema 上设置相同的 `localeNamespace`。基座复用现有 Schema 翻译器，在当前命名空间按显式 key、自动路径及默认文本查找译文，切换语言时重新处理原始 Schema。节点类型、表单值和业务数据保持原值。

开发模式的 `window.$i18nDebug` 提供 `getLocale`、`getMessages`、`test`、`switchTo`、`clearCache` 和 `showMissingKeys`。它由单例入口安装，仅用于本地排查。

## 7. 验证入口与观察点

测试组织和正式命令见 [前端测试规范](../../TESTING.md) 与 [主应用测试说明](../tests/README.md)。下列为行为回归场景，不是本页的运行通过记录：

- 无偏好、已有偏好和不支持的浏览器语言下，核对选择结果、请求、管理器和 store 状态。
- 缓存命中、过期和版本变化时，核对是否重新取包，以及关闭/重开页面后的偏好。
- 在菜单、已打开页签和已加载 AMIS 页面间切换语言，分别核对基础组件文案、Schema 文案、标题和 `dir/lang`。
- 模拟语言接口、缓存失败与快速连续切换，核对错误传播、降级和最终可见语言。
- 卸载并重挂消费组件，核对事件清理和词条显示，微前端沿相同生命周期验证。

本设计依据当前源码描述机制，不代替目标环境下的联调、行为测试或发布证据。
