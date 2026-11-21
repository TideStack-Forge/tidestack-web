import { type Schema, type SchemaNode } from 'amis'

/** ========== 基础类型 ========== */

/** 画布中的栅格尺寸 */
export interface GridSize {
  rows: number // 占用的行数
  cols: number // 占用的列数
}

/** 画布中的位置（基于栅格） */
export interface GridPosition {
  x: number // 左上角列索引（0-based）
  y: number // 左上角行索引（0-based）
}

export interface WidgetConfig {
  title?: SchemaNode
  header?: SchemaNode
  showHeader?: boolean
  showFooter?: boolean
  showBorder?: boolean
  border?: WidgetStyleConfig['border']
  showRadius?: boolean
  borderRadius?: WidgetStyleConfig['borderRadius']
  showShadow?: boolean
  boxShadow?: string
  bodyPadding?: string
  backgroundColor?: string
  headerBackgroundColor?: string
  [key: string]: any
}

/** 小组件样式配置 */
export interface WidgetStyleConfig {
  /** 是否显示边框 */
  showBorder?: boolean
  /** 边框配置（字符串或对象格式） */
  border?:
    | string
    | {
        'top-border-width'?: string
        'top-border-style'?: string
        'top-border-color'?: string
        'right-border-width'?: string
        'right-border-style'?: string
        'right-border-color'?: string
        'bottom-border-width'?: string
        'bottom-border-style'?: string
        'bottom-border-color'?: string
        'left-border-width'?: string
        'left-border-style'?: string
        'left-border-color'?: string
      }
  /** 是否显示圆角 */
  showRadius?: boolean
  /** 圆角配置（字符串或对象格式） */
  borderRadius?:
    | string
    | {
        'top-left-border-radius'?: string
        'top-right-border-radius'?: string
        'bottom-left-border-radius'?: string
        'bottom-right-border-radius'?: string
      }
  /** 是否显示投影 */
  showShadow?: boolean
  /** 投影配置 */
  boxShadow?: string
  /** 内容体内边距 */
  bodyPadding?: string
  /** 背景颜色 */
  backgroundColor?: string
  /** 标题背景颜色 */
  headerBackgroundColor?: string

  /** 其他样式 */
  [key: string]: any
}

/** ========== 小组件定义（Definition） ========== */

/**
 * 小组件定义：描述小组件是什么、能做什么、大小限制、配置项等。
 */
export interface WidgetDefinition {
  /** 小组件定义名称（唯一） */
  name: string

  /** 显示用标签/名称 */
  title: string

  /** 描述（可选） */
  description?: string

  /** 分类 */
  category?: string

  allowHeader?: boolean
  allowFooter?: boolean

  /** 尺寸约束 */
  sizeConstraints: {
    min: GridSize // 最小尺寸
    max: GridSize // 最大尺寸
  }

  /** 默认尺寸 */
  defaultSize: GridSize

  /**
   * 基础配置项定义（例如：是否显示标题、背景色等）
   * 用于渲染配置 UI 的 Schema
   */
  defaultConfig?: WidgetConfig

  /**
   * 样式配置项定义（例如：边框、圆角、投影、内容体内边距、背景颜色等）
   */
  defaultStyleConfig?: WidgetStyleConfig

  /**
   * 高级配置项定义（例如：过滤规则、数据源参数等）
   * 也是 UI Schema 格式
   */
  configFormItems?: Schema[]

  thumbSchema?: SchemaNode

  schemaTpl: SchemaNode

  sampleData?: Record<string, any>

  /**
   * 配置对话框大小
   * 可选值：xs, sm, md, lg, xl, full
   * 默认值：md
   */
  configDialogSize?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'full'
}

/** ========== 小组件实例（Instance） ========== */

/**
 * 小组件实例：定义被放到画布上后的具体对象
 */
export interface WidgetInstance {
  /** 实例唯一 ID */
  id: string

  /** 引用的小组件定义名 */
  widgetName: string

  /** 关联的 Chart 名称，作为业务模型持久化合同字段 */
  chartName?: string

  /** 在画布中的位置与尺寸 */
  position: GridPosition

  size: GridSize

  /** 实例的配置（会覆盖 WidgetDefinition 的 defaultConfig） */
  config?: WidgetConfig

  /** 样式配置（独立于业务配置） */
  styleConfig?: WidgetStyleConfig

  schemaTpl?: SchemaNode
}

export function createWidgetInstance(
  widgetDefinition: WidgetDefinition,
  config?: Record<string, any>,
  styleConfig?: WidgetStyleConfig
): WidgetInstance {
  const finalConfig = config ?? widgetDefinition.defaultConfig
  const finalStyleConfig = styleConfig ?? widgetDefinition.defaultStyleConfig
  const instance: WidgetInstance = {
    id: `${widgetDefinition.name}-${Math.random().toString(36).substring(2, 15)}`,
    widgetName: widgetDefinition.name,
    position: { x: 0, y: 0 },
    size: {
      ...widgetDefinition.defaultSize,
    },
    config: { ...finalConfig },
    styleConfig: finalStyleConfig ? { ...finalStyleConfig } : undefined,
  }

  return instance
}

export function createSchema(
  schemaTpl: SchemaNode,
  config: Record<string, any>
): SchemaNode {
  if (!schemaTpl) {
    return schemaTpl
  }
  if (typeof schemaTpl === 'string') {
    if (schemaTpl.trim().startsWith('#{') && schemaTpl.endsWith('}')) {
      const key = schemaTpl.substring(2, schemaTpl.length - 1)
      return config[key.trim()]
    }
    // 替换字符串中的 #{}
    return schemaTpl.replace(/#{(.*?)}/g, (match, key) => {
      return config[key.trim()]
    })
  }
  if (Array.isArray(schemaTpl)) {
    return schemaTpl.map((item) => createSchema(item, config)) as any
  }
  if (typeof schemaTpl === 'object') {
    const newSchema = { ...schemaTpl }
    for (const key in newSchema) {
      if (Object.prototype.hasOwnProperty.call(newSchema, key)) {
        newSchema[key] = createSchema(newSchema[key], config)
      }
    }
    return newSchema
  }
  return schemaTpl
}

export function createWidgetSchema(
  widgetInstance: WidgetInstance,
  widgetDefinition?: WidgetDefinition
): SchemaNode | null {
  const chartName = widgetInstance.config?.chartName ?? widgetInstance.chartName
  if (
    widgetDefinition?.name === 'chart' &&
    (typeof chartName !== 'string' || chartName.trim() === '')
  ) {
    return widgetDefinition.thumbSchema ?? null
  }

  const schemaTpl = widgetInstance.schemaTpl ?? widgetDefinition?.schemaTpl ?? ''
  const config = {
    ...(widgetDefinition?.defaultConfig ?? {}),
    ...(widgetInstance.config ?? {}),
    chartName: widgetInstance.config?.chartName ?? widgetInstance.chartName,
  }
  const schema = createSchema(schemaTpl, config)
  return schema
}

// 将 WidgetInstance 转换为 react-grid-layout 需要的格式
export function getWidgetLayoutConfig(
  widget: WidgetInstance,
  widgetDef?: WidgetDefinition,
  availableCols?: number
) {
  const requestedWidth = widget.size?.cols ?? widgetDef?.defaultSize?.cols ?? 6
  const minimumWidth = widgetDef?.sizeConstraints.min.cols || widget.size.cols || 6
  const maximumWidth = availableCols && availableCols > 0 ? availableCols : undefined
  const requestedMaximumWidth = widgetDef?.sizeConstraints.max.cols || 24
  return {
    i: widget.id,
    x: widget.position?.x ?? 0,
    y: widget.position?.y ?? 0,
    w: maximumWidth ? Math.min(requestedWidth, maximumWidth) : requestedWidth,
    h: widget.size?.rows ?? widgetDef?.defaultSize?.rows ?? 10,
    minW: maximumWidth ? Math.min(minimumWidth, maximumWidth) : minimumWidth,
    minH: widgetDef?.sizeConstraints.min.rows || widget.size.rows || 10,
    maxW: maximumWidth
      ? Math.min(requestedMaximumWidth, maximumWidth)
      : requestedMaximumWidth,
    maxH: widgetDef?.sizeConstraints.max.rows || 24,
  }
}
