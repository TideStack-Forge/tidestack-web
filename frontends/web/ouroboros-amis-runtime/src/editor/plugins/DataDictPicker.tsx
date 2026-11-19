import { registerEditorPlugin, BasePlugin, BaseEventContext, RendererScaffoldInfo } from './BasePlugin'

export class DataDictPickerPlugin extends BasePlugin {
  name = '数据字典选择器'
  rendererName = 'data-dict-picker'
  panelTitle = '数据字典'
  panelIcon = 'fa fa-caret-square-o-down'
  static scene: string[] = ['layout']
  tags = ['表单项']
  scaffolds: Partial<RendererScaffoldInfo>[] = [
      {
      name: '数据字典选择器',
      icon: 'fa fa-caret-square-o-down',
      previewSchema: {
        type: 'data-dict-picker',
        label: '数据字典选择器'
      },
      scaffold: {
        type: 'data-dict-picker',
        label: '数据字典选择器'
      }
    }
  ]
  panelBodyCreator(context: BaseEventContext): any {
    return [
      {
        type: 'select',
        name: 'selectorType',
        label: '选择器类型',
        options: [
          {
            label: '树形下拉框',
            value: 'tree-select',
          },
          {
            label: '下拉框',
            value: 'select',
          },
          {
            label: '单选按钮',
            value: 'radios',
          },
          {
            label: '列表选择',
            value: 'list-select',
          },
          {
            label: '按钮组',
            value: 'button-group-select',
          },
        ],
        value: context.schema.selectorType || 'tree-select',
        required: true,
      },
      {
        label: '字典名',
        type: 'input-text',
        name: 'dataDictName',
        required: true,
        valueField: 'name',
        labelField: 'title',
        value: context.schema.dataDictName,
      },
      // {
      //   label: '字典名称',
      //   type: 'select',
      //   name: 'dictName',
      //   searchable: true,
      //   required: true,
      //   valueField: 'name',
      //   labelField: 'title',
      //   source: (this.manager.config as any).dictApi ?? '/api/data-dict',
      // },
    ]
  }
}

registerEditorPlugin(DataDictPickerPlugin)
