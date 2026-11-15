import React from 'react'
import {
  FormItem,
  toast,
  createObject,
  buildApi,
} from 'amis'
// @ts-ignore
import { Responsive, WidthProvider } from 'react-grid-layout'
import { isEqual, uniqueId } from 'lodash'

import type {
  Api,
  SchemaNode,
  FormControlProps,
  Schema,
  RendererProps,
  ListenerAction,
  ActionObject,
} from 'amis'
import {
  createWidgetInstance,
  getWidgetLayoutConfig,
  WidgetDefinition,
  WidgetInstance,
} from './common'
import { WidgetWrapper } from './WidgetEditableWrapper'
import { DashboardEditToolbar } from './DashboardEditToolbar'
import {
  DashboardEmptyStateSurface,
  type DashboardEditablePlaceholderIndicator,
  type DashboardEmptyStateImageConfig,
} from './DashboardEmptyStateSurface'
import { EventBus } from '@/common/eventBus'

// @ts-ignore
import 'react-grid-layout/css/styles.css'
// @ts-ignore
import 'react-resizable/css/styles.css'
// @ts-ignore
import './Dashboard.scss'

const ResponsiveGridLayout = WidthProvider(Responsive)

function resolveDashboardWidgets(value: any, data: any): WidgetInstance[] {
  if (Array.isArray(value?.widgets)) {
    return value.widgets
  }
  if (Array.isArray(data?.widgets)) {
    return data.widgets
  }
  return []
}

export type DashboardProps = FormControlProps & {
  /**
   * 画布尺寸
   */
  size: {
    width: number
    height: number
  }

  /**
   * 画布中的组件定义列表
   */
  widgetDefinitions: WidgetDefinition[]

  editable?: boolean
  allowLoadTemplate?: boolean
  widgetDefinitionsApi?: Api
  listTemplatesApi?: Api
  loadTemplateApi?: Api
  cols?: Record<string, number>
  breakpoints?: Record<string, number>

  placeholder?: SchemaNode
  placeholderImage?: DashboardEmptyStateImageConfig
  editablePlaceholder?: SchemaNode
  editablePlaceholderIndicator?: DashboardEditablePlaceholderIndicator

  embedSchemaTpl?: boolean

  widgetClassName?: any
  widgetWrapperClassName?: any
  widgetFooterClassName?: any
  widgetHeaderClassName?: any
  widgetBodyClassName?: any

  wrapperClassName?: any
  onAction?: RendererProps['onAction']
}

export interface DashboardState {
  widgetDefinitions: WidgetDefinition[]
  isDefinitionsDrawerOpen: boolean
  isEditing: boolean
  widgets: WidgetInstance[]
  categoriesCollapsed: Record<string, boolean>
  rowHeight: number
  droppingItem?: {
    i: string
    w: number
    h: number
  }
}

/**
 * 缓存优化方向：维护组件 name 与 schema 的对应关系。
 */
export class Dashboard extends React.Component<DashboardProps, DashboardState> {
  static defaultProps = {
    editable: true,
    embedSchemaTpl: false,
  }

  private readonly dashboardEditEventName = uniqueId('dashboard.edit.')

  private readonly dashboardComponentName = this.props.name || uniqueId('dashboard.component.')

  constructor(props: DashboardProps) {
    super(props)

    // 初始化示例数据 - 使用新的 WidgetInstance 结构
    this.state = {
      widgetDefinitions: [],
      isEditing: false,
      isDefinitionsDrawerOpen: false,
      categoriesCollapsed: {},
      widgets: resolveDashboardWidgets(props.value, props.data),
      rowHeight: 10,
      droppingItem: undefined,
    }
  }

  componentDidMount() {
    EventBus.subscribe(this.dashboardEditEventName, this.handleEditClick)
    this.loadWidgetDefinitions()
  }

  componentWillUnmount(): void {
    EventBus.unsubscribe(this.dashboardEditEventName, this.handleEditClick)
  }

  componentDidUpdate(
    prevProps: Readonly<DashboardProps>,
    prevState: Readonly<DashboardState>,
    snapshot?: any
  ): void {
    // 当外部 value 变化时更新 widgets
    if (!isEqual(this.props.value, prevProps.value)) {
      this.setState(() => ({
        widgets: resolveDashboardWidgets(this.props.value, this.props.data),
      }))
    }

    // 当 widgetDefinitions 从空变为有数据时，如果当前 widgets 为空但 props.value 有 widgets，则更新
    if (
      prevState.widgetDefinitions.length === 0 &&
      this.state.widgetDefinitions.length > 0 &&
      this.state.widgets.length === 0 &&
      resolveDashboardWidgets(this.props.value, this.props.data).length > 0
    ) {
      this.setState(() => ({
        widgets: resolveDashboardWidgets(this.props.value, this.props.data),
      }))
    }
  }

  // 后续拆分职责时，为渲染而加载和为编辑而加载：
  // 1. 为渲染加载的只需要加载没有 schemaTpl 的 widget 的 definitions
  // 2. 为编辑而加载的则要加载所有的 widget 的 definitions
  async loadWidgetDefinitions() {
    const {
      widgetDefinitionsApi,
      source,
      env: { fetcher },
    } = this.props as any

    if (
      (widgetDefinitionsApi && typeof widgetDefinitionsApi === 'string') ||
      (typeof widgetDefinitionsApi === 'object' && !Array.isArray(widgetDefinitionsApi))
    ) {
      try {
        const result = await fetcher(widgetDefinitionsApi)
        if (result.status === 0) {
          this.setState({ widgetDefinitions: result.data.items ?? result.data }, () => {
            // 加载完定义后，如果 props.value 有 widgets 但 state.widgets 为空，则更新
            if (
              this.state.widgets.length === 0 &&
              resolveDashboardWidgets(this.props.value, this.props.data).length > 0
            ) {
              this.setState({
                widgets: resolveDashboardWidgets(this.props.value, this.props.data),
              })
            }
          })
          return
        } else {
          console.error('Error fetching data')
        }
      } catch (error) {
        console.error('Error fetching data:', error)
      }
    }

    if (source && Array.isArray(source)) {
      this.setState({ widgetDefinitions: source }, () => {
        // 加载完定义后，如果 props.value 有 widgets 但 state.widgets 为空，则更新
        if (
          this.state.widgets.length === 0 &&
          resolveDashboardWidgets(this.props.value, this.props.data).length > 0
        ) {
          this.setState({
            widgets: resolveDashboardWidgets(this.props.value, this.props.data),
          })
        }
      })
      return
    }
  }

  // 更新组件
  handleUpdateWidget(updatedWidget: WidgetInstance) {
    const normalizedWidget = this.normalizeWidgetForOutput(updatedWidget)
    const updatedWidgets = this.state.widgets.map((w) =>
      w.id === normalizedWidget.id ? normalizedWidget : w
    )
    this.setState({ widgets: updatedWidgets })
  }

  // 删除组件
  handleRemoveWidget(widget: WidgetInstance) {
    const newWidgets = this.state.widgets.filter((item) => item.id !== widget.id)
    this.setState({ widgets: newWidgets })
  }

  // 根据 widgetName 获取 WidgetDefinition
  getWidgetDefinition(widgetName: string): WidgetDefinition | undefined {
    return this.state.widgetDefinitions.find((def) => def.name === widgetName)
  }

  // 检查 widget 是否需要加载 definition（即是否有内嵌 schemaTpl）
  widgetNeedsDefinition(widget: WidgetInstance): boolean {
    // 如果 widget 有内嵌的 schemaTpl，则不需要加载 definition
    return !widget.schemaTpl
  }

  // 检查是否有任何 widget 需要 definition 但还没有加载
  hasWidgetsWaitingForDefinitions(): boolean {
    const { widgets, widgetDefinitions } = this.state

    // 如果没有 widgets，返回 false
    if (!widgets || widgets.length === 0) {
      return false
    }

    // 如果 widgetDefinitions 已经加载完成，返回 false
    if (widgetDefinitions && widgetDefinitions.length > 0) {
      return false
    }

    // 检查是否有任何 widget 需要 definition
    return widgets.some((widget) => this.widgetNeedsDefinition(widget))
  }

  // 编辑按钮事件
  handleEditClick = () => {
    this.setState({ isEditing: true })
  }

  doAction = async (
    action: ListenerAction | ActionObject,
    _data: any,
    _throwErrors: boolean = false,
    _args?: any
  ) => {
    if (action.actionType === 'dashboard-edit-mode') {
      this.handleEditClick()
      return
    }
  }

  handlePlaceholderAction = (
    e: any,
    action: ActionObject,
    ctx: object,
    throwErrors?: boolean,
    delegate?: any
  ) => {
    if (action.actionType === 'dashboard-edit-mode') {
      return this.doAction(action, ctx, throwErrors, action.args)
    }

    return this.props.onAction?.(e, action, ctx, throwErrors, delegate)
  }

  // 取消编辑按钮事件
  handleCancelEdit = () => {
    this.setState({ isEditing: false })
  }

  // 保存编辑按钮事件
  handleConfirmEdit = () => {
    this.notifyChange(!!this.props.submitOnChange)
    this.setState({ isEditing: false })
  }

  // 打开组件定义抽屉
  handleOpenDrawer = () => {
    this.setState({ isDefinitionsDrawerOpen: true })
  }

  // 关闭抽屉
  handleCloseDrawer = () => {
    this.setState({ isDefinitionsDrawerOpen: false })
  }

  // 组件列表实现点击标题折叠显隐组件
  toggleCollapse = (key: string) => {
    this.setState((prevState) => ({
      categoriesCollapsed: {
        ...prevState.categoriesCollapsed,
        [key]: prevState.categoriesCollapsed[key] !== true,
      },
    }))
  }

  // 加载模板
  handleLoadTemplate = async (templateId: string) => {
    const {
      loadTemplateApi,
      env: { fetcher },
    } = this.props as any

    if (!loadTemplateApi) {
      toast.error('未配置模板加载接口')
      return
    }

    try {
      // 构建 API 请求
      const apiConfig =
        typeof loadTemplateApi === 'string'
          ? { url: loadTemplateApi, method: 'get' }
          : loadTemplateApi

      // 替换 URL 中的模板 ID 占位符
      const finalData = { id: templateId, value: templateId, key: templateId, templateId }
      const finalApiConfig = buildApi(apiConfig, finalData)

      const result = await fetcher(finalApiConfig, finalData)

      if (result.status === 0 && result.data) {
        const templateData = result.data
        // 更新画布内容
        if (templateData.widgets && Array.isArray(templateData.widgets)) {
          this.setState({ widgets: templateData.widgets })
          toast.success('模板加载成功')
        } else {
          toast.error('模板数据格式错误')
        }
      } else {
        toast.error(result.msg || '加载模板失败')
      }
    } catch (error) {
      console.error('Error loading template:', error)
      toast.error('加载模板失败')
    }
  }

  notifyChange(submit = false) {
    const { value = {} } = this.props
    const { name, onBulkChange, onChange, embedSchemaTpl } = this.props
    const normalizedWidgets = this.state.widgets.map((widget) =>
      this.normalizeWidgetForOutput(widget)
    )
    let nextValue

    if (!embedSchemaTpl) {
      // 不嵌入schemaTpl，直接返回widgets
      nextValue = { ...value, widgets: normalizedWidgets }
    } else {
      // 嵌入schemaTpl，需要从definition获取
      const widgets = normalizedWidgets.map((widget) => {
        const widgetDef = this.getWidgetDefinition(widget.widgetName)
        if (!widgetDef) return widget

        return {
          ...widget,
          config: {
            ...widget.config,
            schema: widgetDef.schemaTpl,
          },
        }
      })
      nextValue = { ...value, widgets }
    }

    if (name && onBulkChange) {
      onBulkChange({
        [name]: nextValue,
        widgets: nextValue.widgets,
      }, submit)
      return
    }

    onChange?.(nextValue, submit, true)
  }

  normalizeWidgetForOutput(widget: WidgetInstance): WidgetInstance {
    const viewName = widget.config?.viewName
    if (typeof viewName !== 'string' || viewName.trim() === '') {
      return widget
    }
    return {
      ...widget,
      viewName: viewName.trim(),
    }
  }

  // 生成唯一标识
  generateUniqueId(name: string) {
    const timestamp = Date.now()
    const uniqueString = `${name}_${timestamp}`
    return uniqueId(uniqueString)
  }

  // 从 react-grid-layout 的 layoutItem 转换为 WidgetInstance
  onDrop(layout: any, layoutItem: any, e: React.DragEvent) {
    const widgetName = e.dataTransfer.getData('widgetName')
    const widgetDef = this.state.widgetDefinitions.find((def) => def.name === widgetName)

    if (!widgetDef) {
      toast.error('未找到组件定义')
      this.setState({ droppingItem: undefined })
      return
    }
    const newWidget: WidgetInstance = createWidgetInstance(widgetDef)

    newWidget.position.x = layoutItem.x
    newWidget.position.y = layoutItem.y

    this.setState({
      widgets: [...this.state.widgets, newWidget],
      droppingItem: undefined,
    })
  }

  onDragStop(layout: any, oldItem: any, layoutItem: any) {
    const newWidgets = this.state.widgets.map((widget) => {
      if (widget.id === layoutItem.i) {
        return {
          ...widget,
          position: {
            x: layoutItem.x,
            y: layoutItem.y,
          },
          size: {
            cols: layoutItem.w,
            rows: layoutItem.h,
          },
        }
      }
      return widget
    })
    this.setState({ widgets: newWidgets })
  }

  onResizeStop(layout: any, oldItem: any, layoutItem: any) {
    const newWidgets = this.state.widgets.map((widget) => {
      if (widget.id === layoutItem.i) {
        return {
          ...widget,
          position: {
            x: layoutItem.x,
            y: layoutItem.y,
          },
          size: {
            cols: layoutItem.w,
            rows: layoutItem.h,
          },
        }
      }
      return widget
    })

    this.setState({ widgets: newWidgets })
  }

  // 拖拽开始时设置placeholder
  handleDragStart = (widgetDef: WidgetDefinition, e: React.DragEvent) => {
    e.dataTransfer?.setData('widgetName', widgetDef.name)

    // 设置拖拽placeholder的默认尺寸
    this.setState({
      droppingItem: {
        i: '__dropping-elem__',
        w: widgetDef.defaultSize.cols,
        h: widgetDef.defaultSize.rows,
      },
    })
  }

  // 拖拽结束时清除placeholder
  handleDragEnd = () => {
    this.setState({ droppingItem: undefined })
  }

  // 渲染单个小组件的内容
  renderWidgetContent(widget: WidgetInstance, widgetDef?: WidgetDefinition) {
    const { isEditing } = this.state
    const {
      render,
      widgetClassName,
      widgetHeaderClassName,
      widgetFooterClassName,
      widgetBodyClassName,
      classnames,
      data,
      ...rest
    } = this.props

    return render(
      'widget-control',
      {
        type: 'widget',
        widget,
        definition: widgetDef,
        className: widgetClassName,
        headerClassName: widgetHeaderClassName,
        footerClassName: widgetFooterClassName,
        bodyClassName: widgetBodyClassName,
      },
      { ...rest, classnames, data }
    )
  }

  // 渲染所有小组件
  renderWidgets() {
    const { isEditing, widgets } = this.state
    const { classnames, widgetWrapperClassName } = this.props

    return widgets.map((widget) => {
      const widgetDef = this.getWidgetDefinition(widget.widgetName)
      const widgetContent = this.renderWidgetContent(widget, widgetDef)
      const layoutConfig = getWidgetLayoutConfig(widget, widgetDef)

      return (
        <div
          key={widget.id}
          data-grid={layoutConfig}
          className={classnames('widget-wrapper', widgetWrapperClassName)}>
          {isEditing ? (
            <WidgetWrapper
              widget={widget}
              definition={widgetDef}
              data={this.props.data}
              onUpdate={this.handleUpdateWidget.bind(this)}
              onRemove={this.handleRemoveWidget.bind(this)}>
              {widgetContent}
            </WidgetWrapper>
          ) : (
            widgetContent
          )}
        </div>
      )
    })
  }

  renderEditButtons() {
    const {
      editable,
      allowLoadTemplate,
      listTemplatesApi,
      loadTemplateApi,
      render,
      classnames,
      translate,
      env,
    } = this.props
    const { isEditing, widgetDefinitions, isDefinitionsDrawerOpen, categoriesCollapsed } =
      this.state

    return (
      <DashboardEditToolbar
        editable={editable ?? true}
        isEditing={isEditing}
        widgetDefinitions={widgetDefinitions}
        isDefinitionsDrawerOpen={isDefinitionsDrawerOpen}
        categoriesCollapsed={categoriesCollapsed}
        allowLoadTemplate={allowLoadTemplate}
        listTemplatesApi={listTemplatesApi}
        loadTemplateApi={loadTemplateApi}
        onEditClick={this.handleEditClick}
        onCancelEdit={this.handleCancelEdit}
        onConfirmEdit={this.handleConfirmEdit}
        onOpenDrawer={this.handleOpenDrawer}
        onCloseDrawer={this.handleCloseDrawer}
        onToggleCollapse={this.toggleCollapse}
        onDragStart={this.handleDragStart}
        onDragEnd={this.handleDragEnd}
        onLoadTemplate={this.handleLoadTemplate}
        render={render}
        classnames={classnames}
        translate={translate}
        env={env}
      />
    )
  }

  renderDashboardContent() {
    const {
      cols,
      breakpoints,
      editable,
      placeholder,
      placeholderImage,
      editablePlaceholder,
      editablePlaceholderIndicator,
      render,
      classnames: cx,
      className,
      data,
    } = this.props
    const { isEditing, widgets, rowHeight, droppingItem, widgetDefinitions } = this.state

    // 如果有 widgets 需要 definition 但还没加载完成，显示加载状态
    // 注意：有内嵌 schemaTpl 的 widget 不需要等待 definition 加载
    if (this.hasWidgetsWaitingForDefinitions()) {
      return (
        <div className={cx('dashboard-grid', 'dashboard-grid--empty', className)}>
          <DashboardEmptyStateSurface
            loading
            render={render}
            placeholderSchema="<空>"
          />
        </div>
      )
    }

    if (!widgets?.length && !isEditing) {
      const placeholderSchema =
        (editable ? (editablePlaceholder ?? placeholder) : placeholder) ?? '<空>'
      const placeholderData = createObject(data, {
        dashboardEditEventName: this.dashboardEditEventName,
        dashboardComponentName: this.dashboardComponentName,
        dashboardEmptyState: true,
      })
      return (
        <div className={cx('dashboard-grid', 'dashboard-grid--empty', className)}>
          <DashboardEmptyStateSurface
            loading={false}
            render={render}
            onAction={this.handlePlaceholderAction}
            placeholderSchema={placeholderSchema}
            placeholderData={placeholderData}
            placeholderImage={placeholderImage}
            indicator={editable ? editablePlaceholderIndicator : undefined}
          />
        </div>
      )
    }

    if (!widgets?.length) {
      return (
        <ResponsiveGridLayout
          className={cx('dashboard-grid', className)}
          cols={cols || { md: 24, xs: 1 }}
          breakpoints={breakpoints || { md: 992, xs: 0 }}
          rowHeight={rowHeight}
          compactType={'vertical'}
          onDrop={this.onDrop.bind(this)}
          onResizeStop={this.onResizeStop.bind(this)}
          onDragStop={this.onDragStop.bind(this)}
          measureBeforeMount={false}
          isDroppable={isEditing}
          droppingItem={droppingItem}
          height={500}
          isResizable={isEditing}
          isDraggable={isEditing}
          draggableHandle=".draggable"
        />
      )
    }

    return (
      <ResponsiveGridLayout
        className={cx('dashboard-grid', className)}
        cols={cols || { md: 24, xs: 1 }}
        breakpoints={breakpoints || { md: 992, xs: 0 }}
        rowHeight={rowHeight}
        compactType={'vertical'}
        onDrop={this.onDrop.bind(this)}
        onResizeStop={this.onResizeStop.bind(this)}
        onDragStop={this.onDragStop.bind(this)}
        measureBeforeMount={false}
        isDroppable={isEditing}
        droppingItem={droppingItem}
        height={500}
        isResizable={isEditing}
        isDraggable={isEditing}
        draggableHandle=".draggable">
        {this.renderWidgets()}
      </ResponsiveGridLayout>
    )
  }

  render() {
    const { wrapperClassName, classnames: cx } = this.props
    return (
      <div className={cx('dashboard-wrapper', wrapperClassName)}>
        {this.renderEditButtons()}
        {this.renderDashboardContent()}
      </div>
    )
  }
}

FormItem({
  type: 'dashboard',
  autoVar: false,
})(Dashboard)
