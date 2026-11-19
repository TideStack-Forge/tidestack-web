# Main App Testing Standard

`frontends/web/main-app` uses a single `tests/` root. The canonical layers are `unit` and `integration`.

## Layers

- `tests/unit/`
  - Fast unit-side checks.
  - Includes runtime/unit behavior tests and config/layout behavior validation. Existing source-text checks are legacy debt and are not a pattern for new tests.
- `tests/integration/`
  - Runtime-coupled frontend scenarios grouped by feature or workflow theme.
  - Theme directories may contain browser specs, harness entries, fixtures, and script helpers.

## Placement Rules

- Do not place test files under `src/`.
- Mirror source paths under `tests/unit/src/` when a unit test targets code from `src/`.
- Put repo-level and build/config tests under `tests/unit/config/`.
- Keep integration assets grouped by feature/workflow under `tests/integration/<feature>/`.
- Put harness entry pages under the consuming integration theme, for example `tests/integration/<feature>/harness/`.
- Avoid feature-specific one-off test runners when a standard unit or integration command can cover the case.

## Naming

- Use `*.test.js` for unit tests.
- Use `*.spec.js` for browser flows.
- Prefer one file per unit/feature boundary instead of dumping unrelated checks together.

## Commands

- Run all unit tests:
  - `npm run test:unit`
- Run all integration tests:
  - `npm run test:integration`
- Run AMIS editor regressions through the Web lazy editor entry:
  - `npm run test:integration:amis-editor`
- Run the full frontend test stack:
  - `npm run test:all`

## Tooling Notes

- `test:unit` is backed by `Vitest`; `test:integration` is backed by `Playwright`.
- When refreshing dependencies in this package, prefer `corepack npm` over legacy `npm 6`.
- If dependency installation hits legacy Vue CLI peer conflicts, use `corepack npm install --legacy-peer-deps` so the existing lockfile topology stays stable.

## Helper Usage

- Use `tests/unit/helpers/mainAppTestKit.js` for:
  - requiring TS/TSX modules in unit tests
  - clearing source module cache between tests
- `readMirroredSrcFile` remains for existing legacy tests; do not add source-text, source-structure, or AST assertions. Verify registration/import behavior through public APIs, and validate documented build artifacts directly when the artifact itself is the contract.
- Use `tests/integration/main-app-host-e2e/` for standalone main-app host E2E flows, and capture screenshot evidence with `tests/integration/main-app-host-e2e/helpers/evidence.js` via explicit `page.screenshot()` + `testInfo.attach()` calls instead of snapshot assertions.
- Use `tests/integration/layout-parity/` for current-vs-legacy frame parity proof against `http://127.0.0.1:88`, and capture both DOM snapshot artifacts and screenshot artifacts for each checked checkpoint.
