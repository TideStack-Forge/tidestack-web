const assert = require('node:assert/strict')
const path = require('node:path')

const {
  clearMirroredSrcModuleCache,
  registerTypescriptRequire,
  requireMirroredSrcModule,
} = require(path.join(process.cwd(), 'tests/unit/helpers/mainAppTestKit'))

registerTypescriptRequire()

function loadPopulateCodec() {
  clearMirroredSrcModuleCache(__filename, 'populate-editor')
  return requireMirroredSrcModule(__filename, './populate-codec.ts')
}

test('populate codec merges duplicate relations and always serializes back to a map', () => {
  const { deserializePopulate, serializePopulate } = loadPopulateCodec()

  const result = deserializePopulate([
    'department',
    { department: { select: ['id'] } },
    { manager: { populate: { role: true } } },
  ])

  assert.equal(result.errors.length, 0)
  assert.deepEqual(serializePopulate(result.nodes), {
    department: { select: ['id'] },
    manager: { populate: { role: true } },
  })
})

test('populate codec normalizes shorthand input and preserves unknown extras', () => {
  const { deserializePopulate, serializePopulate } = loadPopulateCodec()

  const result = deserializePopulate({
    department: '',
    manager: {
      select: 'id, name',
      omit: ['secret'],
      unknown: 1,
      populate: {
        role: ['name'],
      },
    },
  })

  assert.equal(result.errors.length, 0)
  assert.deepEqual(serializePopulate(result.nodes), {
    department: true,
    manager: {
      select: ['id', 'name'],
      unknown: 1,
      populate: {
        role: {
          select: ['name'],
        },
      },
    },
  })
})

test('populate codec reports parse errors instead of silently dropping invalid members', () => {
  const { deserializePopulate } = loadPopulateCodec()

  const result = deserializePopulate(['department', 1, { manager: 1 }])

  assert.equal(result.errors.length, 2)
  assert.equal(result.errors[0].path, 'populate[1]')
  assert.equal(result.errors[1].path, 'populate.manager')
})
