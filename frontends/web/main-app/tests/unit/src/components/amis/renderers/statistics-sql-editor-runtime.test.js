const assert = require('node:assert/strict')
const path = require('node:path')
const {
  clearMirroredSrcModuleCache,
  registerTypescriptRequire,
  requireMirroredSrcModule,
} = require(path.join(process.cwd(), 'tests/unit/helpers/mainAppTestKit'))

registerTypescriptRequire()

function loadUtils() {
  clearMirroredSrcModuleCache(__filename, 'statistics-sql-editor')
  return requireMirroredSrcModule(__filename, './statistics-sql-editor/utils.ts')
}

test('statistics sql editor treats repeated normalized values as no-op changes', () => {
  const { isSqlEditorValueEqual } = loadUtils()

  assert.equal(typeof isSqlEditorValueEqual, 'function')
  assert.equal(
    isSqlEditorValueEqual(
      {
        type: 'sql',
        datasourceName: 'reporting-main',
        datasourceTags: ['warehouse'],
        genericSql: 'select 1',
        variants: [
          {
            variantName: 'mysql-reporting',
            dialect: 'mysql',
            dialectVersionRange: '8.x',
            datasourceTags: ['warehouse'],
            priority: 100,
            sqlText: 'select 1',
          },
        ],
      },
      {
        type: 'sql',
        datasourceName: 'reporting-main',
        datasourceTags: ['warehouse'],
        genericSql: 'select 1',
        variants: [
          {
            variantName: 'mysql-reporting',
            dialect: 'mysql',
            dialectVersionRange: '8.x',
            datasourceTags: ['warehouse'],
            priority: 100,
            sqlText: 'select 1',
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
        datasourceName: 'reporting-main',
        datasourceTags: ['warehouse'],
        genericSql: 'select 1',
        variants: [],
      },
      {
        type: 'sql',
        datasourceName: 'reporting-main',
        datasourceTags: ['warehouse'],
        genericSql: 'select 2',
        variants: [],
      }
    ),
    false
  )
})
