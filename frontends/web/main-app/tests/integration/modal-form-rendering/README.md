# 弹层表单渲染回归

在 `frontends/web/main-app` 执行：

```sh
npm run test:integration:modal-form-rendering
```

使用 Playwright Chromium 和生产模式的 React、MobX、AMIS，编译当前分支的真实 Schema Filter、Drawer/Dialog 与 AmisSchema 渲染器；不需要启动整个平台或连接后端。依赖仓库现有的 Playwright、Webpack 和 TypeScript。

覆盖角色/组织/新增表单初始化、显式及继承标题、Schema 标题、远程 service/amis-schema 表单、原生 lazySchema、默认及显式按钮提交、空按钮、关闭同步、连续关闭重开、关闭后迟到响应。检查初始化请求次数、提交数据、标题与按钮，以及包括被 MobX 捕获的 React #185 在内的浏览器错误。

`harness/amis.js` 让渲染器与入口复用同一 AMIS 注册表；`environment.js` 仅替代宿主弹层栈、应用配置、路由查询、多语言和事件总线，fetcher 提供固定接口响应。测试使用实际 AMIS 主题以保留关闭按钮的点击区域。构建使用临时目录和动态端口，失败诊断保存在 `target/playwright-modal-form-rendering/`。
