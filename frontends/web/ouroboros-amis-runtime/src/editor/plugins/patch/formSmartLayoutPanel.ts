type PanelSchema = Record<string, any>

const CRUD_FILTER_PATH_PATTERNS = [
  /\/crud\/filter\/form$/,
  /\/crud2\/filter\/\d\/form$/,
  /\/crud2\/filter\/form$/,
]

function normalizeSchemaArray<T>(value: T | T[] | null | undefined): T[] {
  if (Array.isArray(value)) {
    return value
  }

  return value == null ? [] : [value]
}

export function isCrudFilterFormContext(context: {
  path?: string
  schemaPath?: string
}) {
  return (
    CRUD_FILTER_PATH_PATTERNS.some((pattern) => pattern.test(context.path || '')) ||
    /body\/0\/filter$/.test(context.schemaPath || '')
  )
}

function findLayoutPanel(panelBody: unknown): PanelSchema | null {
  const tabsSchema = normalizeSchemaArray(panelBody).find((item) => {
    const schema = item as PanelSchema | undefined
    return schema && typeof schema === 'object' && schema.type === 'tabs'
  }) as PanelSchema | undefined

  if (!tabsSchema) {
    return null
  }

  const appearanceTab = normalizeSchemaArray(tabsSchema.tabs).find((item) => {
    const schema = item as PanelSchema | undefined
    return schema && typeof schema === 'object' && schema.title === '外观'
  }) as PanelSchema | undefined

  if (!appearanceTab) {
    return null
  }

  const collapseGroup = normalizeSchemaArray(appearanceTab.body).find((item) => {
    const schema = item as PanelSchema | undefined
    return (
      schema &&
      typeof schema === 'object' &&
      schema.type === 'collapse-group'
    )
  }) as PanelSchema | undefined

  if (!collapseGroup) {
    return null
  }

  return (
    normalizeSchemaArray(collapseGroup.body).find((item) => {
      const schema = item as PanelSchema | undefined
      return schema && typeof schema === 'object' && schema.title === '布局'
    }) || null
  )
}

export function injectFormSmartLayoutControl(
  panelBody: unknown,
  controls: PanelSchema[]
) {
  if (!Array.isArray(controls) || !controls.length) {
    return panelBody
  }

  const layoutPanel = findLayoutPanel(panelBody)
  if (!layoutPanel || !Array.isArray(layoutPanel.body)) {
    return panelBody
  }

  if (layoutPanel.body.some((item) => item?.name === 'smartLayout')) {
    return panelBody
  }

  layoutPanel.body.unshift(...controls)
  return panelBody
}
