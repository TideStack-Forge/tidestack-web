# tidestack-web-base

TideStack 前端基座：React／qiankun 主应用、Nginx 代理与独立容器运行资源。

本仓由平台总仓按清单单向导出，源码和测试保持同源；贡献请回到平台主仓评审。默认分支为 `master`。

## 开发与构建

使用 Node.js 22 和 npm：

```bash
npm run install:dependencies
npm run build
npm test
```

构建输出位于 `frontends/web/main-app/dist`。基座按后端 API 合同运行，使用 `BACKEND_URL` 配置代理目标；容器构建入口：

```bash
docker build -t tidestack-web-base:local frontends/web/main-app
```

生产部署前设置真实后端地址。微前端静态资源可按现有约定挂载，部署变量沿用总仓机制。

## 授权

本分发采用 Apache License 2.0，见 `LICENSE`。携带的 SDK 保留其 ISC 授权声明，见 [NOTICE](NOTICE)。
