const assert = require('node:assert/strict')
const path = require('node:path')

const {
  clearMirroredSrcModuleCache,
  registerTypescriptRequire,
  requireMirroredSrcModule,
} = require(path.join(process.cwd(), 'tests/unit/helpers/mainAppTestKit'))

registerTypescriptRequire()

function loadStateModule() {
  clearMirroredSrcModuleCache(__filename, 'where-editor')
  return requireMirroredSrcModule(__filename, './where-editor/where-editor-state.ts')
}

function loadCodecModule() {
  clearMirroredSrcModuleCache(__filename, 'where-editor')
  return requireMirroredSrcModule(__filename, './where-editor/where-visual-codec.ts')
}

test('where editor state resolves supported map values into visual mode', () => {
  const { resolveWhereEditorState, canSwitchWhereValueToVisual } = loadStateModule()
  const { serializeVisualTreeToWhere } = loadCodecModule()

  const state = resolveWhereEditorState({
    status: 'enabled',
    age: { $gte: 18 },
  })

  assert.equal(state.mode, 'visual')
  assert.equal(state.reason, null)
  assert.equal(state.visualValue.conjunction, 'and')
  assert.equal(state.visualValue.children.length, 2)
  assert.deepEqual(serializeVisualTreeToWhere(state.visualValue), {
    $and: [{ status: { $eq: 'enabled' } }, { age: { $gte: 18 } }],
  })
  assert.equal(canSwitchWhereValueToVisual({ status: { $gte: 18 } }), true)
})

test('where editor state preserves unsupported expressions in raw mode', () => {
  const { resolveWhereEditorState, canSwitchWhereValueToVisual } = loadStateModule()

  const listExpression = ['AND', ['=', 'status', 'enabled']]
  const listState = resolveWhereEditorState(listExpression)
  assert.equal(listState.mode, 'raw')
  assert.equal(listState.reason, 'list-expression')
  assert.deepEqual(listState.rawValue, listExpression)
  assert.equal(canSwitchWhereValueToVisual(listExpression), false)

  const unsupportedOperator = { name: { $regex: '^A' } }
  const unsupportedState = resolveWhereEditorState(unsupportedOperator)
  assert.equal(unsupportedState.mode, 'raw')
  assert.equal(unsupportedState.reason, 'unsupported-operator')
  assert.deepEqual(unsupportedState.rawValue, unsupportedOperator)
  assert.equal(canSwitchWhereValueToVisual(unsupportedOperator), false)
})
