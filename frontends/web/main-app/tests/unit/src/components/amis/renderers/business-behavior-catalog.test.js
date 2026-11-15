// @vitest-environment jsdom
import { expect, test, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
vi.mock('amis', () => ({ FormItem: () => (component) => component }))
import { BusinessBehaviorCatalog } from '@/components/amis/renderers/BusinessBehaviorCatalog'

function control(fetcher, overrides = {}) {
  const instance = new BusinessBehaviorCatalog({
    appName: 'demo',
    data: { modelType: 'default', namespace: 'sales', name: 'Order' },
    env: { fetcher },
    onChange: vi.fn(),
    classnames: (...classes) => classes.join(' '),
    onAction: vi.fn().mockResolvedValue(true),
    ...overrides,
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
function catalog(revision = 'rev-1') {
  return {
    modelFullName: 'sales.Order',
    revision,
    sources: [],
    actions: [],
    events: [],
    subscriptions: [],
    conflicts: [],
    mutationEventPlans: {},
  }
}
function response(id, revision = 'rev-1') {
  return {
    ok: true,
    data: {
      requestId: id,
      draftFingerprint: 'fingerprint',
      catalog: catalog(revision),
      validationSnapshot: { validationErrors: [] },
    },
  }
}
function deferred() {
  let resolve
  const promise = new Promise((done) => {
    resolve = done
  })
  return { promise, resolve }
}
const html = (instance) => renderToStaticMarkup(instance.render())

test('generated workflow provenance opens its real definition only within the draft application', () => {
  const instance = control(vi.fn())
  const source = {
    memberType: 'subscription',
    memberName: 'notice',
    role: 'configuration',
    kind: 'generated',
    source: {
      resource: 'approval-workflow-definition:approval/x',
      fieldPath: 'notification.taskCreatedTemplate',
    },
  }
  instance.openSource(source)
  expect(instance.props.onAction).toHaveBeenCalledWith(
    null,
    {
      actionType: 'openOrSwitchTab',
      args: {
        url: '/dev/demo/approval-workflow-definition/approval%2Fx',
        title: '审批流程配置',
      },
    },
    instance.props.data
  )
  instance.props.onAction.mockClear()
  instance.openSource({ ...source, kind: 'contribution' })
  instance.openSource({
    ...source,
    source: { resource: 'https://untrusted.invalid', fieldPath: 'notification' },
  })
  instance.setState({ view: 'published' })
  instance.openSource(source)
  expect(instance.props.onAction).not.toHaveBeenCalled()
})

test('feature effects and action emissions are displayed from published sources and plans', () => {
  const contract = catalog()
  contract.actions = [
    {
      name: 'remove',
      emits: [{ modelFullName: 'sales.Order', eventName: 'recordsDeleted' }],
    },
  ]
  contract.mutationEventPlans = { remove: { eventNames: { DELETE: 'recordsDeleted' } } }
  contract.sources = [
    {
      memberType: 'action',
      memberName: 'remove',
      kind: 'generated',
      role: 'effect',
      source: { resource: 'sales.Order', fieldPath: 'enableArchiveDelete' },
      description: '删除时归档，副本不产生 created',
    },
  ]
  const instance = control(vi.fn())
  instance.setState({
    preview: { ...response('1').data, catalog: contract },
    memberType: 'action',
    selected: contract.actions[0],
  })
  expect(html(instance)).toContain('删除时归档，副本不产生 created')
  expect(html(instance)).toContain('实际写入时的附加效果')
  expect(html(instance)).toContain('实际源写入成功后自动产生')
  instance.openSource(contract.sources[0])
  expect(instance.props.onAction.mock.calls[0][1].args.activeKey).toBe('features')
  expect(instance.props.onChange).not.toHaveBeenCalled()
})

test('event details show reliable workflow producers and conditional local notification rules without inferring delivery', () => {
  const contract = catalog()
  contract.events = [{ name: 'workflowTaskCreated', allowedProducerKinds: ['workflow'] }]
  contract.subscriptions = [
    {
      name: 'notice',
      sourceEventModelFullName: 'sales.Order',
      sourceEventName: 'workflowTaskCreated',
    },
  ]
  contract.sources = [
    {
      memberType: 'event',
      memberName: 'workflowTaskCreated',
      kind: 'generated',
      role: 'producer',
      source: { resource: 'approval-workflow-definition:approval', fieldPath: 'process' },
      description: '经可靠投影产生',
    },
    {
      memberType: 'subscription',
      memberName: 'notice',
      kind: 'generated',
      role: 'configuration',
      source: {
        resource: 'approval-workflow-definition:approval',
        fieldPath: 'notification.taskCreatedTemplate',
      },
      description: '按模板、节点开关与当前资格检查',
    },
  ]
  const instance = control(vi.fn())
  instance.setState({
    preview: { ...response('1').data, catalog: contract },
    selected: contract.events[0],
  })
  const content = html(instance)
  expect(content).toContain('经可靠投影产生')
  expect(content).toContain('notice')
  expect(content).toContain('按模板、节点开关与当前资格检查')
  expect(content).toContain('外部消费者待核验')
  expect(content).not.toContain('实现显式 emit')
  expect(instance.props.onChange).not.toHaveBeenCalled()
})

test('source navigation uses the original model section and never redirects code contributions into dynamic definitions', () => {
  const instance = control(vi.fn())
  const source = {
    memberType: 'action',
    memberName: 'approve',
    role: 'definition',
    kind: 'legacy',
    source: { resource: 'sales.Order', fieldPath: 'custom.approve.api' },
  }
  instance.openSource(source)
  expect(instance.props.onAction).toHaveBeenCalledWith(
    null,
    {
      actionType: 'changeActiveKey',
      componentId: 'business-model-config-tabs',
      args: { activeKey: 'custom' },
    },
    instance.props.data
  )
  instance.props.onAction.mockClear()
  instance.openSource({
    ...source,
    kind: 'contribution',
    source: { resource: 'java:OrderActions', fieldPath: 'actions.approve' },
  })
  instance.openSource({
    ...source,
    source: { resource: 'sales.Other', fieldPath: 'actions.approve' },
  })
  instance.setState({ view: 'published' })
  instance.openSource(source)
  expect(instance.props.onAction).not.toHaveBeenCalled()
})

test('complete form draft is sent without writing derived values to metadata', async () => {
  const data = {
    modelType: 'default',
    namespace: 'sales',
    name: 'Order',
    unknown: { keep: true },
  }
  const fetcher = vi.fn().mockResolvedValue(response('1'))
  const instance = control(fetcher, {
    formStore: { data, validate: vi.fn().mockResolvedValue(true) },
  })
  await instance.loadDraft()
  expect(fetcher.mock.calls[0][0].data).toEqual(data)
  expect(fetcher.mock.calls[0][0].url).toBe(
    '/api/dev/demo/business-model/behavior-preview?requestId=1'
  )
  expect(instance.state.preview.catalog.revision).toBe('rev-1')
  expect(instance.props.onChange).not.toHaveBeenCalled()
  expect(data).not.toHaveProperty('behaviorCatalog')
  expect(data).not.toHaveProperty('requestId')
})

test('late responses cannot replace a newer preview and edited drafts show an expired state', async () => {
  const first = deferred(),
    second = deferred()
  const instance = control(
    vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
  )
  const a = instance.loadDraft(),
    b = instance.loadDraft()
  second.resolve(response('2', 'new'))
  await b
  first.resolve(response('1', 'old'))
  await a
  expect(instance.state.preview.catalog.revision).toBe('new')
  instance.props = {
    ...instance.props,
    data: { ...instance.props.data, title: 'changed' },
  }
  expect(html(instance)).toContain('配置已修改，待检查')
})

test('changing the application while a request is pending discards its response', async () => {
  const pending = deferred(),
    instance = control(vi.fn().mockReturnValue(pending.promise))
  const request = instance.loadDraft()
  instance.props = { ...instance.props, appName: 'other' }
  pending.resolve(response('1'))
  await request
  expect(instance.state.preview).toBeNull()
})

test('invalid editor input cannot preview an apparently valid previous JSON value', async () => {
  const fetcher = vi.fn(),
    instance = control(fetcher, {
      formStore: { data: { name: 'Order' } },
      onAction: vi.fn().mockResolvedValue(false),
    })
  await instance.loadDraft()
  expect(fetcher).not.toHaveBeenCalled()
  expect(instance.state.loading).toBe(false)
  expect(html(instance)).toContain('表单存在无效输入')
})

test('invalid draft diagnostics are distinct from an empty valid catalog', async () => {
  const result = response('1')
  result.data.catalog = null
  result.data.validationSnapshot.validationErrors = ['actions.approve.binding-required']
  const instance = control(vi.fn().mockResolvedValue(result))
  await instance.loadDraft()
  expect(html(instance)).toContain('actions.approve.binding-required')
  expect(html(instance)).not.toContain('没有符合条件的定义')
})

test('published query uses the existing target session and keeps token and snapshot outside the draft', async () => {
  const fetcher = vi.fn().mockResolvedValue({
    ok: true,
    data: {
      view: 'published',
      catalog: catalog('published'),
      consumers: [],
      externalEvents: [],
    },
  })
  const instance = control(fetcher)
  instance.setState({
    view: 'published',
    targetApiBase: '/api/tunnel/session/api',
    targetToken: 'target-token',
  })
  await instance.loadPublished()
  expect(fetcher.mock.calls[0][0]).toEqual({
    method: 'get',
    url: '/api/tunnel/session/api/business-model-behaviors/sales.Order/catalog',
    headers: { Authorization: 'Bearer target-token' },
  })
  expect(instance.state.preview).toBeNull()
  expect(instance.props.onChange).not.toHaveBeenCalled()
  expect(instance.props.data).not.toHaveProperty('targetToken')
  expect(html(instance)).toContain('未与当前草稿合并')
})

test('target denial or disconnection does not erase the independent draft result', async () => {
  const instance = control(vi.fn().mockRejectedValue(new Error('403 Forbidden')))
  instance.setState({
    view: 'published',
    targetApiBase: '/api',
    preview: response('previous').data,
  })
  await instance.loadPublished()
  expect(html(instance)).toContain('403 Forbidden')
  expect(instance.state.preview.requestId).toBe('previous')
  expect(instance.state.published).toBeNull()
})

test('unmounted editors ignore pending completions', async () => {
  const pending = deferred(),
    instance = control(vi.fn().mockReturnValue(pending.promise))
  const request = instance.loadDraft()
  instance.componentWillUnmount()
  pending.resolve(response('1'))
  await request
  expect(instance.state.preview).toBeNull()
})

test('actual mutation plans distinguish automatic production from explicit emits', async () => {
  const result = response('1'),
    contract = result.data.catalog
  contract.events = [{ name: 'recordsCreated', allowedProducerKinds: ['action'] }]
  contract.actions = ['insert', 'custom'].map((name) => ({
    name,
    emits: [{ modelFullName: 'sales.Order', eventName: 'recordsCreated' }],
  }))
  contract.mutationEventPlans = { insert: { eventNames: { INSERT: 'recordsCreated' } } }
  const instance = control(vi.fn().mockResolvedValue(result))
  await instance.loadDraft()
  instance.setState({ selected: contract.events[0] })
  expect(html(instance)).toContain('insert：实际源写入成功后自动产生')
  expect(html(instance)).toContain('custom：实现显式 emit')
  expect(html(instance)).toContain('完整定义')
})

test('conflicts remain visible and disabled production paths do not promise new facts', async () => {
  const result = response('1')
  result.data.catalog.conflicts = ['duplicate-definition:approve']
  result.data.catalog.events = [{ name: 'changed' }]
  result.data.catalog.actions = [
    {
      name: 'update',
      isEnabled: false,
      emits: [{ modelFullName: 'sales.Order', eventName: 'changed' }],
    },
  ]
  result.data.catalog.mutationEventPlans = {
    update: { eventNames: { UPDATE: 'changed' } },
  }
  const instance = control(vi.fn().mockResolvedValue(result))
  await instance.loadDraft()
  instance.setState({ selected: result.data.catalog.events[0] })
  expect(html(instance)).toContain('duplicate-definition:approve')
  expect(html(instance)).toContain('动作已停用，此入口不能产生新事实')
})

test('subscription and event consumer views expose effective enablement without changing metadata', async () => {
  const contract = catalog()
  contract.subscriptions = [{ name: 'notify', isEnabled: false }, { name: 'audit' }]
  contract.events = [{ name: 'changed' }]
  const instance = control(vi.fn())
  instance.setState({
    view: 'published',
    memberType: 'subscription',
    published: {
      catalog: contract,
      externalEvents: [],
      consumers: [
        {
          modelFullName: 'sales.Other',
          subscription: { name: 'notify', sourceEventName: 'changed', isEnabled: false },
          sources: [],
        },
      ],
    },
  })
  expect(html(instance)).toContain('已停用')
  expect(html(instance)).toContain('audit')
  instance.setState({ memberType: 'event', selected: contract.events[0] })
  expect(html(instance)).toContain('sales.Other')
  expect(html(instance)).toContain('已停用')
  expect(instance.props.onChange).not.toHaveBeenCalled()
})

test('automatic checks debounce complete drafts and cancel scheduled work on unmount', async () => {
  vi.useFakeTimers()
  try {
    const fetcher = vi
      .fn()
      .mockImplementation(async ({ url }) =>
        response(new URL(url, 'http://localhost').searchParams.get('requestId'))
      )
    const instance = control(fetcher)
    instance.componentDidMount()
    await vi.advanceTimersByTimeAsync(500)
    expect(fetcher).not.toHaveBeenCalled()
    instance.props.data.title = 'new draft'
    instance.componentDidUpdate()
    await vi.advanceTimersByTimeAsync(500)
    expect(fetcher).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(101)
    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(fetcher.mock.calls[0][0].data.title).toBe('new draft')
    instance.props.data.title = 'next draft'
    instance.componentDidUpdate()
    instance.componentWillUnmount()
    await vi.runAllTimersAsync()
    expect(fetcher).toHaveBeenCalledTimes(1)
  } finally {
    vi.useRealTimers()
  }
})

test('original members remain discoverable after failed resolution without copying resolved definitions', () => {
  const data = {
    namespace: 'sales',
    name: 'Order',
    formatVersion: '2.0',
    events: [{ name: 'original', future: 1 }],
  }
  const formStore = { data, changeValue: vi.fn() }
  const instance = control(vi.fn(), { formStore })
  instance.setState({
    preview: {
      ...response('1').data,
      catalog: null,
      validationSnapshot: { validationErrors: ['bad'] },
    },
  })
  expect(html(instance)).toContain('original')
  instance.addDefinition()
  expect(formStore.changeValue).toHaveBeenCalledWith('events', [
    { name: 'original', future: 1 },
    { name: '', subject: 'model', allowedProducerKinds: ['action'] },
  ])
  expect(data.events).toEqual([{ name: 'original', future: 1 }])
  expect(instance.props.onChange).not.toHaveBeenCalled()
})

test('adding to a legacy model offers explicit upgrade and never rewrites the original model', () => {
  const formStore = {
    data: { name: 'Order', custom: [{ name: 'legacy' }] },
    changeValue: vi.fn(),
  }
  const instance = control(vi.fn(), { formStore })
  instance.addDefinition()
  expect(formStore.changeValue).not.toHaveBeenCalled()
  expect(formStore.data).not.toHaveProperty('formatVersion')
  expect(instance.state.tool).toBe('compatibility')
})
