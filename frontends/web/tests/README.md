# Frontend Web Governance Tests

`frontends/web/tests/` 只放前端子树级治理与工具校验，不放具体包的产品测试。

根级治理测试通过 `frontends/web/package.json` 的 `npm run test:unit` 运行，统一使用 `Vitest`。

## Placement Rules

- 子树级文档、脚本与治理校验放到 `tests/unit/`。
- 具体前端包的产品测试继续放在各包自己的 `tests/` 目录下。
- 前端子树的包级产品测试一级分类以 `unit` 和 `integration` 为准；`browser`、`harness`、`script` 等属于 integration 内部实现方式。
- 这个一级分类要求目前以文档规范和迁移约定为主，不单独作为根治理测试的失败条件。
