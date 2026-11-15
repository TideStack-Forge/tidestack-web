import { createRoot } from 'react-dom/client'
import { render as renderAmis } from 'amis-core'
import 'amis/lib/renderers/Page'
import 'amis/lib/renderers/Tpl'
import 'amis/lib/renderers/Action'
import 'amis-core/lib/renderers/Form'
import 'amis/lib/renderers/Form/Select'
import 'amis/lib/renderers/Form/InputText'
import 'amis/lib/renderers/Service'
import 'amis/lib/renderers/Spinner'
import '@/components/amis/schemaFilter/modalSchemaFilter'
import '@/components/amis/renderers/AmisSchema'
import '@/components/amis/renderers/OuroborosDrawer'
import '@/components/amis/renderers/OuroborosDialog'

const options = new URLSearchParams(location.search)
const kind = options.get('kind') || 'role'
const modalType = options.get('modal') || (kind === 'add' ? 'dialog' : 'drawer')
const field = kind === 'organization' ? 'companys' : 'roles'
const initUrl =
  kind === 'organization' ? '/api/user/test-user/company' : '/api/sys/user/test-user/role'
const sourceUrl =
  kind === 'organization' ? '/api/organization/companies' : '/api/sys/role'
const label = kind === 'organization' ? '配置组织' : kind === 'add' ? '新增' : '配置角色'
const requests = []
window.__modalFormHarness = { requests, ready: false }
const form = {
  type: 'form',
  title:
    options.get('title') === 'object'
      ? { type: 'tpl', tpl: '表单 ${userIdentity}' }
      : '表单标题',
  body: [
    ...(kind === 'add'
      ? [{ type: 'input-text', name: 'name', label: '用户名', value: '测试用户' }]
      : []),
    {
      type: 'select',
      name: field,
      label: '选项',
      multiple: true,
      joinValues: false,
      extractValue: true,
      labelField: 'name',
      valueField: 'id',
      source: { url: sourceUrl, method: 'get' },
    },
  ],
  ...(kind === 'add'
    ? {}
    : {
        initApi: {
          url: initUrl,
          method: 'get',
          responseData: { [field]: '${items|pick:id}' },
        },
      }),
  api: {
    url: kind === 'add' ? '/api/sys/user' : initUrl,
    method: kind === 'add' ? 'post' : 'put',
    data: '${' + field + '}',
  },
}
if (options.get('actions') === 'form-empty') form.actions = []
if (options.get('panel') === 'true') form.wrapWithPanel = true
const modal = {
  type: modalType,
  body: [form],
  ...(modalType === 'dialog' ? { lazyRender: true } : {}),
}
if (!['implicit', 'object'].includes(options.get('title')))
  modal.title = options.get('title') === 'empty' ? '' : label
if (options.get('actions') === 'empty') modal.actions = []
if (options.get('actions') === 'explicit')
  modal.actions = [{ type: 'submit', label: '确认配置' }]
if (options.get('sync') === 'false') modal.updateActions = false
if (['true', 'delayed'].includes(options.get('async')))
  modal.body = { type: 'service', schemaApi: '/api/form-schema' }
if (options.get('async') === 'reference')
  modal.body = { type: 'amis-schema', schemaId: 'test-form' }
if (options.get('async') === 'lazy') {
  modal.body = { type: 'tpl', tpl: '正在加载' }
  modal.lazySchema = () => Promise.resolve({ body: form })
}
const schema = {
  type: 'page',
  data: { userIdentity: 'test-user' },
  body: [{ type: 'button', label, actionType: modalType, [modalType]: modal }],
}
if (options.get('readonly') === 'true') {
  const freeze = (value) => {
    if (value && typeof value === 'object') {
      Object.values(value).forEach(freeze)
      Object.freeze(value)
    }
  }
  freeze(schema)
}
const env = {
  fetcher: async (api) => {
    requests.push({ url: api.url, method: api.method || 'get', data: api.data })
    const pathname = new URL(api.url, location.origin).pathname
    if (pathname === '/api/ui-schema') return { status: 0, data: form }
    if (pathname === '/api/form-schema') {
      const count = requests.filter((request) =>
        request.url.startsWith('/api/form-schema')
      ).length
      if (options.get('async') === 'delayed' && count === 1)
        return new Promise((resolve) => {
          window.__modalFormHarness.resolveSchema = () =>
            resolve({ data: { status: 0, data: { ...form, title: '迟到标题' } } })
        })
      return { data: { status: 0, data: form } }
    }
    return { data: { status: 0, data: { items: [{ id: 'item-1', name: '选项一' }] } } }
  },
  notify: (level, message) => {
    if (level === 'error') console.error(message)
  },
  alert: () => {},
  confirm: () => Promise.resolve(true),
}
createRoot(document.getElementById('root')).render(renderAmis(schema, {}, env))
window.__modalFormHarness.ready = true
