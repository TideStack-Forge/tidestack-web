# Shared Amis Testing

前端测试规范见 [../../TESTING.md](../../TESTING.md)。本包通过两个产品的真实构建与行为测试验证，目前没有独立测试 runner。

- Web：在 `frontends/web/main-app` 执行 `npm run test:unit -- --maxWorkers=4`、`npm run build`；浏览器主流程执行 `npm run test:integration:main-app-host-e2e -- --workers=1`。
- IDE：在 `ide-plugins/common/metadata-editor-runtime` 执行 `npm run test:unit`、`npm run build`、`npm run test:integration`。会话 roundtrip 与宿主能力分别在其 `tests/unit/metadata-editor.test.ts`、`ide-host-capabilities.test.ts`；独立 bundle 的浏览器编辑与卸载在 `tests/integration/amis-editor/runtime.spec.ts`。

历史测试保持在产品主题下，测试 helper 仍识别原镜像路径以支持已有 fixture；生产构建仅消费共享包和显式宿主端口。新增测试验证行为或最终构建合同，不断言源码结构或字符串。
