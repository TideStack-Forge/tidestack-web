import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, expect, test, vi } from 'vitest'
const client = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }))
vi.mock('amis', () => ({ FormItem: () => (component) => component }))
vi.mock('#ouroboros-host/utils/http', () => ({ Client: client }))
const { CompositeViewEditor, apiTargets, bindingProblem, previewFilterNode } =
  await import('../../../../../../src/components/amis/renderers/composite-view/CompositeViewEditor.tsx')
const { ExecutionPolicyEditor } =
  await import('../../../../../../src/components/amis/renderers/composite-view/ExecutionPolicyEditor.tsx')
const policy = { queryTimeoutSeconds: 30, maxPageSize: 1000, maxExportRows: 100000 }
const fields = [{ name: 'id', dataType: 'integer', nullable: false }]
function instance(Component, props = {}) {
  const editor = new Component({
    data: { appName: 'demo', fullName: 'demo.orders', columns: [] },
    render: () => null,
    ...props,
  })
  editor.setState = (update) => {
    editor.state = { ...editor.state, ...update }
  }
  return editor
}
beforeEach(() => {
  client.get.mockReset()
  client.post.mockReset()
})
test('flattens nested required JSON and path targets and excludes headers', () => {
  const targets = apiTargets({
    parameters: [
      { name: 'id', in: 'path', schema: { type: 'integer' } },
      { name: 'token', in: 'header' },
    ],
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['input'],
            properties: {
              input: {
                type: 'object',
                required: ['ids'],
                properties: { ids: { type: 'array', items: { type: 'integer' } } },
              },
              note: { type: 'string' },
            },
          },
        },
      },
    },
  })
  expect(targets.map((target) => [target.name, target.required])).toEqual([
    ['id', true],
    ['input.ids', true],
    ['note', false],
  ])
})
test('reports missing, incompatible and batch bindings from projected fields', () => {
  const scalar = { required: true, schema: { type: 'number' } }
  expect(bindingProblem(scalar, '', 'row', fields)).toBe('缺少必填绑定')
  expect(bindingProblem(scalar, '${ID}', 'row', fields)).toBe('')
  expect(bindingProblem(scalar, 'gone', 'row', fields)).toBe('来源字段已失效')
  expect(bindingProblem(scalar, 'id', 'batch', fields)).toBe('批量字段需要数组参数')
  expect(
    bindingProblem(
      { schema: { type: 'array', items: { type: 'integer' } } },
      'id',
      'batch',
      fields
    )
  ).toBe('')
  expect(bindingProblem({ schema: { type: 'string' } }, 'id', 'row', fields)).toBe(
    '类型不兼容'
  )
  expect(
    bindingProblem(
      { schema: { type: 'array', items: { type: 'object' } } },
      'selectedItems',
      'batch',
      fields
    )
  ).toBe('')
})
test('builds typed range and null preview predicates and omits empty optional values', () => {
  expect(previewFilterNode('id', 'in', '1, 2', 'integer')).toEqual({
    field: 'id',
    op: 'in',
    values: [1, 2],
  })
  expect(previewFilterNode('active', 'eq', 'false', 'boolean')).toEqual({
    field: 'active',
    op: 'eq',
    value: false,
  })
  expect(previewFilterNode('id', 'isNull', '', 'integer')).toEqual({
    field: 'id',
    op: 'isNull',
  })
  expect(previewFilterNode('id', 'eq', '', 'integer')).toBeNull()
})
test('loads contracts from the current app scope and recovers transport errors', async () => {
  const editor = instance(CompositeViewEditor, { appName: '${appName}' })
  client.get
    .mockRejectedValueOnce(new Error('连接失败'))
    .mockResolvedValue({
      data: { code: 0, data: { datasets: [], apis: [], executionPolicy: policy } },
    })
  await editor.load()
  expect(renderToStaticMarkup(editor.render())).toContain('连接失败')
  await editor.load()
  expect(editor.state.error).toBe('')
  expect(editor.state.policy).toEqual(policy)
  expect(client.get.mock.calls[0][0]).toBe('/api/dev/demo/composite-view/contracts')
})
test('ignores contract responses after unmount', async () => {
  let finish
  client.get.mockReturnValue(
    new Promise((resolve) => {
      finish = resolve
    })
  )
  const editor = instance(CompositeViewEditor)
  const pending = editor.load()
  editor.componentWillUnmount()
  const previous = editor.state
  finish({ data: { code: 0, data: { datasets: [{ name: 'late' }] } } })
  await pending
  expect(editor.state).toBe(previous)
})
test('keeps invalid drafts editable and discards stale diagnostics', async () => {
  let finish
  client.post.mockReturnValue(
    new Promise((resolve) => {
      finish = resolve
    })
  )
  const onBulkChange = vi.fn()
  const editor = instance(CompositeViewEditor, { onBulkChange })
  const pending = editor.validateConfiguration()
  editor.change({ columns: [{ field: 'missing' }] })
  finish({ data: { code: 0, data: { diagnostics: ['old diagnostic'] } } })
  await pending
  expect(editor.state.diagnostics).toEqual([])
  expect(onBulkChange).toHaveBeenCalledWith({ columns: [{ field: 'missing' }] })
})
test('sends configured preview operators and consumes DatasetResult pagination', async () => {
  const editor = instance(CompositeViewEditor, {
    data: {
      appName: 'demo',
      datasetName: 'demo.orders',
      columns: [{ field: 'id' }],
      filterConfig: { items: [{ field: 'id', ops: ['in'] }] },
      layoutConfig: { pageSize: 2 },
    },
  })
  editor.state.datasets = [{ name: 'demo.orders', schema: { fields } }]
  editor.state.previewFilters = { id: '1,2' }
  client.post.mockResolvedValue({
    data: { code: 0, data: { rows: [{ id: 1 }], pageInfo: { total: 4 } } },
  })
  await editor.preview(2)
  expect(client.post.mock.calls[0][1].request).toMatchObject({
    page: { pageNo: 2, pageSize: 2 },
    dynamicFilter: {
      filter: { op: 'and', children: [{ field: 'id', op: 'in', values: [1, 2] }] },
    },
  })
  expect(editor.state.preview.pageInfo.total).toBe(4)
})
test('invalidates a late preview after editing', async () => {
  let finish
  client.post.mockReturnValue(
    new Promise((resolve) => {
      finish = resolve
    })
  )
  const editor = instance(CompositeViewEditor)
  const pending = editor.preview()
  editor.change({ title: 'new' })
  finish({ data: { code: 0, data: { rows: [{ id: 1 }] } } })
  await pending
  expect(editor.state.preview).toBeNull()
  expect(editor.state.previewLoading).toBe(false)
})
test('execution limits inherit defaults, reject invalid overrides and recover loading', async () => {
  const editor = instance(ExecutionPolicyEditor)
  expect(editor.validate({})).toBe('执行限制尚未读取')
  client.get
    .mockResolvedValueOnce({ data: { code: 1, msg: '配置不可读' } })
    .mockResolvedValue({ data: { code: 0, data: policy } })
  await editor.load()
  expect(editor.validate()).toBe('配置不可读')
  await editor.load()
  expect(editor.validate({})).toBe('')
  expect(editor.validate({ queryTimeoutSeconds: 15 })).toBe('')
  for (const value of [0, -1, 1.5, 31])
    expect(editor.validate({ queryTimeoutSeconds: value })).not.toBe('')
  expect(renderToStaticMarkup(editor.render())).toContain('100,000')
})
