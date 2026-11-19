# 编辑器代码上下文联调

在 `frontends/web/main-app` 执行：

```sh
npx playwright test --config=playwright.code-intelligence.config.js
```

需要 Java 21、Maven、Python 3、已安装的前端依赖和 Playwright Chromium。配置会构建所需 Maven reactor，运行逻辑流上下文测试，启动监听本机的 Java HTTP 服务（43184）和 webpack 前端（43183），测试结束后关闭服务。

可以先独立验证各段，再运行上面的联合用例：

1. 后端推断：仓库根目录执行 `mvn -pl core/ouroboros-logicflow/ouroboros-logicflow-dev -am test -Dtest=LogicFlowCodeContextProviderTest -Dsurefire.failIfNoSpecifiedTests=false`。
2. HTTP：在本目录执行 `python3 tests/integration/script-editor-intelligence/start-backend.py --server.port=43186`，向 `http://127.0.0.1:43186/api/dev/example/code-intelligence/context` 独立提交上下文请求，检查原始响应。
3. 前端传输与渲染：执行 `CODE_CONTEXT_BACKEND=mock npx playwright test --config=playwright.code-intelligence.config.js`。这里使用模拟快照，只验证 AMIS/Monaco 候选显示和原始草稿传输。
4. 第 3 步另外包含两个表单传播用例，分别检查 ScriptEditor、JsonDataEditor 在自身代码不变时，上游输入合同的编辑能否发出新请求；附件保存请求内容、文档版本和草稿版本。
5. 第 3 步的 `AMIS form` 用例使用真实 JavaScript Worker 与 AMIS 提交行为，验证默认语法错误拦截、修复后提交、`validateCode: false` 放行，以及关闭时 `required` 仍生效；上下文响应与保存接口为夹具。附件记录实际提交内容、表单值和诊断。

`code-context-live.spec.js` 使用实际 AMIS/Monaco 渲染器，通过生产 `CodeContextController → CodeContextService → LogicFlowCodeContextProvider → FlowNodeAnalyzer SPI` 取得上下文。仅表单布局和待编辑的逻辑流是测试数据，代码上下文接口没有拦截或模拟响应。

验证内容：

- 校验节点的 Schema 经过映射后，为下游 JavaScript 编辑器提供字段及嵌套属性提示。
- 在表单中修改上游映射，新的字段进入提示，旧的字段消失。
- 映射 JSON 的 SpEL 字符串出现上游校验 Schema 的属性提示，接受候选后保存的 JSON 值正确。

测试使用隔离表单，不覆盖完整平台导航、登录、逻辑流画布或开发助手容器部署。未装配开发助手快照，后端响应的 `runtimeStatus` 为 `UNAVAILABLE`；本测试证明的是当前草稿推断和编辑器联动。`code-context.spec.js` 另外保留模拟上下文响应的前端传输回归用例。

默认 `npm run test:integration` 仍运行模拟上下文的前端用例；需要 Java 的真实联调用例通过上面的专用配置运行，避免误用默认模拟服务。

录屏、截图、原始请求/响应附件和 Playwright trace 位于 `target/playwright-code-intelligence/`。
模拟快照的独立分段证据位于 `target/playwright-code-intelligence-transport/`。

首次补全性能回归：

```sh
npx playwright test --config=playwright.code-intelligence.config.js --grep 'completion latency' --repeat-each=3
```

每次使用新的浏览器上下文，在原有上下文就绪回调后立即输入并请求提示，不等待 Worker 预热完成，也不添加录屏展示停顿。附件记录第一次、嵌套字段、重复输入、局部变量字符串方法的实际可见耗时、provider 计算耗时及 Worker 加载。首次须低于 1 秒，后续低于 500 毫秒；同时检查只启动一个 TypeScript 服务 Worker。数值包含浏览器调度和自动化观察开销，不等同于纯 provider 计算耗时。


## Groovy LSP 与语言插件

完成[分发包构建](../../../../../../dev-module/ouroboros-dev-groovy-language-server/README.md)后，使用真实本机开发 RabbitMQ：

```sh
CODE_CONTEXT_BACKEND=groovy npx playwright test --config=playwright.code-intelligence.config.js
```

配置会启动独立平台与助手 JVM：HTTP → 平台 stdio LSP，实际应用依赖经原 Command/Rabbit/helper 同步，也可复用同场景已启动的 43184 服务。设置 `LANGUAGE_CONTAINER_IMAGE=ouroboros-language-groovy:script-el-completion` 切到正式容器部署。浏览器用例保存至 `target/playwright-groovy-lsp`，验证上游 schema/mapping、Java 泛型/闭包和扩展 JAR 提示；hover/signature/定义引用重命名/诊断与 quickfix/格式化；实际语义颜色和文档符号；GraalJS 实际全局对象、显式浏览器名称无成员、业务同名字段与普通前端 DOM 隔离；Groovy 语义输出通过映射传播；Groovy 语法错误阻止 AMIS 提交及修复后提交。表单布局、资源草稿和工具 Binding 目录使用夹具，GraalJS 对象来自实际执行器探针，代码智能 HTTP 响应未模拟；表单保存接口记录实际提交但不持久化资源。pageerror 与代码智能接口失败会阻止通过，既有 AMIS findDOMNode 警告和未提供的 STOMP 路由 404 单独记录在附件，不计为语言功能通过证据。

共享 LSP 的单元测试：`npx vitest run tests/unit/src/components/amis/renderers/editor-lsp-session.test.js tests/unit/src/components/amis/renderers/script-editor-intelligence-runtime.test.js`。新语言注册方式见[语言插件接入指南](../../../../../../dev-module/ouroboros-dev-code-intelligence/LANGUAGE-PLUGINS.md)。

## RPC / 业务模型 / FreeMarker 场景

```sh
CODE_CONTEXT_BACKEND=scenarios npx playwright test --config=playwright.code-intelligence.config.js
```

使用生产 context Controller/Service 与领域 providers；仅应用目录与业务预览入口的外部数据为隔离夹具，代码上下文响应未模拟。RPC、授权与业务日志直接读取生产 UI Schema 的控件声明，CRUD 脚本使用正式投影位置。CCI-RPC-MODEL / CCI-RPC-AUTH / CCI-BUSINESS-SCRIPTS / CCI-BUSINESS-LOG 的验收合同见 [场景](../../../../../../testing/integration/feature/development/code-context-editors/contract.md)。原始证据在 target/playwright-code-context-scenarios。

同一套件中的 `basic syntax diagnostics` 用例逐项验证裸 SpEL、映射 JSON 字符串、RPC 混合模板、配置占位符、JSONPath 和 FreeMarker：错误产生 `editor-syntax` 红线及 AMIS 行号反馈，实际保存请求为零；修复后保存请求为一。后端使用真实纯语法 parser，不执行用户代码、不读取应用配置值。保存接口仅记录提交，不持久化资源；截图、HTTP 交换、提交 payload、录像和 trace 随用例保存。仅运行这六项可加 `--grep 'basic syntax diagnostics'`。
