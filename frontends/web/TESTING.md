# Frontend Testing Standard

`frontends/web` packages should organize frontend tests by test level first. The canonical levels in this subtree are `unit` and `integration`.

## Scope

- This document is the canonical source for frontend testing under `frontends/web/**`.
- It covers frontend `unit` and `integration` tests under `frontends/web/**`.
- It does not define Java backend tests, project-level `e2e` suites outside this subtree, or cross-service/system test strategy.

## Entry Rule

- AI agents touching frontend tests in this subtree should read this file first, then the target package's `tests/README.md`.
- If a memory file or lightweight README needs to inject test context, keep it to file references plus a one-line summary back to this document or the package-level `tests/README.md`.

## Taxonomy

- Use test level as the first classification axis:
  - `tests/unit/`
    - Fast behavior tests, public contracts, config behavior, and documented build artifact assertions.
  - `tests/integration/`
    - Multi-module or runtime-coupled frontend checks that exercise real wiring, browser flows, harness pages, transport adapters, or script-driven scenarios.
- Treat `browser`, `harness`, `script`, `fixtures`, and similar names as implementation details inside an integration theme, not as first-level categories.
- The broader project may also define `e2e` suites, but those live outside `frontends/web` and are out of scope for this subtree standard.

## Subtree Governance Checks

- `frontends/web/tests/unit/` is reserved for subtree-level governance checks such as doc-chain and tooling validators.
- Do not move package product tests into `frontends/web/tests/`; keep those in the owning package's `tests/` tree.
- The `unit` / `integration` first-level taxonomy is a repository convention and migration target.
- Keep new work aligned with that convention, but do not treat taxonomy drift by itself as a blocking governance failure unless a later task explicitly asks for hard enforcement.

## Archetypes

### 1. Frontend App Packages

Use this layout when the package owns a runnable frontend app and needs both unit behavior and integration coverage.

- `tests/unit/`
  - Frontend unit behavior, public contracts, and config/build artifact validation.
- `tests/integration/<theme>/`
  - Integration scenarios grouped by product theme or workflow.
  - Theme directories may contain `harness/`, `fixtures/`, `scripts/`, and runner-specific specs.

Current examples:

- `frontends/web/main-app`
- `frontends/web/ouroboros-approval-workflow-designer`

### 2. Frontend Library Packages

Use this layout when the package is a frontend library or SDK.

- `tests/unit/config/`
  - Layout guards and config-level checks.
- `tests/unit/src/`
  - Source-facing runtime/API tests.
- `tests/unit/build/`
  - Optional build-output checks when the package validates emitted artifacts.

Current examples:

- `frontends/web/ouroboros-sdk`

### 3. Unit-Only Utility Packages

Use this layout when the package only needs unit tests today and does not need browser or harness layers.

- `tests/unit/config/`
  - Layout guards and package-level checks.
- `tests/unit/src/`
  - Behavior tests arranged to mirror the owning source subtree when helpful.
- `tests/unit/`
  - Flat package-level tests when there is only one test target.

Current examples:

- `frontends/web/ouroboros-logicflow-editor`
- `frontends/web/script-editor-intelligence-mock-server`
- `frontends/web/ouroboros-debug-console-topbar`

## Placement Rules

- Do not keep test files under `src/`.
- Do not keep integration harness assets under `src/` or `public/`.
- Prefer mirrored test paths under `tests/unit/src/` to keep behavior tests close to their owning components in the test tree.
- Put layout/config guardrails under `tests/unit/config/`.
- Keep integration helpers, harnesses, fixtures, and scripts near the integration theme that consumes them.
- Remove empty legacy test directories after migration.

## Command Conventions

- `npm run test:unit`
  - Canonical command for frontend unit tests.
- `npm run test:integration`
  - Canonical command for frontend integration tests.
- `npm run test:all`
  - Optional aggregator for packages that combine unit and integration tests.

## Runner Policy

- Standardize on `Vitest` for frontend unit tests across `frontends/web`.
- Prefer `Playwright` for browser-backed frontend integration tests.
- Harness pages and script drivers are testing techniques inside integration suites, not runners.
- Do not add `test:node`, `test:playwright`, or `test:vitest` aliases.
- If a suite depends on build artifacts, make the canonical command self-contained with npm lifecycle hooks such as `pretest:unit` or `pretest:integration` instead of relying on undocumented manual build steps.

## Existing Exceptions

- `ouroboros-logicflow-editor` retains historical `tests/*.test.mjs` under Node's built-in runner while new unit tests use Vitest. Its canonical `test:unit` runs both; see the package [tests/README.md](ouroboros-logicflow-editor/tests/README.md). Integration tests remain a separate command.
- Existing tests outside the target taxonomy are migration debt, not permission to add new files there. Keep behavior coverage while moving a bounded package/theme; do not delete a test solely to satisfy the directory shape.
- Exit condition: all historical behavior is covered under the standard runner, the canonical command executes the full intended suite, and the old runner branch/paths can be removed. Track the remaining work as [TEST-001](../../docs/tech-debt-tracker.md#test-001-前端历史-runner-和目录例外).

## Source Contract Boundaries

- Do not generate tests that read source files and regex-match private helper names, internal file names, `findDOMNode`, marker strings, or other implementation-only details.
- Tests should verify behavior results, not source structure or source-pattern checks: assert rendered output, user-observable state, public API results, events, persisted values, or documented build artifacts instead of checking whether a private method/helper exists or source code matches a pattern.
- Public contracts such as renderer registration and package exports must be tested through their public API, runtime behavior, or emitted package artifacts. Config and layout guards may validate documented configuration or generated outputs; they do not exempt tests from the ban on reading implementation source to match strings, regex, AST, or private structure. Generated manifests and exported metadata may be asserted as public structured outputs. Follow the [repository testing rule](../../docs/rules/testing.md#测试用例卫生规则); existing source-pattern tests are migration debt, not permission to add more.

## Route-Transition Regression Rule

- Shell、topbar、tabs 这类布局状态回归，必须覆盖触发缺陷的真实 route transition，不能只把最终路由直接 preload 到 harness 里。
- 当用户报告里包含绕路和返回路径时，集成覆盖必须在同一个浏览器会话里把 detour 和 return 走完，再判断 shell 状态是否真的恢复。
- 对 shell/topbar 修复来说，preloaded-harness 的绿色结果只是基础门槛，不足以单独关闭回归。还必须证明进入路径，例如 public shell → app list → app-card open，以及返回路径，例如 switch away → close tab/app → public shell restored without refresh。

## Tooling Notes

- Prefer `corepack npm` or another modern `npm` when refreshing frontend dependencies or lockfiles.
- Packages with `package-lock.json` `lockfileVersion: 3` and npm alias dependencies can fail under `npm 6`; this showed up in `frontends/web/main-app` when installing `Vitest`.
- For legacy Vue CLI packages with old peer ranges, prefer `corepack npm install --legacy-peer-deps` when you need to refresh dependencies without re-resolving the whole tree.
- Keep runner migrations narrow: change the canonical test script, add the runner config, and avoid mixing unrelated dependency upgrades into the same change.
