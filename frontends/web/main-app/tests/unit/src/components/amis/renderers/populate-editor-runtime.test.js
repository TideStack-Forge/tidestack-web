const assert = require('node:assert/strict')
const path = require('node:path')

const {
  clearMirroredSrcModuleCache,
  registerTypescriptRequire,
  requireMirroredSrcModule,
} = require(path.join(process.cwd(), 'tests/unit/helpers/mainAppTestKit'))

registerTypescriptRequire()

function loadPopulateEditorHelpers() {
  clearMirroredSrcModuleCache(__filename, 'populate-editor')
  return requireMirroredSrcModule(__filename, './populate-editor/populate-editor-helpers.ts')
}

test('populate editor runtime helpers summarize configured nodes', () => {
  const { summarizePopulateNode } = loadPopulateEditorHelpers()

  const summary = summarizePopulateNode({
    id: 'node-1',
    relationName: 'owner',
    options: {
      select: ['id', 'name'],
      where: { status: { $eq: 'enabled' } },
      limit: 10,
    },
    children: [
      {
        id: 'node-1-1',
        relationName: 'role',
        options: {},
        children: [],
      },
    ],
  })

  assert.deepEqual(summary, ['select: 2', 'where: configured', 'limit: 10', 'children: 1'])
})

test('populate editor runtime helpers keep targetModel as the next modelRef', () => {
  const { buildChildPopulateEditorProps } = loadPopulateEditorHelpers()

  const props = buildChildPopulateEditorProps({
    relationName: 'owner',
    targetModel: 'sys.user',
  })

  assert.equal(props.modelRef, 'sys.user')
})
