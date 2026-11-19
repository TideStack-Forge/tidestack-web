import { registerEditorPlugin, BasePlugin, BaseEventContext, RendererScaffoldInfo } from './BasePlugin'

export class EmployeePickerPlugin extends BasePlugin {
  name = '员工选择器'
  rendererName = 'employee-picker'
  panelTitle = '员工选择器'
  panelIcon = 'fa fa-caret-square-o-down'
  static scene: string[] = ['layout']
  tags = ['表单项']
  scaffolds: Partial<RendererScaffoldInfo>[] = [
    {
      name: '员工选择器',
      icon: 'fa fa-caret-square-o-down',
      previewSchema: {
        type: 'employee-picker',
        label: '员工选择器'
      },
      scaffold: {
        type: 'employee-picker',
        label: '员工选择器'
      }
    }
  ]
  panelBodyCreator(context: BaseEventContext): any {
    return [
      {
        type: 'switch',
        name: 'embed',
        label: '嵌入模式',
        value: false
      },
      {
        type: 'switch',
        name: 'multiple',
        label: '允许多选',
        value: false
      },
      {
        type: 'switch',
        name: 'defaultCurrentEmployee',
        label: '默认当前人员',
        value: false
      },
      {
        type: 'button-group-select',
        name: 'organizationsInputMode',
        label: '限定组织输入方式',
        options: [
          { label: '选择器', value: 'picker' },
          { label: '表达式', value: 'expression' }
        ],
        visible: false,
        value: 'expression',
        size: 'sm'
      },
      {
        type: 'organization-picker',
        name: 'organizations',
        label: '限定组织节点',
        visibleOn: "${organizationsInputMode === 'picker'}",
        multiple: true,
        pickCompany: true,
        pickDepartment: true
      },
      {
        type: 'ae-tplFormulaControl',
        name: 'organizations',
        label: '限定组织节点',
        visibleOn: "${!organizationsInputMode || organizationsInputMode === 'expression'}"
      },
      {
        type: 'button-group-select',
        name: 'disabledEmployeesInputMode',
        label: '不可选人员输入方式',
        options: [
          { label: '选择器', value: 'picker' },
          { label: '表达式', value: 'expression' }
        ],
        visible: false,
        value: 'expression',
        size: 'sm'
      },
      {
        type: 'employee-picker',
        name: 'disabledEmployees',
        label: '不可选人员',
        visibleOn: "${disabledEmployeesInputMode === 'picker'}",
        multiple: true
      },
      {
        type: 'ae-tplFormulaControl',
        name: 'disabledEmployees',
        label: '不可选人员',
        visibleOn: "${!disabledEmployeesInputMode || disabledEmployeesInputMode === 'expression'}"
      }
    ]
  }
}

export class UserPickerPlugin extends BasePlugin {
  name = '用户选择器'
  rendererName = 'user-picker'
  panelTitle = '用户选择器'
  panelIcon = 'fa fa-caret-square-o-down'
  static scene: string[] = ['layout']
  tags = ['表单项']
  scaffolds: Partial<RendererScaffoldInfo>[] = [
    {
      name: '用户选择器',
      icon: 'fa fa-caret-square-o-down',
      previewSchema: {
        type: 'user-picker',
        label: '用户选择器'
      },
      scaffold: {
        type: 'user-picker',
        label: '用户选择器'
      }
    }
  ]
  panelBodyCreator(context: BaseEventContext): any {
    return [
      {
        type: 'switch',
        name: 'embed',
        label: '嵌入模式',
        value: false
      },
      {
        type: 'switch',
        name: 'multiple',
        label: '允许多选',
        value: false
      },
      {
        type: 'button-group-select',
        name: 'organizationsInputMode',
        label: '限定组织输入方式',
        options: [
          { label: '选择器', value: 'picker' },
          { label: '表达式', value: 'expression' }
        ],
        visible: false,
        value: 'expression',
        size: 'sm'
      },
      {
        type: 'organization-picker',
        name: 'organizations',
        label: '限定组织节点',
        visibleOn: "${organizationsInputMode === 'picker'}",
        multiple: true,
        pickCompany: true,
        pickDepartment: true
      },
      {
        type: 'ae-tplFormulaControl',
        name: 'organizations',
        label: '限定组织节点',
        visibleOn: "${!organizationsInputMode || organizationsInputMode === 'expression'}"
      },
      {
        type: 'button-group-select',
        name: 'disabledEmployeesInputMode',
        label: '不可选用户输入方式',
        options: [
          { label: '选择器', value: 'picker' },
          { label: '表达式', value: 'expression' }
        ],
        visible: false,
        value: 'expression',
        size: 'sm'
      },
      {
        type: 'user-picker',
        name: 'disabledEmployees',
        label: '不可选用户',
        visibleOn: "${disabledEmployeesInputMode === 'picker'}",
        multiple: true
      },
      {
        type: 'ae-tplFormulaControl',
        name: 'disabledEmployees',
        label: '不可选用户',
        visibleOn: "${!disabledEmployeesInputMode || disabledEmployeesInputMode === 'expression'}"
      }
    ]
  }
}

registerEditorPlugin(EmployeePickerPlugin)
registerEditorPlugin(UserPickerPlugin)
