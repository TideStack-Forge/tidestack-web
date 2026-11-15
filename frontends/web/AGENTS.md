# Frontend Web Agent Entry

Use this file as the entrypoint for AI work started anywhere under `frontends/web/**`.

- [README.md](README.md): subtree overview and human-facing development context.
- [TESTING.md](TESTING.md): canonical frontend-only test taxonomy, commands, runner policy, and placement rules.
- [tests/README.md](tests/README.md): subtree-level governance tests for frontend doc and tooling validation.
- `./<package>/tests/README.md`: package-level test helpers, harness notes, and local exceptions.
- `./<package>/README.md`: package overview when local architecture or scripts matter.

Scope:
- This guidance covers only frontend packages in `frontends/web/**`.
- It does not define Java backend tests, platform-wide e2e suites, or cross-service/system verification.

Context injection rule:
- Local `AGENTS.md`, `README.md`, and memory files should link back to the canonical docs above with a one-line summary.
- Do not duplicate or override frontend test layout, commands, or runner policy in scattered memory files.

Preferred lightweight snippet:
- `[frontends/web/TESTING.md]`: frontend-only test taxonomy and canonical commands.
- `[frontends/web/tests/README.md]`: subtree-level governance checks only, not package product tests.
- `[frontends/web/<package>/tests/README.md]`: package-level test helpers, harness notes, and local exceptions.

Maintenance:
- Run `npm run validate:agent-entrypoints` in `frontends/web` to verify the frontend agent doc chain stays intact.
