import { TableControlPlugin, registerEditorPlugin } from 'amis-editor'

const INPUT_TABLE_EDIT_MODE_OPTIONS = [
  {
    label: '行内',
    value: 'inline',
  },
  {
    label: '弹窗',
    value: 'dialog',
  },
  {
    label: '抽屉',
    value: 'drawer',
  },
]

const INPUT_TABLE_ADD_BUTTON_POSITION_OPTIONS = [
  {
    label: '底部左侧',
    value: 'bottom-left',
  },
  {
    label: '底部右侧',
    value: 'bottom-right',
  },
  {
    label: '顶部左侧',
    value: 'top-left',
  },
  {
    label: '顶部右侧',
    value: 'top-right',
  },
]

const INPUT_TABLE_OPERATION_ACTION_OPTIONS = [
  {
    label: '新增',
    value: 'add',
  },
  {
    label: '新增子项',
    value: 'subAdd',
  },
  {
    label: '复制',
    value: 'copy',
  },
  {
    label: '编辑',
    value: 'edit',
  },
  {
    label: '删除',
    value: 'delete',
  },
  {
    label: '保存',
    value: 'save',
  },
  {
    label: '取消',
    value: 'cancel',
  },
]

const INPUT_TABLE_BUTTON_LEVEL_OPTIONS = [
  {
    label: '链接',
    value: 'link',
  },
  {
    label: '默认',
    value: 'default',
  },
  {
    label: '主要',
    value: 'primary',
  },
  {
    label: '危险',
    value: 'danger',
  },
]

function defaultValue<T>(defaultValue: T) {
  return (value: T | undefined) =>
    value === undefined || value === null ? defaultValue : value
}

function buildStringArrayControl(name: string, label: string, placeholder: string) {
  return {
    type: 'input-array',
    name,
    label,
    items: {
      type: 'input-text',
      placeholder,
    },
  }
}

function buildOperationButtonsControl(name: string, label: string, description: string) {
  return {
    type: 'combo',
    name,
    label,
    description,
    multiple: true,
    addable: true,
    removable: true,
    draggable: true,
    strictMode: false,
    addButtonText: '添加按钮',
    scaffold: {
      type: 'button',
      label: '按钮',
      actionType: 'edit',
      level: 'link',
    },
    items: [
      {
        type: 'input-text',
        name: 'label',
        label: '按钮文字',
      },
      {
        type: 'select',
        name: 'actionType',
        label: '动作',
        options: INPUT_TABLE_OPERATION_ACTION_OPTIONS,
      },
      {
        type: 'select',
        name: 'level',
        label: '样式级别',
        clearable: true,
        options: INPUT_TABLE_BUTTON_LEVEL_OPTIONS,
      },
      {
        type: 'input-text',
        name: 'icon',
        label: '图标',
      },
      {
        type: 'input-text',
        name: 'visibleOn',
        label: '显示条件',
      },
      {
        type: 'input-text',
        name: 'disabledOn',
        label: '禁用条件',
      },
    ],
  }
}

function buildInputTableEnhancementPanel() {
  return {
    title: 'Ouroboros 增强',
    body: [
      {
        type: 'button-group-select',
        name: 'addMode',
        label: '新增形态',
        size: 'sm',
        pipeIn: defaultValue('inline'),
        options: INPUT_TABLE_EDIT_MODE_OPTIONS,
      },
      {
        type: 'button-group-select',
        name: 'editMode',
        label: '编辑形态',
        size: 'sm',
        pipeIn: defaultValue('inline'),
        options: INPUT_TABLE_EDIT_MODE_OPTIONS,
      },
      {
        type: 'button-group-select',
        name: 'addButtonPosition',
        label: '新增按钮位置',
        size: 'sm',
        pipeIn: defaultValue('bottom-left'),
        options: INPUT_TABLE_ADD_BUTTON_POSITION_OPTIONS,
      },
      buildOperationButtonsControl(
        'operationButtons',
        '默认操作按钮',
        '覆盖普通行操作列按钮；不配置时使用 AMIS 原生按钮。'
      ),
      buildOperationButtonsControl(
        'addingOperationButtons',
        '新增态操作按钮',
        '覆盖新增行操作列按钮；不配置时复用默认操作按钮。'
      ),
      buildOperationButtonsControl(
        'editingOperationButtons',
        '编辑态操作按钮',
        '覆盖编辑行操作列按钮；不配置时复用默认操作按钮。'
      ),
      {
        type: 'combo',
        name: 'arrowRowNavigation',
        label: '方向键跨行导航',
        description: '留空不启用；配置后支持上下方向键在同行字段间跨行移动。',
        multiple: false,
        strictMode: false,
        items: [
          buildStringArrayControl(
            'columns',
            '限定字段',
            '字段名；留空表示全部可编辑字段'
          ),
        ],
      },
      {
        type: 'combo',
        name: 'rowAggregate',
        label: '行聚合',
        description: '按来源行汇总数值到目标行，适用于树/引用式明细行。',
        multiple: false,
        strictMode: false,
        items: [
          {
            type: 'input-text',
            name: 'valueField',
            label: '汇总字段',
          },
          buildStringArrayControl('keyPaths', '行键路径', '如 code 或 meta.key'),
          buildStringArrayControl('sourcesPaths', '来源路径', '如 sources'),
          buildStringArrayControl('keyProps', '键属性候选', '如 itemNo、id、code'),
        ],
      },
      {
        type: 'input-number',
        name: 'lazyRenderAfter',
        label: '懒渲染阈值',
        min: 0,
        description: '行数达到阈值后启用表格懒渲染；留空使用默认策略。',
      },
      {
        type: 'input-number',
        name: 'loadingMaxDuration',
        label: '加载最长时长',
        min: 0,
        description: '毫秒。控制懒渲染加载态最长展示时间；留空使用默认策略。',
      },
    ],
  }
}

function hasInputTableEnhancementPanel(panelBody: unknown): boolean {
  if (Array.isArray(panelBody)) {
    return panelBody.some(hasInputTableEnhancementPanel)
  }

  if (!panelBody || typeof panelBody !== 'object') {
    return false
  }

  const node = panelBody as any
  if (node.name === 'addMode' || node.name === 'operationButtons') {
    return true
  }

  return Object.values(node).some((value) => hasInputTableEnhancementPanel(value))
}

function findCollapseGroupInTab(tab: any) {
  if (Array.isArray(tab?.body)) {
    return tab.body.find((item: any) => item?.type === 'collapse-group')
  }

  return tab?.body?.type === 'collapse-group' ? tab.body : null
}

function readPanelTabs(panelBody: any) {
  return Array.isArray(panelBody) ? panelBody[0]?.tabs : panelBody?.tabs
}

export function injectInputTableEnhancementPanel(panelBody: any): any {
  if (hasInputTableEnhancementPanel(panelBody)) {
    return panelBody
  }

  const tabs = readPanelTabs(panelBody)
  const propertyTab = Array.isArray(tabs) ? tabs[0] : null
  const collapseGroup = findCollapseGroupInTab(propertyTab)

  if (Array.isArray(collapseGroup?.body)) {
    collapseGroup.body.push(buildInputTableEnhancementPanel())
  }

  return panelBody
}

export class OuroborosInputTablePlugin extends TableControlPlugin {
  rendererName = 'OuroborosInputTable'
  disabledRendererPlugin = true

  private inheritedPanelBodyCreator: (context: any) => any

  constructor(manager: any) {
    super(manager)
    this.inheritedPanelBodyCreator = this.panelBodyCreator
    this.panelBodyCreator = (context: any): any =>
      injectInputTableEnhancementPanel(this.inheritedPanelBodyCreator.call(this, context))
  }
}

registerEditorPlugin(OuroborosInputTablePlugin)
