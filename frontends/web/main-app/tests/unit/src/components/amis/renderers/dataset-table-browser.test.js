import { beforeEach, expect, test, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

const client = vi.hoisted(() => ({ post: vi.fn() }))
vi.mock('amis', () => ({ Renderer: () => (target) => target }))
vi.mock('#ouroboros-host/utils/http', () => ({ Client: client }))

const { default: TableBrowser } =
  await import('../../../../../../src/components/amis/renderers/dataset-sql-editor/DatasetTableBrowser.tsx')

function browser() {
  const instance = new TableBrowser({
    appName: 'crm',
    datasource: 'warehouse',
    testConnection: { kind: 'application' },
  })
  instance.setState = (patch) => {
    instance.state = { ...instance.state, ...patch }
  }
  return instance
}

beforeEach(() => client.post.mockReset())

test('table catalog loads with the selected datasource and searches names and titles', async () => {
  client.post.mockResolvedValue({
    data: {
      code: 0,
      data: {
        items: [
          {
            name: 'sales_order',
            title: '订单',
            source: 'model',
            columns: [{ name: 'order_id', dataType: 'integer' }],
          },
          {
            name: 'customer',
            title: '客户',
            source: 'database',
            columns: [{ name: 'customer_name', dataType: 'string' }],
          },
        ],
        warnings: ['当前为应用模型结构'],
      },
    },
  })
  const instance = browser()
  await instance.loadTables()
  expect(client.post).toHaveBeenCalledWith(
    '/api/dev/crm/dataset/datasource-tables',
    { datasource: 'warehouse', testConnection: { kind: 'application' } },
    { isSilent: true }
  )
  expect(renderToStaticMarkup(instance.render())).toContain('order_id')
  instance.setState({ search: 'CUSTOMER' })
  const customer = renderToStaticMarkup(instance.render())
  expect(customer).toContain('customer_name')
  expect(customer).not.toContain('order_id')
  instance.setState({ search: '订单' })
  expect(renderToStaticMarkup(instance.render())).toContain('order_id')
  instance.setState({ search: 'missing' })
  expect(renderToStaticMarkup(instance.render())).toContain('没有匹配的数据表')
})

test('table browser reports load failures and recovers with an empty catalog', async () => {
  client.post
    .mockRejectedValueOnce(new Error('连接不可用'))
    .mockResolvedValueOnce({ data: { code: 0, data: { items: [], warnings: [] } } })
  const instance = browser()
  expect(renderToStaticMarkup(instance.render())).toContain('正在读取表结构')
  await instance.loadTables()
  expect(renderToStaticMarkup(instance.render())).toContain('连接不可用')
  expect(renderToStaticMarkup(instance.render())).toContain('重试')
  await instance.loadTables()
  expect(renderToStaticMarkup(instance.render())).toContain('暂无可用数据表')
  expect(instance.state.error).toBe('')
})

test('table browser keeps application error messages and ignores responses after disposal', async () => {
  client.post.mockResolvedValueOnce({ data: { code: 1, msg: '无权读取结构' } })
  const instance = browser()
  await instance.loadTables()
  expect(instance.state.error).toBe('无权读取结构')
  let resolve
  client.post.mockReturnValueOnce(
    new Promise((done) => {
      resolve = done
    })
  )
  const pending = instance.loadTables()
  instance.componentWillUnmount()
  const snapshot = instance.state
  resolve({ data: { code: 0, data: { items: [{ name: 'late', columns: [] }] } } })
  await pending
  expect(instance.state).toBe(snapshot)
})
