const assert = require('node:assert/strict')
const path = require('node:path')
const {
  clearMirroredSrcModuleCache,
  registerTypescriptRequire,
  requireMirroredSrcModule,
} = require(path.join(process.cwd(), 'tests/unit/helpers/mainAppTestKit'))

registerTypescriptRequire()

function loadUtils() {
  clearMirroredSrcModuleCache(__filename, 'dataset-sql-editor')
  return requireMirroredSrcModule(__filename, './dataset-sql-editor/utils.ts')
}

test('statistics sql editor treats repeated normalized values as no-op changes', () => {
  const { isSqlEditorValueEqual } = loadUtils()

  assert.equal(typeof isSqlEditorValueEqual, 'function')
  assert.equal(
    isSqlEditorValueEqual(
      {
        type: 'sql',
        datasource: 'reporting-main',
        sql: 'select 1',
        dialects: [
          {
            dialectName: 'mysql',
            sql: 'select 1',
          },
        ],
      },
      {
        type: 'sql',
        datasource: 'reporting-main',
        sql: 'select 1',
        dialects: [
          {
            dialectName: 'mysql',
            sql: 'select 1',
          },
        ],
      }
    ),
    true
  )
})

test('statistics sql editor detects semantic value changes before marking dirty', () => {
  const { isSqlEditorValueEqual } = loadUtils()

  assert.equal(
    isSqlEditorValueEqual(
      {
        type: 'sql',
        datasource: 'reporting-main',
        sql: 'select 1',
        dialects: [],
      },
      {
        type: 'sql',
        datasource: 'reporting-main',
        sql: 'select 2',
        dialects: [],
      }
    ),
    false
  )
})
