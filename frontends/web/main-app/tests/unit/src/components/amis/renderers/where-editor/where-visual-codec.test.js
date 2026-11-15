const assert = require('node:assert/strict')
const path = require('node:path')

const {
  clearMirroredSrcModuleCache,
  registerTypescriptRequire,
  requireMirroredSrcModule,
} = require(path.join(process.cwd(), 'tests/unit/helpers/mainAppTestKit'))

registerTypescriptRequire()

function loadWhereVisualCodec() {
  clearMirroredSrcModuleCache(__filename, 'where-editor')
  return requireMirroredSrcModule(__filename, './where-visual-codec.ts')
}

test('where visual codec serializes empty groups to null and keeps stable operator shapes', () => {
  const { deserializeWhereToVisualTree, serializeVisualTreeToWhere } =
    loadWhereVisualCodec()

  const visual = deserializeWhereToVisualTree({
    status: { $eq: 'enabled' },
    createdAt: { $between: ['2026-01-01', '2026-01-31'] },
  })

  assert.equal(visual.conjunction, 'and')
  assert.deepEqual(serializeVisualTreeToWhere({ conjunction: 'and', children: [] }), null)
  assert.deepEqual(serializeVisualTreeToWhere(visual), {
    $and: [
      { status: { $eq: 'enabled' } },
      { createdAt: { $between: ['2026-01-01', '2026-01-31'] } },
    ],
  })
})

test('where visual codec preserves nested conjunction groups canonically', () => {
  const { deserializeWhereToVisualTree, serializeVisualTreeToWhere } =
    loadWhereVisualCodec()

  const visual = deserializeWhereToVisualTree({
    $or: [{ status: { $eq: 'enabled' } }, { age: { $gte: 18 } }],
  })

  assert.equal(visual.conjunction, 'or')
  assert.deepEqual(serializeVisualTreeToWhere(visual), {
    $or: [{ status: { $eq: 'enabled' } }, { age: { $gte: 18 } }],
  })
})

test('where visual codec rejects unsupported operators instead of guessing', () => {
  const { deserializeWhereToVisualTree } = loadWhereVisualCodec()

  assert.throws(
    () => deserializeWhereToVisualTree({ name: { $regex: '^A' } }),
    /unsupported/i
  )
})
