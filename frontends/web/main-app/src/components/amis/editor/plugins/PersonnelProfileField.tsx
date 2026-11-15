import { registerEditorPlugin, BasePlugin, BaseEventContext, RendererScaffoldInfo } from './BasePlugin'

export class PersonnelProfileFieldPlugin extends BasePlugin {
  name = '人员档案字段'
  rendererName = 'personnel-profile-field'
  panelTitle = '人员档案字段'
  panelIcon = 'fa fa-user-circle-o'
  static scene: string[] = ['layout']
  tags = ['表单项', '人员档案']
  
  scaffolds: Partial<RendererScaffoldInfo>[] = [
    {
      name: '人员档案字段',
      icon: 'fa fa-user-circle-o',
      previewSchema: {
        type: 'personnel-profile-field',
        fieldName: 'name',
        label: '姓名'
      },
      scaffold: {
        type: 'personnel-profile-field',
        fieldName: 'name',
        label: '姓名'
      }
    }
  ]

  panelBodyCreator(context: BaseEventContext): any {
    return [
      {
        type: 'input-text',
        name: 'fieldName',
        label: '字段名称',
        placeholder: '例如: mobile, email, idCard',
        required: true,
        description: '人员档案字段的标识符，运行时将展开为实际字段组件',
        value: context.schema.fieldName
      },
      {
        type: 'input-text',
        name: 'label',
        label: '字段标签',
        placeholder: '字段显示标签',
        description: '可选，如不指定则使用字段元数据中的标签',
        value: context.schema.label
      },
      {
        type: 'switch',
        name: 'required',
        label: '必填',
        value: context.schema.required ?? false
      },
      {
        type: 'switch',
        name: 'disabled',
        label: '禁用',
        value: context.schema.disabled ?? false
      },
      {
        type: 'textarea',
        name: 'description',
        label: '描述',
        placeholder: '字段说明文字',
        value: context.schema.description
      }
    ]
  }
}

registerEditorPlugin(PersonnelProfileFieldPlugin)
