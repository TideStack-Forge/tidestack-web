const assert = require('node:assert/strict')
const path = require('node:path')

const {
  clearMirroredSrcModuleCache,
  registerTypescriptRequire,
  requireMirroredSrcModule,
} = require(path.join(process.cwd(), 'tests/unit/helpers/mainAppTestKit'))

registerTypescriptRequire()

function loadWhereFieldAdapter() {
  clearMirroredSrcModuleCache(__filename, 'where-editor')
  return requireMirroredSrcModule(__filename, './where-field-adapter.ts')
}

test('where field adapter maps normalized field types to the fixed condition-builder matrix', () => {
  const { buildWhereFields } = loadWhereFieldAdapter()

  const fields = buildWhereFields([
    { name: 'name', label: '名称', type: '单行文本' },
    {
      name: 'status',
      label: '状态',
      type: '数据字典',
      options: [{ label: '启用', value: 'enabled' }],
    },
    { name: 'createdAt', label: '创建时间', type: '日期时间' },
    { name: 'age', label: '年龄', type: '整数数字' },
    { name: 'enabled', label: '启用', type: '布尔值' },
    { name: 'fallback', label: '回退字段', type: '神秘类型' },
  ])

  assert.deepEqual(
    fields.map((item) => ({
      name: item.name,
      type: item.type,
      operators: item.operators,
    })),
    [
      {
        name: 'name',
        type: 'text',
        operators: [
          'equal',
          'not_equal',
          'like',
          'not_like',
          'starts_with',
          'ends_with',
          'is_empty',
          'is_not_empty',
        ],
      },
      {
        name: 'status',
        type: 'select',
        operators: [
          'equal',
          'not_equal',
          'select_any_in',
          'select_not_any_in',
          'is_empty',
          'is_not_empty',
        ],
      },
      {
        name: 'createdAt',
        type: 'datetime',
        operators: [
          'equal',
          'not_equal',
          'greater',
          'greater_or_equal',
          'less',
          'less_or_equal',
          'between',
          'not_between',
          'is_empty',
          'is_not_empty',
        ],
      },
      {
        name: 'age',
        type: 'number',
        operators: [
          'equal',
          'not_equal',
          'greater',
          'greater_or_equal',
          'less',
          'less_or_equal',
          'between',
          'not_between',
          'is_empty',
          'is_not_empty',
        ],
      },
      {
        name: 'enabled',
        type: 'boolean',
        operators: ['equal', 'not_equal', 'is_empty', 'is_not_empty'],
      },
      {
        name: 'fallback',
        type: 'text',
        operators: [
          'equal',
          'not_equal',
          'like',
          'not_like',
          'starts_with',
          'ends_with',
          'is_empty',
          'is_not_empty',
        ],
      },
    ]
  )

  assert.deepEqual(fields[1].options, [{ label: '启用', value: 'enabled' }])
})
