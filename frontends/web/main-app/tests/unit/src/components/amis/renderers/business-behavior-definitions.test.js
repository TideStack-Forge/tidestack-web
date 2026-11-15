// @vitest-environment jsdom
import React from 'react'
import { expect, test, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
vi.mock('amis', () => ({ FormItem: () => (component) => component }))
import { BusinessBehaviorDefinitions } from '@/components/amis/renderers/BusinessBehaviorDefinitions'

function control(value, memberType = 'event', extra = {}) {
  const instance = new BusinessBehaviorDefinitions({
    value,
    memberType,
    onChange: vi.fn(),
    render: () => React.createElement('span', null, 'JSON editor'),
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
const html = (instance) => renderToStaticMarkup(instance.render())

test('opening a missing array or a legacy dynamic definition does not materialize defaults', () => {
  const instance = control(undefined)
  expect(html(instance)).toContain('新增自定义事件')
  expect(instance.props.onChange).not.toHaveBeenCalled()
  const legacy = control([
    { name: 'approved', future: { keep: true }, payloadSchema: { type: 'object' } },
  ])
  expect(html(legacy)).toContain('发生说明')
  expect(legacy.props.onChange).not.toHaveBeenCalled()
  legacy.switchMode()
  expect(html(legacy)).toContain('返回表单')
  expect(legacy.props.onChange).not.toHaveBeenCalled()
})

test('editing one action field preserves adjacent definitions, missing flags and unknown binding fields', () => {
  const original = [
    {
      name: 'approve',
      binding: { kind: 'logicflow', flowName: 'sales.Order.approve', future: 1 },
      future: { keep: true },
    },
    { name: 'cancel' },
  ]
  const instance = control(original, 'action')
  instance.change(0, 'binding.flowName', 'sales.Order.approveV2')
  const saved = instance.props.onChange.mock.lastCall[0]
  expect(saved[0]).toEqual({
    ...original[0],
    binding: { ...original[0].binding, flowName: 'sales.Order.approveV2' },
  })
  expect(saved[1]).toBe(original[1])
  expect(saved[0]).not.toHaveProperty('isEnabled')
  expect(original[0].binding.flowName).toBe('sales.Order.approve')
  expect(html(instance)).toContain('自动传入标准动作输入')
})

test('explicit removal preserves unrelated fields, and additions do not invent a schema or an implementation', () => {
  const instance = control([{ name: 'approve', readOnly: true, future: 1 }], 'action')
  instance.change(0, 'readOnly', undefined)
  expect(instance.props.onChange.mock.lastCall[0]).toEqual([
    { name: 'approve', future: 1 },
  ])
  instance.add()
  expect(instance.props.onChange.mock.lastCall[0][1]).toEqual({ name: '' })
  instance.remove(0)
  expect(instance.props.onChange).toHaveBeenLastCalledWith([])
})

test('read-only and malformed values remain inspectable without overwriting the stored definition', () => {
  const readOnly = control([{ name: 'approved' }], 'event', { static: true })
  expect(html(readOnly)).toContain('disabled=""')
  expect(readOnly.props.onChange).not.toHaveBeenCalled()
  const malformed = control('invalid-original')
  expect(html(malformed)).toContain('JSON editor')
  expect(malformed.props.onChange).not.toHaveBeenCalled()
  const subscription = control(
    [
      {
        name: 'notify',
        listenerConfig: { expressionLooking: '${ invalid expression }' },
      },
    ],
    'subscription'
  )
  expect(html(subscription)).toContain('筛选与交付设置')
  expect(subscription.props.onChange).not.toHaveBeenCalled()
})

test('subscription state is edited in the original definition without materializing the enabled default', () => {
  const original = [{ name: 'notify', listenerName: 'noticeListener', future: 1 }]
  const instance = control(original, 'subscription')
  expect(html(instance)).toContain('订阅状态')
  expect(html(instance)).not.toContain('已有待处理交付将阻塞')
  expect(instance.props.onChange).not.toHaveBeenCalled()
  instance.change(0, 'isEnabled', false)
  expect(instance.props.onChange.mock.lastCall[0]).toEqual([
    { ...original[0], isEnabled: false },
  ])
  expect(original[0]).not.toHaveProperty('isEnabled')
  instance.change(0, 'isEnabled', undefined)
  expect(instance.props.onChange.mock.lastCall[0]).toEqual(original)
})

function editing(value, memberType = 'action', extra = {}) {
  const render = vi.fn(() => React.createElement('span'))
  return control(value, memberType, {
    appName: 'demo',
    modelFullName: 'sales.Order',
    render,
    env: { confirm: vi.fn().mockResolvedValue(true), fetcher: vi.fn() },
    onAction: vi.fn(),
    ...extra,
  })
}
function input(instance, region) {
  html(instance)
  const props = instance.props.render.mock.calls.findLast(([name]) => name === region)[2]
  return {
    ...props,
    onChange: (value) => props.onChange(value, {}, { store: { changeValue: vi.fn() } }),
  }
}

test('flow candidates merge saved and projected resources; opening each uses the existing editor route', async () => {
  const instance = editing([{ name: 'approve', binding: { kind: 'logicflow' } }])
  instance.props.env.fetcher
    .mockResolvedValueOnce({ ok: true, data: { items: [{ model: { name: 'saved' } }] } })
    .mockResolvedValueOnce({
      ok: true,
      data: {
        FlowModelMeta: [{ name: 'projected', model: { name: 'projected', nodes: [] } }],
      },
    })
  await instance.loadFlows()
  expect(instance.state.flows.map((item) => item.name)).toEqual(['saved', 'projected'])
  input(instance, 'flow-0').onChange({ value: 'saved' })
  expect(instance.props.onChange.mock.lastCall[0][0].binding).toEqual({
    kind: 'logicflow',
    flowName: 'saved',
  })
  instance.openFlow('saved')
  expect(instance.props.onAction.mock.lastCall[1].args.url).toBe(
    '/dev/demo/logicflow-model/saved'
  )
  instance.openFlow('projected')
  expect(instance.props.onAction.mock.lastCall[1].dialog.data.model).toEqual({
    name: 'projected',
    nodes: [],
  })
  instance.openFlow()
  expect(instance.props.onAction.mock.lastCall[1].args.url).toBe(
    '/dev/demo/logicflow-model/add'
  )
})

test('partial flow lookup failure keeps usable candidates and failed reads do not write metadata', async () => {
  const instance = editing([{ name: 'approve' }])
  instance.props.env.fetcher
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValueOnce({
      ok: true,
      data: { FlowModelMeta: [{ name: 'projected', model: {} }] },
    })
  await instance.loadFlows()
  expect(instance.state.flowError).toContain('offline')
  expect(instance.state.flows).toHaveLength(1)
  expect(instance.props.onChange).not.toHaveBeenCalled()
  instance.props.env.fetcher.mockResolvedValue({ ok: false, msg: 'denied' })
  await instance.loadFlows()
  expect(instance.state.flowError).toContain('denied')
})

test('late candidate loads cannot replace the newer result or update an unmounted editor', async () => {
  const instance = editing([{ name: 'approve' }])
  let finish
  const first = new Promise((resolve) => {
    finish = resolve
  })
  instance.props.env.fetcher
    .mockReturnValueOnce(first)
    .mockReturnValueOnce(first)
    .mockResolvedValue({ ok: true, data: { items: [], FlowModelMeta: [] } })
  const loading = instance.loadFlows()
  await instance.loadFlows()
  finish({
    ok: true,
    data: { items: [{ model: { name: 'obsolete' } }], FlowModelMeta: [] },
  })
  await loading
  expect(instance.state.flows).toEqual([])
  const pending = editing([{ name: 'approve' }])
  pending.props.env.fetcher.mockReturnValue(first)
  const run = pending.loadFlows()
  pending.componentWillUnmount()
  await run
  expect(pending.state.flows).toEqual([])
})

test('external reference lookup uses model behavior maps and preserves manually entered names on failure', async () => {
  const definition = {
    name: 'confirm',
    sourceEventModelFullName: 'external.Payment',
    sourceEventName: 'paid',
  }
  const instance = editing([definition], 'subscription')
  instance.props.env.fetcher.mockResolvedValue({
    ok: true,
    data: {
      BusinessModelBehavior: [
        {
          name: 'external.Payment',
          model: {
            events: {
              paid: { name: 'paid', subject: 'model', payloadSchema: { type: 'object' } },
            },
          },
        },
      ],
    },
  })
  await instance.loadReferenceMembers('external.Payment', 'event')
  expect(instance.state.references.event.members[0].name).toBe('paid')
  expect(html(instance)).not.toContain('外部引用待核验')
  instance.props.env.fetcher.mockResolvedValue({ ok: false, msg: 'not visible' })
  await instance.loadReferenceMembers('external.Payment', 'event')
  expect(html(instance)).toContain('not visible')
  expect(html(instance)).toContain('外部引用待核验')
  expect(instance.props.onChange).not.toHaveBeenCalled()
})

test('subject changes require confirmation and never change the payload schema', async () => {
  const definition = {
    name: 'paid',
    subject: 'instance',
    payloadSchema: { type: 'object', properties: { amount: { type: 'number' } } },
  }
  const instance = editing([definition], 'event')
  instance.props.env.confirm.mockResolvedValueOnce(false).mockResolvedValueOnce(true)
  await input(instance, 'choice-0-subject').onChange({ value: 'model' })
  expect(instance.props.onChange).not.toHaveBeenCalled()
  await input(instance, 'choice-0-subject').onChange({ value: 'model' })
  expect(instance.props.onChange.mock.lastCall[0][0]).toEqual({
    ...definition,
    subject: 'model',
  })
})

test('schema edits preserve unknown fields, cancelled destructive edits do not write and complex schema stays in advanced editing', async () => {
  const payloadSchema = {
    type: 'object',
    properties: { note: { type: 'string' } },
    'x-extension': true,
  }
  const instance = editing([{ name: 'paid', payloadSchema }], 'event')
  instance.props.env.confirm.mockResolvedValueOnce(false).mockResolvedValueOnce(true)
  const next = { ...payloadSchema, properties: {} }
  await input(instance, 'schema-0-payloadSchema').onChange({ value: next })
  expect(instance.props.onChange).not.toHaveBeenCalled()
  await input(instance, 'schema-0-payloadSchema').onChange({ value: next })
  expect(instance.props.onChange.mock.lastCall[0][0].payloadSchema).toEqual(next)
  const complex = editing(
    [{ name: 'paid', payloadSchema: { type: 'object', oneOf: [{ required: ['one'] }] } }],
    'event'
  )
  expect(html(complex)).toContain('此数据结构使用高级定义维护')
  expect(complex.props.onChange).not.toHaveBeenCalled()
})

test('schema partitions and emitted event selection write only their original field', async () => {
  const original = {
    name: 'approve',
    binding: { kind: 'logicflow', future: 1 },
    emits: [{ modelFullName: 'external.Payment', eventName: 'paid' }],
  }
  const instance = editing([original], 'action', {
    catalog: { events: [{ name: 'approved' }] },
  })
  const schema = { type: 'object', properties: { id: { type: 'string' } } }
  await input(instance, 'schema-0-inputSchema.properties.params').onChange({
    value: schema,
  })
  expect(
    instance.props.onChange.mock.lastCall[0][0].inputSchema.properties.params
  ).toEqual(schema)
  input(instance, 'emits-0').onChange({ value: ['approved'] })
  expect(instance.props.onChange.mock.lastCall[0][0].emits).toEqual([
    ...original.emits,
    { modelFullName: 'sales.Order', eventName: 'approved' },
  ])
})

test('unfinished nested editors block switching to advanced mode', () => {
  const instance = editing([{ name: 'approve' }])
  instance.jsonEditors.set('schema', { validate: () => '格式错误' })
  instance.switchMode()
  expect(instance.state.advanced).toBe(false)
  expect(instance.state.error).toContain('修正当前 JSON')
})
