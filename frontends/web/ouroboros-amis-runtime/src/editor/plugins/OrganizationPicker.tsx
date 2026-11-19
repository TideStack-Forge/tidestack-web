import { registerEditorPlugin, BasePlugin, BaseEventContext, RendererScaffoldInfo } from './BasePlugin'

export class OrganizationPicker extends BasePlugin {
  name = '组织架构选择器'
  rendererName = 'organization-picker'
  panelTitle = '组织架构选择器'
  panelIcon = 'fa fa-caret-square-o-down'
  static scene: string[] = ['layout']
  tags = ['表单项']
  scaffolds: Partial<RendererScaffoldInfo>[] = [
    {
      name: '公司选择',
      icon: 'fa fa-caret-square-o-down',
      previewSchema: {
        type: 'organization-picker',
        pickCompany: true,
        pickDepartment: false,
        label: '公司选择'
      },
      scaffold: {
        type: 'organization-picker',
        pickCompany: true,
        label: '公司选择'
      }
    },
    {
      name: '部门选择',
      icon: 'fa fa-caret-square-o-down',
      previewSchema: {
        type: 'organization-picker',
        pickCompany: false,
        pickDepartment: true,
        label: '部门选择'
      },
      scaffold: {
        type: 'organization-picker',
        pickCompany: false,
        pickDepartment: true,
        label: '部门选择'
      }
    }
  ]

  panelBodyCreator(context: BaseEventContext): any {
    return [
      {
        type: 'switch',
        name: 'multiple',
        label: '允许多选',
        value: false
      },
      {
        type: 'switch',
        name: 'showCompany',
        label: '显示公司',
        disabled: true,
        value: true
      },
      {
        type: 'switch',
        name: 'showDepartment',
        label: '显示部门',
        disabledOn: '${showDepartment}',
        value: true
      },
      {
        type: 'switch',
        name: 'pickCompany',
        label: '选择公司',
        value: true,
        disabledOn: '${pickDepartment && !pickCompany}',
        onEvent: {
          change: {
            actions: [
              {
                actionType: 'parallel',
                children: [
                  {
                    actionType: 'setValue',
                    componentName: 'showCompany',
                    args: {
                      value: true
                    }
                  },
                  {
                    actionType: 'setValue',
                    componentName: 'showDepartment',
                    args: {
                      value: '${!value}'
                    }
                  },
                  {
                    actionType: 'setValue',
                    componentName: 'pickDepartment',
                    args: {
                      value: '${!value}'
                    }
                  },
                  {
                    actionType: 'setValue',
                    componentName: 'defaultCurrentCompany',
                    expression: "${!value}",
                    args: {
                      value: false
                    }
                  },
                  {
                    actionType: 'setValue',
                    componentName: 'defaultCurrentDepartment',
                    expression: "${value}",
                    args: {
                      value: false
                    }
                  }
                ]
              }
            ]
          }
        }
      },
      {
        type: 'switch',
        name: 'pickDepartment',
        label: '选择部门',
        value: true,
        disabledOn: '${!pickDepartment && pickCompany}',
        onEvent: {
          change: {
            actions: [
              {
                actionType: 'parallel',
                children: [
                  {
                    actionType: 'setValue',
                    componentName: 'showCompany',
                    args: {
                      value: true
                    }
                  },
                  {
                    actionType: 'setValue',
                    componentName: 'showDepartment',
                    args: {
                      value: '${value}'
                    }
                  },
                  {
                    actionType: 'setValue',
                    componentName: 'pickCompany',
                    args: {
                      value: '${!value}'
                    }
                  },
                  {
                    actionType: 'setValue',
                    componentName: 'defaultCurrentCompany',
                    expression: "${value}",
                    args: {
                      value: false
                    }
                  },
                  {
                    actionType: 'setValue',
                    componentName: 'defaultCurrentDepartment',
                    expression: "${!value}",
                    args: {
                      value: false
                    }
                  }
                ]
              }
            ]
          }
        }
      },
      {
        type: 'switch',
        name: 'hideNodePathLabel',
        label: '只显示叶节点名',
        value: false
      },
      {
        type: 'switch',
        name: 'defaultCurrentCompany',
        label: '默认选择当前用户公司',
        disabledOn: '${!pickCompany}',
      },
      {
        type: 'switch',
        name: 'defaultCurrentDepartment',
        label: '默认选择当前用户部门',
        disabledOn: '${!pickDepartment}',
      },
      {
        type: 'button-group-select',
        name: 'parentNodeInputMode',
        label: '限定上级节点输入方式',
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
        name: 'parentNode',
        label: '限定上级节点',
        visibleOn: "${parentNodeInputMode === 'picker'}",
        multiple: false,
        pickCompany: true,
        pickDepartment: true
      },
      {
        type: 'ae-tplFormulaControl',
        name: 'parentNode',
        label: '限定上级节点',
        visibleOn: "${!parentNodeInputMode || parentNodeInputMode === 'expression'}"
      },
      {
        type: 'button-group-select',
        name: 'disabledOrganizationsInputMode',
        label: '不可选组织输入方式',
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
        name: 'disabledOrganizations',
        label: '不可选组织',
        visibleOn: "${disabledOrganizationsInputMode === 'picker'}",
        multiple: true,
        pickCompany: true,
        pickDepartment: true
      },
      {
        type: 'ae-tplFormulaControl',
        name: 'disabledOrganizations',
        label: '不可选组织',
        visibleOn: "${!disabledOrganizationsInputMode || disabledOrganizationsInputMode === 'expression'}"
      },
      {
        type: 'switch',
        name: 'disableChildOrganizations',
        label: '包含下级组织',
        value: true,
        visibleOn: '${disabledOrganizations}'
      }
    ]
  }
}

registerEditorPlugin(OrganizationPicker)
