# Ouroboros SDK Testing Standard

`frontends/web/ouroboros-sdk` 当前仅维护前端单元测试。按前端子树统一分类，它属于仅有 `unit`、暂未引入 `integration` 的包。

## Placement Rules

- Do not keep tests under `src/` or `src/__tests__/`.
- Place package-level guardrails under `tests/unit/config/`.
- Place source-facing suites under `tests/unit/src/`.
- Place emitted-artifact checks under `tests/unit/build/` when needed.
- Keep `vitest.config.ts` aligned with the `tests/unit/` root.

## Commands

- `npm run test:unit`
- `npm test`
