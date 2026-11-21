# Ouroboros Amis Runtime

Web 主应用与 IDE 元数据编辑器共用的 Amis renderer、编辑器 preset、schema filter、动作与样式。这里维护同一份行为；页面容器、登录、路由和平台服务由宿主拥有。

包以源码发布给仓库内构建器。公开入口为 `ouroboros-amis-runtime/<path>`，如 `editor/editorRuntimePreset`、`editor/lazyRegister`、`renderers` 和 `style/themes`。消费者负责安装 `package.json` 中的 peerDependencies 并统一 React、Amis、MobX 实例。Webpack/Vite 应分别对 `.ts/.tsx/.scss` 使用自身正式编译链。

`collaboration/YjsWorkspace` 提供协同文档、事务和待同步操作恢复，`collaboration/platformTransport` 复用宿主 STOMP。首个接入为业务模型关系画布，接入合同见[模型实时协同](../../../docs/design/cross-cutting/model-collaboration.md)。消费者统一 Yjs 实例。IDE 宿主目前对平台实时消息明确报不支持，协同试点在 Web 基座运行。

## 宿主契约

共享源码通过 `#ouroboros-host/<port>` 使用宿主能力；完整清单见 [host-ports.json](host-ports.json)。两个产品均调用 [createHostBindings](host-bindings.cjs) 提供全部清单项，缺失项使构建失败。新增宿主依赖必须更新清单及两侧绑定，不得导入主应用私有源码或增加通配 fallback。

| 能力 | Web 宿主 | IDE 宿主 |
| --- | --- | --- |
| HTTP 与开发环境变更 | 正式平台实现 | 编辑服务通过 IDE host bridge；dev-helper 环境变更轮询并随订阅销毁停止 |
| 平台身份、状态与其他消息 | 正式平台实现 | 明确报不支持 |
| 页签、导航、微前端挂载 | 正式 navigation command 与微前端机制 | 明确报不支持 |
| alert/confirm/prompt | Amis 交互 | Amis 交互 |
| dialog/drawer | Web 弹层生命周期 | 活跃 Amis 弹层作用域内派发，随 entered/exited 入栈与退栈；无作用域时报不支持 |
| 文件导出 | 浏览器下载 | Blob 下载并回收对象 URL |
| 本地事件 | Web EventBus | 本地订阅、一次订阅、退订；replay 报不支持 |
| i18n、URL、Deferred | Web 服务或纯函数 | 本地编辑器上下文或纯函数 |

Web 绑定在 `main-app/webpack.config.js`，IDE 绑定在 `ide-plugins/common/metadata-editor-runtime/vite.amis-editor.config.ts`。宿主适配器只能裁剪能力，不能返回虚假的成功结果。

## 样式边界

`src/style` 保存双消费者共用的令牌、CSS 变量契约、主题、密度、组件和 Amis 适配样式；`layout/variables.scss` 仅定义共享主题用到的布局变量。主应用页面、壳层布局和全局容器样式仍由 `main-app/src/style` 组合，IDE 只引入共用部分。

## 验证

现有共享组件行为测试仍按来源主题保留在 Web 的 `main-app/tests/unit/src/components/amis`，由主应用 Vitest 运行；IDE 会话、schema roundtrip 和宿主能力在 `ide-plugins/common/metadata-editor-runtime/tests/unit`。说明见 [测试归属](tests/README.md)。共享包的变更必须验证两个消费者的构建，不能只以 Web 能解析为依据。
