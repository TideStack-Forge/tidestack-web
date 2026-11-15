// @vitest-environment jsdom
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, test, vi } from 'vitest'
vi.mock('amis', () => ({ FormItem: () => (component) => component }))
import { BusinessBehaviorMappingEditor } from '@/components/amis/renderers/BusinessBehaviorMappingEditor'

function control(value, extra = {}) {
  const instance = new BusinessBehaviorMappingEditor({
    value,
    partitioned: true,
    onChange: vi.fn(),
    render: () => React.createElement('span'),
    env: { confirm: vi.fn().mockResolvedValue(true) },
    ...extra,
  })
  instance.setState = (patch, callback) => {
    instance.state = {
      ...instance.state,
      ...(typeof patch === 'function' ? patch(instance.state) : patch),
    }
    callback?.()
  }
  return instance
}

test('opening a mapping preserves exact expressions, literals, missing input and unknown tree shapes', () => {
  for (const mapping of [
    undefined,
    {},
    {
      'params.order.id': '${ event.subject.id }',
      'data.amount': 0,
      'data.active': false,
      'data.note': null,
    },
    { params: { id: '$.event.payload.id' }, data: {} },
  ]) {
    const instance = control(mapping)
    const html = renderToStaticMarkup(instance.render())
    expect(html).toContain('动作参数 params')
    expect(instance.props.onChange).not.toHaveBeenCalled()
    expect(instance.validate()).toBe('')
  }
})

test('field edits preserve the other partition and unknown literal values without evaluating EL', () => {
  const input = {
    'params.order.id': '${ event.subject.id }',
    'data.value': { flag: false, extension: [1, null] },
  }
  const instance = control(input)
  instance.update(0, { value: '${ event.payload.orderId }' })
  expect(instance.props.onChange).toHaveBeenLastCalledWith({
    ...input,
    'params.order.id': '${ event.payload.orderId }',
  })
  expect(input['params.order.id']).toBe('${ event.subject.id }')
})

test('duplicate and parent-child target conflicts block writes instead of silently overriding', () => {
  for (const target of [
    'params',
    'params.order',
    'params.order.id',
    'params..id',
    'params.__proto__.polluted',
  ]) {
    const instance = control({ 'params.order.id': '${ event.subject.id }', 'data.id': 1 })
    instance.update(1, { target })
    expect(instance.validate()).not.toBe('')
    expect(instance.props.onChange).not.toHaveBeenCalled()
  }
})

test('cancelled mode change retains both partitions, accepted omission deletes only its own mapping', async () => {
  const input = { 'params.order.id': '${ event.subject.id }', data: '${ event.payload }' }
  const instance = control(input, {
    env: { confirm: vi.fn().mockResolvedValueOnce(false).mockResolvedValue(true) },
  })
  await instance.setMode('params', 'none')
  expect(instance.props.onChange).not.toHaveBeenCalled()
  expect(instance.state.rows).toHaveLength(2)
  await instance.setMode('params', 'none')
  expect(instance.props.onChange).toHaveBeenCalledWith({ data: '${ event.payload }' })
})

test('whole partition is explicit and never implied by a missing mapping', async () => {
  const instance = control(undefined)
  expect(instance.props.onChange).not.toHaveBeenCalled()
  await instance.setMode('data', 'whole')
  expect(instance.props.onChange).toHaveBeenCalledWith({ data: '${ event.payload }' })
  expect(instance.props.onChange.mock.lastCall[0]).not.toHaveProperty('params')
})

test('external advanced changes refresh rows while partial table edits are retained on the same emitted value', () => {
  const instance = control({ 'data.id': 1 })
  const previous = instance.props
  instance.props = { ...instance.props, value: { params: '${ event.payload }' } }
  instance.componentDidUpdate(previous)
  expect(instance.state.rows[0].target).toBe('params')
})

test('invalid target state is reported immediately and clears after correction', () => {
  const instance = control({ 'data.id': 1 }, { onInputStateChange: vi.fn() })
  instance.update(0, { target: 'data.' })
  expect(instance.props.onInputStateChange.mock.lastCall[0]).toContain('完整')
  instance.update(0, { target: 'data.orderId' })
  expect(instance.props.onChange).toHaveBeenCalledWith({ 'data.orderId': 1 })
  expect(instance.props.onInputStateChange.mock.lastCall[0]).toBe('')
})

test('a confirmation cannot overwrite mapping edits made while it was pending', async () => {
  let confirm
  const instance = control(
    { 'data.id': 1 },
    {
      env: {
        confirm: () =>
          new Promise((resolve) => {
            confirm = resolve
          }),
      },
    }
  )
  const pending = instance.setMode('data', 'none')
  instance.update(0, { target: 'data.orderId' })
  confirm(true)
  await pending
  expect(instance.props.onChange).toHaveBeenLastCalledWith({ 'data.orderId': 1 })
})

test('a malformed fixed value in one row cannot be hidden by editing another row', () => {
  const instance = control(
    { 'data.note': {}, 'params.id': 1 },
    { onInputStateChange: vi.fn() }
  )
  instance.literalEditors.set(instance.state.rows[0].id, { validate: () => '固定值无效' })
  instance.update(1, { value: 2 })
  expect(instance.props.onChange).not.toHaveBeenCalled()
  expect(instance.props.onInputStateChange).toHaveBeenLastCalledWith('固定值无效')
})

function find(tree, predicate) {
  if (Array.isArray(tree)) return tree.flatMap((item) => find(item, predicate))
  if (!React.isValidElement(tree)) return []
  return [...(predicate(tree) ? [tree] : []), ...find(tree.props.children, predicate)]
}
function mountedLiteral(value) {
  const parent = control(
    { 'data.value': value },
    { onInputStateChange: vi.fn(), render: vi.fn(() => React.createElement('span')) }
  )
  parent.state.rows[0].kind = 'literal'
  const node = find(
    parent.render(),
    (node) => typeof node.type === 'function' && node.type.name === 'LiteralMappingValue'
  )[0]
  const editor = new node.type(node.props)
  editor.setState = (patch, callback) => {
    editor.state = { ...editor.state, ...patch }
    callback?.()
  }
  node.ref(editor)
  return { parent, editor }
}
function literalType(parent, editor, value) {
  editor.render()
  const call = parent.props.render.mock.calls.findLast(
    ([region]) => region === 'literal-type'
  )
  call[2].onChange({ value })
}
function literalInput(editor, value) {
  find(
    editor.render(),
    (node) => node.props['aria-label'] === '固定值'
  )[0].props.onChange(value)
}

test('fixed text uses official EL quoting, including apostrophes and expression-looking text', () => {
  const { parent, editor } = mountedLiteral('${ event.payload.note }')
  expect(editor.validate()).toBe('请填写固定值。')
  literalInput(editor, "O'Brien ${literal}")
  expect(parent.props.onChange).toHaveBeenLastCalledWith({
    'data.value': "${ 'O''Brien $${literal}' }",
  })
})

test('fixed numeric, boolean, null and JSON values retain their types and invalid edits keep the last valid mapping', () => {
  const { parent, editor } = mountedLiteral(1)
  literalInput(editor, '')
  expect(editor.validate()).not.toBe('')
  expect(parent.props.onChange).not.toHaveBeenCalled()
  literalInput(editor, '12')
  expect(parent.props.onChange).toHaveBeenLastCalledWith({ 'data.value': 12 })
  literalType(parent, editor, 'boolean')
  expect(parent.props.onChange).toHaveBeenLastCalledWith({ 'data.value': true })
  editor.render()
  parent.props.render.mock.calls
    .findLast(([region]) => region === 'literal-boolean')[2]
    .onChange({ value: false })
  expect(parent.props.onChange).toHaveBeenLastCalledWith({ 'data.value': false })
  literalType(parent, editor, 'null')
  expect(parent.props.onChange).toHaveBeenLastCalledWith({ 'data.value': null })
  literalType(parent, editor, 'object')
  literalInput(editor, '{"note":"${literal}","active":false}')
  expect(parent.props.onChange).toHaveBeenLastCalledWith({
    'data.value': { note: "${ '$${literal}' }", active: false },
  })
  literalType(parent, editor, 'array')
  literalInput(editor, '[1,null,"fixed"]')
  expect(parent.props.onChange).toHaveBeenLastCalledWith({
    'data.value': [1, null, "${ 'fixed' }"],
  })
  literalInput(editor, '{}')
  expect(editor.validate()).toContain('类型不一致')
  expect(parent.props.onInputStateChange.mock.lastCall[0]).toContain('类型不一致')
})

test('field choices use the visible event schema and exclude subject ID for a model event', () => {
  const instance = control(
    { 'data.value': '${ event.payload.amount }' },
    {
      eventSubject: 'model',
      eventSchema: {
        properties: {
          amount: { type: 'number' },
          detail: { properties: { code: { type: 'string' } } },
          'unusual-key': { type: 'string' },
        },
      },
      render: vi.fn(() => React.createElement('span')),
    }
  )
  instance.state.rows[0].kind = 'field'
  renderToStaticMarkup(instance.render())
  const field = instance.props.render.mock.calls.findLast(
    ([region]) => region === 'field-0'
  )
  const options = field[1].body[0].options
  expect(options.map((item) => item.label)).toContain('event.payload.detail.code')
  expect(options.map((item) => item.label)).not.toContain('event.subject.id')
  field[2].onChange({ value: '${ event.payload.amount }' })
  expect(instance.props.onChange).not.toHaveBeenCalled()
})

test('advanced mapping preserves unknown roots and explicit empty partitions', () => {
  const instance = control({ future: { keep: true }, data: {} })
  expect(renderToStaticMarkup(instance.render())).toContain('返回映射表')
  const node = find(
    instance.render(),
    (node) =>
      typeof node.type === 'function' && node.type.name === 'JsonDataEditorControl'
  )[0]
  node.props.onChange({ future: { keep: true }, data: {}, params: null })
  expect(instance.props.onChange).toHaveBeenCalledWith({
    future: { keep: true },
    data: {},
    params: null,
  })
})

test('an AMIS cloned echo keeps row identity and literal edit state while an external replacement resets it', () => {
  const instance = control({ 'data.value': 1 })
  instance.update(0, { value: 12 })
  const rows = instance.state.rows
  const previous = instance.props
  instance.props = {
    ...instance.props,
    value: JSON.parse(JSON.stringify(instance.props.onChange.mock.lastCall[0])),
  }
  instance.componentDidUpdate(previous)
  expect(instance.state.rows).toBe(rows)
  const beforeReset = instance.props
  instance.props = { ...instance.props, value: { 'data.value': 15 } }
  instance.componentDidUpdate(beforeReset)
  expect(instance.state.rows[0].value).toBe(15)
  expect(instance.state.rows[0].id).not.toBe(rows[0].id)
})

test('nested expression trees use the advanced value editor and never re-encode existing expressions as fixed text', () => {
  const mapping = {
    data: {
      note: "${ 'fixed' }",
      total: '${ event.payload.amount }',
      flags: [false, null],
    },
  }
  const instance = control(mapping)
  const node = find(
    instance.render(),
    (node) =>
      typeof node.type === 'function' &&
      node.type.name === 'JsonDataEditorControl' &&
      node.props.value === mapping.data
  )[0]
  expect(node).toBeDefined()
  node.props.onChange({ ...mapping.data, total: '${ event.payload.total }' })
  expect(instance.props.onChange).toHaveBeenCalledWith({
    data: { ...mapping.data, total: '${ event.payload.total }' },
  })
})
