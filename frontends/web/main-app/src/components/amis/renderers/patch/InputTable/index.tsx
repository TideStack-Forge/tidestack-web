import { FormItem } from 'amis'
import { TableControlRenderer } from 'amis/lib/renderers/Form/InputTable'

import { createInputTableRendererAdapter } from './inputTableRendererAdapter'

const InputTableClass = (TableControlRenderer as any)
  .ComposedComponent as typeof TableControlRenderer
const InputTableRendererAdapter = createInputTableRendererAdapter(InputTableClass)

@FormItem({
  type: 'input-table',
  name: 'OuroborosInputTable',
  override: true,
  weight: -200,
})
// 这个补丁扩展 inputTable 的操作列固定与新增/编辑弹层输入能力
export default class OuroborosInputTable extends InputTableRendererAdapter {
  static propsList: Array<string> = Array.from(
    new Set([
      ...(((InputTableClass as any).propsList as string[]) || []),
      'addMode',
      'editMode',
      'lazyRenderAfter',
      'loadingMaxDuration',
      'childrenAddable',
      'showCopyBtn',
      'height',
      'minHeight',
      'maxHeight',
      'overflow',
      'overflowX',
      'overflowY',
      'addFormItems',
      'editFormItems',
      'addDialogProps',
      'editDialogProps',
      'addDrawerProps',
      'editDrawerProps',
      'rowAggregate',
      'arrowRowNavigation',
      'addButtonPosition',
      'operationButtons',
      'addingOperationButtons',
      'editingOperationButtons',
    ])
  )
}
