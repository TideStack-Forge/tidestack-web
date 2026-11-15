const assert = require('node:assert/strict')
const path = require('node:path')

const {
  clearMirroredSrcModuleCache,
  registerTypescriptRequire,
  requireMirroredSrcModule,
} = require(path.join(process.cwd(), 'tests/unit/helpers/mainAppTestKit'))

registerTypescriptRequire()

function loadWhereModeResolver() {
  clearMirroredSrcModuleCache(__filename, 'where-editor')
  return requireMirroredSrcModule(__filename, './where-mode-resolver.ts')
}

test('where mode resolver sends list expressions directly to raw mode', () => {
  const { resolveWhereEditorMode } = loadWhereModeResolver()
  assert.deepEqual(resolveWhereEditorMode(['AND', ['=', 'status', 'enabled']]), {
    mode: 'raw',
    reason: 'list-expression',
  })
})

test('where mode resolver accepts supported map expressions for visual mode', () => {
  const { resolveWhereEditorMode } = loadWhereModeResolver()
  assert.deepEqual(
    resolveWhereEditorMode({
      $and: [
        { status: { $eq: 'enabled' } },
        { age: { $between: [18, 60] } },
      ],
    }),
    {
      mode: 'visual',
      reason: null,
    }
  )
})

test('where mode resolver falls back to raw mode for unsupported operators', () => {
  const { resolveWhereEditorMode } = loadWhereModeResolver()
  assert.deepEqual(resolveWhereEditorMode({ name: { $regex: '^A' } }), {
    mode: 'raw',
    reason: 'unsupported-operator',
  })
})

test('where mode resolver falls back to raw mode for malformed supported operator shapes', () => {
  const { resolveWhereEditorMode } = loadWhereModeResolver()
  assert.deepEqual(resolveWhereEditorMode({ age: { $between: [18] } }), {
    mode: 'raw',
    reason: 'unsupported-shape',
  })
})

test('where mode resolver treats null as an empty visual tree', () => {
  const { resolveWhereEditorMode } = loadWhereModeResolver()
  assert.deepEqual(resolveWhereEditorMode(null), {
    mode: 'visual',
    reason: null,
  })
})
