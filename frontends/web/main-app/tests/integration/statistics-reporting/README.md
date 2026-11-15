# 统计分析测试

遵循 [前端测试规范](../../../../TESTING.md) 和 [主应用测试入口](../../README.md)。测试使用主应用、实际 AMIS 渲染器与平台统计分析元数据，HTTP 边界使用固定数据。

管理页面回归：

```bash
npx playwright test tests/integration/statistics-reporting/statistics-reporting-workspace.spec.js --config=playwright.dev-workspace-management.config.js
```

覆盖数据集、图表、仪表板导航，名称和标识搜索，编辑入口，数据集到图表的数据传递，读取失败重试，空状态、数据集创建请求与跳转，以及编辑后的保存请求和未保存提醒。验证发布检查不出现在编辑器、当前图表引用在使用情况页签展示，以及桌面和窄屏 SQL 编辑器填满编辑区且不越界。截图通过 Playwright 的 `--output` 保存，包含桌面及窄屏页面。

逻辑源接口使用设计时目录的 `label/value` 选项，始终包含默认数据源。覆盖无绑定直接创建、模型表结构查看、额外应用绑定的添加/刷新与草稿保留，以及指定平台连接/环境、运行容器选择、独立保存测试配置、字段推导和查询预览请求。非默认源不显示连接设置，推导、表结构与预览直接使用定义声明的源，旧测试配置不能覆盖；切换默认源后才显示可展开的预览连接。参数定义与测试值分别保存，切换页签不丢失查询。新增连接复用平台表单，验证驱动、URL、用户名和密码实际进入保存请求，保存后刷新可选连接。保存后再次推导和预览必须保持应用与数据集标识。HTTP 边界使用固定连接和元数据，不修改实际应用配置；后端真实 SQL 和持久化验证位于模块的 DatasetDesignDataSourceServiceTest、DatasetPreviewConnectionIntegrationTest 和 DatasetTestFixturePersistenceTest。

SQL 编辑器回归：

```bash
npx playwright test tests/integration/statistics-reporting/statistics-sql-editor.spec.js --config=playwright.statistics-reporting-runtime.config.js
```

覆盖方言切换、数据源和变体配置保留、变体增删、SQL 未保存提醒和保存事件清理，同时验证通用与变体编辑器的实际宽度和最小高度。同目录的其他运行时与专用编辑器用例使用同一配置，按文件指定执行。
