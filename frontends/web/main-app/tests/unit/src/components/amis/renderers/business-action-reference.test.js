import { expect, test, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
vi.mock('amis', () => ({ FormItem: () => (component) => component }))
import { BusinessActionReference } from 'ouroboros-amis-runtime/renderers/BusinessActionReference'

function setup(overrides = {}) {
  const root = {
    storeType: 'FormStore',
    data: {
      modelType: 'default',
      name: 'Order',
      namespace: 'sales',
      title: '完整草稿',
      future: 1,
    },
    validate: vi.fn().mockResolvedValue(true),
  }
  const row = {
    storeType: 'FormStore',
    data: { ...root.data, name: 'approveButton' },
    parentStore: { storeType: 'ComboStore', parentStore: root },
  }
  const fetcher = vi.fn().mockImplementation(async ({ url }) => ({
    ok: true,
    data: {
      requestId: new URL(url, 'http://localhost').searchParams.get('requestId'),
      catalog: {
        actions: [{ name: 'approve', isEnabled: true }],
        sources: [
          {
            memberType: 'action',
            memberName: 'approve',
            role: 'definition',
            kind: 'contribution',
            source: { resource: 'java:OrderActions', fieldPath: 'approve' },
          },
        ],
      },
      validationSnapshot: { validationErrors: ['另一处草稿诊断'] },
    },
  }))
  const instance = new BusinessActionReference({
    appName: 'example',
    formStore: row,
    value: {
      isEnabled: true,
      url: '/order/approve',
      implementationMode: 'ACTION',
      action: 'unloadedCodeAction',
      future: { keep: true },
    },
    env: { fetcher },
    onChange: vi.fn(),
    classnames: (...values) => values.join(' '),
    ...overrides,
  })
  instance.setState = (patch) => {
    instance.state = { ...instance.state, ...patch }
  }
  return { instance, root, fetcher }
}
const html = (instance) => renderToStaticMarkup(instance.render())

test('nested function selector previews the complete root model, retaining unknown fields and existing code references', async () => {
  const { instance, root, fetcher } = setup()
  await instance.loadActions()
  expect(root.validate).toHaveBeenCalledOnce()
  expect(fetcher.mock.calls[0][0].data).toEqual(root.data)
  expect(fetcher.mock.calls[0][0].data.name).toBe('Order')
  expect(html(instance)).toContain('unloadedCodeAction（来源未核验，保留引用）')
  expect(html(instance)).toContain('另一处草稿诊断')
  expect(instance.props.onChange).not.toHaveBeenCalled()
  instance.setAction('approve')
  expect(instance.props.onChange.mock.lastCall[0]).toEqual({
    ...instance.props.value,
    action: 'approve',
  })
})

test('mode changes write only the function API, and ordinary REST drops its former action reference', () => {
  const { instance } = setup()
  instance.setMode('WEB_API')
  expect(instance.props.onChange.mock.lastCall[0]).toEqual({
    isEnabled: true,
    url: '/order/approve',
    implementationMode: 'WEB_API',
    future: { keep: true },
  })
  expect(instance.props.value.action).toBe('unloadedCodeAction')
  instance.setAction('')
  expect(instance.props.onChange.mock.lastCall[0]).not.toHaveProperty('action')
})

test('invalid JSON prevents preview, and missing root never sends a function row as a model', async () => {
  const { instance, root, fetcher } = setup()
  root.validate.mockResolvedValue(false)
  await instance.loadActions()
  expect(fetcher).not.toHaveBeenCalled()
  expect(html(instance)).toContain('表单存在无效输入')
  instance.props = {
    ...instance.props,
    formStore: { storeType: 'FormStore', data: { name: 'approveButton' } },
  }
  await instance.loadActions()
  expect(fetcher).not.toHaveBeenCalled()
  expect(html(instance)).toContain('未找到业务模型根表单')
})

test('edited drafts and late responses never replace the current directory', async () => {
  let resolve
  const { instance, root } = setup({
    env: {
      fetcher: () =>
        new Promise((done) => {
          resolve = done
        }),
    },
  })
  const pending = instance.loadActions()
  await Promise.resolve()
  root.data = { ...root.data, title: 'new' }
  resolve({
    ok: true,
    data: { requestId: '1', catalog: { actions: [{ name: 'obsolete' }] } },
  })
  await pending
  expect(instance.state.actions).toEqual([])
  const final = setup()
  await final.instance.loadActions()
  final.root.data = { ...final.root.data, title: 'new' }
  expect(html(final.instance)).toContain('动作预览已过期')
  final.instance.props = {
    ...final.instance.props,
    value: { implementationMode: 'ACTION', action: 'approve' },
  }
  expect(html(final.instance)).toContain('java:OrderActions')
})
