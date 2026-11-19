import { createRoot } from 'react-dom/client'
import { render as renderAmis } from 'amis-core'
import 'amis/lib/renderers/Page'
import 'amis/lib/renderers/Tpl'
import 'amis/lib/renderers/Plain'
import 'amis/lib/renderers/Form/Group'
import 'amis/lib/renderers/Action'
import 'amis-core/lib/renderers/Form'
import 'amis/lib/renderers/Form/Select'
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
import 'ouroboros-amis-runtime/schemaFilter/modalSchemaFilter'
import 'ouroboros-amis-runtime/renderers/AmisSchema'
import 'ouroboros-amis-runtime/renderers/OuroborosDrawer'
import 'ouroboros-amis-runtime/renderers/rpc-model-editor/RpcModelEditor'
import add from '../../../../../../../ability/ouroboros-rpc-model/ouroboros-rpc-model-dev/src/main/metadata/dev/{appName}/rpc-model/add.ui-schema.json'
import edit from '../../../../../../../ability/ouroboros-rpc-model/ouroboros-rpc-model-dev/src/main/metadata/dev/{appName}/rpc-model/edit.ui-schema.json'
import list from '../../../../../../../ability/ouroboros-rpc-model/ouroboros-rpc-model-dev/src/main/metadata/dev/{appName}/rpc-model/list.ui-schema.json'
import fields from '../../../../../../../ability/ouroboros-rpc-model/ouroboros-rpc-model-dev/src/main/metadata/dev/{appName}/rpc-model/form-items.ui-schema.json'
import advanced from '../../../../../../../ability/ouroboros-rpc-model/ouroboros-rpc-model-dev/src/main/metadata/dev/{appName}/rpc-model/advanced-setting/edit.ui-schema.json'

const adding = new URLSearchParams(location.search).get('add') === 'true'
const debugging = new URLSearchParams(location.search).get('debug') === 'true'
const drawer = adding
  ? list.schema.headerToolbar[1].drawer
  : list.schema.columns.at(-1).buttons[debugging ? 2 : 1].drawer
const schemas = { add: add.schema, edit: edit.schema, 'form-items': fields.schema }
const env = {
  fetcher: async (api, data) => {
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
      data: { appName: 'demo', name: 'example' },
      body: [
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
