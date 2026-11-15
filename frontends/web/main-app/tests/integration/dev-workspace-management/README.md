# 开发工作区回归

测试遵循 [前端测试规范](../../../../TESTING.md) 和 [主应用测试入口](../../README.md)，使用主应用与实际 AMIS 渲染器，HTTP 边界使用固定数据。

```bash
npx playwright test --config=playwright.dev-workspace-management.config.js
```

覆盖以下操作：

- 从应用卡片打开开发看板，切换业务模型、绕到打开应用后返回，验证菜单与标签选择。
- 业务逻辑菜单与应用管理菜单的顺序。
- 当前提交信息、本人持锁文件的单项与批量提交、管理员强制解锁、纵向凭证表单。
- 逻辑流与 UI Schema 投射目标存在时直接打开，不存在时克隆，失败时阻止跳转。
- 复用树表回归，连续执行五轮渲染，每轮三次多级展开与收起。

截图通过 Playwright 的 `--output` 保存。文件提交的实际 Git 结果与权限拒绝由后端 `AppVcsWorkspaceIntegrationTest`、`AppVcsWorkspaceServiceTest` 验证。
