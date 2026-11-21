# 统计分析测试

遵循 [前端测试规范](../../../../TESTING.md) 和 [主应用测试入口](../../README.md)。测试使用实际 AMIS 渲染器与平台统计分析元数据，HTTP 边界使用固定数据。

```bash
npx playwright test tests/integration/statistics-reporting/dataset-sql-editor.spec.js tests/integration/statistics-reporting/statistics-reporting-dataset-editor.spec.js tests/integration/statistics-reporting/statistics-reporting-chart-editor.spec.js tests/integration/statistics-reporting/statistics-reporting-dashboard-editor.spec.js tests/integration/statistics-reporting/statistics-reporting-runtime.spec.js --config=playwright.statistics-reporting-runtime.config.js
```

工作区导航、搜索、读取重试和创建流程使用 `statistics-reporting-workspace.spec.js`，通过 `playwright.dev-workspace-management.config.js` 执行。

覆盖 SQL 方言切换、参数与字段编辑、独立开发态配置、推导、连接测试、预览、保存、对象切换与未保存提醒，包含宽窄屏布局。连接配置只传平台连接或运行容器引用，手动 JDBC 连接通过平台数据源管理创建。

Chart 与 Dashboard 用例验证后端结果渲染、独立请求、局部失败与重试。真实 SQL、离线模型推导、连接选择及配置持久化验证位于后端 DatasetDesignDataSourceServiceTest、DatasetPreviewConnectionIntegrationTest 和 DatasetTestFixturePersistenceTest。浏览器 HTTP fixture 的通过结果不能代替部署环境的数据库与授权联调。


综合查询 `statistics-reporting-composite-editor.spec.js` 对应统一场景的 SRT-CV-UI-001 至 003，覆盖业务模型完整草稿保存、列与来源切换、诊断聚焦、行/批量参数映射、内嵌查询、执行限制、分页、超时恢复和窄屏。该用例通过 `playwright.statistics-reporting-runtime.config.js` 执行，并保留截图、录屏和 trace。真实开发服务与 JDBC 的组合测试位于 `CompositeViewDesignControllerTest`，运行时 SQL 限额与取消验证位于 `StatisticsExecutionPipelineIntegrationTest`。
