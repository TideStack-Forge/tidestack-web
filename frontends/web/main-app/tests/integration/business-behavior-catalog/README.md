# Business behavior editor scenarios

These scenarios run the real AMIS form and Monaco editor. HTTP responses are controlled by the tests; they do not prove a deployed Java/UI combination.

`catalog.spec.js` covers the merged catalog and explicit format upgrade. `editor.spec.js` consumes the actual Java-generated editor Schema to cover legacy editing, version 2 function references, new functions, structured/advanced Event editing, subscription enablement, and explicit script Action/Flow resource creation. The script scenario uses the real ScriptEditor, verifies cancel/reopen retention and keeps its temporary source outside model metadata; backend resource atomicity and HTTP/invoke execution have separate Java integration tests.

`workbench.spec.js` covers the unified Chinese workspace, automatic validation, object/model subject changes with independent payload, logic-flow selection, external references, read-only code/generated members, typed params/data mappings, invalid-input navigation blocking, cancellation, and a narrow viewport. Browser routes are controlled; official Java mapping tests separately verify the emitted platform EL and missing/null semantics.

Before running `editor.spec.js` or `workbench.spec.js`, generate its Schema artifact from the repository root:

```sh
mvn -q -pl core/ouroboros-business-model/ouroboros-business-model-default -am test \
  -Dsurefire.failIfNoSpecifiedTests=false \
  -Dtest=BusinessBehaviorEditorSchemaTest \
  -Douroboros.editor-schema-artifact=/tmp/ouroboros-business-behavior-editor-schema.json
```

Start the existing main-app Playwright harness (`PLAYWRIGHT_HARNESS=true`) using the package's normal dev server. Pass `OUROBOROS_EDITOR_SCHEMA=/tmp/ouroboros-business-behavior-editor-schema.json` to Playwright and point its `baseURL` at that server. The generated artifact stays outside Git; tests fail clearly if it is absent.
