const assert = require('node:assert/strict')
const path = require('node:path')
const { registerTypescriptRequire, requireMirroredSrcModule } = require(
  path.join(process.cwd(), 'tests/unit/helpers/mainAppTestKit')
)
registerTypescriptRequire()
const { buildJsonPathCompletionItems } = requireMirroredSrcModule(
  __filename,
  'script-editor-intelligence/jsonpath/adapter.ts'
)
const { buildFreemarkerCompletionItems } = requireMirroredSrcModule(
  __filename,
  'script-editor-intelligence/freemarker/adapter.ts'
)
const { buildTemplateCompletionItems } = requireMirroredSrcModule(
  __filename,
  'script-editor-intelligence/template/adapter.ts'
)
const monaco = {
  languages: { CompletionItemKind: { Field: 1, Variable: 2, Value: 3, Function: 4 } },
}
const root = {
  type: 'object',
  properties: {
    data: {
      type: 'object',
      properties: { accessToken: { type: 'string' }, 'expires-in': { type: 'integer' } },
    },
    items: {
      type: 'array',
      items: { type: 'object', properties: { sku: { type: 'string' } } },
    },
  },
}
function model(text) {
  return {
    getValue: () => text,
    getOffsetAt: () => text.length,
    getLineContent: () => text.split('\n').at(-1),
    getWordUntilPosition: () => ({
      startColumn: text.split('\n').at(-1).length + 1,
      endColumn: text.split('\n').at(-1).length + 1,
    }),
  }
}
function complete(builder, snapshot, text) {
  return builder(monaco, snapshot, model(text), {
    lineNumber: text.split('\n').length,
    column: text.split('\n').at(-1).length + 1,
  })
}

describe('Structured server-side editor languages', () => {
  it('JSONPath resolves response members, array elements and non-identifier keys without globals', () => {
    const snapshot = {
      globals: [{ name: 'window' }],
      languageProjectionHints: {
        rootShape: root,
        templateMode: 'config-only',
        configurationKeys: [{ key: 'token.path' }],
      },
    }
    const suggestions = complete(buildJsonPathCompletionItems, snapshot, '$.data.')
    assert.deepEqual(
      suggestions.map((item) => item.label),
      ['accessToken', 'expires-in']
    )
    assert.equal(suggestions[1].insertText, '["expires-in"]')
    assert.equal(suggestions[1].range.startColumn, 7)
    assert.deepEqual(
      complete(buildJsonPathCompletionItems, snapshot, '$.items[*].').map(
        (item) => item.label
      ),
      ['sku']
    )
    assert.deepEqual(
      complete(buildJsonPathCompletionItems, snapshot, '#{token.').map(
        (item) => item.label
      ),
      ['token.path']
    )
    assert.deepEqual(complete(buildJsonPathCompletionItems, snapshot, '$..'), [])
  })
  it('FreeMarker resolves nested HTTP fields, list aliases, assignments and builtin names', () => {
    const snapshot = {
      globals: [{ name: 'Request', kind: 'variable', shape: { schema: root } }],
      languageProjectionHints: { templateMode: 'freemarker' },
    }
    const special = complete(
      buildFreemarkerCompletionItems,
      snapshot,
      '${Request.data.'
    ).find((item) => item.label === 'expires-in')
    assert.equal(special.insertText, '["expires-in"]')
    assert.equal(special.range.startColumn, '${Request.data.'.length)
    assert.deepEqual(
      complete(buildFreemarkerCompletionItems, snapshot, '${Request.data.').map(
        (item) => item.label
      ),
      ['accessToken', 'expires-in']
    )
    assert.deepEqual(
      complete(
        buildFreemarkerCompletionItems,
        snapshot,
        '<#list Request.items as row>\n${row.'
      ).map((item) => item.label),
      ['sku']
    )
    assert.deepEqual(
      complete(
        buildFreemarkerCompletionItems,
        snapshot,
        '<#assign result = Request.data>\n${result.'
      ).map((item) => item.label),
      ['accessToken', 'expires-in']
    )
    assert.deepEqual(
      complete(
        buildFreemarkerCompletionItems,
        snapshot,
        '<#list Request.items as row></#list>\n${row.'
      ).map((item) => item.label),
      []
    )
    assert.deepEqual(
      complete(buildFreemarkerCompletionItems, snapshot, '${Request.data?upper_').map(
        (item) => item.label
      ),
      ['upper_case']
    )
  })
  it('Configuration-only fields expose config keys and allowed values without invocation variables', () => {
    const snapshot = {
      globals: [{ name: 'secretInput' }],
      languageProjectionHints: {
        templateMode: 'config-only',
        configurationKeys: [{ key: 'http.method' }],
        literals: ['GET', 'POST'],
      },
    }
    assert.deepEqual(
      complete(buildTemplateCompletionItems, snapshot, '#{http.').map(
        (item) => item.label
      ),
      ['http.method']
    )
    assert.deepEqual(
      complete(buildTemplateCompletionItems, snapshot, '').map((item) => item.label),
      ['GET', 'POST']
    )
    assert.equal(
      complete(buildTemplateCompletionItems, snapshot, '${').some(
        (item) => item.label === 'secretInput'
      ),
      false
    )
  })
})
