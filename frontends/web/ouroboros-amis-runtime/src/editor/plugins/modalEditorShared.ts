function hasConfiguredValue(value: unknown): boolean {
  return typeof value === 'string'
    ? value.trim().length > 0
    : value !== undefined && value !== null
}

export function isReferencedModalSchema(schema: any): boolean {
  return hasConfiguredValue(schema?.url) || hasConfiguredValue(schema?.schemaId)
}

function readModalSchemaFromRenderer(renderer: any, editorInfo: any) {
  return (
    editorInfo?.schema ||
    renderer?.props?.store?.schema ||
    renderer?.props?.$schema ||
    renderer?.props
  )
}

export function createModalBodyRegionRenderMethodOverride() {
  return (regions: any, insertRegion: any) => {
    return function (this: any, ...args: any[]) {
      const info = this.props?.$$editor
      const dom = this.super(...args)
      const schema = readModalSchemaFromRenderer(this, info)

      if (info && args[1] === 'body' && !isReferencedModalSchema(schema)) {
        return insertRegion(this, dom, regions, info, info.plugin.manager)
      }

      return dom
    }
  }
}

const DIALOG_SIZE_OPTIONS = [
  {
    label: '小',
    value: 'sm',
  },
  {
    label: '中',
    value: 'md',
  },
  {
    label: '大',
    value: 'lg',
  },
  {
    label: '超大',
    value: 'xl',
  },
  {
    label: '铺满',
    value: 'full',
  },
]

export function buildDialogResizePanel() {
  return {
    title: '尺寸调整',
    body: [
      {
        type: 'switch',
        label: '显示预设尺寸切换',
        name: 'sizeSwitchable',
        value: false,
      },
      {
        type: 'select',
        label: '可切换尺寸',
        name: 'sizeOptions',
        multiple: true,
        joinValues: false,
        extractValue: true,
        options: DIALOG_SIZE_OPTIONS,
        visibleOn: 'this.sizeSwitchable',
      },
      {
        type: 'switch',
        label: '允许拖拽调整尺寸',
        name: 'resizable',
        value: false,
      },
    ],
  }
}

export function buildModalReferencePanel() {
  return {
    title: '引用页面',
    body: [
      {
        type: 'input-text',
        label: '页面 URL',
        name: 'url',
        placeholder: '/system-setting/example/detail',
        description: '设置 url 后，弹窗/抽屉内容引用目标页面；内容请在目标页面中维护。',
      },
      {
        type: 'input-text',
        label: 'Schema ID',
        name: 'schemaId',
        placeholder: '/dev/{appName}/example/detail',
        description:
          '设置 schemaId 后，弹窗/抽屉内容引用对应 UI Schema；内容请在对应 Schema 中维护。',
      },
      {
        type: 'switch',
        label: '同步引用页按钮区',
        name: 'updateActions',
        value: true,
        description: '开启后，引用页面可更新当前弹窗/抽屉底部按钮。',
      },
    ],
  }
}

function hasDialogResizePanel(panelBody: unknown): boolean {
  if (Array.isArray(panelBody)) {
    return panelBody.some(hasDialogResizePanel)
  }

  if (!panelBody || typeof panelBody !== 'object') {
    return false
  }

  const node = panelBody as any
  if (node.name === 'sizeSwitchable' || node.name === 'sizeOptions') {
    return true
  }

  return Object.values(node).some((value) => hasDialogResizePanel(value))
}

function hasModalReferencePanel(panelBody: unknown): boolean {
  if (Array.isArray(panelBody)) {
    return panelBody.some(hasModalReferencePanel)
  }

  if (!panelBody || typeof panelBody !== 'object') {
    return false
  }

  const node = panelBody as any
  if (node.name === 'url' || node.name === 'schemaId') {
    return true
  }

  return Object.values(node).some((value) => hasModalReferencePanel(value))
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

export function injectModalReferencePanel(panelBody: any): any {
  if (hasModalReferencePanel(panelBody)) {
    return panelBody
  }

  const tabs = readPanelTabs(panelBody)
  const propertyTab = Array.isArray(tabs) ? tabs[0] : null
  const collapseGroup = findCollapseGroupInTab(propertyTab)

  if (Array.isArray(collapseGroup?.body)) {
    collapseGroup.body.push(buildModalReferencePanel())
  }

  return panelBody
}

export function injectDialogResizePanel(panelBody: any): any {
  if (hasDialogResizePanel(panelBody)) {
    return panelBody
  }

  const tabs = readPanelTabs(panelBody)
  const appearanceTab = Array.isArray(tabs) ? tabs[1] || tabs[0] : null
  const collapseGroup = findCollapseGroupInTab(appearanceTab)

  if (Array.isArray(collapseGroup?.body)) {
    collapseGroup.body.push(buildDialogResizePanel())
  }

  return panelBody
}

export function injectDialogEditorPanels(panelBody: any): any {
  injectModalReferencePanel(panelBody)
  injectDialogResizePanel(panelBody)
  return panelBody
}
