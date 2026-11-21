import { createRoot } from 'react-dom/client'
import { render as renderAmis } from 'amis-core'
import 'amis/lib/renderers/Page'
import 'amis/lib/renderers/Tpl'
import 'amis/lib/renderers/Plain'
import 'amis/lib/renderers/Form/Group'
import 'amis/lib/renderers/Action'
import 'amis-core/lib/renderers/Form'
import 'amis/lib/renderers/Form/Select'
import 'amis/lib/renderers/Form/InputTree'
import 'amis/lib/renderers/Form/Picker'
import 'amis/lib/renderers/CRUD'
import 'amis/lib/renderers/Table/index'
import 'amis/lib/renderers/Mapping'
import 'amis/lib/renderers/Operation'
import 'amis/lib/renderers/Pagination'
import 'amis/lib/renderers/Form/InputText'
import 'amis/lib/renderers/Form/Textarea'
import 'amis/lib/renderers/Form/Switch'
import 'amis/lib/renderers/Form/Hidden'
import 'amis/lib/renderers/Form/InputGroup'
import 'amis/lib/renderers/Form/Combo'
import 'amis/lib/renderers/Form/InputTable'
import 'amis/lib/renderers/Json'
import 'amis/lib/renderers/Wrapper'
import 'amis/lib/renderers/Container'
import 'amis/lib/renderers/Form/FieldSet'
import 'amis/lib/renderers/Form/Static'
import 'amis/lib/renderers/Form/InputNumber'
import '@/components/amis/schemaFilter/modalSchemaFilter'
import '@/components/amis/filters/rpcModelGroups'
import browserStyles from '@/style/components/organisms/rpc-model-browser.css'
import '@/components/amis/renderers/AmisSchema'
import '@/components/amis/renderers/OuroborosDrawer'
import '@/components/amis/renderers/OuroborosDialog'
import '@/components/amis/renderers/rpc-model-editor/RpcModelEditor'
import add from '../../../../../../../ability/ouroboros-rpc-model/ouroboros-rpc-model-dev/src/main/metadata/dev/{appName}/rpc-model/add.ui-schema.json'
import edit from '../../../../../../../ability/ouroboros-rpc-model/ouroboros-rpc-model-dev/src/main/metadata/dev/{appName}/rpc-model/edit.ui-schema.json'
import list from '../../../../../../../ability/ouroboros-rpc-model/ouroboros-rpc-model-dev/src/main/metadata/dev/{appName}/rpc-model/list.ui-schema.json'
import fields from '../../../../../../../ability/ouroboros-rpc-model/ouroboros-rpc-model-dev/src/main/metadata/dev/{appName}/rpc-model/form-items.ui-schema.json'
import advanced from '../../../../../../../ability/ouroboros-rpc-model/ouroboros-rpc-model-dev/src/main/metadata/dev/{appName}/rpc-model/advanced-setting/edit.ui-schema.json'
import runtime from '../../../../../../../ability/ouroboros-rpc-model/ouroboros-rpc-model-runtime/src/main/metadata/system-setting/rpc-runtime-management.ui-schema.json'
import { transpile } from '../../../../../ouroboros-logicflow-editor/src/property-transpiler/transpiler'
import '../../../../../ouroboros-logicflow-editor/src/property-transpiler/transpilers/rpc-model'

const adding = new URLSearchParams(location.search).get('add') === 'true'
const debugging = new URLSearchParams(location.search).get('debug') === 'true'
const view = new URLSearchParams(location.search).get('view')
const grouping = ['groups', 'dev-list', 'runtime-list', 'picker'].includes(view)
const browserStyle = document.createElement('style')
browserStyle.textContent = browserStyles
document.head.appendChild(browserStyle)
const rows = [
  {
    name: 'member',
    modelName: 'member',
    title: '读取成员',
    type: 'OpenAPI',
    group: '钉钉/通讯录',
  },
  {
    name: 'department',
    modelName: 'department',
    title: '读取部门',
    type: 'OpenAPI',
    group: '钉钉/通讯录',
  },
  {
    name: 'message',
    modelName: 'message',
    title: '发送消息',
    type: 'OpenAPI',
    group: '钉钉/消息',
  },
  { name: 'legacy', modelName: 'legacy', title: '旧接口', type: 'OpenAPI', group: null },
]
window.__rpcRows = new URLSearchParams(location.search).has('empty') ? [] : rows
const drawer = adding
  ? list.schema.headerToolbar[1].drawer
  : list.schema.columns.at(-1).buttons[debugging ? 2 : 1].drawer
const schemas = { add: add.schema, edit: edit.schema, 'form-items': fields.schema }
window.__rpcFetches = []
const env = {
  fetcher: async (api, data) => {
    window.__rpcFetches.push(api.url)
    if (api.url.includes('mode=groups'))
      return {
        data: {
          code: 0,
          data: { items: [{ label: '钉钉/通讯录', value: '钉钉/通讯录' }] },
        },
      }
    if (api.url.includes('mode=raw')) {
      const value = api.data?.value || data?.value
      const selected = value ? (Array.isArray(value) ? value : [value]) : null
      return {
        data: {
          code: 0,
          data: {
            items: selected
              ? window.__rpcRows.filter((row) => selected.includes(row.name))
              : window.__rpcRows,
          },
        },
      }
    }
    if (
      api.url.split('?')[0] === '/api/dev/demo/rpc-model' ||
      api.url.split('?')[0] === '/api/sys/rpc-runtime'
    )
      return { data: { code: 0, data: { items: window.__rpcRows } } }
    if (
      api.url.startsWith('/api/ui-schema') &&
      (api.data?.path || data?.path || api.url).includes('advanced-setting')
    )
      return { status: 0, data: advanced.schema }
    if (api.url.startsWith('/api/ui-schema'))
      return {
        status: 0,
        data: schemas[
          (
            api.data?.path ||
            data?.path ||
            new URL(api.url, location.origin).searchParams.get('path')
          )
            .split('/')
            .pop()
        ],
      }
    return { data: { status: 0, data: { items: [] } } }
  },
  notify: () => {},
  alert: () => {},
  confirm: () => Promise.resolve(true),
}
createRoot(document.getElementById('root')).render(
  renderAmis(
    {
      type: 'page',
      data: {
        appName: 'demo',
        name: 'example',
        selectedModel: new URLSearchParams(location.search).get('selected') || '',
      },
      body: grouping
        ? [
            { type: 'container', className: 'dev-models', body: list.schema },
            { type: 'container', className: 'runtime-models', body: runtime.schema },
            {
              type: 'form',
              wrapWithPanel: false,
              actions: [],
              body: [
                transpile({
                  type: 'rpc-model',
                  name: 'selectedModel',
                  label: '选择 RPC 模型',
                }),
                { type: 'static', name: 'selectedModel', label: '实际模型名称' },
              ],
            },
          ].filter(
            (_, index) =>
              view === 'groups' || view === ['dev-list', 'runtime-list', 'picker'][index]
          )
        : [
            {
              type: 'button',
              label: '编辑接口',
              actionType: 'drawer',
              drawer: {
                ...drawer,
                url: undefined,
                body: {
                  ...drawer.body,
                  type: 'amis-schema',
                  schemaId: `/dev/demo/rpc-model/${adding ? 'add' : 'edit'}`,
                },
              },
            },
          ],
    },
    {},
    env
  )
)
